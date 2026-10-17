import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditType, ConsultSuggestion, MedicationOrder } from '@medx/shared';
import { addTurn, createSession } from '../pipeline';
import { consultNote, draftConsultNote, getConsult, modelSuggestions, reviewConsultSuggestion } from '../consult';
import { parsePrescription, prescribingChecks } from '../orders';
import { MEDRULES } from '../medrules';
import { getAudit, getConsultRecord, getSession, saveConsultRecord, saveSession } from '../store';
import { POST as vitals } from '../../../app/api/sessions/[id]/vitals/route';
import { POST as confirm } from '../../../app/api/sessions/[id]/triage/confirm/route';
import { POST as medication } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as submit } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { POST as turns } from '../../../app/api/sessions/[id]/turns/route';
import { GET as sessionGet } from '../../../app/api/sessions/[id]/route';
import { OPTIONS } from '../../../app/api/_http';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-w15-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
const loc = (en: string) => ({ en, it: en, th: en });
const request = (value: unknown, patient = false) => new Request('http://localhost/api', { method: 'POST', headers: patient ? { 'x-medx-client': 'patient' } : {}, body: JSON.stringify(value) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const normal = { respRate: 16, spo2: 98, onOxygen: false, systolicBP: 120, heartRate: 70, consciousness: 'alert', tempC: 37 };
const abnormal = { heartRate: 130, systolicBP: 88, respRate: 28, tempC: 39.2, spo2: 89, consciousness: 'new_confusion', onOxygen: false };
const draft = { orderedBy: 'synthetic-dr', drugText: 'paracetamol', dose: '1500 mg', route: 'oral', frequency: 'daily' };

describe('MF-1 model treatment gate', () => {
  it.each([
    'Consider aspirin 300 mg for clinician review', 'Consider morphine 5 mg IV for clinician review',
    'Consider giving aspirin for clinician review', 'Consider nitroglycerin spray for clinician review',
    'Consider headache causes for clinician review',
  ])('drops model considerations: %s', async text => {
    const s = await addTurn(createSession('en').id, 'Fever and sore throat.');
    expect(modelSuggestions({ suggestions: [{ kind: 'consider', text: loc(text), why: loc('Patient report'), turn: 'T1', quote: 'Fever and sore throat.', confidence: 0.9 }] }, s)).toEqual([]);
  });
  it.each(['aspirin', '300 mg', '300mg', '5 mcg', '1 g', '2 ml', '100 units', 'IU', 'IV', 'IM', 'PO', 'SC', 'tablet', 'puff', 'give', 'start', 'administer', 'prescribe', 'take', 'dose', ...MEDRULES.drugs.flatMap(d => d.names)])('rejects unsafe ask_next text or rationale: %s', async unsafe => {
    const s = await addTurn(createSession('en').id, 'Fever and sore throat.');
    for (const field of ['text', 'why']) {
      const item = { kind: 'ask_next', text: loc('Ask about onset'), why: loc('Patient report'), turn: 'T1', quote: 'Fever and sore throat.', confidence: 0.9, [field]: loc(`Ask about ${unsafe.trim()}`) };
      expect(modelSuggestions({ suggestions: [item] }, s)).toEqual([]);
    }
  });
});

describe('MF-2 signed note adoption and immutable flags', () => {
  it('excludes dismissed dengue, preserves dismissed questions, and signs only explicitly kept considerations', async () => {
    const s = await addTurn(createSession('en').id, 'I have a fever after a trip with mosquito bites and a cough for three weeks.');
    const state = await getConsult(s.id, 'doctor');
    const record = getConsultRecord(s.id);
    const sepsis = record.suggestions.find(x => x.kind === 'consider' && /dengue/i.test(x.text.en))!;
    expect(sepsis).toBeDefined();
    await reviewConsultSuggestion(s.id, sepsis.id, 'synthetic-dr', 'dismissed');
    const question = state.suggestions.find(x => x.kind === 'rule_out' && !x.id.includes(':flag:'))!;
    await reviewConsultSuggestion(s.id, question.id, 'synthetic-dr', 'dismissed');
    const drafted = await consultNote(s.id, { mode: 'doctor', reviewerId: 'synthetic-dr', action: 'draft' });
    expect(drafted.note!.lines.some(l => l.id === `suggestion:${sepsis.id}`)).toBe(false);
    expect(drafted.note!.lines.find(l => l.id === `suggestion:${question.id}`)?.text.en).toMatch(/^Not asked \(dismissed\)/);
    const kept = drafted.note!.lines.find(l => l.section === 'considerations')!;
    expect(kept).toBeDefined();
    const signed = await consultNote(s.id, { mode: 'doctor', reviewerId: 'synthetic-dr', action: 'sign', edits: [{ lineId: kept.id, text: kept.text.en }] });
    expect(signed.note!.lines.filter(l => l.section === 'considerations')).toEqual([expect.objectContaining({ id: kept.id, status: 'edited' })]);
    expect(getAudit(s.id).at(-1)?.payload.keptConsiderationIds).toEqual([kept.id]);
  });
  it('drops every unkept consideration at sign', async () => {
    const s = await addTurn(createSession('en').id, 'I have a fever after a trip with mosquito bites and a cough for three weeks.');
    await consultNote(s.id, { mode: 'doctor', reviewerId: 'dr', action: 'draft' });
    const signed = await consultNote(s.id, { mode: 'doctor', reviewerId: 'dr', action: 'sign' });
    expect(signed.note!.lines.filter(l => l.section === 'considerations')).toEqual([]);
  });
  it('rejects red_flags edits without saving partial edits or a signature', async () => {
    const s = await addTurn(createSession('en').id, 'Chest pain and I feel sweaty');
    for (const f of s.summary!.redFlags) f.review = { reviewerId: 'dr', at: '', action: 'acknowledge' };
    saveSession(s);
    const d = await consultNote(s.id, { mode: 'doctor', reviewerId: 'dr', action: 'draft' });
    const flag = d.note!.lines.find(l => l.section === 'red_flags')!;
    await expect(consultNote(s.id, { mode: 'doctor', reviewerId: 'dr', action: 'sign', edits: [{ lineId: d.note!.lines[0].id, text: 'Changed' }, { lineId: flag.id, text: 'No flags' }] })).rejects.toMatchObject({ status: undefined, code: 'bad_request' });
    expect(getConsultRecord(s.id).notes.doctor).toEqual(d.note);
  });
  it('never drafts or returns a legacy model consideration, even through suggestion review', async () => {
    const s = createSession('en');
    const legacy = { id: 'legacy', kind: 'consider', mode: ['doctor'], source: 'model', status: 'open', text: loc('Consider aspirin'), why: loc('legacy'), confidence: 1, evidence: [] } as ConsultSuggestion;
    expect(draftConsultNote(s, [legacy], 'doctor').lines.some(l => l.section === 'considerations')).toBe(false);
    saveConsultRecord(s.id, { suggestions: [legacy], notes: {}, modelSuggestions: [legacy], modelCalls: [] });
    expect((await reviewConsultSuggestion(s.id, legacy.id, 'dr', 'dismissed')).suggestions).toEqual([]);
    expect((await getConsult(s.id, 'doctor')).suggestions.some(x => x.source === 'model')).toBe(false);
  });
});

describe('MF-4 and MF-5 carried-forward vitals', () => {
  it('normal confirmed 4 → NEWS2 16 level 2 → temperature only retains urgency and per-parameter origins; re-confirm works', async () => {
    const id = createSession('en').id;
    await vitals(request({ recordedBy: 'n', vitals: normal }), ctx(id));
    await confirm(request({ reviewerId: 'n', level: 4 }), ctx(id));
    const worsened = await (await vitals(request({ recordedBy: 'n', vitals: abnormal }), ctx(id))).json();
    expect(worsened.triage).toMatchObject({ suggestedLevel: 2, warningScore: 16, confirmed: { level: 4 } });
    const partial = await (await vitals(request({ recordedBy: 'n', vitals: { tempC: 37.5 } }), ctx(id))).json();
    expect(partial.triage).toMatchObject({ suggestedLevel: 2, warningScore: 14, confirmed: { level: 4 } });
    for (const key of Object.keys(abnormal)) expect(partial.triage.vitalSources[key].entryId).toBe(partial.vitals[key === 'tempC' ? 2 : 1].id);
    for (const lang of ['en', 'it', 'th']) expect(partial.triage.reasons.some((r: Record<string, string>) => /re-confirm|riconfermare|กรุณายืนยันอีกครั้ง/.test(r[lang]))).toBe(true);
    expect(partial.triage.reasons.some((r: { en: string }) => /carried forward/.test(r.en))).toBe(true);
    const reconfirmed = await (await confirm(request({ reviewerId: 'n', level: 2 }), ctx(id))).json();
    expect(reconfirmed.triage.confirmed.level).toBe(2);
    expect(reconfirmed.triage.reasons.some((r: { en: string }) => /re-confirm/.test(r.en))).toBe(false);
    expect(getAudit(id).filter(a => a.type === 'triage_confirmed')).toHaveLength(2);
  });
});

describe('MF-6 and MF-7 incomplete prescribing checks', () => {
  it.each([
    ['methotrexate', '10 mg', 'daily'], ['warfarin', '50 mg', 'daily'], ['ibuprofen', '800 mg x2', 'tid'],
    ['paracetamol', '1000 mg', 'every 4-6 hours prn'], ['insulin', '100 units', 'tid'], ['paracetamol', '500 mg', 'x2'],
  ])('one unchecked alert for %s %s %s', (drugText, dose, frequency) => {
    const o: MedicationOrder = { ...draft, drugText, dose, frequency, ...parsePrescription(dose, frequency), id: 'order', generic: null, drugClass: null, at: '', status: 'draft', checks: [], overrides: [] };
    const checks = prescribingChecks(createSession('en'), o);
    expect(checks.filter(a => a.ruleId === 'MR-DOSE-UNCHECKED')).toEqual([expect.objectContaining({ kind: 'dose_range', severity: 'moderate', message: expect.objectContaining({ en: 'Dose not checked — verify against a full reference' }) })]);
    if (drugText === 'methotrexate') expect(checks).toContainEqual(expect.objectContaining({ ruleId: 'MR-METHOTREXATE-DAILY', severity: 'high' }));
  });
  it('does not raise daily methotrexate caution for an unparsed weekly schedule, but does flag the unchecked dose', () => {
    const o: MedicationOrder = { ...draft, drugText: 'methotrexate', dose: '10 mg', frequency: 'weekly', doseMg: 10, id: 'order', generic: null, drugClass: null, at: '', status: 'draft', checks: [], overrides: [] };
    const checks = prescribingChecks(createSession('en'), o);
    expect(checks.some(a => a.ruleId === 'MR-METHOTREXATE-DAILY')).toBe(false);
    expect(checks.some(a => a.ruleId === 'MR-DOSE-UNCHECKED')).toBe(true);
  });
  it('amoxicillin 1 g tid flags missing allergies; recorded allergy and explicit no-known evidence resolve unknown status', async () => {
    const id = createSession('en').id;
    const response = await medication(request({ ...draft, drugText: 'amoxicillin', dose: '1 g', frequency: 'tid' }), ctx(id));
    const s = await response.json();
    expect(s.orders.medications[0].checks).toContainEqual(expect.objectContaining({ ruleId: 'MR-ALLERGY-UNKNOWN', kind: 'allergy_conflict', severity: 'moderate' }));
    for (const sentence of ['I am allergic to penicillin.', 'I have no known allergies.']) {
      const recorded = await addTurn(createSession('en').id, sentence);
      const checks = prescribingChecks(recorded, s.orders.medications[0]);
      expect(checks.some(a => a.ruleId === 'MR-ALLERGY-UNKNOWN')).toBe(false);
      if (sentence.includes('penicillin')) expect(checks.some(a => a.kind === 'allergy_conflict' && a.severity === 'high')).toBe(true);
    }
  });
});

describe('MF-8 override rationale', () => {
  it.each(['.', '.....', '   ', 'a!b?c.d', '😀😀😀😀😀', '1234', 'abcd'])('HTTP 400 without mutation for %j', async reason => {
    const id = createSession('en').id;
    const s = await (await medication(request(draft), ctx(id))).json();
    const o = s.orders.medications[0];
    const audit = getAudit(id);
    expect((await submit(request({ orderedBy: 'dr', overrides: [{ alertId: o.checks.find((a: { severity: string }) => a.severity === 'high').id, reason }] }), ctx(id, o.id))).status).toBe(400);
    expect(getSession(id)?.orders?.medications[0].status).toBe('draft'); expect(getAudit(id)).toEqual(audit);
  });
  it.each(['Review123', 'ทบทวนแล้ว', 'Valutato'])('accepts substantive Unicode reason %s and audits submission', async reason => {
    const id = createSession('en').id;
    const s = await (await medication(request(draft), ctx(id))).json(), o = s.orders.medications[0];
    expect((await submit(request({ orderedBy: 'dr', overrides: [{ alertId: o.checks.find((a: { severity: string }) => a.severity === 'high').id, reason }] }), ctx(id, o.id))).status).toBe(200);
    const type: AuditType = 'order_submitted';
    expect(getAudit(id).at(-1)?.type).toBe(type);
  });
});

describe('patient-scoped routes', () => {
  it('allowlists GET and POST responses and permits the mobile CORS header', async () => {
    const s = await addTurn(createSession('en').id, 'I have a fever after a trip with mosquito bites and a cough for three weeks.');
    s.turns.push({ id: 'secret-clinician', role: 'clinician', lang: 'en', text: 'Clinician private discussion', at: '' }); saveSession(s);
    await medication(request(draft), ctx(s.id));
    const get = await (await sessionGet(new Request(`http://localhost/api/sessions/${s.id}?view=patient`), ctx(s.id))).json();
    expect(Object.keys(get)).toEqual(['session']);
    const check = (value: typeof get.session) => {
      expect(Object.keys(value).sort()).toEqual(['code', 'id', 'patientLang', 'status', 'summary', 'turns']);
      expect(value.turns.every((t: { role: string }) => t.role === 'patient')).toBe(true);
      expect(Object.keys(value.summary).sort()).toEqual(['abstained', 'nextQuestion', 'redFlags']);
      expect(JSON.stringify(value)).not.toContain('Clinician private discussion');
    };
    check(get.session);
    const posted = await (await turns(request({ text: 'Chest pain and I feel sweaty. My phone is 0812345678.' }, true), ctx(s.id))).json();
    check(posted); expect(JSON.stringify(posted)).not.toContain('0812345678');
    expect(posted.summary.redFlags.length).toBeGreaterThan(0);
    for (const f of posted.summary.redFlags) expect(Object.keys(f).sort()).toEqual(['patientMessage', 'severity']);
    const full = await (await sessionGet(new Request(`http://localhost/api/sessions/${s.id}`), ctx(s.id))).json();
    expect(full.audit).toBeDefined(); expect(full.session.orders).toBeDefined();
    expect(OPTIONS(new Request('http://localhost/api', { method: 'OPTIONS' })).headers.get('Access-Control-Allow-Headers')).toContain('x-medx-client');
  });
});
