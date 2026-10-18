// w20 orchestrator decisions from the wave-1 gate:
// (a) an order submitted after "collected" starts a new pickup cycle; (b) drafts do not block "Call patient";
// (c) a new high alert on a verified, not yet dispensed order sends it back to pharmacist 1 ("Re-check needed").
// w20 fixes: (c) also covers a dispensed order the patient has not collected (the medicine is still at the counter), and
// the pickup itself re-checks first; a cancelled follow-up order restores the earlier collection; intake review edits re-check.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedicationOrder } from '@medx/shared';
import { dispenseOrder, medicationAction, medicationOrder, pickupAction } from '../orders';
import { patientView } from '../patientView';
import { pharmacyReview } from '../pharmacyReview';
import { addTurn, createSession, review } from '../pipeline';
import { sessionStage } from '../journey';
import { getAudit, getConsultRecord, getSession, saveSession } from '../store';
import { deriveTrace } from '../trace';
import { POST as postPickup } from '../../../app/api/sessions/[id]/pickup/route';
import { POST as postDispense } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/dispense/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-pickup-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const doctor = 'Dr. Marco Bianchi', ph1 = 'Pharmacist Laura Conti', ph2 = 'Pharmacist Nattaya Wong';
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
type Draft = { drugText: string; dose: string; route: string; frequency: string; duration?: string };
const PARA: Draft = { drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' };
const AMOX: Draft = { drugText: 'amoxicillin', dose: '500 mg', route: 'oral', frequency: 'three times daily', duration: '5 days' };
const req = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const order = (id: string, orderId: string) => getSession(id)!.orders!.medications.find(o => o.id === orderId)!;
const high = (o: MedicationOrder, reason = 'Reviewed synthetic case') => o.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason }));
const patient = async (text = 'I have a headache since today. It is 4/10. No allergies.') => (await addTurn(createSession('en').id, text)).id;
async function drafted(id: string, d: Draft = PARA) { return (await medicationOrder(id, { orderedBy: doctor, ...d })).orders!.medications.at(-1)!; }
async function submitted(id: string, d: Draft = PARA) { const o = await drafted(id, d); await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: high(o) }); return order(id, o.id); }
async function verified(id: string, d: Draft = PARA) { const o = await submitted(id, d); await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' }); return order(id, o.id); }
async function dispensed(id: string, d: Draft = PARA) { const o = await verified(id, d); await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL }); return order(id, o.id); }
const call = (id: string, counter?: string) => postPickup(req({ reviewerId: ph2, action: 'call', ...(counter ? { counter } : {}) }), ctx(id));
const last = (id: string, type: string) => getAudit(id).filter(e => e.type === type).at(-1)!;

describe('(a) a new prescription after collection starts a new pickup cycle', () => {
  it('clears the collected pickup, audits pickupReset, and the next call and collection cover only the new order', async () => {
    const id = await patient(); const first = await dispensed(id);
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '2' });
    await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    expect(sessionStage(getSession(id)!)).toBe('collected');
    const second = await submitted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect(getSession(id)).not.toHaveProperty('pickup');
    expect(last(id, 'order_submitted').payload).toMatchObject({ orderId: second.id, pickupReset: true, previousPickup: 'collected' });
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'preparing' });
    expect(sessionStage(getSession(id)!)).toBe('pharmacy_verify');
    expect((await call(id)).status).toBe(409); // the new order is not dispensed yet
    await medicationAction(id, second.id, 'pharmacy', { reviewerId: ph1, action: 'verify' });
    await dispenseOrder(id, second.id, { reviewerId: ph2, checklist: ALL });
    expect((await call(id, '3')).status).toBe(200);
    expect(last(id, 'pickup_called').payload).toMatchObject({ orderIds: [second.id], recall: false, counter: '3' });
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'ready', counter: '3' });
    expect((await postPickup(req({ reviewerId: ph2, action: 'collected' }), ctx(id))).status).toBe(200);
    expect(last(id, 'pickup_collected').payload.orderIds).toEqual([second.id]);
    expect(getAudit(id).filter(e => e.type === 'pickup_collected').flatMap(e => e.payload.orderIds as string[])).toEqual([first.id, second.id]);
  });
  it('nothing new to collect: a cancelled follow-up order leaves no call, and a draft never resets a collection', async () => {
    const id = await patient(); await dispensed(id);
    await pickupAction(id, { reviewerId: ph2, action: 'call' }); await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    await drafted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect(getSession(id)!.pickup!.status).toBe('collected');
    const r = await call(id); expect(r.status).toBe(409); expect((await r.json()).error).toBe('Medicines already collected');
    const extra = await submitted(id, { drugText: 'loratadine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect(getSession(id)).not.toHaveProperty('pickup');
    await medicationAction(id, extra.id, 'cancel', { orderedBy: doctor, reason: 'Not needed' });
    // The follow-up never reached the patient: the earlier collection stands again (stage, phone and queue agree).
    expect(getSession(id)!.pickup).toMatchObject({ status: 'collected', calledBy: ph2, collectedBy: ph2 });
    expect(last(id, 'order_drafted').payload).toMatchObject({ orderId: extra.id, action: 'cancel', pickupRestored: 'collected' });
    expect(sessionStage(getSession(id)!)).toBe('collected');
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'collected' });
    const none = await call(id); expect(none.status).toBe(409); expect((await none.json()).error).toBe('Medicines already collected');
  });
  it('a returned follow-up edited back to a draft also restores the collection, with the counter it was called to', async () => {
    const id = await patient(); await dispensed(id);
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '4' }); await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    const extra = await submitted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    await medicationAction(id, extra.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Please check the indication' });
    expect(getSession(id)).not.toHaveProperty('pickup'); // a returned order is still in play
    expect(sessionStage(getSession(id)!)).toBe('orders_submitted');
    await medicationOrder(id, { orderedBy: doctor, orderId: extra.id, drugText: 'loratadine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect(getSession(id)!.pickup).toMatchObject({ status: 'collected', counter: '4' });
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'collected', counter: '4' });
  });
  it('a cancelled follow-up while the earlier medicines are still uncollected leaves the call open', async () => {
    const id = await patient(); const first = await dispensed(id);
    await pickupAction(id, { reviewerId: ph2, action: 'call' });
    const extra = await submitted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    await medicationAction(id, extra.id, 'cancel', { orderedBy: doctor, reason: 'Not needed' });
    expect(getSession(id)).not.toHaveProperty('pickup');
    expect(sessionStage(getSession(id)!)).toBe('pharmacy_dispense');
    expect((await call(id, '2')).status).toBe(200);
    expect(last(id, 'pickup_called').payload.orderIds).toEqual([first.id]);
  });
  it('a resubmission while ready still resets (previousPickup ready)', async () => {
    const id = await patient(); await dispensed(id); await pickupAction(id, { reviewerId: ph2, action: 'call' });
    const next = await submitted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect(last(id, 'order_submitted').payload).toMatchObject({ orderId: next.id, pickupReset: true, previousPickup: 'ready' });
  });
});

describe('(b) drafts do not block "Call patient"', () => {
  it('a draft beside a dispensed order: the call goes ahead and lists only the dispensed order', async () => {
    const id = await patient(); const done = await dispensed(id);
    await drafted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    expect((await call(id, '1')).status).toBe(200);
    expect(last(id, 'pickup_called').payload.orderIds).toEqual([done.id]);
  });
  it.each(['submitted', 'returned', 'verified'] as const)('a %s order still blocks the call, atomically', async status => {
    const id = await patient(); await dispensed(id);
    const other = status === 'verified' ? await verified(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' }) : await submitted(id, { drugText: 'cetirizine', dose: '10 mg', route: 'oral', frequency: 'daily' });
    if (status === 'returned') await medicationAction(id, other.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'Check' });
    expect(order(id, other.id).status).toBe(status);
    const before = getSession(id), audit = getAudit(id);
    const r = await call(id); expect(r.status).toBe(409); expect((await r.json()).error).toMatch(/dispensed/);
    expect(getSession(id)).toEqual(before); expect(getAudit(id)).toEqual(audit);
  });
  it('at least one dispensed order is required: drafts alone cannot be called', async () => {
    const id = await patient(); await drafted(id);
    const r = await call(id); expect(r.status).toBe(409); expect((await r.json()).error).toBe('No medication orders to collect');
  });
});

describe('(c) a new high alert after verification sends the order back to pharmacist 1', () => {
  it('a newly stated allergy re-checks a verified order: status, history, audit, trace, dispense blocked, then the normal loop', async () => {
    const id = await patient(); const o = await verified(id, AMOX);
    expect(o.checks.some(c => c.severity === 'high')).toBe(false);
    await addTurn(id, 'Sorry, I forgot: I am allergic to penicillin, it gave me a rash.');
    const r = order(id, o.id);
    const pen = r.checks.find(c => c.ruleId === 'MR-ALLERGY-PEN')!;
    expect(pen.severity).toBe('high');
    expect(r.status).toBe('submitted'); expect(r).not.toHaveProperty('pharmacist');
    expect(r.recheck).toMatchObject({ reason: 'new_high_alert', alertIds: [pen.id] });
    expect(r.pharmacistHistory).toEqual([expect.objectContaining({ action: 'verify', by: ph1, reason: 'new_high_alert', supersededAt: expect.any(String) })]);
    expect(last(id, 'order_recheck')).toMatchObject({ actor: 'system', payload: { orderId: o.id, reason: 'new_high_alert', alertIds: [pen.id], ruleIds: ['MR-ALLERGY-PEN'], previousPharmacist: ph1, message: expect.stringMatching(/pharmacist 1/) } });
    expect(sessionStage(getSession(id)!)).toBe('pharmacy_verify');
    const node = deriveTrace(getSession(id)!, getAudit(id), getConsultRecord(id)).nodes.find(n => n.auditIds.includes(last(id, 'order_recheck').id))!;
    expect(node).toMatchObject({ kind: 'order_check', status: 'escalated', label: { en: 'Re-check needed: new high alert' } });
    // Pharmacist 2 cannot dispense; pharmacist 1 cannot verify without a prescriber reason for the new alert.
    const d = await postDispense(req({ reviewerId: ph2, checklist: ALL }), ctx(id, o.id));
    expect(d.status).toBe(409); expect((await d.json()).error).toMatch(/^Re-check needed/);
    await expect(medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' })).rejects.toMatchObject({ status: 409 });
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'New penicillin allergy', alertIds: [pen.id], suggestedGenerics: ['clarithromycin'] });
    expect(order(id, o.id)).toMatchObject({ status: 'returned', pharmacist: { action: 'return' } }); expect(order(id, o.id)).not.toHaveProperty('recheck');
    expect(last(id, 'order_pharmacy_action').payload).toMatchObject({ action: 'return', afterRecheck: true });
    await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: high(order(id, o.id), 'Synthetic case: allergy reviewed with the patient') });
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' });
    expect((await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL })).orders!.medications[0].status).toBe('dispensed');
    expect(order(id, o.id).pharmacistHistory).toHaveLength(1);
  });
  it('checks gone stale are caught at dispense: the re-check is saved even though the dispense is refused', async () => {
    const id = await patient(); const o = await verified(id, AMOX);
    const allergic = await patient('I have a sore throat since yesterday. I am allergic to penicillin.');
    const s = getSession(id)!; s.summary!.allergies = getSession(allergic)!.summary!.allergies; saveSession(s); // simulate an unrefreshed change
    const d = await postDispense(req({ reviewerId: ph2, checklist: ALL }), ctx(id, o.id));
    expect(d.status).toBe(409);
    expect(order(id, o.id)).toMatchObject({ status: 'submitted', recheck: { reason: 'new_high_alert' } });
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'order_recheck', actor: 'system' });
    expect(getAudit(id).some(e => e.type === 'order_dispensed')).toBe(false);
  });
  it('a pharmacist allergy correction re-checks a verified order', async () => {
    const id = await patient('I have a sore throat since yesterday. I am allergic to sulfa.');
    const o = await verified(id, AMOX);
    const allergy = getSession(id)!.summary!.allergies![0];
    await pharmacyReview(id, { reviewerId: ph1, medActions: [], alertActions: [], allergyActions: [{ allergyId: allergy.id, action: 'edit', allergenClass: 'penicillin' }] });
    expect(order(id, o.id).status).toBe('submitted');
    const audit = getAudit(id).map(e => e.type);
    expect(audit.lastIndexOf('order_recheck')).toBeGreaterThan(audit.lastIndexOf('pharmacy_review'));
  });
  it('an alert from a draft waits until that order is submitted, then re-checks the verified order', async () => {
    const id = await patient(); const ibu = await verified(id, { drugText: 'ibuprofen', dose: '400 mg', route: 'oral', frequency: 'three times daily' });
    const nap = await drafted(id, { drugText: 'naproxen', dose: '250 mg', route: 'oral', frequency: 'twice daily' });
    const dup = order(id, ibu.id).checks.find(c => c.medIds.includes(nap.id) && c.severity === 'high');
    expect(dup).toBeDefined();
    expect(order(id, ibu.id).status).toBe('verified');
    expect(getAudit(id).some(e => e.type === 'order_recheck')).toBe(false);
    await medicationAction(id, nap.id, 'submit', { orderedBy: doctor, overrides: high(order(id, nap.id)) });
    expect(order(id, ibu.id)).toMatchObject({ status: 'submitted', recheck: { alertIds: [dup!.id] } });
    const types = getAudit(id).map(e => e.type);
    expect(types.slice(-2)).toEqual(['order_submitted', 'order_recheck']);
  });
  it('a high allergy stated after dispense, before collection, sends the order back and stops the handover', async () => {
    const id = await patient(); const o = await dispensed(id, AMOX);
    expect((await call(id, '2')).status).toBe(200);
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'ready', counter: '2' });
    await addTurn(id, 'Sorry, I am allergic to penicillin.');
    const r = order(id, o.id);
    const pen = r.checks.find(c => c.ruleId === 'MR-ALLERGY-PEN')!;
    expect(pen.severity).toBe('high');
    expect(r).toMatchObject({ status: 'submitted', recheck: { reason: 'new_high_alert', alertIds: [pen.id] } });
    expect(r).not.toHaveProperty('dispense'); expect(r).not.toHaveProperty('pharmacist');
    expect(r.pharmacistHistory).toEqual([expect.objectContaining({ action: 'verify', by: ph1, reason: 'new_high_alert' })]);
    expect(last(id, 'order_recheck').payload).toMatchObject({ orderId: o.id, wasDispensed: true, previousDispenser: ph2, previousPharmacist: ph1, message: expect.stringMatching(/before the patient collected/) });
    expect(getAudit(id).some(e => e.type === 'order_dispensed' && e.payload.orderId === o.id)).toBe(true); // the dispense stays in the log
    expect(getSession(id)).not.toHaveProperty('pickup');
    expect(patientView(getSession(id)!).pickup).toEqual({ status: 'preparing' });
    expect(sessionStage(getSession(id)!)).toBe('pharmacy_verify');
    for (const action of ['call', 'collected'] as const) {
      const res = await postPickup(req({ reviewerId: ph2, action }), ctx(id));
      expect(res.status).toBe(409); expect((await res.json()).error).toMatch(/^Re-check needed/);
    }
    expect(getAudit(id).some(e => e.type === 'pickup_collected')).toBe(false);
  });
  it('the pickup re-checks stale checks itself: collection is refused and the re-check is saved', async () => {
    const id = await patient(); const o = await dispensed(id, AMOX);
    await pickupAction(id, { reviewerId: ph2, action: 'call', counter: '1' });
    const allergic = await patient('I have a sore throat since yesterday. I am allergic to penicillin.');
    const s = getSession(id)!; s.summary!.allergies = getSession(allergic)!.summary!.allergies; saveSession(s); // simulate an unrefreshed change
    const res = await postPickup(req({ reviewerId: ph2, action: 'collected' }), ctx(id));
    expect(res.status).toBe(409); expect((await res.json()).error).toMatch(/^Re-check needed/);
    expect(order(id, o.id)).toMatchObject({ status: 'submitted', recheck: { reason: 'new_high_alert' } });
    expect(getAudit(id).at(-1)).toMatchObject({ type: 'order_recheck', actor: 'system', payload: { wasDispensed: true } });
    expect(getAudit(id).some(e => e.type === 'pickup_collected')).toBe(false);
  });
  it('collected orders are never pulled back, and an overridden alert is not "new"', async () => {
    const id = await patient(); const done = await dispensed(id, AMOX);
    await pickupAction(id, { reviewerId: ph2, action: 'call' }); await pickupAction(id, { reviewerId: ph2, action: 'collected' });
    await addTurn(id, 'Sorry, I am allergic to penicillin.');
    expect(order(id, done.id).status).toBe('dispensed');
    expect(getSession(id)!.pickup!.status).toBe('collected');
    const other = await patient('I have a sore throat since yesterday. I am allergic to penicillin.');
    const o = await verified(other, AMOX); // high allergy alert overridden at submit
    await addTurn(other, 'It is 5/10.');
    expect(order(other, o.id).status).toBe('verified');
    expect(getAudit(id).concat(getAudit(other)).some(e => e.type === 'order_recheck')).toBe(false);
  });
});

describe('w20 fixes: re-checks from intake review, pharmacist 1 and the prescriber loop', () => {
  it('an intake review edit to pregnancy re-checks a verified order at once (MR-PREG-01), not at dispense', async () => {
    const id = await patient('I have a sore throat since yesterday. It is 4/10. No allergies.');
    const o = await verified(id, { drugText: 'doxycycline', dose: '100 mg', route: 'oral', frequency: 'twice daily', duration: '5 days' });
    expect(o.checks.some(c => c.ruleId === 'MR-PREG-01')).toBe(false);
    await review(id, 'Nurse Anna Rossi', [{ fieldKey: 'pregnancy_status', action: 'edit', newValue: 'Pregnant' }]);
    const r = order(id, o.id);
    expect(r.checks.find(c => c.ruleId === 'MR-PREG-01')?.severity).toBe('high');
    expect(r).toMatchObject({ status: 'submitted', recheck: { reason: 'new_high_alert' } });
    const types = getAudit(id).map(e => e.type);
    expect(types.slice(-2)).toEqual(['review', 'order_recheck']);
    expect(sessionStage(getSession(id)!)).toBe('pharmacy_verify');
  });
  it('editing a returned order keeps the earlier pharmacist history', async () => {
    const id = await patient(); const o = await verified(id, AMOX);
    await addTurn(id, 'Sorry, I forgot: I am allergic to penicillin, it gave me a rash.');
    expect(order(id, o.id).pharmacistHistory).toHaveLength(1);
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'return', note: 'New penicillin allergy' });
    await medicationOrder(id, { orderedBy: doctor, orderId: o.id, drugText: 'clarithromycin', dose: '500 mg', route: 'oral', frequency: 'twice daily', duration: '5 days' });
    expect(order(id, o.id)).toMatchObject({ status: 'draft', generic: 'clarithromycin' });
    expect(order(id, o.id).pharmacistHistory).toEqual([expect.objectContaining({ action: 'verify', by: ph1, reason: 'new_high_alert' })]);
  });
});
