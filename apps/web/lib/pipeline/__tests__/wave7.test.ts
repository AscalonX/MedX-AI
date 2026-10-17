import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Turn } from '@medx/shared';
import { addTurn, createSession, metrics, review, runTurn } from '../pipeline';
import { redact } from '../redact';
import { verifyDetailed } from '../verify';
import { checkRedFlags } from '../redflags';
import { languageOK } from '../schema';
import { mergePharmacy, pharmacyEntries } from '../pharmacyExtraction';
import { pharmacyReview, validatePharmacyReview } from '../pharmacyReview';
import { chatJSON, type ModelClient } from '../llm';
import { mockJSON } from '../mock';
import { providerInfo } from '../config';
import * as resetRoute from '../../../app/api/demo/reset/route';
import { POST as seed } from '../../../app/api/dev/seed/route';
import { body, OPTIONS } from '../../../app/api/_http';
import { POST as addTurnRoute } from '../../../app/api/sessions/[id]/turns/route';
import { appendAudit, getAudit, getSession, saveSession } from '../store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w7-'));
  vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const turn = (text: string, id = 'T1'): Turn => ({ id, text, role: 'patient', lang: 'en', at: '' });
const reset = (request: Request) => (resetRoute as unknown as { POST: (r: Request) => Promise<Response> }).POST(request);
const request = (token?: string) => new Request('http://localhost:3000/api/demo/reset', { method: 'POST', headers: token ? { 'x-demo-token': token } : {} });

describe('P0-1 redaction cannot hide deterministic flags', () => {
  it.each([
    ['ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก', 'RF-CHEST-01'],
    ['ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก', 'RF-CHEST-01'],
    ['ดิฉันชื่อมาลี หายใจไม่ออก', 'RF-BREATH-01'],
    ['Sono Svenuto stamattina', 'RF-SYNC-01'],
  ])('%s retains %s with stored evidence and zero calls', async (text, ruleId) => {
    const client = vi.fn<ModelClient>();
    const s = await runTurn(createSession('th', { persist: false }), text, { client });
    expect(s.status).toBe('escalated'); expect(client).not.toHaveBeenCalled();
    expect(s.summary!.redFlags.some(f => f.ruleId === ruleId)).toBe(true);
    for (const e of s.summary!.redFlags.flatMap(f => f.evidence)) {
      const t = s.turns.find(t => t.id === e.turnId)!;
      expect(e.start).toBeGreaterThanOrEqual(0); expect(e.end).toBeLessThanOrEqual(t.text.length);
      expect(e.quote === '[redacted]' || t.text.slice(e.start, e.end) === e.quote).toBe(true);
    }
  });
  it('retains bare ชื่อ and clinical Italian prose', () => {
    for (const text of ['จำชื่อยาไม่ได้ ยาละลายลิ่มเลือด', 'Sono Svenuto stamattina']) expect(redact(text).text).toBe(text);
  });
  it('captures a lowercase surname after an explicit name trigger', () => {
    expect(redact('mi chiamo mario rossi').text).toBe('[NAME_1]');
  });
});
describe('P0-2 evidence negation and Unicode', () => {
  it.each([
    ['I am not allergic to penicillin', 'I am allergic to penicillin'],
    ['I take warfarin every day', 'I do not take warfarin every day'],
    ['Non ho dolore al petto', 'Ho dolore al petto'],
    ['I have never had any allergies', 'I have had any allergies'],
    ['Ho dolore senza febbre alta', 'Ho dolore con febbre alta'],
  ])('rejects a changed negation: %s', (quote, text) => { expect(verifyDetailed(quote, [turn(text)])).toBeNull(); });
  it('matches NFD quotes to NFC patient text', () => {
    expect(verifyDetailed('so perché ho', [turn('Non so perché ho la febbre alta')])?.evidence.quote).toBe('so perché ho');
  });
  it.each(['allergies', 'medications', 'pregnancy_status'])('does not tolerate altered %s evidence', async key => {
    const client: ModelClient = async req => ({ data: req.step === 'extract' ? { language_detected: 'en', fields: { [key]: { value_original: 'test', value: { th: 'ทดสอบ', it: 'test', en: 'test' }, certainty: 'high', evidence: [{ turn: 'T1', quote: 'I take warfarin each day' }] } }, noKnownAllergies: { turn: 'T1', quote: 'I take warfarin each day' } } : req.step === 'red_flags' ? { flags: [] } : null, call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: true } });
    const s = await runTurn(createSession('en', { persist: false }), 'I take warfarin every day', { client });
    expect(s.summary!.fields.find(f => f.key === key)!.status).toBe('unsupported');
    expect(s.summary!.noKnownAllergiesEvidence).toEqual([]);
  });
});
it('P1-3 negation stops at every patient turn boundary', () => {
  expect(checkRedFlags(['I am sweating a lot', 'no', 'chest pain'].map((t, i) => turn(t, `T${i}`))).some(f => f.ruleId === 'RF-CHEST-01')).toBe(true);
});
it('P1-4 escalation retains supported fields', async () => {
  const s = await runTurn(createSession('en', { persist: false }), 'I have a headache since yesterday, 6/10. I am 40 years old. No allergies.');
  const next = await runTurn(s, 'now crushing chest pain and sweating');
  expect(next.summary!.fields).toEqual(s.summary!.fields);
});
it.each(['7/10', '45', '38.5 °C', '500 mg'])('P1-5 accepts numeric/units Thai values %s', value => {
  expect(languageOK({ th: value, it: value + ' ', en: value })).toBe(true);
});
it('P1-6 rebuilds unreviewed medicines and deduplicates overlapping evidence', async () => {
  const s = await runTurn(createSession('it', { persist: false }), 'Ho mal di testa. Prendo Tachipirina 1000 la sera.');
  const entries = (nameOriginal: string) => pharmacyEntries({ medications: [{ nameOriginal, dose: null, frequency: null, timing: null, turn: 'T1', quote: 'Tachipirina 1000 la sera' }] }, s);
  const previous = structuredClone(s.summary!);
  const fresh = entries('Tachipirina 1000'); fresh.medications.push(...entries('Tachipirina').medications);
  mergePharmacy(s, fresh, previous);
  expect(s.summary!.medications).toHaveLength(1);
  expect(s.summary!.medAlerts!.some(a => a.ruleId === 'MR-MAXDOSE-01')).toBe(false);
  mergePharmacy(s, { medications: [], allergies: [], noKnownAllergiesEvidence: [] }, structuredClone(s.summary));
  expect(s.summary!.medications).toEqual([]);
});
it('P1-7 pharmacy IDs containing digit runs remain reviewable', () => {
  expect(() => validatePharmacyReview({ reviewerId: 'pharmacist', medActions: [{ medId: 'med-6762937494768adc59b80df4', action: 'verify' }], alertActions: [] })).not.toThrow();
});
describe('P1-8 guarded POST-only demo seed/reset', () => {
  it('does not export a destructive GET', () => { expect(resetRoute).not.toHaveProperty('GET'); });
  it.each([undefined, 'wrong'])('refuses reset and seed token %s without changing the store', async token => {
    vi.stubEnv('DEMO_SEED', '1'); vi.stubEnv('DEMO_TOKEN', 'test-demo-token'); const s = createSession('en');
    expect((await reset(request(token))).status).toBe(403);
    expect((await (seed as unknown as (r: Request) => Promise<Response>)(request(token))).status).toBe(403);
    expect(getSession(s.id)).toBeDefined();
  });
  it('disables endpoints when DEMO_TOKEN is unset', async () => {
    vi.stubEnv('DEMO_SEED', '1'); vi.stubEnv('DEMO_TOKEN', '');
    expect((await reset(request())).status).toBe(404);
  });
});
it('P1-9 allows configured CORS origins and denies unrelated origins', () => {
  vi.stubEnv('ALLOWED_ORIGINS', 'https://mobile.example');
  const options = OPTIONS as (r?: Request) => Response;
  expect(options(new Request('http://localhost:3000', { headers: { Origin: 'https://mobile.example' } })).headers.get('Access-Control-Allow-Origin')).toBe('https://mobile.example');
  expect(options(new Request('http://localhost:3000', { headers: { Origin: 'https://evil.example' } })).headers.has('Access-Control-Allow-Origin')).toBe(false);
});

describe('P2 transport compatibility cache', () => {
  it('steps schema → object → none, caches system fallback, and isolates steps', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'https://w7.invalid/v1'); vi.stubEnv('AMD_API_KEY', 'synthetic'); vi.stubEnv('AMD_MODEL', 'cache-test'); vi.stubEnv('AMD_JSON_SCHEMA', 'true');
    const sent: { response_format?: { type: string }; messages: { role: string }[] }[] = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string); sent.push(payload);
      if (payload.messages[0].role === 'system') return new Response('system role is not supported', { status: 400 });
      if (payload.response_format) return new Response('unsupported response_format', { status: 400 });
      return Response.json({ choices: [{ message: { content: '```json\n{"flags":[]}\n```' } }] });
    });
    vi.stubGlobal('fetch', fetcher);
    const req = { step: 'red_flags' as const, system: 's', user: 'u', schemaName: 'cache' };
    for (let i = 0; i < 3; i++) expect((await chatJSON(req)).call.ok).toBe(true);
    expect(sent.map(x => x.response_format?.type || 'none')).toEqual(['json_schema', 'json_schema', 'json_object', 'none', 'none', 'none']);
    expect(sent.slice(1).every(x => x.messages[0].role === 'user')).toBe(true);
    await chatJSON({ ...req, step: 'extract' });
    expect(sent[6].response_format?.type).toBe('json_schema'); expect(sent[6].messages[0].role).toBe('system');
  });
});
describe('P2 turn limits and input mode', () => {
  it.each(['approved', 'taken_over'] as const)('returns 409 without model calls for %s', async status => {
    const s = createSession('en', { persist: false }); s.status = status;
    const client = vi.fn<ModelClient>();
    await expect(runTurn(s, 'more information', { client })).rejects.toMatchObject({ status: 409 }); expect(client).not.toHaveBeenCalled();
  });
  it.each(['collecting', 'awaiting_review', 'needs_human', 'escalated'] as const)('accepts more information while %s', async status => {
    const s = createSession('en', { persist: false }); s.status = status;
    expect((await runTurn(s, 'chest pain and sweating')).status).toBe('escalated');
  });
  it('caps at 20 patient turns and 4000 UTF-16 characters', async () => {
    const s = createSession('en', { persist: false }); s.turns = Array.from({ length: 20 }, (_, i) => turn('hello', `T${i}`));
    await expect(runTurn(s, 'new answer')).rejects.toMatchObject({ status: 409 });
    await expect(runTurn(createSession('en', { persist: false }), 'x'.repeat(4001))).rejects.toThrow('4000');
    const twenty = await runTurn({ ...s, turns: s.turns.slice(0, 19) }, 'chest pain');
    expect(twenty.turns.filter(t => t.role === 'patient')).toHaveLength(20);
  });
  it('passes voice input through HTTP, persisted turn and audit', async () => {
    const s = createSession('en');
    const r = await addTurnRoute(new Request('http://localhost:3000', { method: 'POST', body: JSON.stringify({ text: 'chest pain', inputMode: 'voice' }) }), { params: Promise.resolve({ id: s.id }) });
    expect(r.status).toBe(200); expect(getSession(s.id)!.turns[0].inputMode).toBe('voice');
    expect(getAudit(s.id).find(e => e.type === 'turn_added')!.payload.inputMode).toBe('voice');
    const bad = await addTurnRoute(new Request('http://localhost:3000', { method: 'POST', body: JSON.stringify({ text: 'more', inputMode: 'camera' }) }), { params: Promise.resolve({ id: s.id }) });
    expect(bad.status).toBe(400);
  });
});
it('P2 metrics count calls once and time review from first awaiting_review', () => {
  const s = createSession('en');
  s.turns.push(turn('headache')); saveSession(s);
  const call = { step: 'extract', provider: 'mock', model: 'test', ok: true, latencyMs: 10 };
  appendAudit(s.id, 'summary_generated', 'system', { status: 'collecting', modelCalls: [call] }, undefined, '2026-10-17T00:00:00Z');
  appendAudit(s.id, 'summary_generated', 'system', { event: 'screen_completed', modelCalls: [{ ...call, latencyMs: 10000 }] });
  appendAudit(s.id, 'summary_generated', 'system', { status: 'awaiting_review', modelCalls: [{ ...call, latencyMs: 100 }] }, undefined, '2026-10-17T00:01:30Z');
  appendAudit(s.id, 'pharmacy_review', 'clinician', {}, undefined, '2026-10-17T00:01:35Z');
  expect(metrics()).toMatchObject({ medianReviewSeconds: 5, modelLatencyMs: { p50: 10, p95: 100 } });
});
it('P2 model escalation records every call once in final summary audit', async () => {
  const text = 'I feel as if an elephant is sitting on my upper body.';
  const events: { type: string; payload: Record<string, unknown> }[] = [];
  const client: ModelClient = async req => ({ data: req.step === 'red_flags' ? { flags: [{ category: 'CHEST', turn: 'T1', quote: text, certainty: 'high' }] } : mockJSON(req), call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 1, ok: true } });
  const s = await runTurn(createSession('en', { persist: false }), text, { client, audit: (type, payload) => events.push({ type, payload }) });
  expect(s.status).toBe('escalated');
  expect(events.filter(e => e.type === 'summary_generated').flatMap(e => e.payload.modelCalls || [])).toEqual(s.summary!.modelCalls);
});
it('P2 unknown model keys never enter audit', async () => {
  const events: unknown[] = [];
  const client: ModelClient = async req => {
    const data = mockJSON(req);
    if (req.step === 'extract') (data as { fields: Record<string, unknown> }).fields['my name is Jane Doe jane@example.invalid'] = null;
    return { data, call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: true } };
  };
  await runTurn(createSession('en', { persist: false }), 'I have a headache.', { client, audit: (_type, payload) => events.push(payload) });
  expect(events).toContainEqual({ event: 'unknown_field_keys', count: 1 });
  expect(JSON.stringify(events)).not.toMatch(/Jane|example.invalid/);
});
describe('P2 clinician decisions survive extraction', () => {
  it('keeps rejection until new evidence appears, then flags it', async () => {
    const s = await addTurn(createSession('en').id, 'I have a headache since yesterday.');
    await review(s.id, 'clinician', [{ fieldKey: 'chief_complaint', action: 'reject' }]);
    const same = await addTurn(s.id, 'No medicines.');
    expect(same.summary!.fields.find(f => f.key === 'chief_complaint')).toMatchObject({ value: null, evidence: [], status: 'missing' });
    // A provider may choose the old quote; inject the newly supplied quote to test the review boundary.
    const client: ModelClient = async req => {
      const data = mockJSON(req);
      if (req.step === 'extract') (data as { fields: Record<string, { evidence: unknown[] }> }).fields.chief_complaint.evidence = [{ turn: 'T3', quote: 'I still have a headache' }];
      return { data, call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: true } };
    };
    const events: unknown[] = [];
    const next = await runTurn(same, 'I still have a headache.', { client, audit: (_t, payload) => events.push(payload) });
    expect(next.summary!.fields.find(f => f.key === 'chief_complaint')!.status).toBe('supported');
    expect(events).toContainEqual({ event: 'field_review_change', key: 'chief_complaint', note: 'new evidence' });
  });
  it('reopens an approved field with a conflict audit note on new contrary evidence', async () => {
    const s = await addTurn(createSession('en').id, 'I have a headache. No allergies.');
    const approved = await review(s.id, 'clinician', [{ fieldKey: 'allergies', action: 'approve' }]);
    const events: unknown[] = [];
    const client: ModelClient = async req => ({ data: req.step === 'extract' ? { language_detected: 'en', fields: { allergies: { value_original: 'penicillin', value: { en: 'penicillin allergy', it: 'allergia alla penicillina', th: 'แพ้เพนิซิลลิน' }, certainty: 'high', evidence: [{ turn: 'T2', quote: 'actually allergic to penicillin' }] } } } : req.step === 'red_flags' ? { flags: [] } : null, call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: true } });
    const changed = await runTurn(approved, 'I am actually allergic to penicillin', { client, audit: (_t, payload) => events.push(payload) });
    expect(changed.status).toBe('awaiting_review'); expect(changed.summary!.fields.find(f => f.key === 'allergies')).toMatchObject({ status: 'supported', value: { en: 'penicillin allergy' } });
    expect(events).toContainEqual({ event: 'field_review_change', key: 'allergies', note: 'conflict' });
    const stillPending = await runTurn(changed, 'No other changes.', { client });
    expect(stillPending.status).toBe('needs_human'); // Missing chief complaint on turn 3 still abstains.
    expect(stillPending.summary!.fields.find(f => f.key === 'allergies')).toMatchObject({ reviewMemory: { flags: ['conflict'] } });
  });
});
it('P2 pharmacy false_alarm needs a note', () => {
  expect(() => validatePharmacyReview({ reviewerId: 'p', medActions: [], alertActions: [{ alertId: 'alert', action: 'false_alarm' }] })).toThrow('note');
});
it('NEW pharmacy empty dose/frequency/reaction explicitly clear values and preserve previous', async () => {
  const s = await addTurn(createSession('en').id, 'I take warfarin 5 mg every evening. I am allergic to penicillin, rash.');
  const m = s.summary!.medications![0], a = s.summary!.allergies![0];
  const changed = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: m.id, action: 'edit', dose: '', frequency: '' }], allergyActions: [{ allergyId: a.id, action: 'edit', reaction: '' }], alertActions: [] });
  expect(changed.summary!.medications![0]).toMatchObject({ dose: null, frequency: null, review: { previous: { dose: m.dose, frequency: m.frequency } } });
  expect(changed.summary!.allergies![0]).toMatchObject({ reaction: null, review: { previous: { reaction: a.reaction } } });
  expect(getAudit(s.id).at(-1)!.payload.medActions).toEqual([{ medId: m.id, action: 'edit', dose: '', frequency: '' }]);
});
it('P2 stream body cap counts bytes and cancels before buffering the rest', async () => {
  let pulls = 0; let cancelled = false;
  const stream = new ReadableStream({ pull(c) { pulls++; c.enqueue(new Uint8Array(33000).fill(65)); }, cancel() { cancelled = true; } });
  const req = new Request('http://localhost:3000', { method: 'POST', body: stream, duplex: 'half' } as RequestInit & { duplex: 'half' });
  await expect(body(req)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true); expect(pulls).toBeLessThanOrEqual(3);
});
it('P2 hardware claims only use configured label or the neutral default', () => {
  vi.stubEnv('MODEL_PROVIDER', 'amd');
  vi.stubEnv('AMD_HARDWARE_LABEL', ''); expect(providerInfo().hardware).toBe('AMD (via Token Factory)');
  vi.stubEnv('AMD_HARDWARE_LABEL', 'Confirmed demo host'); expect(providerInfo().hardware).toBe('Confirmed demo host');
});
it('P0 raw-only evidence maps to the stored redaction token', async () => {
  const s = await runTurn(createSession('en', { persist: false }), "my name is Jane Fainted");
  const flag = s.summary!.redFlags.find(f => f.ruleId === 'RF-SYNC-01');
  expect(flag).toBeDefined(); expect(s.turns[0].text).toBe('[NAME_1]');
  expect(flag!.evidence).toEqual([{ turnId: s.turns[0].id, quote: '[redacted]', start: 0, end: 8 }]);
});
