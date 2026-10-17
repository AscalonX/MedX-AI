import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VitalRuleFile } from '@medx/shared';
import vitalrules from '@medx/shared/src/vitalrules.json';
import { createSession, addTurn } from '../pipeline';
import { assessTriage } from '../triage';
import { parsePrescription, prescribingChecks } from '../orders';
import { MEDRULES } from '../medrules';
import { addConsultTurn, consultNote, getConsult, ruleSuggestions } from '../consult';
import { loadConsultRules } from '../consultRules';
import { getAudit, getSession, saveSession } from '../store';
import { POST as vitals } from '../../../app/api/sessions/[id]/vitals/route';
import { POST as confirm } from '../../../app/api/sessions/[id]/triage/confirm/route';
import { POST as investigation } from '../../../app/api/sessions/[id]/orders/investigations/route';
import { POST as medication } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as submit } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { POST as cancel } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/cancel/route';
import { POST as pharmacy } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/pharmacy/route';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-w12-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
const request = (v: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(v) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const normal = { respRate: 16, spo2: 98, onOxygen: false, systolicBP: 120, heartRate: 70, consciousness: 'alert' as const, tempC: 37 };
const draft = { orderedBy: 'dr', drugText: 'paracetamol', dose: '500 mg', frequency: 'every 6 hours', route: 'oral' };
async function make(id: string, values = {}) { const r = await medication(request({ ...draft, ...values }), ctx(id)); expect(r.status).toBe(200); return (await r.json()).orders.medications.at(-1); }

describe('vitals and triage routes and NEWS2 rules', () => {
  it.each([
    ['normal', normal, 4, 0], ['score six', { ...normal, respRate: 22, spo2: 95, systolicBP: 105, heartRate: 105, tempC: 38.5 }, 2, 6],
    ['confusion', { ...normal, consciousness: 'new_confusion' as const }, 2, 3], ['score one', { ...normal, heartRate: 95 }, 3, 1],
    ['score four', { ...normal, respRate: 22, heartRate: 95, tempC: 38.2 }, 3, 4],
    ['score nineteen', { ...normal, respRate: 26, spo2: 90, onOxygen: true, systolicBP: 88, heartRate: 135, consciousness: 'pain' as const, tempC: 39.5 }, 2, 19],
    ['cold', { ...normal, tempC: 35 }, 2, 3], ['36 C', { ...normal, tempC: 36 }, 3, 1], ['SBP220', { ...normal, systolicBP: 220 }, 2, 3],
    ['incomplete', { heartRate: 80 }, 3, undefined], ['incomplete low oxygen', { spo2: 88 }, 2, undefined], ['rounded temperature', { ...normal, tempC: 35.05 }, 3, 1],
  ])('%s', (_name, values, level, score) => {
    const result = assessTriage(createSession('en', { persist: false }), values);
    expect(result.suggestedLevel).toBe(level); expect(result.warningScore).toBe(score);
  });
  it.each((vitalrules.bands as VitalRuleFile['bands']).map((band, i) => ({ band, i })))('scores band $i and emits its alert', ({ band }) => {
    const n = band.min ?? band.max!;
    const value = band.vital === 'consciousness' ? (n === 0 ? 'alert' : 'new_confusion') : band.vital === 'onOxygen' ? !!n : n;
    const result = assessTriage(createSession('en', { persist: false }), { ...normal, [band.vital]: value });
    expect(result.warningScore).toBe(band.points);
    expect(result.vitalAlerts.some(a => a.ruleId === band.alert?.ruleId)).toBe(!!band.alert);
  });
  it('supports categorical equals and incompleteVitals predicates with first-match precedence', () => {
    const bank = structuredClone(vitalrules) as VitalRuleFile;
    bank.bands = bank.bands.filter(b => b.vital !== 'onOxygen' && b.vital !== 'consciousness');
    bank.bands.push({ vital: 'onOxygen', equals: false, points: 0 }, { vital: 'consciousness', equals: 'alert', points: 0 });
    bank.levels.unshift({ level: 2, when: { incompleteVitals: true }, reason: { en: 'incomplete', it: 'incomplete', th: 'incomplete' } });
    expect(assessTriage(createSession('en', { persist: false }), normal, bank)).toMatchObject({ warningScore: 0, suggestedLevel: 4 });
    expect(assessTriage(createSession('en', { persist: false }), {}, bank).suggestedLevel).toBe(2);
  });
  it.each([{ heartRate: -1 }, { heartRate: '80' }, { spo2: 101 }, { tempC: 100 }, { respRate: 0 }, { painScore: 11 }, { painScore: 0.5 }, { onOxygen: 1 }, { consciousness: 'asleep' }, { systolicBP: 100, diastolicBP: 120 }, { id: 'spoof' }, {}, null])('rejects nonsense without mutation: %j', async values => {
    const s = createSession('en'); const before = getAudit(s.id);
    expect((await vitals(request({ recordedBy: 'nurse', vitals: values }), ctx(s.id))).status).toBe(400);
    expect(getSession(s.id)?.vitals).toBeUndefined(); expect(getAudit(s.id)).toEqual(before);
  });
  it('records, confirms with downgrade rationale, audits, and never auto-confirms or replaces confirmation', async () => {
    const s = createSession('en');
    let r = await vitals(request({ recordedBy: 'n', vitals: { heartRate: 70 } }), ctx(s.id));
    expect(r.status).toBe(200); expect((await r.json()).triage).not.toHaveProperty('confirmed');
    expect((await confirm(request({ reviewerId: 'n', level: 4 }), ctx(s.id))).status).toBe(400);
    expect((await confirm(request({ reviewerId: 'n', level: 4, note: 'Assessed in person' }), ctx(s.id))).status).toBe(200);
    r = await vitals(request({ recordedBy: 'n', vitals: { spo2: 88 } }), ctx(s.id));
    expect((await r.json()).triage).toMatchObject({ suggestedLevel: 2, confirmed: { level: 4 } });
    await addTurn(s.id, 'Chest pain and I feel sweaty'); expect(getSession(s.id)!.triage).toMatchObject({ suggestedLevel: 1, confirmed: { level: 4 } });
    expect(getAudit(s.id).filter(a => a.type === 'vitals_recorded')).toHaveLength(2);
    expect(getAudit(s.id).filter(a => a.type === 'triage_confirmed')).toHaveLength(1);
  });
  it.each([0, 6, 2.5, '3', null])('validates confirmation level %s', async level => {
    expect((await confirm(request({ reviewerId: 'n', level }), ctx(createSession('en').id))).status).toBe(400);
  });
  it('urgent flag beats normal score', async () => {
    const s = await addTurn(createSession('en').id, 'Chest pain'); s.summary!.redFlags[0].severity = 'urgent';
    expect(assessTriage(s, normal).suggestedLevel).toBe(2);
  });
});

describe('doctor orders and prescribing gates', () => {
  it.each(MEDRULES.drugs.filter(d => d.doseRange).map(drug => ({ drug })))('checks dose boundaries for $drug.generic', ({ drug }) => {
    const s = createSession('en', { persist: false });
    const order = { ...draft, drugText: drug.names[0].trim(), id: 'new-order', generic: drug.generic, drugClass: drug.drugClass, doseMg: drug.doseRange!.maxSingleMg!, timesPerDay: 1, at: '', status: 'draft' as const, checks: [], overrides: [] };
    const baseline = prescribingChecks(s, order).filter(a => a.kind === 'dose_range'); expect(baseline).toEqual([]);
    const single = prescribingChecks(s, { ...order, doseMg: drug.doseRange!.maxSingleMg! + 1 });
    expect(single.some(a => a.ruleId === 'MR-DOSE-01' && a.severity === 'high')).toBe(true);
    const daily = prescribingChecks(s, { ...order, timesPerDay: drug.doseRange!.maxDailyMg! / order.doseMg + 1 });
    expect(daily.some(a => a.ruleId === 'MR-DOSE-02' && a.severity === 'high')).toBe(true);
  });
  it('validates catalog codes and returns updated session with a submitted investigation', async () => {
    const id = createSession('en').id;
    expect((await investigation(request({ orderedBy: 'dr', code: 'invented' }), ctx(id))).status).toBe(400);
    const response = await investigation(request({ orderedBy: 'dr', code: 'ecg', fromSuggestionId: 'consider:chest' }), ctx(id));
    expect(response.status).toBe(200); expect((await response.json()).orders.investigations[0]).toMatchObject({ code: 'ecg', fromSuggestionId: 'consider:chest', status: 'submitted' });
    expect(getAudit(id).at(-1)?.type).toBe('order_submitted');
  });
  it.each([['500 mg', 'every 6 hours', 500, 4], ['1 g', 'bid', 1000, 2], ['50 mcg', 'daily', 0.05, 1], ['500 mg', '3 times per day', 500, 3], ['one tablet', 'as needed', undefined, undefined]])('parses %s / %s conservatively', (dose, frequency, doseMg, timesPerDay) => {
    expect(parsePrescription(dose, frequency)).toEqual({ ...(doseMg === undefined ? {} : { doseMg }), ...(timesPerDay === undefined ? {} : { timesPerDay }) });
  });
  it('matches dictionary and enforces both dose limits; unknown and unparsed drugs do not invent doses', async () => {
    const id = createSession('en').id, o = await make(id, { dose: '1500 mg' });
    expect(o).toMatchObject({ generic: 'paracetamol', doseMg: 1500, timesPerDay: 4 });
    expect(o.checks.filter((a: { kind: string }) => a.kind === 'dose_range').map((a: { ruleId: string }) => a.ruleId)).toEqual(['MR-DOSE-01', 'MR-DOSE-02']);
    const unknown = await make(id, { drugText: 'mystery pill' }); expect(unknown.checks.some((a: { kind: string }) => a.kind === 'unknown_medication')).toBe(true);
    const unparsed = await make(createSession('en').id, { dose: 'one tablet' }); expect(unparsed).not.toHaveProperty('doseMg'); expect(unparsed.checks).toEqual([]);
  });
  it('uses current meds, allergies, pregnancy, and other active orders; excludes pharmacist-discontinued meds', async () => {
    const s = await addTurn(createSession('en').id, 'I take warfarin. I am allergic to penicillin. I am pregnant.');
    const ib = await make(s.id, { drugText: 'ibuprofen' }); expect(ib.checks.some((a: { kind: string }) => a.kind === 'interaction')).toBe(true);
    expect(ib.checks.some((a: { kind: string }) => a.kind === 'pregnancy_caution')).toBe(true);
    const am = await make(s.id, { drugText: 'amoxicillin' }); expect(am.checks.some((a: { kind: string }) => a.kind === 'allergy_conflict')).toBe(true);
    const s2 = getSession(s.id)!; s2.summary!.medications!.forEach(m => { m.status = 'discontinued'; }); saveSession(s2);
    const other = await make(s.id, { drugText: 'naproxen' }); expect(other.checks.some((a: { kind: string }) => a.kind === 'duplicate_therapy')).toBe(true);
    expect(other.checks.some((a: { kind: string }) => a.kind === 'interaction')).toBe(false);
  });
  it('requires all high overrides, returns with note, rechecks edits, resubmits, verifies, and cancels with audit', async () => {
    const id = createSession('en').id, o = await make(id, { dose: '1500 mg' }); const context = ctx(id, o.id);
    expect((await submit(request({ orderedBy: 'dr', overrides: [] }), context)).status).toBe(409);
    expect((await submit(request({ orderedBy: 'dr', overrides: [{ alertId: o.checks[0].id, reason: ' ' }] }), context)).status).toBe(400);
    expect((await submit(request({ orderedBy: 'dr', overrides: [{ alertId: 'fake', reason: 'x' }] }), context)).status).toBe(400);
    const overrides = o.checks.filter((a: { severity: string }) => a.severity === 'high').map((a: { id: string }) => ({ alertId: a.id, reason: 'Reviewed synthetic case' }));
    expect((await submit(request({ orderedBy: 'dr', overrides }), context)).status).toBe(200);
    expect(getSession(id)!.orders!.medications[0].overrides[0].by).toBe('dr');
    expect((await medication(request({ ...draft, orderId: o.id }), ctx(id))).status).toBe(409);
    expect((await pharmacy(request({ reviewerId: 'ph', action: 'return' }), context)).status).toBe(400);
    expect((await pharmacy(request({ reviewerId: 'ph', action: 'return', note: 'Please review dose' }), context)).status).toBe(200);
    const edit = await medication(request({ ...draft, orderId: o.id }), ctx(id)); expect(edit.status).toBe(200);
    expect((await edit.json()).orders.medications[0]).toMatchObject({ status: 'draft', checks: [], overrides: [] });
    expect((await submit(request({ orderedBy: 'dr', overrides: [] }), context)).status).toBe(200);
    expect((await pharmacy(request({ reviewerId: 'ph', action: 'verify' }), context)).status).toBe(200);
    expect((await cancel(request({ orderedBy: 'dr', reason: 'No longer needed' }), context)).status).toBe(200);
    expect(getSession(id)!.orders!.medications[0].status).toBe('cancelled');
    expect(getAudit(id).filter(a => a.type === 'order_pharmacy_action')).toHaveLength(2);
    expect(getAudit(id).at(-1)?.payload).toMatchObject({ action: 'cancel', orderId: o.id });
    expect((await submit(request({ orderedBy: 'dr', overrides: [] }), context)).status).toBe(409);
  });
  it('rechecks new interactions at verify and blocks stale overrides', async () => {
    const id = createSession('en').id, o = await make(id, { drugText: 'ibuprofen' });
    expect((await submit(request({ orderedBy: 'dr', overrides: [] }), ctx(id, o.id))).status).toBe(200);
    await make(id, { drugText: 'warfarin' });
    expect((await pharmacy(request({ reviewerId: 'ph', action: 'verify' }), ctx(id, o.id))).status).toBe(409);
  });
  it('redacts free text and serializes concurrent drafts', async () => {
    const id = createSession('en').id;
    await Promise.all([make(id), make(id, { drugText: 'My name is John Smith. mystery' })]);
    expect(getSession(id)!.orders!.medications).toHaveLength(2); expect(JSON.stringify(getSession(id))).not.toContain('John Smith');
  });
});

describe('route errors', () => {
  const routes = [
    [vitals, { recordedBy: 'n', vitals: normal }], [confirm, { reviewerId: 'n', level: 2 }],
    [investigation, { orderedBy: 'dr', code: 'ecg' }], [medication, draft],
    [submit, { orderedBy: 'dr', overrides: [] }], [cancel, { orderedBy: 'dr' }], [pharmacy, { reviewerId: 'ph', action: 'verify' }],
  ] as const;
  it.each(routes)('returns 404 for missing session and 400 for unknown/malformed payload', async (route, value) => {
    expect((await route(request(value), ctx('absent', 'absent'))).status).toBe(404);
    expect((await route(request({ ...value, extra: true }), ctx(createSession('en').id))).status).toBe(400);
    expect((await route(new Request('http://localhost/api', { method: 'POST', body: '{' }), ctx('absent'))).status).toBe(400);
  });
  it.each([submit, cancel, pharmacy])('returns 404 for missing order', async route => {
    const id = createSession('en').id;
    const value = route === pharmacy ? { reviewerId: 'ph', action: 'verify' } : route === submit ? { orderedBy: 'dr', overrides: [] } : { orderedBy: 'dr' };
    expect((await route(request(value), ctx(id, 'absent'))).status).toBe(404);
  });
});

describe('consult regression fixes', () => {
  it('shows doctor considerations for the live chest-pain wording with catalog workups and guidelines', async () => {
    const s = createSession('en');
    await addConsultTurn(s.id, { mode: 'doctor', speaker: 'patient', text: 'Chest pain since this morning, going to my left arm, and I feel sweaty' });
    const d = await getConsult(s.id, 'doctor'), n = await getConsult(s.id, 'nurse');
    const considers = d.suggestions.filter(x => x.kind === 'consider'); expect(considers.length).toBeGreaterThan(0);
    expect(considers[0].workup?.length).toBeGreaterThan(0); expect(considers.some(x => x.guideline?.url.startsWith('https://'))).toBe(true);
    expect(n.suggestions.some(x => x.kind === 'consider')).toBe(false); expect(d.modelCalls).toEqual([]);
    expect(d.suggestions.filter(x => x.status === 'open').length).toBeLessThanOrEqual(8);
  });
  it('keeps earlier urinary complaint and new chest complaint as evidenced note lines; groups missing fields', async () => {
    const s = createSession('en');
    for (const text of ['Burning when I urinate since yesterday', 'Chest pain since this morning, going to my left arm, and I feel sweaty']) await addConsultTurn(s.id, { mode: 'doctor', speaker: 'patient', text });
    const note = (await consultNote(s.id, { reviewerId: 'dr', mode: 'doctor', action: 'draft' })).note!;
    const complaints = note.lines.filter(l => l.section === 'presenting_complaint');
    expect(complaints.some(l => /urinat/i.test(l.text.en))).toBe(true); expect(complaints.some(l => /chest pain/i.test(l.text.en))).toBe(true);
    expect(complaints.every(l => l.evidence.length && l.status === 'supported')).toBe(true);
    const missing = note.lines.filter(l => l.text.en.startsWith('Not yet asked:')); expect(missing).toHaveLength(1);
    expect(missing[0].text.en).toContain('duration'); expect(missing[0].status).toBe('unsupported');
    expect(note.lines.some(l => /pregnancy_status|medical_history|associated_symptoms/.test(l.text.en))).toBe(false);
    expect(note.lines.filter(l => l.section !== 'open_questions').every(l => l.evidence.length > 0)).toBe(true);
  });
  it('merges escalation cards per red flag without repeating banner action text', async () => {
    const s = await addTurn(createSession('en').id, 'Chest pain');
    s.summary!.redFlags.push(structuredClone(s.summary!.redFlags[0]));
    const cards = ruleSuggestions(s, loadConsultRules()).filter(x => x.id.startsWith('rule_out:flag:'));
    expect(new Set(cards.map(x => x.ruleId)).size).toBe(cards.length);
    expect(cards[0].why).not.toEqual(s.summary!.redFlags[0].action);
  });
});
