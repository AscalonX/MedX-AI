// w20 M-05: intake approval no longer ends the visit. Consult, sign and orders work on approved sessions;
// red-flag rules still run first; a plain patient turn on an approved intake is still refused.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsultState, IntakeSession, MedicationOrder } from '@medx/shared';
import { addTurn, createSession, review, takeover } from '../pipeline';
import { getAudit, getConsultRecord, getSession } from '../store';
import { POST as consultTurn } from '../../../app/api/sessions/[id]/consult/turns/route';
import { POST as noteRoute } from '../../../app/api/sessions/[id]/consult/note/route';
import { GET as consultGet } from '../../../app/api/sessions/[id]/consult/route';
import { POST as medsRoute } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as submitRoute } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { POST as turnsRoute } from '../../../app/api/sessions/[id]/turns/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-approved-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const doctor = 'Dr. Marco Bianchi';
const post = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const ctx = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const GOLD = "I've had a sore throat for two days and I can see white spots on my tonsils. It hurts to swallow. It's about 7 out of 10. I'm a 24 year old man. I'm allergic to penicillin, it gave me a rash. I don't take any medication.";

async function approvedSession(text = GOLD): Promise<IntakeSession> {
  const s = await addTurn(createSession('en').id, text);
  expect(s.status).toBe('awaiting_review');
  const approved = await review(s.id, 'Nurse Anna Rossi', s.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
  expect(approved.status).toBe('approved');
  return approved;
}
/** Runs a step and proves it added at least one audit event of `type`. */
async function audited<T>(id: string, type: string, step: () => Promise<T>) {
  const before = getAudit(id).filter(e => e.type === type).length;
  const out = await step();
  expect(getAudit(id).filter(e => e.type === type).length).toBeGreaterThan(before);
  return out;
}

describe('approved intake: the visit continues', () => {
  it('approve all, then a doctor consult turn (200), sign the note, then submit a medication order; every step is audited', async () => {
    const s = await approvedSession();
    const turn = await audited(s.id, 'consult_turn', () => consultTurn(post({ speaker: 'patient', mode: 'doctor', text: 'Yes, I can swallow my saliva, and my voice is normal.' }), ctx(s.id)));
    expect(turn.status).toBe(200);
    const state = await turn.json() as ConsultState;
    // w20: uncomplicated sore throat with tonsillar white spots: the FeverPAIN prompt, never the quinsy consideration.
    expect(state.suggestions.some(x => x.id === 'consider:CR-THROAT-05:CR-THROAT-05-C1')).toBe(true);
    expect(state.suggestions.some(x => x.id.includes('CR-THROAT-03'))).toBe(false);
    let saved = getSession(s.id)!;
    // The approved intake stays approved: no intake follow-up is pushed at the patient.
    expect(saved.status).toBe('approved'); expect(saved.summary!.nextQuestion).toBeNull();
    expect(saved.turns.filter(t => t.role === 'assistant')).toHaveLength(0);
    expect(saved.summary!.fields.filter(f => f.required).every(f => f.status === 'approved')).toBe(true);
    expect(getAudit(s.id).some(e => e.type === 'turn_added')).toBe(true);

    expect((await audited(s.id, 'summary_generated', () => noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'draft' }), ctx(s.id)))).status).toBe(200);
    const edits = getConsultRecord(s.id).notes.doctor!.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed' }));
    const signed = await audited(s.id, 'consult_note_signed', () => noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'sign', edits }), ctx(s.id)));
    expect(signed.status).toBe(200); expect((await signed.json()).note.signed.reviewerId).toBe(doctor);

    const drafted = await audited(s.id, 'order_drafted', () => medsRoute(post({ orderedBy: doctor, drugText: 'clarithromycin', dose: '500 mg', route: 'oral', frequency: 'twice daily', duration: '5 days' }), ctx(s.id)));
    expect(drafted.status).toBe(200);
    const o = (await drafted.json() as IntakeSession).orders!.medications[0] as MedicationOrder;
    const submit = await audited(s.id, 'order_submitted', () => submitRoute(post({ orderedBy: doctor, overrides: o.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed synthetic case' })) }), ctx(s.id, o.id)));
    expect(submit.status).toBe(200);
    saved = getSession(s.id)!;
    expect(saved.status).toBe('approved'); expect(saved.orders!.medications[0].status).toBe('submitted');
  });

  it('a plain patient POST /turns on an approved session still returns 409, with no write', async () => {
    const s = await approvedSession();
    const before = getSession(s.id), audit = getAudit(s.id);
    const r = await turnsRoute(post({ text: 'One more thing, I also have a cough.' }), ctx(s.id));
    expect(r.status).toBe(409);
    expect(getSession(s.id)).toEqual(before); expect(getAudit(s.id)).toEqual(audit);
  });

  it('red-flag rules still run first: a red-flag sentence in the consult escalates an approved session with no model call', async () => {
    const s = await approvedSession();
    const r = await consultTurn(post({ speaker: 'patient', mode: 'doctor', text: 'Now I have chest pain and I am sweating a lot.' }), ctx(s.id));
    expect(r.status).toBe(200);
    const saved = getSession(s.id)!;
    expect(saved.status).toBe('escalated');
    expect(saved.summary!.redFlags.map(f => f.ruleId)).toContain('RF-CHEST-01');
    expect(saved.summary!.modelCalls).toEqual([]); // escalation path: zero model calls for this turn
    expect(getAudit(s.id).filter(e => e.type === 'red_flag')).toHaveLength(1);
    // Red flags block signing until a clinician reviews them, approved intake or not.
    expect((await noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'draft' }), ctx(s.id))).status).toBe(200);
    expect((await noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'sign' }), ctx(s.id))).status).toBe(409);
  });

  it('new contrary evidence on an approved field sends the intake back to review', async () => {
    const s = await approvedSession('I have a headache since today. It is 4/10. I am a 30 year old man. No allergies. I take no medicines.');
    await consultTurn(post({ speaker: 'patient', mode: 'nurse', text: 'Sorry, I do take a daily multivitamin.' }), ctx(s.id));
    const saved = getSession(s.id)!;
    expect(saved.status).toBe('awaiting_review');
    expect(getAudit(s.id).some(e => e.payload.event === 'field_review_change' && e.payload.note === 'conflict')).toBe(true);
  });

  it('clinician speech on an approved session is stored for context only and keeps the status', async () => {
    const s = await approvedSession();
    expect((await consultTurn(post({ speaker: 'clinician', mode: 'nurse', text: 'Can you swallow your saliva?' }), ctx(s.id))).status).toBe(200);
    expect(getSession(s.id)!.status).toBe('approved');
    expect((await consultGet(new Request(`http://localhost/api/sessions/${s.id}/consult?mode=doctor`), ctx(s.id))).status).toBe(200);
  });

  it('sign is 403 for a STAFF member who is not a doctor, and taken-over sessions still refuse consult speech', async () => {
    const s = await approvedSession();
    await noteRoute(post({ reviewerId: doctor, mode: 'doctor', action: 'draft' }), ctx(s.id));
    for (const who of ['Nurse Anna Rossi', 'Pharmacist Laura Conti', 'Head Nurse Elena Greco', 'pharm-wong']) {
      const r = await noteRoute(post({ reviewerId: who, mode: 'doctor', action: 'sign' }), ctx(s.id));
      expect(r.status).toBe(403); expect((await r.json()).error).toMatch(/doctor/);
    }
    expect(getConsultRecord(s.id).notes.doctor!.signed).toBeUndefined();
    expect((await noteRoute(post({ reviewerId: 'Dr. Somchai Chaiyo', mode: 'doctor', action: 'sign' }), ctx(s.id))).status).toBe(200);
    const t = await addTurn(createSession('en').id, 'I have a headache since today.');
    await takeover(t.id, 'Nurse Anna Rossi', 'Manual intake');
    expect((await consultTurn(post({ speaker: 'patient', mode: 'nurse', text: 'Headache' }), ctx(t.id))).status).toBe(409);
  });
});
