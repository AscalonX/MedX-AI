// w20 S-05: staff roles are enforced on clinical write APIs, not only in the UI.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedicationOrder } from '@medx/shared';
import { requireStaffRole } from '../clinicalWrites';
import { dispenseOrder, medicationAction, medicationOrder } from '../orders';
import { addTurn, createSession } from '../pipeline';
import { getAudit, getSession } from '../store';
import { POST as vitalsRoute } from '../../../app/api/sessions/[id]/vitals/route';
import { POST as triageRoute } from '../../../app/api/sessions/[id]/triage/confirm/route';
import { POST as medsRoute } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as submitRoute } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { POST as cancelRoute } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/cancel/route';
import { POST as pharmacyRoute } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/pharmacy/route';
import { POST as dispenseRoute } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/dispense/route';
import { POST as invRoute } from '../../../app/api/sessions/[id]/orders/investigations/route';
import { POST as pickupRoute } from '../../../app/api/sessions/[id]/pickup/route';
import { POST as reconcileRoute } from '../../../app/api/sessions/[id]/pharmacy-review/route';
import { POST as noteRoute } from '../../../app/api/sessions/[id]/consult/note/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-roles-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STRICT_ROLES', '');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const nurse = 'Nurse Anna Rossi', doctor = 'Dr. Marco Bianchi', ph1 = 'Pharmacist Laura Conti', ph2 = 'Pharmacist Nattaya Wong', ops = 'Head Nurse Elena Greco';
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const VITALS = { heartRate: 80, systolicBP: 120, diastolicBP: 80, respRate: 14, tempC: 36.8, spo2: 99, onOxygen: false, consciousness: 'alert' };
const DRAFT = { drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' };
const post = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const patient = async () => (await addTurn(createSession('en').id, 'I have a headache since today. It is 4/10. No allergies.')).id;
const high = (o: MedicationOrder) => o.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed synthetic case' }));
async function drafted(id: string) { return (await medicationOrder(id, { orderedBy: doctor, ...DRAFT })).orders!.medications.at(-1)!; }
async function submitted(id: string) { const o = await drafted(id); await medicationAction(id, o.id, 'submit', { orderedBy: doctor, overrides: high(o) }); return o; }
async function verified(id: string) { const o = await submitted(id); await medicationAction(id, o.id, 'pharmacy', { reviewerId: ph1, action: 'verify' }); return o; }
async function dispensed(id: string) { const o = await verified(id); await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL }); return o; }

/** Status of a write, plus proof that a refused one changed neither the session nor the audit. */
async function attempt(id: string, call: () => Promise<Response>) {
  const before = getSession(id), audit = getAudit(id);
  const r = await call(); const body = await r.json();
  if (r.status !== 200) { expect(getSession(id)).toEqual(before); expect(getAudit(id)).toEqual(audit); }
  return { status: r.status, body };
}

type Write = { name: string; allowed: string[]; refused: string[]; run: (id: string, actor: string) => Promise<Response>; setup?: (id: string) => Promise<string> };
const WRITES: Write[] = [
  { name: 'vitals', allowed: [nurse, 'nurse-kanya'], refused: [doctor, ph1, ops], run: (id, a) => vitalsRoute(post({ recordedBy: a, vitals: VITALS }), ctx(id)) },
  { name: 'triage confirm', allowed: [nurse], refused: [doctor, 'Dr. Somchai Chaiyo', ph2, ops], run: (id, a) => triageRoute(post({ reviewerId: a, level: 3 }), ctx(id)) },
  { name: 'medication order draft', allowed: [doctor, 'doctor-chaiyo'], refused: [nurse, ph1, ops], run: (id, a) => medsRoute(post({ orderedBy: a, ...DRAFT }), ctx(id)) },
  { name: 'medication order submit', allowed: [doctor], refused: [nurse, ph1], setup: async id => (await drafted(id)).id, run: () => Promise.resolve(new Response()) },
  { name: 'medication order cancel', allowed: [doctor], refused: [nurse, ph2], setup: async id => (await drafted(id)).id, run: () => Promise.resolve(new Response()) },
  { name: 'investigation order', allowed: [doctor], refused: [nurse, ph1, ops], run: (id, a) => invRoute(post({ orderedBy: a, code: 'fbc' }), ctx(id)) },
  { name: 'pharmacy verify', allowed: [ph1], refused: [doctor, nurse, ops], setup: async id => (await submitted(id)).id, run: () => Promise.resolve(new Response()) },
  { name: 'pharmacy return', allowed: [ph2], refused: [doctor, nurse], setup: async id => (await submitted(id)).id, run: () => Promise.resolve(new Response()) },
  { name: 'dispense', allowed: [ph2], refused: [doctor, nurse, ops], setup: async id => (await verified(id)).id, run: () => Promise.resolve(new Response()) },
  { name: 'pickup call', allowed: [ph2], refused: [doctor, nurse, ops], setup: async id => (await dispensed(id)).id, run: (id, a) => pickupRoute(post({ reviewerId: a, action: 'call', counter: '1' }), ctx(id)) },
  { name: 'medicine reconciliation', allowed: [ph1], refused: [doctor, nurse], run: (id, a) => reconcileRoute(post({ reviewerId: a, medActions: [], alertActions: [], complete: true }), ctx(id)) },
];
// Order-scoped writes need the order id created in setup.
const orderRun: Record<string, (id: string, orderId: string, actor: string) => Promise<Response>> = {
  'medication order submit': (id, o, a) => submitRoute(post({ orderedBy: a, overrides: [] }), ctx(id, o)),
  'medication order cancel': (id, o, a) => cancelRoute(post({ orderedBy: a, reason: 'Changed plan' }), ctx(id, o)),
  'pharmacy verify': (id, o, a) => pharmacyRoute(post({ reviewerId: a, action: 'verify' }), ctx(id, o)),
  'pharmacy return': (id, o, a) => pharmacyRoute(post({ reviewerId: a, action: 'return', note: 'Please check the dose' }), ctx(id, o)),
  dispense: (id, o, a) => dispenseRoute(post({ reviewerId: a, checklist: ALL }), ctx(id, o)),
};
async function perform(w: Write, actor: string) {
  const id = await patient(); const orderId = w.setup ? await w.setup(id) : '';
  return attempt(id, () => orderRun[w.name] ? orderRun[w.name](id, orderId, actor) : w.run(id, actor));
}

describe('403 for the wrong STAFF role, 200 for the right one', () => {
  for (const w of WRITES) {
    it.each(w.refused)(`${w.name}: 403 for %s, atomically`, async actor => {
      const { status, body } = await perform(w, actor);
      expect(status).toBe(403); expect(body.code).toBe('bad_request'); expect(body.error).toMatch(/^Only /);
    });
    it.each(w.allowed)(`${w.name}: 200 for %s`, async actor => {
      const { status, body } = await perform(w, actor);
      expect(status, JSON.stringify(body)).toBe(200);
    });
  }
  it('pickup collected is pharmacist-only too', async () => {
    const id = await patient(); await dispensed(id);
    await pickupRoute(post({ reviewerId: ph2, action: 'call' }), ctx(id));
    expect((await attempt(id, () => pickupRoute(post({ reviewerId: nurse, action: 'collected' }), ctx(id)))).status).toBe(403);
    expect((await attempt(id, () => pickupRoute(post({ reviewerId: ph1, action: 'collected' }), ctx(id)))).status).toBe(200);
  });
  it('consult note sign is doctor-only', async () => {
    const id = await patient();
    await noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'draft' }), ctx(id));
    expect((await noteRoute(post({ reviewerId: nurse, mode: 'doctor', action: 'sign' }), ctx(id))).status).toBe(403);
  });
  it('shape errors stay 400 before the role check', async () => {
    const id = await patient();
    expect((await vitalsRoute(post({ recordedBy: '', vitals: VITALS }), ctx(id))).status).toBe(400);
    expect((await medsRoute(post({ orderedBy: nurse, ...DRAFT, extra: 1 }), ctx(id))).status).toBe(400);
  });
});

describe('actors not in STAFF', () => {
  it('are allowed by default, so synthetic test reviewers keep working', async () => {
    const id = await patient();
    expect((await vitalsRoute(post({ recordedBy: 'synthetic-nurse', vitals: VITALS }), ctx(id))).status).toBe(200);
    expect((await medsRoute(post({ orderedBy: 'synthetic-doctor', ...DRAFT }), ctx(id))).status).toBe(200);
  });
  it('get 403 everywhere with MEDX_STRICT_ROLES=1, while listed staff still pass', async () => {
    vi.stubEnv('MEDX_STRICT_ROLES', '1');
    for (const w of WRITES) {
      const { status, body } = await perform(w, 'synthetic-reviewer');
      expect(status, w.name).toBe(403); expect(body.error).toMatch(/Unknown staff member/);
      expect((await perform(w, w.allowed[0])).status, w.name).toBe(200);
    }
  });
  it('requireStaffRole: role match, id form, wrong role, unknown and strict mode', () => {
    expect(() => requireStaffRole('nurse-rossi', ['nurse'])).not.toThrow();
    expect(() => requireStaffRole('NURSE ANNA ROSSI', ['nurse'])).not.toThrow();
    expect(() => requireStaffRole(doctor, ['nurse'], 'record vitals')).toThrow('Only a nurse can record vitals');
    expect(() => requireStaffRole('someone', ['doctor'])).not.toThrow();
    vi.stubEnv('MEDX_STRICT_ROLES', '1');
    expect(() => requireStaffRole('someone', ['doctor'])).toThrow(/Unknown staff member/);
    try { requireStaffRole(ph1, ['doctor']); } catch (e) { expect(e).toMatchObject({ status: 403, code: 'bad_request' }); }
  });
});
