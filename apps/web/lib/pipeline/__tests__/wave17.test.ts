import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAFF } from '@medx/shared';
import { addTurn, createSession, review, takeover } from '../pipeline';
import { addConsultTurn, consultNote, getConsult } from '../consult';
import { medicationAction, medicationOrder } from '../orders';
import { pharmacyReview } from '../pharmacyReview';
import { redactKeepStaff } from '../redact';
import { getAudit, getConsultRecord, getSession } from '../store';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-w17-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
const doctor = STAFF.find(s => s.role === 'doctor')!.name, pharm = STAFF.find(s => s.role === 'pharmacist')!.name, nurse = STAFF.find(s => s.role === 'nurse')!.name;
const fresh = async (text: string) => addTurn(createSession('en').id, text);

describe('W17 P0-1 staff identity is never redacted', () => {
  it.each(STAFF.map(s => s.name))('keeps %s on note receipts and audit', async name => {
    const s = await fresh('Headache since today.');
    const req = { reviewerId: name, mode: 'doctor' as const };
    await consultNote(s.id, { ...req, action: 'draft' });
    const signed = await consultNote(s.id, { ...req, action: 'sign', edits: (getConsultRecord(s.id).notes.doctor!.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed' }))) });
    expect(signed.note!.signed!.reviewerId).toBe(name);
    expect(getAudit(s.id).at(-1)!.actorId).toBe(name);
  });
  it('keeps names on orders, pharmacy returns, review, takeover and pharmacy review', async () => {
    const s = await fresh('Headache since today. I take warfarin.');
    const o = await medicationOrder(s.id, { orderedBy: doctor, drugText: 'ibuprofen', dose: '400 mg', route: 'oral', frequency: 'tid' });
    const id = getSession(s.id)!.orders!.medications[0].id;
    expect(o.orders!.medications[0].orderedBy).toBe(doctor);
    await medicationAction(s.id, id, 'submit', { orderedBy: doctor, overrides: getSession(s.id)!.orders!.medications[0].checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed with patient' })) });
    const r = await medicationAction(s.id, id, 'pharmacy', { reviewerId: pharm, action: 'return', note: 'Please check dose' });
    expect(r.orders!.medications[0].pharmacist!.by).toBe(pharm);
    const pr = await pharmacyReview(s.id, { reviewerId: pharm, medActions: [], alertActions: [], complete: true }).catch(e => e);
    if (!(pr instanceof Error)) expect(pr.pharmacyReviewerId).toBe(pharm); else expect(String(pr.message)).not.toMatch(/personal data/);
    await takeover(s.id, nurse, 'Needs a human');
    expect(getAudit(s.id).filter(a => a.actorId?.includes('['))).toEqual([]);
  });
  it('review keeps the reviewer name', async () => {
    const s = await fresh('Headache since today.');
    const out = await review(s.id, doctor, [{ fieldKey: 'chief_complaint', action: 'approve' }]);
    expect(out.id).toBe(s.id); expect(getAudit(s.id).at(-1)!.actorId).toBe(doctor);
  });
  it('rejects empty or over-long identity', async () => {
    const s = await fresh('Headache since today.');
    await expect(consultNote(s.id, { mode: 'doctor', reviewerId: 'x'.repeat(81), action: 'draft' })).rejects.toMatchObject({ code: 'bad_request' });
  });
  it('clinician speech keeps exact STAFF names but still redacts other names', async () => {
    const s = await fresh('Headache since today.');
    await addConsultTurn(s.id, { mode: 'doctor', speaker: 'clinician', text: `I am ${doctor}, with ${nurse}. Hello Mr. Smith, my name is John Carter.` });
    const text = getSession(s.id)!.turns.filter(t => t.role === 'clinician').at(-1)!.text;
    expect(text).toContain(doctor); expect(text).toContain(nurse); expect(text).not.toMatch(/Smith|Carter/);
    expect(redactKeepStaff('Hi, I am Marco Bianchi')).not.toContain('Bianchi');
  });
  it('patient speech still redacts a STAFF name', async () => {
    const s = await fresh(`My name is Marco Bianchi and I have a headache.`);
    expect(s.turns[0].text).not.toContain('Bianchi');
  });
});

describe('W17 allergies field sync', () => {
  it('mirrors a captured penicillin allergy into the allergies field with evidence', async () => {
    const s = await fresh('I have a sore throat. I am allergic to penicillin.');
    const f = s.summary!.fields.find(f => f.key === 'allergies')!;
    expect(s.summary!.allergies!.length).toBeGreaterThan(0);
    expect(f.status).toBe('supported'); expect(f.value!.en.toLowerCase()).toContain('penicillin'); expect(f.evidence.length).toBeGreaterThan(0);
  });
  it('mirrors a recorded denial of allergies', async () => {
    const s = await fresh('I have a headache. I have no known allergies.');
    const f = s.summary!.fields.find(f => f.key === 'allergies')!;
    expect(f.status).toBe('supported'); expect(f.value!.en).toMatch(/no known allergies/i); expect(f.evidence.length).toBeGreaterThan(0);
  });
  it('stays missing when nothing was said', async () => {
    expect((await fresh('I have a headache.')).summary!.fields.find(f => f.key === 'allergies')!.status).toBe('missing');
  });
});

describe('W17 considerations', () => {
  it('shows at most 4 considerations, never from rules whose presenting complaint is absent', async () => {
    const s = await fresh('I am 34, I have had a sore throat for 1 day with a bit of fever, a cough and a rash on my arm.');
    const st = await getConsult(s.id, 'doctor');
    const shown = st.suggestions.filter(x => x.kind === 'consider' && x.status === 'open');
    expect(shown.length).toBeLessThanOrEqual(4);
    expect(shown.map(x => x.text.en).join(' ')).not.toMatch(/lung cancer|tubercul|Stevens/i);
  });
  it('orders chips draw only on shown considerations', async () => {
    const s = await fresh('I have a fever and a stiff neck, a cough, a rash, and a headache.');
    const st = await getConsult(s.id, 'doctor');
    const shown = st.suggestions.filter(x => x.kind === 'consider' && x.status === 'open');
    expect(shown.length).toBeLessThanOrEqual(4);
    const all = getConsultRecord(s.id).suggestions.filter(x => x.kind === 'consider');
    for (const x of all.filter(x => !shown.includes(x) && !shown.some(y => y.id === x.id))) expect(st.suggestions.some(y => y.id === x.id)).toBe(false);
  });
  it('the draft note carries only shown considerations', async () => {
    const s = await fresh('I have a fever and a stiff neck, a cough, a rash, and a headache.');
    const st = await getConsult(s.id, 'doctor');
    const n = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'draft' });
    const shown = new Set(st.suggestions.filter(x => x.kind === 'consider' && x.status === 'open').map(x => `suggestion:${x.id}`));
    expect(n.note!.lines.filter(l => l.section === 'considerations').every(l => shown.has(l.id))).toBe(true);
  });
});

describe('W17 draft note presenting complaint', () => {
  it('never copies a short answer turn as a Patient report', async () => {
    let s = await fresh('I have a headache.'); s = await addTurn(s.id, 'No');
    const n = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'draft' });
    const lines = n.note!.lines.filter(l => l.section === 'presenting_complaint');
    expect(lines.map(l => l.text.en).join('|')).not.toMatch(/Patient report/);
    expect(lines).toHaveLength(1); expect(lines[0]).toMatchObject({ status: 'supported' }); expect(lines[0].text.en.toLowerCase()).toContain('headache');
  });
  it('escalated sessions still keep their first report', async () => {
    const s = await fresh('Chest pain');
    const n = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'draft' });
    expect(n.note!.lines.some(l => l.section === 'presenting_complaint')).toBe(true);
  });
});

describe('W17 mock recognises lay complaints', () => {
  it.each([['I have a sore throat', 'sore throat'], ['I have a fever', 'fever'], ['bad cough since today', 'cough'], ['I have a headache', 'headache'], ['my stomach ache is bad', 'stomach ache'], ['I have back pain', 'back pain'], ['I have a rash', 'rash'], ['I feel dizzy', 'dizziness']])('%s', async (text, value) => {
    const s = await fresh(text);
    const f = s.summary!.fields.find(f => f.key === 'chief_complaint')!;
    expect(f.status).toBe('supported'); expect(f.value!.en).toBe(value);
    expect(s.summary!.nextQuestion?.field).not.toBe('chief_complaint');
  });
});

describe('W17 overlapping name triggers', () => {
  it('collapses "hello Mr. Smith" into one clean token', async () => {
    const { redact } = await import('../redact');
    expect(redact('hello Mr. Smith, I have a headache').text).toBe('[NAME_1], I have a headache');
  });
});

describe('W18 kept considerations', () => {
  it('a kept consideration appears in the draft immediately and persists in the signed note; unkept are dropped', async () => {
    const s = await fresh('I have a fever after a trip with mosquito bites and a cough for three weeks.');
    const st = await getConsult(s.id, 'doctor');
    const [keep, other] = st.suggestions.filter(x => x.kind === 'consider' && x.status === 'open');
    expect(other).toBeDefined();
    const before = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'draft' });
    expect(before.note!.lines.some(l => l.id === `suggestion:${keep.id}`)).toBe(true);
    const { reviewConsultSuggestion } = await import('../consult');
    await reviewConsultSuggestion(s.id, keep.id, doctor, 'asked');
    expect(getConsultRecord(s.id).notes.doctor).toBeUndefined(); // stale draft invalidated
    const kept = await getConsult(s.id, 'doctor');
    expect(kept.suggestions.find(x => x.id === keep.id)!.status).toBe('asked');
    const draft = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'draft' });
    const line = draft.note!.lines.find(l => l.id === `suggestion:${keep.id}`)!;
    expect(line.section).toBe('considerations'); expect(line.text.en).toMatch(/^Consider for clinician review/);
    // UI sends the kept line as an unchanged-text edit; sending nothing must still keep it
    const unsupported = draft.note!.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed' }));
    const signed = await consultNote(s.id, { mode: 'doctor', reviewerId: doctor, action: 'sign', edits: unsupported });
    const ids = signed.note!.lines.filter(l => l.section === 'considerations').map(l => l.id);
    expect(ids).toEqual([`suggestion:${keep.id}`]);
  });
});

describe('W18 consult inputMode', () => {
  it('honours text, defaults to voice, rejects junk', async () => {
    const s = await fresh('Headache since today.');
    await addConsultTurn(s.id, { mode: 'doctor', speaker: 'clinician', text: 'How long?', inputMode: 'text' });
    await addConsultTurn(s.id, { mode: 'doctor', speaker: 'clinician', text: 'Any fever?' });
    await addConsultTurn(s.id, { mode: 'doctor', speaker: 'patient', text: 'Two days, no fever.', inputMode: 'text' });
    const t = getSession(s.id)!.turns;
    expect(t.find(x => x.text === 'How long?')!.inputMode).toBe('text');
    expect(t.find(x => x.text === 'Any fever?')!.inputMode).toBe('voice');
    expect(t.find(x => x.text === 'Two days, no fever.')!.inputMode).toBe('text');
    expect(getAudit(s.id).filter(a => a.type === 'consult_turn').map(a => a.payload.inputMode)).toEqual(['text', 'voice', 'text']);
    await expect(addConsultTurn(s.id, { mode: 'doctor', speaker: 'clinician', text: 'x', inputMode: 'telepathy' as never })).rejects.toMatchObject({ code: 'bad_request' });
  });
});
