import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntakeSession, ModelCall } from '@medx/shared';
import { addTurn, createSession, review, runTurn, TURN_TIMEOUT_MS } from '../pipeline';
import type { ModelClient } from '../llm';
import { mockJSON } from '../mock';
import { pharmacyReview } from '../pharmacyReview';
import { pharmacyContext } from '../pharmacyContext';
import { pharmacyEntries } from '../pharmacyExtraction';
import { checkRedFlags } from '../redflags';
import { checkMedRules } from '../medrules';
import { redact } from '../redact';
import { getAudit, getSession, saveSession } from '../store';
import { POST as signoff } from '../../../app/api/sessions/[id]/pharmacy-review/route';
import { POST as turn } from '../../../app/api/sessions/[id]/turns/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w10-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const request = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value), headers: { Origin: 'http://localhost:8081' } });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const complete = { reviewerId: 'pharmacist', medActions: [], alertActions: [], complete: true };
async function setup() { return addTurn(createSession('en').id, 'Headache. I take warfarin and ibuprofen.'); }
function flags(s: IntakeSession, model = false) {
  const flag = checkRedFlags('chest pain')[0];
  if (model) { flag.ruleId = 'MODEL-TEST'; flag.source = 'model'; }
  s.summary!.redFlags = [flag];
}

describe('server pharmacy sign-off gates', () => {
  it.each(['rule', 'model', 'abstained', 'allergy-unmatched', 'allergy-unsupported', 'high', 'med-unmatched', 'med-unsupported'])('blocks %s with HTTP 409 and no writes', async blocker => {
    const s = await setup();
    // Remove unrelated blockers so each safety gate is independently exercised.
    s.summary!.medAlerts!.forEach(a => { a.review = { action: 'acknowledge', reviewerId: 'p', at: '' }; });
    if (blocker === 'rule' || blocker === 'model') flags(s, blocker === 'model');
    if (blocker === 'abstained') s.summary!.abstained = true;
    if (blocker.startsWith('allergy-')) s.summary!.allergies = [{ id: 'a', allergenOriginal: 'unknown', allergenClass: null, reaction: null, evidence: [], status: blocker === 'allergy-unmatched' ? 'unmatched' : 'unsupported' }];
    if (blocker === 'high') s.summary!.medAlerts!.forEach(a => { delete a.review; });
    if (blocker.startsWith('med-')) s.summary!.medications![0].status = blocker === 'med-unmatched' ? 'unmatched' : 'unsupported';
    saveSession(s); const audit = getAudit(s.id);
    const response = await signoff(request(complete), context(s.id));
    expect(response.status).toBe(409);
    const reason = blocker === 'abstained' ? 'abstained' : blocker === 'high' ? 'high alert' : blocker.startsWith('allergy') ? 'allergy a' : blocker.startsWith('med-') ? 'medication' : 'red flag';
    expect(await response.json()).toMatchObject({ code: 'bad_request', error: expect.stringContaining(reason) });
    expect(getSession(s.id)).toEqual(s); expect(getAudit(s.id)).toEqual(audit);
  });
  it('returns every blocker and rolls back corrections in a failed completion', async () => {
    const s = await setup(); flags(s); s.summary!.abstained = true;
    s.summary!.allergies = [{ id: 'a', allergenOriginal: 'unknown', allergenClass: null, reaction: null, evidence: [], status: 'unsupported' }];
    s.summary!.medications![0].status = 'unsupported'; saveSession(s);
    const response = await signoff(request({ ...complete, medActions: [{ medId: s.summary!.medications![1].id, action: 'edit', dose: '5 mg' }] }), context(s.id));
    const { error } = await response.json();
    for (const reason of ['red flag', 'abstained', 'allergy a', 'high alert', 'medication']) expect(error).toContain(reason);
    expect(getSession(s.id)).toEqual(s);
  });
  it('requires review of a recorded high alert even when a medication is discontinued', async () => {
    const s = await setup(); saveSession(s);
    const response = await signoff(request({ ...complete, medActions: [{ medId: s.summary!.medications![0].id, action: 'discontinue' }] }), context(s.id));
    expect(response.status).toBe(409); expect((await response.json()).error).toContain('high alert');
    expect(getSession(s.id)).toEqual(s);
  });
  it('allows complete after every flag and uncertain entry has a review', async () => {
    const s = await setup(); flags(s, true);
    s.summary!.redFlags[0].review = { action: 'acknowledge', reviewerId: 'dr', at: '' };
    s.summary!.allergies = [{ id: 'a', allergenOriginal: 'unknown', allergenClass: null, reaction: null, evidence: [], status: 'unsupported' }];
    s.summary!.medications![0].status = 'unsupported'; saveSession(s);
    const result = await pharmacyReview(s.id, { ...complete, medActions: [{ medId: s.summary!.medications![0].id, action: 'verify' }], allergyActions: [{ allergyId: 'a', action: 'verify' }], alertActions: s.summary!.medAlerts!.map(a => ({ alertId: a.id, action: 'acknowledge' })) });
    expect(result.pharmacyStatus).toBe('reconciled');
  });
});

describe('field approval red-flag gate', () => {
  it.each(['approve', 'edit'] as const)('blocks %s for an unreviewed rule or model flag', async action => {
    for (const model of [false, true]) {
      const s = await setup(); flags(s, model); saveSession(s); const audit = getAudit(s.id);
      await expect(review(s.id, 'dr', [{ fieldKey: 'chief_complaint', action, ...(action === 'edit' ? { newValue: 'Headache' } : {}) }])).rejects.toMatchObject({ status: 409 });
      expect(getSession(s.id)).toEqual(s); expect(getAudit(s.id)).toEqual(audit);
    }
  });
  it('allows a same-request flag review and edit only when all flags are reviewed', async () => {
    const s = await setup(); flags(s); saveSession(s);
    const result = await review(s.id, 'dr', [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'Headache' }], [{ ruleId: s.summary!.redFlags[0].ruleId, action: 'acknowledge' }]);
    expect(result.summary!.fields.find(f => f.key === 'chief_complaint')?.status).toBe('edited');
    await expect(review(s.id, 'dr', [{ fieldKey: 'chief_complaint', action: 'approve' }])).resolves.toBeDefined();
  });
});

describe('MF-2 fail-safe patient-reported stopping', () => {
  const probes = [
    "I can't stop taking ibuprofen for my back, and I take warfarin every day.",
    'The doctor told me to stop aspirin but I still take aspirin and warfarin.',
    'I stopped taking warfarin yesterday. I take ibuprofen.',
  ];
  it.each(probes)('retains high bleeding alert: %s', async text => {
    const s = await runTurn(createSession('en', { persist: false }), text);
    expect(s.summary!.medications?.every(m => m.status === 'supported')).toBe(true);
    expect(s.summary!.medAlerts).toContainEqual(expect.objectContaining({ ruleId: text.includes('aspirin') ? 'MR-INT-03' : 'MR-INT-01', severity: 'high' }));
  });
  it.each(["I can't stop taking ibuprofen", 'The doctor told me to stop aspirin', 'I cannot stop taking warfarin', 'I have not stopped taking warfarin'])('does not label a bare or negated stop as stopped: %s', text => {
    expect(pharmacyContext(text, text.search(/ibuprofen|aspirin|warfarin/)).stopped).toBeNull();
  });
  it('preserves timing and appends confirmation in all three languages without mutating templates', async () => {
    const s = await runTurn(createSession('en', { persist: false }), probes[2]);
    const med = s.summary!.medications!.find(m => m.generic === 'warfarin')!;
    expect(med.timing).toContain('yesterday');
    const alert = s.summary!.medAlerts!.find(a => a.ruleId === 'MR-INT-01')!;
    for (const [lang, suffix] of [['en', 'patient says stopped — confirm'], ['it', 'il paziente riferisce di aver interrotto — confermare'], ['th', 'ผู้ป่วยแจ้งว่าหยุดยาแล้ว — โปรดยืนยัน']] as const) {
      expect(alert.message[lang]).toContain(suffix); expect(alert.action[lang]).toContain(suffix);
    }
    const current = checkMedRules(s.summary!.medications!.map(m => ({ ...m, timing: null })), []);
    expect(current[0].message.en).not.toContain('patient says stopped');
    med.status = 'discontinued';
    expect(checkMedRules(s.summary!.medications!, [])).toEqual([]);
  });
  it('provider extraction retains supported timing even with a narrow evidence quote', () => {
    const s = createSession('en', { persist: false });
    s.turns = [{ id: 'p', role: 'patient', lang: 'en', text: probes[2], at: '' }];
    const result = pharmacyEntries({ medications: [{ nameOriginal: 'warfarin', dose: null, frequency: null, timing: 'yesterday', turn: 'T1', quote: 'warfarin' }] }, s);
    expect(result.medications[0]).toMatchObject({ status: 'supported', timing: expect.stringContaining('yesterday') });
    for (const e of result.medications[0].evidence) expect(s.turns[0].text.slice(e.start, e.end)).toBe(e.quote);
  });
});

describe('MF-5 address shape', () => {
  it.each(['3 days ago I saw the dr', 'I take 20 mg every day since my dr changed it', '20 mg since my dr', '3 days since my st', '4 days since my rd'])('preserves clinical prose: %s', text => {
    expect(redact(text).text).toBe(text);
  });
  it.each(['123 Main St', '12 Oak Rd.', '3 Maple Dr', '123 main street', 'via Roma 12', 'viale Giuseppe Verdi 8', 'piazza Dante 2', 'บ้านเลขที่ 123/45', 'ซอย สุขุมวิท 12', 'ถนน สุขุมวิท'])('redacts real address: %s', text => {
    expect(redact(text).text).toBe('[ADDRESS_1]');
  });
  it('retains dose and onset through turn processing', async () => {
    const text = '3 days ago I saw the dr. I take ibuprofen 20 mg every day since my dr changed it.';
    const s = await runTurn(createSession('en', { persist: false }), text);
    expect(s.turns[0].text).toBe(text); expect(s.summary!.medications![0].dose).toBe('20 mg');
  });
});

describe('turn retry and budget contracts', () => {
  it('serialises concurrent retries, persists the id, and returns the current session after takeover', async () => {
    const s = createSession('en'); const value = { text: 'Headache', clientTurnId: 'retry-1' };
    const responses = await Promise.all([turn(request(value), context(s.id)), turn(request(value), context(s.id))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(await responses[0].json()).toEqual(await responses[1].json());
    const saved = getSession(s.id)!; expect(saved.turns.filter(t => t.role === 'patient')).toHaveLength(1);
    expect(JSON.parse(readFileSync(path.join(dir, 'store.json'), 'utf8')).sessions[0].turns[0].clientTurnId).toBe('retry-1');
    saved.status = 'taken_over'; saveSession(saved); const audit = getAudit(s.id);
    const duplicate = await turn(request(value), context(s.id));
    expect(duplicate.status).toBe(200); expect(await duplicate.json()).toEqual(saved); expect(getAudit(s.id)).toEqual(audit);
    expect(getAudit(s.id).filter(a => a.type === 'turn_added')).toHaveLength(1);
  });
  it('keeps ids scoped to a session and supports distinct ids and legacy requests', async () => {
    const a = createSession('en'); const b = createSession('en');
    await addTurn(a.id, 'Headache', undefined, 'same'); await addTurn(b.id, 'Headache', undefined, 'same');
    await addTurn(a.id, 'Mild', undefined, 'different'); await addTurn(a.id, 'Since yesterday');
    expect(getSession(a.id)!.turns.filter(t => t.role === 'patient')).toHaveLength(3);
    expect(getSession(b.id)!.turns.filter(t => t.role === 'patient')).toHaveLength(1);
  });
  it.each([null, '', ' ', 123, 'x'.repeat(201)])('rejects invalid clientTurnId %j', async id => {
    const s = createSession('en'); const response = await turn(request({ text: 'Headache', clientTurnId: id }), context(s.id));
    expect(response.status).toBe(400); expect(getSession(s.id)!.turns).toEqual([]);
  });
  it.each([{ text: 'Headache' }, { text: '' }, { text: 123 }])('exposes 40000ms on success and errors: %j', async value => {
    const response = await turn(request(value), context(createSession('en').id));
    expect(response.headers.get('x-medx-timeout-ms')).toBe('40000');
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('x-medx-timeout-ms');
  });
  it('caps a slow next-question model call within the whole-turn budget', async () => {
    vi.useFakeTimers(); vi.stubEnv('LLM_TIMEOUT_MS', '100000');
    const client: ModelClient = async req => {
      if (req.step === 'next_question') return new Promise(() => undefined);
      const call: ModelCall = { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: true };
      return { data: mockJSON(req), call };
    };
    const promise = runTurn(createSession('en', { persist: false }), 'Headache', { client });
    await vi.advanceTimersByTimeAsync(TURN_TIMEOUT_MS);
    const result = await promise;
    expect(result.summary!.abstained).toBe(true); expect(result.summary!.abstainReason).toBe('provider_error');
  });
});
