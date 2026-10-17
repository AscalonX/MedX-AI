import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addConsultTurn, askedMatch, consultNote, getConsult, reviewConsultSuggestion } from '../consult';
import { addTurn, createSession, runTurn } from '../pipeline';
import { getAudit, getConsultRecord, getSession, getSessions, saveConsultRecord, saveSession } from '../store';
import { redact } from '../redact';
import { consultRules } from './fixtures/consultRules';
import { readLines, readText } from './fixtures/text';
import { POST as postNote } from '../../../app/api/sessions/[id]/consult/note/route';
import { POST as postInvestigation } from '../../../app/api/sessions/[id]/orders/investigations/route';
import { POST as postCancel } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/cancel/route';
import { POST as postSubmit } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';
import { medicationAction, medicationOrder, prescribingChecks } from '../orders';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w16-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const options = { rules: consultRules };
const req = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const context = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });
const speech = (text: string, speaker: 'patient' | 'clinician' = 'patient', clientTurnId?: string) => ({ text, speaker, mode: 'doctor' as const, clientTurnId });
const noteReq = { reviewerId: 'synthetic-dr', mode: 'doctor' as const };
const draftOrder = { orderedBy: 'synthetic-dr', drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'daily' };
function reload() {
  const main = path.join(dir, 'store.json');
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'other.json')); getSession('absent'); vi.stubEnv('MEDX_STORE_PATH', main);
}

describe('W16 P1-1 ambient names and record identifiers', () => {
  it.each([
    ['Good morning Mr. Somchai Jaidee, what brings you in?', 'Somchai Jaidee'],
    ['Hi, I am Somchai Jaidee. My hospital number is HN 1234567. Headache since yesterday', 'Somchai Jaidee'],
    ['Hello Somchai, what brings you in?', 'Somchai'], ['Yes doctor, Somchai here', 'Somchai'],
    ['Mrs. Malee Srisuk, are you feeling better?', 'Malee Srisuk'],
    ["I'm Marco Rossi", 'Marco Rossi'], ['sono Marco Rossi', 'Marco Rossi'],
    ['ผม สมชาย ใจดี ปวดหัว', 'สมชาย ใจดี'], ['ฉัน Somchai Jaidee', 'Somchai Jaidee'],
    ...['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Signor', 'Signora', 'Sig.', 'คุณ', 'นาย', 'นาง', 'นางสาว'].flatMap(title => [
      [`${title} Marco Luigi Rossi, headache`, 'Marco Luigi Rossi'],
      [`${title} สมชาย ใจดี ปวดหัว`, 'สมชาย ใจดี'],
    ]),
  ])('redacts name in %s', (raw, name) => {
    const result = redact(raw); expect(result.text).not.toContain(name); expect(result.text).toMatch(/\[NAME_\d+\]/);
    for (const symptom of ['Headache since yesterday', 'headache', 'ปวดหัว']) if (raw.includes(symptom)) expect(result.text).toContain(symptom);
    const index = result.text.indexOf('[NAME_'); const end = result.text.indexOf(']', index) + 1;
    const span = result.positions[index]; expect(raw.slice(span.start, span.end)).toContain(name);
    expect(result.positions.slice(index, end).every(p => p.start === span.start && p.end === span.end)).toBe(true);
  });
  it.each(['HN 1234567', 'HN: 123-4567', 'MRN 1234567', 'MRN: 123-4567', 'Patient ID 7654321', 'เลขที่โรงพยาบาล 1234567', 'numero di cartella: 123-4567', 'hospital number is 1234567', 'medical record number 1234567'])('uses ID placeholders for %s', raw => {
    expect(redact(raw).text).toBe('[ID_1]');
  });
  it.each(['I am dizzy', 'I am Feverish', 'I am Feverish And Dizzy', "I'm tired", "I'm Tired And Sick", 'sono molto stanco', 'Sono Stanco E Malato', 'ผมปวดหัว', 'ฉันเวียนหัว', 'ผมมีอาการเจ็บหน้าอก', 'คุณหายใจไม่ออก', 'ผมอายุ 45 ปี'])('preserves symptoms: %s', raw => {
    expect(redact(raw).text).toBe(raw);
  });
  it('redacts ambient patient/clinician turns, stored summaries, notes, audits and model inputs', async () => {
    const s = createSession('en');
    await addConsultTurn(s.id, speech('Good morning Mr. Somchai Jaidee, what brings you in?', 'clinician'), options);
    await addConsultTurn(s.id, speech('Hi, I am Somchai Jaidee. My hospital number is HN 1234567. Headache since yesterday'), options);
    await consultNote(s.id, { ...noteReq, action: 'draft' }, options);
    expect(readFileSync(path.join(dir, 'store.json'), 'utf8')).not.toMatch(/Somchai|Jaidee|1234567/);
    const client = vi.fn(async () => { throw new Error('must not run'); });
    const flagged = await runTurn(createSession('th', { persist: false }), 'ผม สมชาย ใจดี เจ็บหน้าอก เหงื่อออก', { client });
    expect(flagged.summary!.redFlags.length).toBeGreaterThan(0); expect(flagged.status).toBe('escalated'); expect(client).not.toHaveBeenCalled();
    expect(flagged.turns[0].text).not.toContain('สมชาย'); expect(flagged.turns[0].text).toContain('เจ็บหน้าอก');
    for (const e of flagged.summary!.redFlags.flatMap(f => f.evidence)) expect(flagged.turns.find(t => t.id === e.turnId)!.text.slice(e.start, e.end)).toBe(e.quote);
  });
});

describe('W16 P1-2 / P1-3 note signing', () => {
  it('returns 403 ApiError for nurse sign and leaves the draft/audit unchanged', async () => {
    const s = createSession('en'); await consultNote(s.id, { ...noteReq, mode: 'nurse', action: 'draft' }, options);
    const before = getConsultRecord(s.id), audit = getAudit(s.id);
    const response = await postNote(req({ ...noteReq, mode: 'nurse', action: 'sign' }), context(s.id));
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ code: 'bad_request', error: expect.stringContaining('Only doctor') });
    expect(getConsultRecord(s.id)).toEqual(before); expect(getAudit(s.id)).toEqual(audit);
  });
  it.each(['Not assessed', 'Deferred for clinician follow-up'])('requires every unsupported line resolved, accepting edit %s', async text => {
    const s = await addTurn(createSession('en').id, 'Headache');
    await consultNote(s.id, { ...noteReq, action: 'draft' }, options);
    const record = getConsultRecord(s.id);
    record.notes.doctor!.lines.push({ id: 'unsupported-med', section: 'medications', text: { en: 'Unverified', it: 'Unverified', th: 'Unverified' }, evidence: [], status: 'unsupported' });
    saveConsultRecord(s.id, record);
    const unsupported = record.notes.doctor!.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields');
    expect(unsupported.some(l => l.id === 'unsupported-med')).toBe(true);
    const audit = getAudit(s.id);
    const response = await postNote(req({ ...noteReq, action: 'sign', edits: [{ lineId: record.notes.doctor!.lines[0].id, text: 'Reviewed history' }] }), context(s.id));
    expect(response.status).toBe(409); expect(getConsultRecord(s.id)).toEqual(record); expect(getAudit(s.id)).toEqual(audit);
    const signed = await consultNote(s.id, { ...noteReq, action: 'sign', edits: unsupported.map(l => ({ lineId: l.id, text })) }, options);
    expect(signed.note!.signed).toBeTruthy(); expect(signed.note!.lines.find(l => l.id === 'unsupported-med')).toMatchObject({ status: 'edited', text: { en: text } });
    expect(signed.note!.lines.filter(l => l.status === 'unsupported').map(l => l.id)).toEqual(['missing:fields']);
    expect(getAudit(s.id).filter(a => a.type === 'consult_note_signed')).toHaveLength(1);
  });
  it('allows the informational missing-fields summary while signing an empty-session draft', async () => {
    const s = createSession('en'); await consultNote(s.id, { ...noteReq, action: 'draft' }, options);
    const signed = await consultNote(s.id, { ...noteReq, action: 'sign' }, options);
    expect(signed.note!.signed).toBeTruthy(); expect(signed.note!.lines).toContainEqual(expect.objectContaining({ id: 'missing:fields', status: 'unsupported' }));
  });
});

describe('W16 P2-1 / P2-2 asked and answered suggestions', () => {
  it('requires content overlap, retains the half-token threshold and ignores small talk', async () => {
    const s = createSession('en'); await getConsult(s.id, 'doctor', options);
    const age = getConsultRecord(s.id).suggestions.find(x => x.field === 'age')!;
    const allergies = getConsultRecord(s.id).suggestions.find(x => x.field === 'allergies')!;
    for (const text of ['Are you OK? Do you want some water?', 'Do you have any?', 'How are you?']) {
      expect(askedMatch(text, age)).toBe(false); expect(askedMatch(text, allergies)).toBe(false);
    }
    expect(askedMatch('How old are you?', age)).toBe(true); expect(askedMatch('What is your age?', age)).toBe(true);
    expect(askedMatch('Any allergies to medicines or foods?', allergies)).toBe(true);
    expect(askedMatch('Any allergies?', allergies)).toBe(false); // One of three content tokens is below .5.
    const four = { ...age, text: { en: 'alpha beta gamma delta', it: 'alpha beta gamma delta', th: 'alpha beta gamma delta' } };
    expect(askedMatch('alpha', four)).toBe(false); expect(askedMatch('alpha beta', four)).toBe(true);
    await addConsultTurn(s.id, speech('Are you OK? Do you want some water?', 'clinician'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === age.id)!.status).toBe('open');
  });
  it('answers the asked age field only after a later supported patient answer, persisting and auditing once', async () => {
    const s = createSession('en'); await addConsultTurn(s.id, speech('How old are you?', 'clinician'), options);
    const id = 'ask_next:field:age'; expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('asked');
    await addConsultTurn(s.id, speech('I am 45 years old', 'clinician'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('asked');
    await addConsultTurn(s.id, speech('I am 45 years old'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('answered');
    reload(); await getConsult(s.id, 'doctor', options); await getConsult(s.id, 'nurse', options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('answered');
    expect(getAudit(s.id).filter(a => a.type === 'consult_suggestion' && a.payload.status === 'answered' && a.payload.suggestionId === id)).toHaveLength(1);
  });
  it('does not answer from prior/unsupported evidence or change dismissed status', async () => {
    const s = await addTurn(createSession('en').id, 'I am 45 years old. Headache'); await getConsult(s.id, 'doctor', options);
    const record = getConsultRecord(s.id), field = s.summary!.fields.find(f => f.key === 'age')!;
    const age = { ...record.suggestions.find(x => x.field === 'allergies')!, id: 'ask_next:field:age', field: 'age' as const, status: 'asked' as const };
    record.suggestions.push(age); record.askedAfterTurn = { [age.id]: s.turns.length }; saveConsultRecord(s.id, record);
    await getConsult(s.id, 'doctor', options); expect(getConsultRecord(s.id).suggestions.find(x => x.id === age.id)!.status).toBe('asked');
    await reviewConsultSuggestion(s.id, 'ask_next:field:allergies', 'synthetic-dr', 'dismissed');
    await addConsultTurn(s.id, speech('No allergies'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.field === 'allergies')!.status).toBe('dismissed');
    const current = getSession(s.id)!; const ageField = current.summary!.fields.find(f => f.key === 'age')!;
    ageField.status = 'unsupported'; ageField.evidence = [{ ...field.evidence[0], turnId: current.turns.at(-1)!.id }]; saveSession(current);
    await getConsult(s.id, 'doctor', options); expect(getConsultRecord(s.id).suggestions.find(x => x.id === age.id)!.status).toBe('asked');
  });
  it('answers a rule question from a matched later patient answer, not from its repeated trigger', async () => {
    const s = createSession('en'); await addConsultTurn(s.id, speech('Headache'), options);
    const id = 'rule_out:CR-HEAD:sudden'; await addConsultTurn(s.id, speech('Was the headache sudden or gradual?', 'clinician'), options);
    await addConsultTurn(s.id, speech('Headache'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('asked');
    await addConsultTurn(s.id, speech('It was gradual'), options);
    expect(getConsultRecord(s.id).suggestions.find(x => x.id === id)!.status).toBe('answered');
    const draft = await consultNote(s.id, { ...noteReq, action: 'draft' }, options);
    expect(draft.note!.lines.some(l => l.id === `suggestion:${id}` && l.section === 'open_questions')).toBe(false);
  });
});

describe('W16 P2-3 private persistent retry IDs', () => {
  it.each(['patient', 'clinician'] as const)('keeps %s retry IDs private across routes, reload and concurrent retries', async speaker => {
    const s = createSession('en'), value = speech('Headache', speaker, 'private-retry');
    await Promise.all([addConsultTurn(s.id, value, options), addConsultTurn(s.id, value, options)]);
    expect(getSession(s.id)!.turns.filter(t => t.role === speaker)).toHaveLength(1);
    expect(JSON.stringify(getSessions())).not.toContain('private-retry'); expect(JSON.stringify(getSession(s.id))).not.toContain('clientTurnId');
    reload(); const before = getAudit(s.id);
    await addConsultTurn(s.id, value, options); await addTurn(s.id, 'Headache', 'voice', 'private-retry');
    expect(getAudit(s.id)).toEqual(before); expect(getSession(s.id)!.turns.filter(t => t.role === speaker)).toHaveLength(1);
    const disk = JSON.parse(readFileSync(path.join(dir, 'store.json'), 'utf8'));
    expect(disk.clientTurnIds).toContainEqual([s.id, ['private-retry']]); expect(JSON.stringify(disk.sessions)).not.toContain('clientTurnId');
  });
  it.each([false, true])('migrates legacy retry IDs, including an existing private map: %s', async privateMap => {
    const s = await addTurn(createSession('en').id, 'Headache');
    const file = path.join(dir, 'store.json'), saved = JSON.parse(readFileSync(file, 'utf8'));
    if (!privateMap) delete saved.clientTurnIds;
    saved.sessions[0].turns[0].clientTurnId = 'legacy-retry'; writeFileSync(file, JSON.stringify(saved)); reload();
    expect(JSON.stringify(getSession(s.id))).not.toContain('legacy-retry');
    await addTurn(s.id, 'Headache', undefined, 'legacy-retry'); expect(getSession(s.id)!.turns.filter(t => t.role === 'patient')).toHaveLength(1);
  });
});

describe('W16 P2-6 current clinical markdown dose identities', () => {
  const docs = path.resolve(process.cwd(), '../../docs/clinical');
  it.each(['CONSULT-SPEC.md', 'MEDRULES-TESTS.md', 'PHARMACY-SPEC.md'])('removes stale dose identities from %s', file => {
    const text = readText(path.join(docs, file));
    expect(text).not.toMatch(/MR-DOSE-0[12]/); expect(text).toContain('MR-DOSE-RANGE'); expect(text).toContain('MR-DOSE-UNCHECKED');
  });
  // readLines normalises CRLF/BOM: the `$`-anchored selector parsed 0 rows on Windows checkouts.
  const rows = readLines(path.join(docs, 'MEDRULES-TESTS.md')).flatMap(line => {
    const m = line.match(/^\| D \| (en|it|th) \| (!?MR-DOSE-(?:RANGE|UNCHECKED)) \| (.+?) \| ([\d.]+) \| ([\d.]+) \|$/);
    return m ? [{ lang: m[1], expected: m[2], drugText: m[3], doseMg: Number(m[4]), timesPerDay: Number(m[5]) }] : [];
  });
  it('covers all ten documented dose rows independently of the legacy checker', () => { expect(rows).toHaveLength(10); });
  it.each(rows)('checks current doc case $lang $expected $drugText $doseMg x $timesPerDay', ({ expected, drugText, doseMg, timesPerDay }) => {
    const order = { ...draftOrder, drugText, doseMg, timesPerDay, id: 'synthetic-doc-order', generic: null, drugClass: null, at: '', status: 'draft' as const, checks: [], overrides: [] };
    const alerts = prescribingChecks(createSession('en', { persist: false }), order);
    expect(alerts.some(a => a.ruleId === expected.replace('!', ''))).toBe(!expected.startsWith('!'));
  });
});

describe('W16 P2-4 / P2-5 order provenance and cancellation', () => {
  it('preserves opaque server references containing phone-like numeric runs', async () => {
    const s = createSession('en'); await medicationOrder(s.id, { ...draftOrder, dose: '1500 mg' });
    const saved = getSession(s.id)!; saved.orders!.medications[0].id = 'synthetic-order-38'; saveSession(saved);
    const order = saved.orders!.medications[0], alert = prescribingChecks(saved, order).find(a => a.severity === 'high')!;
    expect(alert.id).toBe('MR-DOSE-RANGE-be2edff3542677053a8b21e8');
    expect(redact(alert.id).text).not.toBe(alert.id); // Opaque identity is not clinical prose.
    const response = await postSubmit(req({ orderedBy: 'synthetic-dr', overrides: [{ alertId: alert.id, reason: 'Review123' }] }), context(s.id, order.id));
    expect(response.status).toBe(200); expect(getSession(s.id)!.orders!.medications[0].overrides[0].alertId).toBe(alert.id);
    await getConsult(s.id, 'doctor', options);
    const record = getConsultRecord(s.id), suggestion = record.suggestions[0]; suggestion.id = 'ask_next:model:3542677053abcdef'; saveConsultRecord(s.id, record);
    expect((await postInvestigation(req({ orderedBy: 'synthetic-dr', code: 'fbc', fromSuggestionId: suggestion.id }), context(s.id))).status).toBe(200);
  });
  it('rejects unknown and other-session suggestion IDs with 400, accepts this-session provenance and manual orders', async () => {
    const a = createSession('en'), b = createSession('en'); await addConsultTurn(a.id, speech('Headache'), options);
    const suggestion = getConsultRecord(a.id).suggestions.find(x => x.kind === 'consider')!;
    for (const [id, fromSuggestionId] of [[a.id, 'does-not-exist-anywhere'], [b.id, suggestion.id]]) {
      const before = getAudit(id), session = getSession(id);
      const response = await postInvestigation(req({ orderedBy: 'synthetic-dr', code: 'fbc', fromSuggestionId }), context(id));
      expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: 'bad_request' });
      expect(getSession(id)).toEqual(session); expect(getAudit(id)).toEqual(before);
    }
    expect((await postInvestigation(req({ orderedBy: 'synthetic-dr', code: 'fbc', fromSuggestionId: suggestion.id }), context(a.id))).status).toBe(200);
    expect((await postInvestigation(req({ orderedBy: 'synthetic-dr', code: 'fbc' }), context(b.id))).status).toBe(200);
  });
  it('rejects verified cancellation with 409 without changing order or audit', async () => {
    const s = createSession('en'), drafted = await medicationOrder(s.id, draftOrder), order = drafted.orders!.medications[0];
    await medicationAction(s.id, order.id, 'submit', { orderedBy: 'synthetic-dr', overrides: [] });
    await medicationAction(s.id, order.id, 'pharmacy', { reviewerId: 'synthetic-ph', action: 'verify' });
    const before = getSession(s.id), audit = getAudit(s.id);
    const response = await postCancel(req({ orderedBy: 'synthetic-dr' }), context(s.id, order.id));
    expect(response.status).toBe(409); expect(getSession(s.id)).toEqual(before); expect(getAudit(s.id)).toEqual(audit);
  });
  it.each(['draft', 'submitted', 'returned'] as const)('allows cancellation before verify from %s, with explicit legacy audit action', async status => {
    const s = createSession('en'), drafted = await medicationOrder(s.id, draftOrder), order = drafted.orders!.medications[0];
    if (status !== 'draft') await medicationAction(s.id, order.id, 'submit', { orderedBy: 'synthetic-dr', overrides: [] });
    if (status === 'returned') await medicationAction(s.id, order.id, 'pharmacy', { reviewerId: 'synthetic-ph', action: 'return', note: 'Review requested' });
    expect((await postCancel(req({ orderedBy: 'synthetic-dr', reason: 'Doctor reviewed' }), context(s.id, order.id))).status).toBe(200);
    expect(getSession(s.id)!.orders!.medications[0].status).toBe('cancelled');
    expect(getAudit(s.id).at(-1)).toMatchObject({ type: 'order_drafted', payload: { action: 'cancel', orderId: order.id, reason: 'Doctor reviewed' } });
  });
});
