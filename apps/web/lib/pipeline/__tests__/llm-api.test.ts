import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Lang } from '@medx/shared';
import { chatJSON } from '../llm';
import type { ModelClient } from '../llm';
import { createSession, runTurn } from '../pipeline';
import { FIELD_KEYS } from '../config';
import { GET as health, OPTIONS } from '../../../app/api/health/route';
import { GET as list, POST as create } from '../../../app/api/sessions/route';
import { GET as get } from '../../../app/api/sessions/[id]/route';
import { POST as add } from '../../../app/api/sessions/[id]/turns/route';
import { POST as review } from '../../../app/api/sessions/[id]/review/route';
import { POST as takeover } from '../../../app/api/sessions/[id]/takeover/route';
import { GET as metrics } from '../../../app/api/metrics/route';
const complete = 'I have a headache since yesterday. It is 4/10. No other symptoms. No medicines. No allergies. I am not pregnant. I am 28 years old.';
let dir = ''; let transportTest = 0;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-api-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'amd');
  vi.stubEnv('AMD_BASE_URL', `https://synthetic-${++transportTest}.invalid/v1`); vi.stubEnv('AMD_API_KEY', 'synthetic-key-do-not-log'); vi.stubEnv('AMD_MODEL', 'synthetic-model');
  vi.stubEnv('AMD_JSON_SCHEMA', 'false');
});
afterEach(() => { if (vi.isFakeTimers()) vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const req = { step: 'extract' as const, system: 'System instructions', user: 'Redacted patient text', schemaName: 'intake_extraction' };
const envelope = (content: string) => Response.json({ choices: [{ message: { content } }] });
describe('AMD client transport', () => {
  it('sends compatible parameters, parses fenced JSON, records latency', async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope('```json\n{"fields":{}}\n```')); vi.stubGlobal('fetch', fetcher);
    const result = await chatJSON(req); expect(result.data).toEqual({ fields: {} }); expect(result.call.ok).toBe(true); expect(result.call.provider).toBe('amd-tokenfactory'); expect(result.call.latencyMs).toBeGreaterThanOrEqual(0);
    const [url, init] = fetcher.mock.calls[0]; expect(url).toBe(`${process.env.AMD_BASE_URL}/chat/completions`); expect(init.headers.Authorization).toBe('Bearer synthetic-key-do-not-log');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'synthetic-model', temperature: 0, top_p: 1, max_tokens: 3000, stream: false, response_format: { type: 'json_object' } });
  });
  it('retries without response_format after 400, recording both attempts', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('unsupported response_format', { status: 400 })).mockResolvedValueOnce(envelope('{"ok":true}')); vi.stubGlobal('fetch', fetcher);
    const onCall = vi.fn(); const result = await chatJSON({ ...req, onCall });
    expect(result.call.ok).toBe(true); expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty('response_format'); expect(onCall.mock.calls.map(c => c[0].ok)).toEqual([false, true]);
  });
  it('folds rejected system role into user prompt', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('system role is not supported', { status: 400 })).mockResolvedValueOnce(envelope('{"ok":true}')); vi.stubGlobal('fetch', fetcher);
    const result = await chatJSON(req); expect(result.call.ok).toBe(true); const messages = JSON.parse(fetcher.mock.calls[1][1].body).messages; expect(messages).toHaveLength(1); expect(messages[0].content).toContain('### INSTRUCTIONS');
  });
  it('schema-capable mode emits strict schema', async () => {
    vi.stubEnv('AMD_JSON_SCHEMA', 'true'); const fetcher = vi.fn().mockResolvedValue(envelope('{}')); vi.stubGlobal('fetch', fetcher); await chatJSON(req);
    const format = JSON.parse(fetcher.mock.calls[0][1].body).response_format; expect(format.type).toBe('json_schema'); expect(format.json_schema.strict).toBe(true); expect(format.json_schema.schema.properties.fields.required).toHaveLength(12);
  });
  it('automatically detects json_output support from the model catalog', async () => {
    delete process.env.AMD_JSON_SCHEMA;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: 'synthetic-model', json_output: true }] })).mockResolvedValueOnce(envelope('{}')); vi.stubGlobal('fetch', fetcher);
    await chatJSON(req);
    expect(fetcher.mock.calls[0][0]).toBe(`${process.env.AMD_BASE_URL}/models`);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).response_format.type).toBe('json_schema');
  });
  it('returns parse failure for repair without throwing or leaking output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope('broken synthetic JSON'))); const result = await chatJSON(req);
    expect(result.data).toBeNull(); expect(result.failure).toBe('schema_error'); expect(result.raw).toBe('broken synthetic JSON'); expect(result.call.ok).toBe(false);
  });
  it.each([401, 403, 429, 500])('handles HTTP %d with safe metadata', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-response-body', { status, headers: { 'Retry-After': '3' } })));
    const result = await chatJSON(req); expect(result.call.ok).toBe(false); expect(result.failure).toBe('provider_error'); expect(JSON.stringify(result)).not.toContain('secret-response-body');
    if (status === 429) expect(result.retryAfterMs).toBe(3000);
  });
  it('aborts extraction fetch at the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))));
    const promise = chatJSON({ ...req, timeoutMs: 25 }); await vi.advanceTimersByTimeAsync(25); const result = await promise; expect(result.call.ok).toBe(false); expect(result.call.error).toContain('timeout');
  });
  it('repair preserves original messages and adds capped invalid output', async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope('{}')); vi.stubGlobal('fetch', fetcher);
    await chatJSON({ ...req, repair: { raw: 'x'.repeat(5000), errors: ['wrong shape'] } });
    const messages = JSON.parse(fetcher.mock.calls[0][1].body).messages; expect(messages).toHaveLength(4); expect(messages[2].content).toHaveLength(4000); expect(messages[3].content).toContain('Do not add fields or values');
  });
});
describe('fault injection, six scenarios in all languages', () => {
  it.each((['th', 'it', 'en'] as Lang[]).flatMap(lang => ['401', 'timeout', '500', 'malformed', 'shape', 'quotes'].map(fault => [lang, fault] as const)))('%s %s abstains with zero asserted fields', async (lang, fault) => {
    const failCall = { step: 'extract' as const, provider: 'mock' as const, model: 'fault-injection', latencyMs: 0, ok: false, error: 'Synthetic injected error' };
    const client: ModelClient = async req => {
      if (req.step === 'red_flags') return { data: { flags: [] }, call: { ...failCall, step: 'red_flags', ok: true } };
      if (fault === 'quotes') return { data: { language_detected: lang, medications: [], allergies: [], noKnownAllergies: null, fields: Object.fromEntries(FIELD_KEYS.map(k => [k, { value_original: 'fabrication', value: { en: 'fabrication', it: 'invenzione', th: 'ข้อความสมมติ' }, certainty: 'high', evidence: [{ turn: 'T1', quote: 'totally absent evidence' }] }])) }, call: { ...failCall, ok: true } };
      if (fault === 'shape') return { data: { bad: true }, call: { ...failCall, ok: true } };
      if (fault === 'malformed') return { data: null, raw: 'broken JSON', failure: 'schema_error', call: failCall };
      if (fault === 'timeout') return new Promise(() => undefined);
      return { data: null, failure: 'provider_error', call: { ...failCall, error: `HTTP ${fault}` } };
    };
    vi.stubEnv('LLM_TIMEOUT_MS', '10');
    const s = await runTurn(createSession(lang, { persist: false }), lang === 'th' ? 'ฉันปวดหัวเล็กน้อย' : lang === 'it' ? 'Ho mal di testa lieve' : 'I have a mild headache', { client });
    expect(s.status).toBe('needs_human'); expect(s.summary?.abstained).toBe(true); expect(s.summary?.abstainReason).toBe(fault === 'quotes' ? 'low_confidence' : ['shape', 'malformed'].includes(fault) ? 'schema_error' : 'provider_error');
    expect(s.summary?.fields.filter(f => f.status === 'supported')).toHaveLength(0); expect(s.summary?.nextQuestion).toBeNull();
  });
  it('enforces the 40-second whole-turn cap even when injected clients ignore abort', async () => {
    vi.useFakeTimers(); vi.stubEnv('LLM_TIMEOUT_MS', '100000');
    const client: ModelClient = () => new Promise(() => undefined);
    const promise = runTurn(createSession('en', { persist: false }), 'I have a mild headache', { client }); await vi.advanceTimersByTimeAsync(40000);
    expect((await promise).summary?.abstainReason).toBe('provider_error');
  });
});
const post = (value: unknown) => new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(value) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
describe('HTTP contracts and CORS', () => {
  beforeEach(() => vi.stubEnv('MODEL_PROVIDER', 'mock'));
  it('returns health metadata without credentials and permits preflight', async () => {
    // M-02 (w20) extended the body with store/commit/region facts; pin the exact key set so nothing else (credentials) can appear.
    vi.stubEnv('AMD_API_KEY', 'sk-health-secret-must-not-leak'); vi.stubEnv('AMD_BASE_URL', 'https://secret-host.invalid/v1');
    const h = health(new Request('http://localhost/api/health')); const text = await h.text(); const body = JSON.parse(text);
    expect(body).toMatchObject({ status: 'ok', provider: 'mock', model: 'deterministic-mock', hardware: '\u2014', providerConfigured: true, storeOk: true });
    expect(Object.keys(body).sort()).toEqual(['commit', 'hardware', 'model', 'provider', 'providerConfigured', 'region', 'sessions', 'status', 'store', 'storeOk', 'storeVersion']);
    expect(text).not.toContain('sk-health-secret-must-not-leak'); expect(text).not.toContain('secret-host.invalid');
    expect(h.headers.has('Access-Control-Allow-Origin')).toBe(false); expect(OPTIONS(new Request('http://localhost/api/health')).status).toBe(204);
  });
  it('creates, lists, gets, adds turns, reviews and returns metrics', async () => {
    const created = await create(post({ patientLang: 'en' })); expect(created.status).toBe(201); const s = await created.json();
    expect(await (await list(new Request('http://localhost/api/sessions'))).json()).toEqual([]);
    const added = await add(post({ text: complete }), context(s.id)); expect(added.status).toBe(200); expect((await added.json()).status).toBe('awaiting_review');
    const sessions = await (await list(new Request('http://localhost/api/sessions'))).json(); expect(sessions[0].id).toBe(s.id);
    const fetched = await (await get(new Request('http://localhost'), context(s.id))).json(); expect(fetched.session.id).toBe(s.id); expect(fetched.audit.length).toBeGreaterThan(0);
    const edited = await review(post({ reviewerId: 'synthetic-reviewer', actions: [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'Clinician text' }] }), context(s.id)); expect(edited.status).toBe(200); expect((await edited.json()).summary.fields.find((f: { key: string }) => f.key === 'chief_complaint').status).toBe('edited');
    const m = await (await metrics(new Request('http://localhost/api/metrics'))).json(); expect(m.sessionsToday).toBe(1); expect(m.provider.name).toBe('mock');
    expect((await takeover(post({ reviewerId: 'reviewer', reason: 'manual' }), context(s.id))).status).toBe(200);
  });
  it.each([{ patientLang: 'fr' }, { patientLang: 'en', secret: 'extra' }, null, [], {}])('rejects invalid create body %j', async value => {
    const response = await create(post(value)); expect(response.status).toBe(400); expect((await response.json()).code).toBe('bad_request'); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });
  it('rejects malformed JSON, nonstring turns, invalid reviews and unknown sessions', async () => {
    const bad = await create(new Request('http://localhost', { method: 'POST', body: '{' })); expect(bad.status).toBe(400);
    expect((await add(post({ text: 123 }), context('absent'))).status).toBe(400);
    expect((await add(post({ text: 'I have a mild headache' }), context('absent'))).status).toBe(404);
    expect((await get(new Request('http://localhost'), context('absent'))).status).toBe(404);
    expect((await review(post({ reviewerId: 'n', actions: [{ fieldKey: 'age', action: 'edit', newValue: 123 }] }), context('absent'))).status).toBe(400);
    expect((await takeover(post({ reviewerId: 123 }), context('absent'))).status).toBe(400);
  });
});
