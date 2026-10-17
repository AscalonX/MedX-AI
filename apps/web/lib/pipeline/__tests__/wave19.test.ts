import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedAlert, MedicationOrder, MedRuleFile } from '@medx/shared';
import { addTurn, createSession, metrics } from '../pipeline';
import { alternativesFor, dispenseOrder, medicationAction, medicationOrder, pickupAction, prescribingChecks } from '../orders';
import { MEDRULES } from '../medrules';
import { patientView } from '../patientView';
import { seedDemo } from '../seed';
import { getAudit, getConsultRecord, getSession, saveSession } from '../store';
import { deriveTrace } from '../trace';
import { POST as postDispense } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/dispense/route';
import { POST as postPharmacy } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/pharmacy/route';
import { POST as postCancel } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/cancel/route';
import { POST as postSubmit } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { POST as postDraft } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as postPickup } from '../../../app/api/sessions/[id]/pickup/route';
import { GET as getSessionRoute } from '../../../app/api/sessions/[id]/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w19-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); rmSync(dir, { recursive: true, force: true }); });

const doctor = 'Dr. Marco Bianchi', ph1 = 'Pharmacist Laura Conti', ph2 = 'Pharmacist Nattaya Wong';
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const draft = { orderedBy: doctor, drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' };
const req = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const order = (id: string, orderId: string) => getSession(id)!.orders!.medications.find(o => o.id === orderId)!;
const highOverrides = (o: MedicationOrder) => o.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed synthetic case' }));
async function patient(text = 'I have a headache since today. No allergies.') { return (await addTurn(createSession('en').id, text)).id; }
async function drafted(id: string, over: Partial<typeof draft> = {}) {
  const s = await medicationOrder(id, { ...draft, ...over }); return s.orders!.medications.at(-1)!;
}
async function submitted(id: string, over: Partial<typeof draft> = {}) {
  const o = await drafted(id, over); await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: highOverrides(o) }); return order(id, o.id);
}
async function verified(id: string, over: Partial<typeof draft> = {}) {
  const o = await submitted(id, over); await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' }); return order(id, o.id);
}
async function dispensed(id: string, over: Partial<typeof draft> = {}) {
  const o = await verified(id, over); await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL }); return order(id, o.id);
}
/** Response status plus proof that a refused write changed neither the session nor the audit. */
async function refused(id: string, call: () => Promise<Response>) {
  const before = getSession(id), audit = getAudit(id);
  const response = await call(); const body = await response.json();
  expect(getSession(id)).toEqual(before); expect(getAudit(id)).toEqual(audit);
  return { status: response.status, body };
}
function withAlternatives<T>(table: NonNullable<MedRuleFile['alternatives']>, fn: () => Promise<T>) {
  const previous = MEDRULES.alternatives;
  MEDRULES.alternatives = table;
  return fn().finally(() => { if (previous === undefined) delete MEDRULES.alternatives; else MEDRULES.alternatives = previous; });
}
const note = { en: 'Options for prescriber review', it: 'Opzioni per la revisione del prescrittore', th: 'ทางเลือกให้แพทย์ผู้สั่งพิจารณา' };

describe('W19 pharmacist 1: return with report', () => {
  it('stores a deduped report on return only, with the note, and audits it', async () => {
    const id = await patient('I have a headache. I take warfarin. I am allergic to penicillin.');
    const o = await submitted(id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' });
    const alertId = o.checks[0].id;
    const r = await postPharmacy(req({ reviewerId: ph1, action: 'return', note: 'Interaction with warfarin', alertIds: [alertId, alertId], suggestedGenerics: ['Paracetamol', 'paracetamol '] }), ctx(id, o.id));
    expect(r.status).toBe(200);
    const after = order(id, o.id);
    expect(after.status).toBe('returned');
    expect(after.pharmacist).toMatchObject({ action: 'return', by: ph1, note: 'Interaction with warfarin', report: { alertIds: [alertId], suggestedGenerics: ['paracetamol'] } });
    expect(after.generic).toBe('ibuprofen'); // suggestions are never applied to the order
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'order_pharmacy_action', actorId: ph1, payload: { orderId: o.id, action: 'return', report: { alertIds: [alertId], suggestedGenerics: ['paracetamol'] } } });
  });
  it('return without report fields stores an empty report; verify never stores one', async () => {
    const id = await patient();
    const a = await submitted(id);
    await medicationAction(id, a.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Please confirm duration' });
    expect(order(id, a.id).pharmacist!.report).toEqual({ alertIds: [], suggestedGenerics: [] });
    const b = await submitted(id);
    await medicationAction(id, b.id, 'pharmacy', { reviewerId: ph1, action: 'verify', alertIds: b.checks.map(c => c.id), suggestedGenerics: ['ibuprofen'] });
    expect(order(id, b.id).status).toBe('verified'); expect(order(id, b.id).pharmacist).not.toHaveProperty('report');
  });
  it.each([
    ['missing note', { action: 'return' }],
    ['blank note', { action: 'return', note: '   ' }],
    ['unknown action', { action: 'approve', note: 'x' }],
    ['unknown alert id', { action: 'return', note: 'Check', alertIds: ['MR-NOT-THIS-ORDER'] }],
    ['alertIds not an array', { action: 'return', note: 'Check', alertIds: 'MR-X' }],
    ['non-dictionary generic', { action: 'return', note: 'Check', suggestedGenerics: ['unobtainium'] }],
    ['unspecified generic', { action: 'return', note: 'Check', suggestedGenerics: ['statin (unspecified)'] }],
    ['the ordered generic', { action: 'return', note: 'Check', suggestedGenerics: ['paracetamol'] }],
    ['six distinct generics', { action: 'return', note: 'Check', suggestedGenerics: ['ibuprofen', 'naproxen', 'cetirizine', 'loratadine', 'omeprazole', 'metformin'] }],
    ['suggestedGenerics not an array', { action: 'return', note: 'Check', suggestedGenerics: 'ibuprofen' }],
    ['unknown property', { action: 'return', note: 'Check', report: {} }],
  ])('400 for %s, atomically', async (_label, extra) => {
    const id = await patient(); const o = await submitted(id);
    const { status, body } = await refused(id, () => postPharmacy(req({ reviewerId: ph1, ...extra }), ctx(id, o.id)));
    expect(status).toBe(400); expect(body.code).toBe('bad_request');
  });
  it('rejects an alert id that belongs to another order of the same session', async () => {
    const id = await patient('I have a headache. I take warfarin.');
    const other = await drafted(id, { drugText: 'naproxen', dose: '250 mg', frequency: 'bid' });
    const o = await submitted(id);
    expect(other.checks.length).toBeGreaterThan(0);
    const { status } = await refused(id, () => postPharmacy(req({ reviewerId: ph1, action: 'return', note: 'Check', alertIds: [other.checks[0].id] }), ctx(id, o.id)));
    expect(status).toBe(400);
  });
  it('accepts five distinct generics after dedupe', async () => {
    const id = await patient(); const o = await submitted(id);
    const list = ['ibuprofen', 'Ibuprofen', 'naproxen', 'cetirizine', 'loratadine', 'omeprazole'];
    expect((await postPharmacy(req({ reviewerId: ph1, action: 'return', note: 'Options', suggestedGenerics: list }), ctx(id, o.id))).status).toBe(200);
    expect(order(id, o.id).pharmacist!.report!.suggestedGenerics).toEqual(['ibuprofen', 'naproxen', 'cetirizine', 'loratadine', 'omeprazole']);
  });
  it('the prescriber can confirm again: resubmit clears the report and goes back to pharmacist 1', async () => {
    const id = await patient(); const o = await submitted(id);
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Confirm', suggestedGenerics: ['ibuprofen'] });
    expect((await postSubmit(req({ orderedBy: doctor, overrides: [] }), ctx(id, o.id))).status).toBe(200);
    expect(order(id, o.id).status).toBe('submitted'); expect(order(id, o.id)).not.toHaveProperty('pharmacist');
  });
});

describe('W19 pharmacist 2: dispense with two-person check', () => {
  it('dispenses a verified order by a second pharmacist with every checklist item', async () => {
    const id = await patient(); const o = await verified(id);
    const r = await postDispense(req({ reviewerId: ph2, checklist: ALL, note: 'Labelled, counselled. Call 0812345678' }), ctx(id, o.id));
    expect(r.status).toBe(200);
    const after = order(id, o.id);
    expect(after.status).toBe('dispensed');
    expect(after.dispense).toMatchObject({ by: ph2, checklist: ALL }); expect(after.dispense!.at).toMatch(/^\d{4}-/);
    expect(after.dispense!.note).not.toContain('0812345678');
    const last = getAudit(id).at(-1)!;
    expect(last).toMatchObject({ type: 'order_dispensed', actor: 'clinician', actorId: ph2, payload: { orderId: o.id, verifiedBy: ph1, by: ph2, checklist: ALL } });
    expect(JSON.stringify(last)).not.toContain('0812345678');
  });
  it.each(['draft', 'submitted', 'returned', 'cancelled', 'dispensed'] as const)('409 unless verified (%s)', async status => {
    const id = await patient();
    const o = status === 'dispensed' ? await dispensed(id) : status === 'draft' || status === 'cancelled' ? await drafted(id) : await submitted(id);
    if (status === 'returned') await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Check' });
    if (status === 'cancelled') await medicationAction(id, o.id, 'cancel', { orderedBy: doctor });
    expect(order(id, o.id).status).toBe(status);
    const { status: code, body } = await refused(id, () => postDispense(req({ reviewerId: 'Pharmacist Third Person', checklist: ALL }), ctx(id, o.id)));
    expect(code).toBe(409); expect(body.error).toMatch(/verified/i);
  });
  it.each([ph1, 'pharmacist laura conti', '  Pharmacist   Laura Conti ', 'pharm-conti'])('409 when the verifying pharmacist tries to dispense (%s)', async who => {
    const id = await patient(); const o = await verified(id);
    const { status, body } = await refused(id, () => postDispense(req({ reviewerId: who, checklist: ALL }), ctx(id, o.id)));
    expect(status).toBe(409); expect(body.error).toMatch(/second pharmacist/i);
  });
  it.each<[string, unknown]>([
    ...Object.keys(ALL).map((k): [string, unknown] => [`${k} false`, { ...ALL, [k]: false }]),
    ['missing item', { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true }],
    ['extra item', { ...ALL, extra: true }],
    ['string value', { ...ALL, labelled: 'true' }],
    ['not an object', [true, true, true, true, true, true]],
    ['null', null],
  ])('400 unless every checklist value is true: %s', async (_label, checklist) => {
    const id = await patient(); const o = await verified(id);
    const { status } = await refused(id, () => postDispense(req({ reviewerId: ph2, checklist }), ctx(id, o.id)));
    expect(status).toBe(400);
  });
  it('400 for a missing checklist or unknown property; 404 for unknown session or order', async () => {
    const id = await patient(); const o = await verified(id);
    expect((await refused(id, () => postDispense(req({ reviewerId: ph2 }), ctx(id, o.id)))).status).toBe(400);
    expect((await refused(id, () => postDispense(req({ reviewerId: ph2, checklist: ALL, by: ph2 }), ctx(id, o.id)))).status).toBe(400);
    expect((await refused(id, () => postDispense(req({ checklist: ALL }), ctx(id, o.id)))).status).toBe(400);
    expect((await postDispense(req({ reviewerId: ph2, checklist: ALL }), ctx('missing', o.id))).status).toBe(404);
    expect((await refused(id, () => postDispense(req({ reviewerId: ph2, checklist: ALL }), ctx(id, 'missing')))).status).toBe(404);
  });
  it('dispensed orders cannot be cancelled, edited, resubmitted or re-reviewed', async () => {
    const id = await patient(); const o = await dispensed(id);
    const cancel = await refused(id, () => postCancel(req({ orderedBy: doctor, reason: 'Changed mind' }), ctx(id, o.id)));
    expect(cancel.status).toBe(409); expect(cancel.body.error).toMatch(/Dispensed/);
    expect((await refused(id, () => postDraft(req({ ...draft, orderId: o.id }), ctx(id)))).status).toBe(409);
    expect((await refused(id, () => postSubmit(req({ orderedBy: doctor, overrides: [] }), ctx(id, o.id)))).status).toBe(409);
    expect((await refused(id, () => postPharmacy(req({ reviewerId: ph1, action: 'return', note: 'Late' }), ctx(id, o.id)))).status).toBe(409);
  });
});

describe('W19 pickup: call the patient, then collected', () => {
  it('409 for call with no medication orders, only cancelled orders, or any active order not dispensed', async () => {
    const id = await patient();
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id)))).status).toBe(409);
    const c = await drafted(id); await medicationAction(id, c.id, 'cancel', { orderedBy: doctor });
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id)))).status).toBe(409);
    await dispensed(id);
    const pending = await drafted(id, { drugText: 'cetirizine', dose: '10 mg', frequency: 'daily' });
    for (const step of ['draft', 'submitted', 'verified'] as const) {
      if (step === 'submitted') await medicationAction(id, pending.id, 'submit', { orderedBy: doctor, overrides: highOverrides(order(id, pending.id)) });
      if (step === 'verified') await medicationAction(id, pending.id, 'pharmacy', { reviewerId: ph1, action: 'verify' });
      expect(order(id, pending.id).status).toBe(step);
      const { status, body } = await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id)));
      expect(status).toBe(409); expect(body.error).toMatch(/dispensed/);
    }
    await dispenseOrder(id, pending.id, { reviewerId: ph2, checklist: ALL });
    expect((await postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id))).status).toBe(200);
  });
  it('call sets ready, re-call is allowed and audited, collected closes it, nothing after collected', async () => {
    const id = await patient(); const o = await dispensed(id);
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'collected' }), ctx(id)))).status).toBe(409);
    expect((await postPickup(req({ reviewerId: ph2, action: 'call', counter: '2' }), ctx(id))).status).toBe(200);
    expect(getSession(id)!.pickup).toMatchObject({ status: 'ready', counter: '2', calledBy: ph2 });
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'pickup_called', actorId: ph2, payload: { orderIds: [o.id], recall: false, counter: '2' } });
    expect((await postPickup(req({ reviewerId: ph1, action: 'call' }), ctx(id))).status).toBe(200);
    expect(getSession(id)!.pickup).toMatchObject({ status: 'ready', counter: '2', calledBy: ph1 });
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'pickup_called', actorId: ph1, payload: { recall: true, counter: '2' } });
    expect((await postPickup(req({ reviewerId: ph2, action: 'call', counter: '4' }), ctx(id))).status).toBe(200);
    expect(getSession(id)!.pickup!.counter).toBe('4');
    expect((await postPickup(req({ reviewerId: ph2, action: 'collected' }), ctx(id))).status).toBe(200);
    expect(getSession(id)!.pickup).toMatchObject({ status: 'collected', counter: '4', collectedBy: ph2 }); expect(getSession(id)!.pickup!.collectedAt).toMatch(/^\d{4}-/);
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'pickup_collected', actorId: ph2, payload: { orderIds: [o.id] } });
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id)))).status).toBe(409);
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'collected' }), ctx(id)))).status).toBe(409);
    expect(getAudit(id).filter(e => e.type === 'pickup_called')).toHaveLength(3);
    expect(getAudit(id).filter(e => e.type === 'pickup_collected')).toHaveLength(1);
  });
  it.each([
    ['unknown action', { reviewerId: ph2, action: 'deliver' }],
    ['missing reviewer', { action: 'call' }],
    ['counter on collected', { reviewerId: ph2, action: 'collected', counter: '2' }],
    ['over-long counter', { reviewerId: ph2, action: 'call', counter: 'x'.repeat(41) }],
    ['unknown property', { reviewerId: ph2, action: 'call', orderId: 'x' }],
  ])('400 for %s', async (_label, payload) => {
    const id = await patient(); await dispensed(id);
    expect((await refused(id, () => postPickup(req(payload), ctx(id)))).status).toBe(400);
  });
  it('404 for an unknown session', async () => {
    expect((await postPickup(req({ reviewerId: ph2, action: 'call' }), ctx('missing'))).status).toBe(404);
  });
  it('a new prescription while ready resets pickup (audited pickupReset) and blocks the call until dispensed', async () => {
    const id = await patient(); await dispensed(id);
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '3' });
    const next = await drafted(id, { drugText: 'cetirizine', dose: '10 mg', frequency: 'daily' });
    expect(getSession(id)!.pickup!.status).toBe('ready'); // a draft does not reach the pharmacy
    expect((await postSubmit(req({ orderedBy: doctor, overrides: highOverrides(next) }), ctx(id, next.id))).status).toBe(200);
    expect(getSession(id)).not.toHaveProperty('pickup');
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'order_submitted', payload: { orderId: next.id, pickupReset: true } });
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'preparing' });
    expect((await refused(id, () => postPickup(req({ reviewerId: ph2, action: 'call' }), ctx(id)))).status).toBe(409);
    // Submit without a ready pickup carries no pickupReset flag.
    const other = createSession('en').id; const plain = await drafted(other);
    await medicationAction(other, plain.id, 'submit', { orderedBy: doctor, overrides: highOverrides(plain) });
    expect(getAudit(other).at(-1)!.payload).not.toHaveProperty('pickupReset');
  });
});

describe('W19 alternatives: deterministic options for prescriber review', () => {
  const table: NonNullable<MedRuleFile['alternatives']> = [
    { id: 'ALT-TEST-PEN', kinds: ['allergy_conflict'], drugClasses: ['penicillin'], consider: ['amoxicillin', 'cefalexin', 'clarithromycin', 'metronidazole', 'atorvastatin', 'doxycycline', 'azithromycin', 'unobtainium', 'statin (unspecified)', 'azithromycin'], note, source: 'test fixture' },
    { id: 'ALT-TEST-NSAID', kinds: ['interaction'], drugClasses: ['nsaid'], consider: ['naproxen', 'celecoxib', 'paracetamol'], note, source: 'test fixture' },
  ];
  // Penicillin allergy, warfarin + simvastatin, pregnant: every dropped candidate fails one deterministic check.
  const history = 'I have a sore throat. I take warfarin. I take simvastatin. I am allergic to penicillin. I am pregnant.';
  it('keeps only candidates that pass this patient\'s allergy, interaction, duplicate and pregnancy checks', async () => {
    const id = await patient(history);
    const s = getSession(id)!;
    expect(s.summary!.medications!.map(m => m.generic)).toEqual(expect.arrayContaining(['warfarin', 'simvastatin']));
    const o = await drafted(id, { drugText: 'amoxicillin', frequency: 'tid' });
    const allergy = o.checks.find(c => c.ruleId === 'MR-ALLERGY-PEN')!;
    expect(allergy).toBeDefined();
    // amoxicillin = ordered; cefalexin = penicillin cross-sensitivity; clarithromycin = simvastatin interaction;
    // metronidazole = warfarin interaction; atorvastatin = duplicate statin; doxycycline = pregnancy; unknown / unspecified = not in dictionary.
    expect(alternativesFor(getSession(id)!, o, allergy, table)).toEqual(['azithromycin']);
    const interaction = { ...allergy, kind: 'interaction' } as MedAlert;
    expect(alternativesFor(getSession(id)!, o, interaction, table)).toEqual([]); // class/kind must both match
  });
  it('drops interacting NSAIDs and COX-2 for a warfarin patient', async () => {
    const id = await patient('I have back pain. I take warfarin. No allergies.');
    const o = await drafted(id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' });
    const interaction = o.checks.find(c => c.kind === 'interaction')!;
    expect(alternativesFor(getSession(id)!, o, interaction, table)).toEqual(['paracetamol']);
  });
  it('attaches alternatives to the matching alert only, never changes the order, and reads medrules.alternatives', async () => {
    await withAlternatives(table, async () => {
      const id = await patient(history);
      const s = await postDraft(req({ ...draft, drugText: 'amoxicillin', frequency: 'tid' }), ctx(id));
      const o = (await s.json()).orders.medications[0] as MedicationOrder;
      expect(o.generic).toBe('amoxicillin');
      expect(o.checks.find(c => c.ruleId === 'MR-ALLERGY-PEN')!.alternatives).toEqual(['azithromycin']);
      for (const c of o.checks.filter(c => c.ruleId !== 'MR-ALLERGY-PEN')) expect(c).not.toHaveProperty('alternatives');
      // Same result on every recheck (deterministic) and persisted with the order.
      expect(prescribingChecks(getSession(id)!, order(id, o.id))).toEqual(order(id, o.id).checks);
    });
  });
  it('suggests nothing when allergy status is unknown (every candidate is unchecked)', async () => {
    await withAlternatives(table, async () => {
      const id = await patient('I have a sore throat since yesterday.');
      const o = await drafted(id, { drugText: 'amoxicillin', frequency: 'tid' });
      const unknown = o.checks.find(c => c.ruleId === 'MR-ALLERGY-UNKNOWN')!;
      expect(unknown).toBeDefined(); expect(unknown).not.toHaveProperty('alternatives');
    });
  });
  it('works with no alternatives table at all', async () => {
    await withAlternatives(undefined as unknown as NonNullable<MedRuleFile['alternatives']>, async () => {
      delete MEDRULES.alternatives;
      const id = await patient(history);
      const o = await drafted(id, { drugText: 'amoxicillin', frequency: 'tid' });
      expect(o.checks.every(c => !('alternatives' in c))).toBe(true);
    });
  });
  it('every curated entry in medrules.json names dictionary generics only', () => {
    const generics = new Set(MEDRULES.drugs.map(d => d.generic));
    for (const entry of MEDRULES.alternatives ?? []) {
      expect(entry.consider.length).toBeGreaterThan(0);
      for (const g of entry.consider) expect(generics.has(g), `${entry.id}: ${g}`).toBe(true);
      for (const lang of ['en', 'it', 'th'] as const) expect(entry.note[lang].trim().length).toBeGreaterThan(0);
    }
  });
});

describe('W19 patient view: pickup status only', () => {
  it('moves null → preparing → ready → collected and never leaks drugs, staff or notes', async () => {
    const id = await patient();
    const view = async () => (await (await getSessionRoute(new Request(`http://localhost/api/sessions/${id}?view=patient`), { params: Promise.resolve({ id }) })).json()).session;
    expect((await view()).pickup).toBeNull();
    const o = await drafted(id, { drugText: 'Panadol paracetamol' });
    expect((await view()).pickup).toBeNull();
    await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: highOverrides(order(id, o.id)) });
    expect((await view()).pickup).toEqual({ status: 'preparing' });
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify', note: 'Secret verify note' });
    expect((await view()).pickup).toEqual({ status: 'preparing' });
    await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL, note: 'Secret dispense note' });
    expect((await view()).pickup).toEqual({ status: 'preparing' });
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '5' });
    expect((await view()).pickup).toEqual({ status: 'ready', counter: '5' });
    await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    const last = await view();
    expect(last.pickup).toEqual({ status: 'collected', counter: '5' });
    const json = JSON.stringify(last);
    for (const secret of ['paracetamol', 'Panadol', 'Paracetamol', ph1, ph2, 'Conti', 'Wong', doctor, 'Secret', 'checklist', 'calledBy', 'collectedBy', 'orders']) expect(json).not.toContain(secret);
  });
  it('a returned-only order is not "preparing"', async () => {
    const id = await patient(); const o = await submitted(id);
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Check' });
    expect(patientView(getSession(id)!).pickup).toBeNull();
  });
});

describe('W19 audit + case trace', () => {
  it('appends one audit event per action and derives PII-free pharmacist nodes', async () => {
    const id = await patient('My name is Maria Rossi, phone 081 234 5678. I have a headache. No allergies.');
    const o = await submitted(id);
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Maria Rossi should confirm dose', alertIds: o.checks.map(c => c.id), suggestedGenerics: ['ibuprofen'] });
    await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: [] });
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' });
    await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL, note: 'Counselled' });
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '1' });
    await pickupAction(id, { reviewerId: ph2, action: 'call' });
    await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    const types = getAudit(id).map(e => e.type).filter(t => t.startsWith('order_') || t.startsWith('pickup_'));
    expect(types).toEqual(['order_drafted', 'order_submitted', 'order_pharmacy_action', 'order_submitted', 'order_pharmacy_action', 'order_dispensed', 'pickup_called', 'pickup_called', 'pickup_collected']);
    const t = deriveTrace(getSession(id)!, getAudit(id), getConsultRecord(id));
    const pharm = t.nodes.filter(n => n.kind === 'pharmacist_action');
    expect(pharm.map(n => n.label.en)).toEqual(['Pharmacist 1: returned to prescriber', 'Pharmacist 1: prescription verified', 'Pharmacist 2: dispensed', 'Patient called to collect', 'Patient called to collect', 'Medicines collected']);
    expect(pharm[0].detail.en).toBe(`Order return; report: ${o.checks.length} alert(s) flagged, 1 option(s) for prescriber review`);
    expect(pharm[2].detail.en).toBe('Final double check 6 of 6 items confirmed by a second pharmacist');
    expect(pharm[4].detail.en).toBe('Patient called again');
    for (const n of pharm) {
      for (const lang of ['en', 'it', 'th'] as const) { expect(n.label[lang].length).toBeGreaterThan(0); expect(n.detail[lang].length).toBeGreaterThan(0); }
      expect(n.label.th).not.toBe(n.label.en); expect(n.detail.th).not.toBe(n.detail.en);
      expect(n.auditIds).toHaveLength(1); expect(t.edges.some(e => e.to === n.id)).toBe(true);
    }
    const dispenseNode = pharm[2], callNode = pharm[3], collectNode = pharm[5];
    expect(t.edges).toContainEqual(expect.objectContaining({ from: pharm[1].id, to: dispenseNode.id }));
    expect(t.edges).toContainEqual({ from: dispenseNode.id, to: callNode.id });
    expect(t.edges).toContainEqual({ from: pharm[4].id, to: collectNode.id });
    expect(t.edges.every(e => t.nodes.some(n => n.id === e.from) && t.nodes.some(n => n.id === e.to))).toBe(true);
    const json = JSON.stringify(t);
    // (No bare digit fragments here: random hex ids could contain them.)
    for (const secret of ['Maria', 'Rossi', '081 234', '234 5678', 'Counselled', 'confirm dose', ph1, ph2, 'ibuprofen']) expect(json).not.toContain(secret);
    expect(JSON.stringify(deriveTrace(getSession(id)!, getAudit(id), getConsultRecord(id)))).toBe(json);
  });
});

describe('W19 ops metrics: pharmacy queue', () => {
  it('counts orders to verify / dispense and patients ready / collected today', async () => {
    expect(metrics().pharmacy).toEqual({ toVerify: 0, toDispense: 0, readyForPickup: 0, collectedToday: 0 });
    const a = await patient(); await submitted(a); await submitted(a); await drafted(a);
    const b = await patient(); await verified(b);
    const c = await patient(); await dispensed(c); await pickupAction(c, { reviewerId: ph2, action: 'call' });
    const d = await patient(); await dispensed(d); await pickupAction(d, { reviewerId: ph2, action: 'call' }); await pickupAction(d, { reviewerId: ph2, action: 'collected' });
    const e = await patient(); await dispensed(e); await pickupAction(e, { reviewerId: ph2, action: 'call' }); await pickupAction(e, { reviewerId: ph2, action: 'collected' });
    const old = getSession(e)!; old.pickup!.collectedAt = '2020-01-01T10:00:00.000Z'; saveSession(old);
    expect(metrics().pharmacy).toEqual({ toVerify: 2, toDispense: 1, readyForPickup: 1, collectedToday: 1 });
  });
});

describe('W19 demo seed shows every pharmacy stage', () => {
  const caseSession = (caseId: string) => getSession(getAudit().find(e => e.type === 'session_created' && e.payload.demoCaseId === caseId)!.sessionId)!;
  it('seeds to-verify (with alternatives), to-dispense and ready-for-pickup cases idempotently', async () => {
    vi.stubEnv('DEMO_SEED', '1');
    const altTable: NonNullable<MedRuleFile['alternatives']> = [{ id: 'ALT-TEST-SEED', kinds: ['allergy_conflict'], drugClasses: ['penicillin'], consider: ['azithromycin', 'cefalexin'], note, source: 'test fixture' }];
    const first = await withAlternatives(altTable, () => seedDemo());
    expect(first.created).toBe(11); expect(first.mismatches).toEqual([]);
    const toVerify = caseSession('MED-01').orders!.medications;
    expect(toVerify).toHaveLength(1); expect(toVerify[0]).toMatchObject({ status: 'submitted', generic: 'amoxicillin' });
    const allergy = toVerify[0].checks.find(c => c.kind === 'allergy_conflict' && c.severity === 'high')!;
    expect(allergy.alternatives).toEqual(['azithromycin']);
    expect(toVerify[0].overrides.map(x => x.alertId)).toEqual(toVerify[0].checks.filter(c => c.severity === 'high').map(c => c.id));
    const toDispense = caseSession('IT-01').orders!.medications;
    expect(toDispense).toHaveLength(1); expect(toDispense[0]).toMatchObject({ status: 'verified', pharmacist: { action: 'verify', by: ph1 } });
    const ready = caseSession('EN-01');
    expect(ready.orders!.medications).toHaveLength(1);
    expect(ready.orders!.medications[0]).toMatchObject({ status: 'dispensed', pharmacist: { by: ph1 }, dispense: { by: ph2, checklist: ALL } });
    expect(ready.pickup).toMatchObject({ status: 'ready', counter: '2', calledBy: ph2 });
    expect(patientView(ready).pickup).toEqual({ status: 'ready', counter: '2' });
    expect(metrics().pharmacy).toEqual({ toVerify: 1, toDispense: 1, readyForPickup: 1, collectedToday: 0 });
    // Existing seeded statuses are unchanged; the approved case still ends with its review.
    expect(first.byStatus).toEqual({ escalated: 2, awaiting_review: 2, needs_human: 2, collecting: 4, approved: 1, taken_over: 0 });
    const again = await seedDemo();
    expect(again.created).toBe(0);
    expect(caseSession('EN-01').orders!.medications).toHaveLength(1); expect(caseSession('MED-01').orders!.medications).toHaveLength(1);
    // The seeded pharmacist-2 stage is live: a different pharmacist can dispense the IT-01 order now.
    const it01 = caseSession('IT-01');
    await expect(dispenseOrder(it01.id, it01.orders!.medications[0].id, { reviewerId: ph1, checklist: ALL })).rejects.toMatchObject({ status: 409 });
    expect((await dispenseOrder(it01.id, it01.orders!.medications[0].id, { reviewerId: ph2, checklist: ALL })).orders!.medications[0].status).toBe('dispensed');
  });
  it('with the shipped medrules table, the seeded to-verify alert carries curated options that pass the patient checks', async () => {
    vi.stubEnv('DEMO_SEED', '1'); await seedDemo();
    const o = caseSession('MED-01').orders!.medications[0];
    const allergy = o.checks.find(c => c.kind === 'allergy_conflict' && c.severity === 'high')!;
    const curated = (MEDRULES.alternatives ?? []).filter(e => e.kinds.includes('allergy_conflict') && e.drugClasses.includes(o.drugClass!)).flatMap(e => e.consider);
    if (!curated.length) { expect(allergy).not.toHaveProperty('alternatives'); return; }
    expect(allergy.alternatives!.length).toBeGreaterThan(0);
    for (const g of allergy.alternatives!) { expect(curated).toContain(g); expect(g).not.toBe(o.generic); }
    // Each option, ordered instead, raises no allergy / interaction / duplicate / pregnancy alert for this patient.
    const s = caseSession('MED-01');
    for (const g of allergy.alternatives!) {
      const drug = MEDRULES.drugs.find(d => d.generic === g)!;
      const checks = prescribingChecks(s, { ...o, drugText: g, generic: g, drugClass: drug.drugClass, checks: [], overrides: [] });
      expect(checks.filter(c => ['allergy_conflict', 'interaction', 'duplicate_therapy', 'pregnancy_caution', 'max_dose_risk'].includes(c.kind))).toEqual([]);
    }
  });
});
