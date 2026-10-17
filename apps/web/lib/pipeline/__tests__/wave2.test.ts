import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExtractedField } from '@medx/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRequiredFields, emptyFields, REQUIRED_FIELDS } from '../config';
import { addTurn, createSession, review, runTurn } from '../pipeline';
import { getAudit, getSession, getSessions, saveSession } from '../store';
import { mockJSON } from '../mock';
import { seedDemo } from '../seed';
import { POST as reviewRoute } from '../../../app/api/sessions/[id]/review/route';
import { POST as seedRoute } from '../../../app/api/dev/seed/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-wave2-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
  vi.stubEnv('DEMO_SEED', '1');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const post = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const demographics = (age?: string, sex?: string, status: ExtractedField['status'] = 'supported') => applyRequiredFields(emptyFields().map(f => {
  const value = f.key === 'age' ? age : f.key === 'sex' ? sex : undefined;
  return value ? { ...f, status, value: { en: value, it: value, th: value }, valueOriginal: value } : f;
}));

describe('clinical required fields and question budget', () => {
  it('requires exactly the six unconditional fields plus conditional pregnancy', () => {
    expect(REQUIRED_FIELDS).toEqual(['chief_complaint', 'onset', 'severity', 'age', 'allergies', 'medications']);
    expect(emptyFields().filter(f => f.required).map(f => f.key).sort()).toEqual([...REQUIRED_FIELDS, 'pregnancy_status'].sort());
    expect(emptyFields().find(f => f.key === 'associated_symptoms')?.required).toBe(false);
  });
  it.each([
    [undefined, undefined, true], ['12 years', 'female', true], ['55 years', 'female', true],
    ['11 years', 'female', false], ['56 years', 'female', false], [undefined, 'female', true],
    ['28 years', undefined, true], ['60 years', undefined, false], ['28 years', 'male', false],
    [undefined, 'male', false], ['unknown', 'female', true], ['12–55', 'female', true],
  ] as const)('age %s, sex %s: pregnancy required = %s', (age, sex, required) => {
    const fields = demographics(age, sex);
    expect(fields.find(f => f.key === 'pregnancy_status')?.required).toBe(required);
    for (const key of REQUIRED_FIELDS) expect(fields.find(f => f.key === key)?.required).toBe(true);
  });
  it('unsupported demographics cannot suppress the pregnancy question', () => {
    expect(demographics('60 years', 'male', 'unsupported').find(f => f.key === 'pregnancy_status')?.required).toBe(true);
  });
  it('asks at most three questions, then offers incomplete fields for nurse review', async () => {
    let session = createSession('en', { persist: false });
    for (let i = 0; i < 5; i++) session = await runTurn(session, 'I have a headache');
    expect(session.turns.filter(t => t.role === 'assistant')).toHaveLength(3);
    expect(session.status).toBe('awaiting_review');
    expect(session.summary?.nextQuestion).toBeNull();
    expect(session.summary?.fields.find(f => f.key === 'onset')?.status).toBe('missing');
    expect(session.summary?.modelCalls.map(c => c.step)).toEqual(['extract', 'red_flags']);
  });
  it('a flag cancels follow-ups before the configured provider is called', async () => {
    const first = await runTurn(createSession('en', { persist: false }), 'I have a headache');
    const client = vi.fn();
    const flagged = await runTurn(first, 'No cough but chest pain since noon', { client });
    expect(flagged.status).toBe('escalated'); expect(flagged.summary?.nextQuestion).toBeNull();
    expect(flagged.turns.filter(t => t.role === 'assistant')).toHaveLength(1);
    expect(client).not.toHaveBeenCalled();
  });
  it('recalculates pregnancy requirements after clinician demographic edits', async () => {
    const session = await addTurn(createSession('en').id, 'I have a headache');
    const male = await review(session.id, 'reviewer', [{ fieldKey: 'sex', action: 'edit', newValue: 'male' }]);
    expect(male.summary?.fields.find(f => f.key === 'pregnancy_status')?.required).toBe(false);
    const female = await review(session.id, 'reviewer', [{ fieldKey: 'sex', action: 'edit', newValue: 'female' }]);
    expect(female.summary?.fields.find(f => f.key === 'pregnancy_status')?.required).toBe(true);
  });
});

describe('red-flag review actions', () => {
  it.each(['out_of_scope', 'conflicting_information'] as const)('preserves the shared %s abstention reason during partial clinician review', async abstainReason => {
    const session = await addTurn(createSession('en').id, 'I have a headache');
    session.status = 'needs_human'; session.summary!.abstained = true; session.summary!.abstainReason = abstainReason; session.summary!.nextQuestion = null;
    saveSession(session);
    const result = await review(session.id, 'reviewer', [{ fieldKey: 'chief_complaint', action: 'approve' }]);
    expect(result.status).toBe('needs_human'); expect(result.summary?.abstainReason).toBe(abstainReason);
  });
  it('acknowledges and marks false alarm with separate immutable audit history', async () => {
    const session = await addTurn(createSession('en').id, 'chest pain');
    const ruleId = session.summary!.redFlags[0].ruleId;
    const before = getAudit(session.id);
    const ack = await review(session.id, 'nurse-1', [], [{ ruleId, action: 'acknowledge' }]);
    const firstReview = ack.summary!.redFlags[0].review;
    expect(firstReview).toMatchObject({ action: 'acknowledge', reviewerId: 'nurse-1' });
    const falseAlarm = await review(session.id, 'nurse-2', [], [{ ruleId, action: 'false_alarm', note: 'Synthetic clinician reviewed context; call 081-234-5678' }]);
    expect(falseAlarm.status).toBe('escalated');
    expect(falseAlarm.summary?.redFlags).toHaveLength(session.summary!.redFlags.length);
    expect(falseAlarm.summary?.redFlags[0].review).toMatchObject({ action: 'false_alarm', reviewerId: 'nurse-2', note: 'Synthetic clinician reviewed context; call [PHONE_1]' });
    expect(falseAlarm.summary?.redFlags[0].evidence).toEqual(session.summary!.redFlags[0].evidence);
    expect(getAudit(session.id).slice(0, before.length)).toEqual(before);
    const events = getAudit(session.id).filter(e => e.type === 'red_flag_review');
    expect(events).toHaveLength(2);
    expect(events[0].payload.actions).toEqual([{ ruleId, action: 'acknowledge' }]);
    expect(events[0].at).toBe(firstReview!.at);
    expect(readFileSync(path.join(dir, 'store.json'), 'utf8')).not.toContain('081-234-5678');
    const followup = await addTurn(session.id, 'I feel better now');
    expect(followup.summary?.redFlags[0].review).toEqual(falseAlarm.summary?.redFlags[0].review);
    expect(followup.summary?.modelCalls).toEqual([]); expect(followup.status).toBe('escalated');
  });
  it('handles mixed field and flag review through the HTTP route', async () => {
    const session = await addTurn(createSession('en').id, 'chest pain');
    const ruleId = session.summary!.redFlags[0].ruleId;
    const response = await reviewRoute(post({ reviewerId: 'reviewer', actions: [{ fieldKey: 'age', action: 'edit', newValue: '40' }], redFlagActions: [{ ruleId, action: 'acknowledge' }] }), context(session.id));
    expect(response.status).toBe(200);
    const result = await response.json(); expect(result.status).toBe('escalated'); expect(result.summary.redFlags[0].review.action).toBe('acknowledge');
    expect(getAudit(session.id).slice(-2).map(e => e.type)).toEqual(['review', 'red_flag_review']);
  });
  it('accepts a flag-only review through the route', async () => {
    const session = await addTurn(createSession('en').id, 'chest pain');
    const response = await reviewRoute(post({ reviewerId: 'reviewer', actions: [], redFlagActions: [{ ruleId: session.summary!.redFlags[0].ruleId, action: 'acknowledge' }] }), context(session.id));
    expect(response.status).toBe(200);
  });
  it.each([
    { ruleId: 'unknown', action: 'acknowledge' }, { ruleId: 'RF-CHEST-02', action: 'delete' },
    { ruleId: 'RF-CHEST-02', action: 'false_alarm' }, { ruleId: 'RF-CHEST-02', action: 'false_alarm', note: '   ' },
    { ruleId: 'RF-CHEST-02', action: 'acknowledge', note: 123 }, { ruleId: 'RF-CHEST-02', action: 'acknowledge', note: 'x'.repeat(2001) },
    { ruleId: 'RF-CHEST-02', action: 'acknowledge', unexpected: true }, null,
  ])('rejects malformed or unsafe flag actions atomically (%#)', async action => {
    const session = await addTurn(createSession('en').id, 'chest pain');
    const before = getAudit(session.id);
    const response = await reviewRoute(post({ reviewerId: 'reviewer', actions: [{ fieldKey: 'age', action: 'edit', newValue: '40' }], redFlagActions: [action] }), context(session.id));
    expect(response.status).toBe(400); expect(getAudit(session.id)).toEqual(before); expect(getSession(session.id)).toEqual(session);
  });
  it('rejects an empty review and a non-array flag list', async () => {
    const session = await addTurn(createSession('en').id, 'chest pain');
    for (const redFlagActions of [[], {}, null]) expect((await reviewRoute(post({ reviewerId: 'reviewer', actions: [], redFlagActions }), context(session.id))).status).toBe(400);
  });
});

describe('demo fixture replay', () => {
  it.each(['', '0', 'true'])('is unavailable unless DEMO_SEED is exactly 1 (%s)', async value => {
    vi.stubEnv('DEMO_SEED', value);
    expect((await seedRoute()).status).toBe(404); expect(getSessions()).toHaveLength(0); expect(getAudit()).toHaveLength(0);
  });
  it('creates the eight-session mix through the real pipeline, once even with concurrent requests', async () => {
    const [first, second] = await Promise.all([seedDemo(), seedDemo()]);
    expect(first.created).toBe(8); expect(second.created).toBe(0); expect(second.reused).toBe(8);
    expect(first.byStatus).toEqual({ escalated: 2, awaiting_review: 2, needs_human: 1, collecting: 2, approved: 1, taken_over: 0 });
    expect(first.mismatches).toEqual([]); expect(getSessions()).toHaveLength(8);
    expect(new Set(first.sessions.map(s => s.patientLang))).toEqual(new Set(['en', 'it', 'th']));
    expect(first.sessions.filter(s => s.status === 'escalated').every(s => s.summary?.modelCalls.length === 0)).toBe(true);
    for (const session of first.sessions) {
      expect(getAudit(session.id).some(e => e.type === 'turn_added')).toBe(true);
      for (const field of session.summary!.fields) for (const e of field.evidence) expect(session.turns.find(t => t.id === e.turnId)?.text.slice(e.start, e.end)).toBe(e.quote);
    }
    const approved = first.sessions.find(s => s.status === 'approved')!;
    expect(getAudit(approved.id).at(-1)).toMatchObject({ type: 'review', actor: 'clinician', actorId: 'demo-clinician' });
  });
  it('uses the configured AMD transport and records actual provider calls', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'https://synthetic.invalid/v1'); vi.stubEnv('AMD_API_KEY', 'synthetic-key'); vi.stubEnv('AMD_MODEL', 'seed-transport-test'); vi.stubEnv('AMD_JSON_SCHEMA', 'false');
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      const user = payload.messages[1].content;
      const data = mockJSON({ step: user.startsWith('Missing information:') ? 'next_question' : payload.messages[0].content.startsWith('You are a safety screen') ? 'red_flags' : 'extract', schemaName: 'seed_transport_test', system: payload.messages[0].content, user });
      return Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await seedRoute(); expect(response.status).toBe(200);
    const result = await response.json(); expect(result.mismatches).toEqual([]); expect(fetcher).toHaveBeenCalled();
    const calls = getAudit().flatMap(e => Array.isArray(e.payload.modelCalls) ? e.payload.modelCalls : []);
    expect(calls.length).toBeGreaterThan(0); expect(calls.every(c => c.provider === 'amd-tokenfactory' && c.model === 'seed-transport-test')).toBe(true);
  });
  it('reports provider failures honestly and never fabricates approvals or switches to mock', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'https://synthetic.invalid/v1'); vi.stubEnv('AMD_API_KEY', 'synthetic-key'); vi.stubEnv('AMD_MODEL', 'seed-failure'); vi.stubEnv('AMD_JSON_SCHEMA', 'false');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Synthetic failure', { status: 500, headers: { 'Retry-After': '3' } })));
    const result = await seedDemo();
    expect(result.created).toBe(8); expect(result.byStatus.escalated).toBe(2); expect(result.byStatus.needs_human).toBe(6); expect(result.byStatus.approved).toBe(0);
    expect(result.mismatches).toHaveLength(5);
    expect(result.sessions.filter(s => s.status === 'needs_human').every(s => s.summary?.abstainReason === 'provider_error' && s.summary.fields.every(f => f.status !== 'supported'))).toBe(true);
  });
});
