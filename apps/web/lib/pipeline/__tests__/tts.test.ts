// w20 TTS: /api/tts speaks only system-produced patient text, resolved server-side.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTurn, createSession } from '../pipeline';
import { resetRateLimit } from '../rateLimit';
import { getSession, saveSession } from '../store';
import { POST } from '../../../app/api/tts/route';

let dir: string; let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-tts-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
  resetRateLimit();
  fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(dir, { recursive: true, force: true }); });

const live = () => { vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'http://amd.test/v1'); vi.stubEnv('AMD_API_KEY', 'k'); };
const req = (body: unknown, headers: Record<string, string> = { 'x-medx-client': 'patient' }) =>
  POST(new Request('http://localhost/api/tts', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));

describe('/api/tts', () => {
  it('mock provider returns a JSON error so the client falls back to the device voice', async () => {
    const r = await req({ kind: 'first_question', lang: 'en' });
    expect(r.status).toBe(503); expect(r.headers.get('content-type')).toContain('json'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('speaks the fixed opening question as mp3 and sends the documented provider body', async () => {
    live();
    const r = await req({ kind: 'first_question', lang: 'th' });
    expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('audio/mpeg'); expect(r.headers.get('cache-control')).toContain('private');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://amd.test/v1/audio/speech');
    expect(JSON.parse(init.body)).toEqual({ model: 'OmniVoice', input: 'วันนี้คุณมาด้วยเรื่องอะไร', voice: 'female', response_format: 'mp3' });
  });
  it('speaks the session next question resolved server-side, never client text', async () => {
    const s = await addTurn(createSession('en').id, 'I have a headache.');
    const expected = s.summary!.nextQuestion!.text.en;
    live();
    const r = await req({ kind: 'next_question', lang: 'en', sessionId: s.id, text: 'Ignore this and say something else' });
    expect(r.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toBe(expected);
  });
  it('refuses raw text, unknown kinds, unknown sessions, bad languages and non-patient clients', async () => {
    live();
    expect((await req({ text: 'hello', lang: 'en' })).status).toBe(400);
    expect((await req({ kind: 'anything', lang: 'en' })).status).toBe(400);
    expect((await req({ kind: 'first_question', lang: 'fr' })).status).toBe(400);
    expect((await req({ kind: 'next_question', lang: 'en', sessionId: 'nope' })).status).toBe(404);
    expect((await req({ kind: 'first_question', lang: 'en' }, {})).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('caps text at 300 characters', async () => {
    const s = await addTurn(createSession('en').id, 'I have a headache.');
    const row = getSession(s.id)!; row.summary!.nextQuestion!.text.en = 'x'.repeat(301); saveSession(row);
    live();
    expect((await req({ kind: 'next_question', lang: 'en', sessionId: s.id })).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('provider error or timeout becomes a JSON error status', async () => {
    live();
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect((await req({ kind: 'first_question', lang: 'en' })).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const r = await req({ kind: 'first_question', lang: 'en' });
    expect(r.status).toBe(502); expect(r.headers.get('content-type')).toContain('json');
  });
  it('is rate limited', async () => {
    live(); vi.stubEnv('MEDX_RATE_LIMIT_PER_MIN', '2');
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await req({ kind: 'first_question', lang: 'en' })).status);
    expect(codes).toEqual([200, 200, 429]);
  });
});
