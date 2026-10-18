// w20 S-04: the patient phone learns only one more thing, a boolean that staff have seen the case.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consultNote } from '../consult';
import { patientView, seenByStaff } from '../patientView';
import { addTurn, createSession, review, takeover } from '../pipeline';
import { getConsultRecord, getSession } from '../store';
import { confirmTriage, recordVitals } from '../vitals';
import { GET as sessionGet } from '../../../app/api/sessions/[id]/route';
import { POST as turnsRoute } from '../../../app/api/sessions/[id]/turns/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-seen-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const KEYS = ['code', 'id', 'patientLang', 'pickup', 'seenByStaff', 'status', 'summary', 'turns'];
const viewOf = async (id: string) => (await (await sessionGet(new Request(`http://localhost/api/sessions/${id}?view=patient`), ctx(id))).json()).session;
const intake = async () => addTurn(createSession('en').id, "I've had a sore throat for two days. It's about 7 out of 10. I'm a 24 year old man. No allergies. I don't take any medication.");

describe('seenByStaff', () => {
  it('is false while only the patient and the pipeline have touched the case', async () => {
    const s = await intake();
    expect(s.status).toBe('awaiting_review');
    expect((await viewOf(s.id)).seenByStaff).toBe(false);
  });
  it('turns true on intake approval', async () => {
    const s = await intake();
    await review(s.id, 'Nurse Anna Rossi', s.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
    expect((await viewOf(s.id)).seenByStaff).toBe(true);
  });
  it('turns true on takeover', async () => {
    const s = await addTurn(createSession('en').id, 'I have a headache.');
    await takeover(s.id, 'Nurse Anna Rossi');
    expect((await viewOf(s.id)).seenByStaff).toBe(true);
  });
  it('scripted journey without intake approval: triage confirm moves the phone past "A nurse is reviewing"', async () => {
    const s = await intake();
    await recordVitals(s.id, { recordedBy: 'Nurse Anna Rossi', vitals: { heartRate: 80, systolicBP: 120, diastolicBP: 80, respRate: 14, tempC: 36.8, spo2: 99, onOxygen: false, consciousness: 'alert' } });
    expect((await viewOf(s.id)).seenByStaff).toBe(false); // vitals alone are not a decision
    await confirmTriage(s.id, { reviewerId: 'Nurse Anna Rossi', level: getSession(s.id)!.triage!.suggestedLevel });
    expect(getSession(s.id)!.status).toBe('awaiting_review');
    expect((await viewOf(s.id)).seenByStaff).toBe(true);
  });
  it('turns true when a consult note is signed (read from the consult record, which never reaches the phone)', async () => {
    const s = await intake();
    await consultNote(s.id, { reviewerId: 'Dr. Marco Bianchi', mode: 'doctor', action: 'draft' });
    expect(seenByStaff(getSession(s.id)!, getConsultRecord(s.id))).toBe(false);
    const edits = getConsultRecord(s.id).notes.doctor!.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed' }));
    await consultNote(s.id, { reviewerId: 'Dr. Marco Bianchi', mode: 'doctor', action: 'sign', edits });
    expect((await viewOf(s.id)).seenByStaff).toBe(true);
    expect(patientView(getSession(s.id)!).seenByStaff).toBe(false); // no consult record passed: nothing inferred
  });
});

describe('view=patient allowlist', () => {
  it('GET and POST /turns (x-medx-client: patient) add exactly one new key, a boolean, and no clinician data', async () => {
    const s = await intake();
    await review(s.id, 'Nurse Anna Rossi', s.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
    await consultNote(s.id, { reviewerId: 'Dr. Marco Bianchi', mode: 'doctor', action: 'draft' });
    const got = await viewOf(s.id);
    expect(Object.keys(got).sort()).toEqual(KEYS);
    expect(typeof got.seenByStaff).toBe('boolean');
    const json = JSON.stringify(got);
    for (const secret of ['Nurse Anna Rossi', 'Dr. Marco Bianchi', 'triage', 'vitals', 'orders', 'audit', 'notes', 'consult']) expect(json).not.toContain(secret);
    const fresh = await addTurn(createSession('en').id, 'I have a headache since today.');
    const posted = await (await turnsRoute(new Request('http://localhost/api', { method: 'POST', headers: { 'x-medx-client': 'patient' }, body: JSON.stringify({ text: 'It is 4/10.' }) }), ctx(fresh.id))).json();
    expect(Object.keys(posted).sort()).toEqual(KEYS);
    expect(posted.seenByStaff).toBe(false);
  });
});
