import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Lang } from '@medx/shared';
import { addTurn, createSession, listSessions, metrics, review, runTurn, takeover } from '../pipeline';
import { getAudit, getSession } from '../store';
import { mockJSON } from '../mock';
import type { ChatRequest, ModelClient } from '../llm';
import { FIELD_KEYS, REQUIRED_FIELDS } from '../config';
import { QUESTIONS } from '../templates';
import type { ModelExtraction } from '../schema';
const complete = 'I have a headache since yesterday. It is 4/10. No other symptoms. No medicines. No allergies. I am not pregnant. I am 28 years old.';
const completeByLang: Record<Lang, string> = { en: complete, it: 'Ho mal di testa da ieri. È 4/10. Nessun altro sintomo. Nessun farmaco. Nessuna allergia. Non sono incinta. Ho 28 anni.', th: 'ปวดหัวตั้งแต่เมื่อวาน ระดับ 4/10 ไม่มีอาการอื่น ไม่ได้กินยา ไม่แพ้ยา ไม่ได้ตั้งครรภ์ อายุ 28 ปี' };
const call = (ok = true) => ({ step: 'extract' as const, provider: 'mock' as const, model: 'fault-test', latencyMs: 1, ok, ...(ok ? {} : { error: 'Synthetic failure' }) });
const clientFor = (fn: (r: ChatRequest) => unknown): ModelClient => async r => ({ data: fn(r), call: { ...call(), step: r.step } });
let dir = '';
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-engine-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
describe('pipeline', () => {
  it('red flags stop before the first model call and remain sticky', async () => {
    const client = vi.fn(clientFor(mockJSON));
    const first = await runTurn(createSession('en', { persist: false }), 'I have chest pain and cannot breathe', { client });
    expect(first.status).toBe('escalated'); expect(first.summary?.redFlags.length).toBeGreaterThan(0); expect(first.summary?.modelCalls).toEqual([]); expect(client).not.toHaveBeenCalled();
    const next = await runTurn(first, 'I feel better now', { client }); expect(next.status).toBe('escalated'); expect(next.summary?.modelCalls).toEqual([]);
  });
  it('unreachable AMD provider abstains', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'http://127.0.0.1:9'); vi.stubEnv('AMD_API_KEY', 'synthetic-test-key'); vi.stubEnv('AMD_MODEL', 'synthetic-test-model');
    const result = await addTurn(createSession('en').id, 'I have a mild headache');
    expect(result.status).toBe('needs_human'); expect(result.summary?.abstainReason).toBe('provider_error'); expect(result.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(2); expect(result.summary?.fields.filter(f => f.status === 'supported')).toEqual([]);
  });
  it.each(['en', 'it', 'th'] as Lang[])('complete %s case awaits review', async lang => {
    const session = await addTurn(createSession(lang).id, completeByLang[lang]);
    expect(session.status).toBe('awaiting_review'); expect(session.summary?.nextQuestion).toBeNull(); expect(session.summary?.fields).toHaveLength(12);
    expect(session.summary?.fields.filter(f => f.required && f.status === 'supported')).toHaveLength(REQUIRED_FIELDS.length + 1);
    expect(session.summary?.modelCalls.map(c => c.step)).toEqual(['extract', 'red_flags']);
    for (const f of session.summary!.fields) for (const e of f.evidence) expect(session.turns.find(t => t.id === e.turnId)?.text.slice(e.start, e.end)).toBe(e.quote);
  });
  it('review approves required fields and records actor/actions', async () => {
    const session = await addTurn(createSession('en').id, complete);
    const approved = await review(session.id, 'synthetic-reviewer', session.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
    expect(approved.status).toBe('approved'); expect(getAudit(session.id).at(-1)?.actorId).toBe('synthetic-reviewer');
    expect(metrics().autoCapturedRate).toBe(1);
  });
  it('never overwrites edited or approved fields on re-extraction', async () => {
    const session = await addTurn(createSession('en').id, complete);
    const reviewed = await review(session.id, 'reviewer', [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'Clinician wording' }, { fieldKey: 'allergies', action: 'approve' }]);
    const result = await runTurn(reviewed, 'I have a cough');
    expect(result.summary?.fields.find(f => f.key === 'chief_complaint')).toEqual(reviewed.summary?.fields.find(f => f.key === 'chief_complaint'));
    expect(result.summary?.fields.find(f => f.key === 'allergies')?.status).toBe('approved');
    expect(result.summary?.fields.find(f => f.key === 'chief_complaint')?.value).toEqual({ th: 'Clinician wording', it: 'Clinician wording', en: 'Clinician wording' });
  });
  it('redacts before persistence, model input and audit; audit access is a snapshot', async () => {
    const session = createSession('en'); const phone = '081-234-5678';
    const captured: string[] = []; await runTurn(session, `I have a headache. My phone is ${phone}`, { client: clientFor(r => { captured.push(r.user); return mockJSON(r); }) });
    await addTurn(session.id, `I have a headache. My phone is ${phone}`);
    expect(readFileSync(path.join(dir, 'store.json'), 'utf8')).not.toContain(phone); expect(captured.join('')).not.toContain(phone);
    const audit = getAudit(session.id); expect(audit.some(e => e.type === 'pii_redacted')).toBe(true); expect(JSON.stringify(audit)).not.toContain(phone);
    audit.splice(0); expect(getAudit(session.id).length).toBeGreaterThan(0);
    const stored = getSession(session.id)!; stored.turns[0].text = 'changed'; expect(getSession(session.id)?.turns[0].text).not.toBe('changed');
  });
  it('takes over and pins escalated sessions first', async () => {
    const s = await addTurn(createSession('en').id, 'chest pain and cannot breathe'); const other = createSession('it');
    expect(listSessions()[0].id).toBe(s.id); const taken = await takeover(other.id, 'reviewer', 'Manual intake'); expect(taken.status).toBe('taken_over');
    await expect(addTurn(other.id, 'more text')).rejects.toThrow('taken over'); expect(metrics().provider.hardware).toBe('mock');
  });
  it('serialises concurrent patient writes without losing either turn', async () => {
    const s = createSession('en'); await Promise.all([addTurn(s.id, 'I have a headache'), addTurn(s.id, 'No allergies')]);
    expect(getSession(s.id)?.turns.filter(t => t.role === 'patient')).toHaveLength(2);
  });
  it('requests highest priority gap and falls back on bad question schema', async () => {
    const client = clientFor(r => r.step === 'next_question' ? { field: 'age', question: QUESTIONS.age } : mockJSON(r));
    const s = await runTurn(createSession('it', { persist: false }), 'Ho mal di testa', { client });
    expect(s.summary?.nextQuestion).toEqual({ field: 'onset', text: QUESTIONS.onset }); expect(s.summary?.abstained).toBe(false); expect(s.summary?.modelCalls.at(-1)?.ok).toBe(false);
  });
  it('repairs malformed schema once, tracing each raw output before verification', async () => {
    let extracts = 0; const trace = vi.fn();
    const client = clientFor(r => r.step === 'extract' && extracts++ === 0 ? { wrong: 'shape' } : mockJSON(r));
    const s = await runTurn(createSession('en', { persist: false }), complete, { client, trace, now: () => '2026-10-17T01:02:03Z' });
    expect(s.status).toBe('awaiting_review'); expect(s.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(2); expect(s.summary?.modelCalls[0].ok).toBe(false); expect(trace.mock.calls.filter(([e]) => e.step === 'extract')).toHaveLength(2); expect(trace.mock.calls[0][0].raw).toEqual({ wrong: 'shape' }); expect(s.summary?.generatedAt).toBe('2026-10-17T01:02:03Z');
  });
  it.each(['th', 'it', 'en'] as Lang[])('schema fault twice abstains in %s', async lang => {
    const s = await runTurn(createSession(lang, { persist: false }), completeByLang[lang], { client: clientFor(() => ({ invalid: true })) });
    expect(s.status).toBe('needs_human'); expect(s.summary?.abstainReason).toBe('schema_error'); expect(s.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(2);
  });
  it('provider retry selects AMD_MODEL_FALLBACK', async () => {
    vi.stubEnv('AMD_MODEL_FALLBACK', 'fallback-test'); const requests: ChatRequest[] = [];
    const client: ModelClient = async r => { requests.push(r); return r.step === 'extract' && requests.filter(r => r.step === 'extract').length === 1 ? { data: null, call: call(false), failure: 'provider_error' } : { data: mockJSON(r), call: { ...call(), step: r.step } }; };
    const s = await runTurn(createSession('en', { persist: false }), complete, { client });
    expect(s.status).toBe('awaiting_review'); expect(requests.filter(r => r.step === 'extract')[1].model).toBe('fallback-test'); expect(s.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(2);
  });
  it('long Retry-After abstains immediately', async () => {
    const client = vi.fn<ModelClient>(async () => ({ data: null, call: call(false), failure: 'provider_error', retryAfterMs: 3000 }));
    const s = await runTurn(createSession('en', { persist: false }), complete, { client }); expect(s.summary?.abstainReason).toBe('provider_error'); expect(client.mock.calls.filter(([r]) => r.step === 'extract')).toHaveLength(1);
  });
  it('quotes absent from transcript trigger low confidence and zero assertions', async () => {
    const client = clientFor(r => { const data = mockJSON(r) as ReturnType<typeof JSON.parse>; if (r.step === 'extract') for (const f of Object.values(data.fields) as { evidence: { turn: string; quote: string }[] }[]) if (f) f.evidence = [{ turn: 'T1', quote: 'invented evidence never written by the patient' }]; return data; });
    const s = await runTurn(createSession('en', { persist: false }), complete, { client });
    expect(s.summary?.abstainReason).toBe('low_confidence'); expect(s.summary?.fields.every(f => f.status !== 'supported')).toBe(true); expect(s.summary?.fields.filter(f => f.status === 'unsupported').every(f => f.confidence <= 0.3)).toBe(true);
  });
  it('retains medium certainty tolerant evidence above the .55 threshold', async () => {
    const client = clientFor(() => {
      const fields = Object.fromEntries(FIELD_KEYS.map(k => [k, null])) as ModelExtraction['fields']; fields.chief_complaint = { value_original: 'headache', value: { th: 'ปวดหัว', it: 'mal di testa', en: 'headache' }, certainty: 'medium', evidence: [{ turn: 'T1', quote: 'have very bad head ache' }] };
      return { language_detected: 'en', fields, medications: [], allergies: [], noKnownAllergies: null };
    });
    // Medium tolerant long quote = .56: remains above the threshold.
    const s = await runTurn(createSession('en', { persist: false }), 'I have very bad head pain today', { client }); expect(s.summary?.abstainReason).not.toBe('low_confidence');
  });
  it('unsupported-language needs both model and code agreement', async () => {
    const client = clientFor(() => ({ language_detected: 'other', fields: {}, medications: [], allergies: [], noKnownAllergies: null }));
    const s = await runTurn(createSession('en', { persist: false }), 'bonjour avec douleur depuis trois jours maintenant', { client }); expect(s.summary?.abstainReason).toBe('unsupported_language');
    const supported = await runTurn(createSession('th', { persist: false }), 'ฉันปวดหัวตั้งแต่เมื่อวานและมีอาการคลื่นไส้', { client }); expect(supported.summary?.abstainReason).not.toBe('unsupported_language');
  });
  it('missing chief complaint after 3 turns hands over', async () => {
    const client = clientFor(r => r.step === 'extract' ? { language_detected: 'en', fields: {}, medications: [], allergies: [], noKnownAllergies: null } : { field: 'chief_complaint', question: QUESTIONS.chief_complaint });
    let s = createSession('en', { persist: false }); for (let i = 0; i < 3; i++) s = await runTurn(s, 'No allergies', { client });
    expect(s.status).toBe('needs_human'); expect(s.summary?.abstainReason).toBe('low_confidence');
  });
});
