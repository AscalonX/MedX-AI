import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsultMode, Lang, Localized } from '@medx/shared';
import { addConsultTurn, askedMatch, consultNote, draftConsultNote, getConsult, modelSuggestions, reviewConsultSuggestion, ruleSuggestions } from '../consult';
import { loadConsultRules, validateConsultRules } from '../consultRules';
import { addTurn, createSession, review } from '../pipeline';
import { getAudit, getConsultRecord, getSession, saveSession } from '../store';
import { extractionPrompt, screenPrompt } from '../prompts';
import type { ModelClient } from '../llm';
import { chatJSON } from '../llm';
import { consultRules } from './fixtures/consultRules';
import { GET } from '../../../app/api/sessions/[id]/consult/route';
import { POST as postTurn } from '../../../app/api/sessions/[id]/consult/turns/route';
import { POST as postSuggestion } from '../../../app/api/sessions/[id]/consult/suggestions/[suggestionId]/route';
import { POST as postNote } from '../../../app/api/sessions/[id]/consult/note/route';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-w11-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
const options = { rules: consultRules };
const loc = (en: string): Localized => ({ en, it: en, th: en });
const request = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const utterance = (text: string, speaker: 'patient' | 'clinician' = 'patient', mode: ConsultMode = 'doctor', clientTurnId?: string) => ({ text, speaker, mode, clientTurnId });
async function setup(text = 'Headache since yesterday') {
  const s = createSession('en'); await addConsultTurn(s.id, utterance(text), options); return getSession(s.id)!;
}
function modelItem(overrides: Record<string, unknown> = {}) {
  return { kind: 'ask_next', text: loc('Ask about sleep?'), why: loc('Clarify the patient report.'), turn: 'T1', quote: 'Headache', confidence: 0.9, ...overrides };
}

describe('ambient patient and clinician safety boundaries', () => {
  it('uses the same patient path as intake, including verified extraction and voice mode', async () => {
    const a = await setup(); const b = await addTurn(createSession('en').id, 'Headache since yesterday', 'voice');
    expect(a.status).toBe(b.status);
    expect(a.summary!.fields.map(f => [f.key, f.status, f.value])).toEqual(b.summary!.fields.map(f => [f.key, f.status, f.value]));
    expect(a.turns[0].inputMode).toBe('voice');
  });
  it('escalates before any consult model call and never clears escalation', async () => {
    const s = createSession('en'); const client = vi.fn<ModelClient>();
    const result = await addConsultTurn(s.id, utterance('My name is John Smith. My phone is 0812345678. Chest pain.'), { ...options, client });
    expect(getSession(s.id)!.status).toBe('escalated'); expect(client).not.toHaveBeenCalled();
    expect(result.suggestions[0]).toMatchObject({ kind: 'rule_out', source: 'rule', text: { en: expect.stringContaining('Escalate:') } });
    const stored = readFileSync(path.join(dir, 'store.json'), 'utf8'); expect(stored).not.toMatch(/John Smith|0812345678/);
    await addConsultTurn(s.id, utterance('No symptoms now', 'clinician'), options);
    await addConsultTurn(s.id, utterance('I feel better'), options);
    expect(getSession(s.id)!.status).toBe('escalated');
    expect(getAudit(s.id).filter(a => a.type === 'consult_turn')).toHaveLength(3);
    expect(JSON.stringify(getAudit(s.id).filter(a => a.type === 'consult_turn'))).not.toMatch(/symptoms|Chest pain|John Smith/);
  });
  it('clinician speech is redacted, never flags, extracts, or enters model prompts', async () => {
    const s = createSession('en');
    await addConsultTurn(s.id, utterance('My name is Jane Doe. Chest pain. I take warfarin.', 'clinician'), options);
    const saved = getSession(s.id)!; expect(saved.summary).toBeNull(); expect(saved.status).toBe('collecting');
    expect(saved.turns[0]).toMatchObject({ role: 'clinician', inputMode: 'voice' }); expect(saved.turns[0].text).not.toContain('Jane Doe');
    expect(extractionPrompt(saved)).not.toContain('warfarin'); expect(screenPrompt(saved)).not.toContain('Jane Doe');
    await addConsultTurn(s.id, utterance('Headache'), options);
    const after = getSession(s.id)!; expect(after.summary!.redFlags).toEqual([]); expect(after.summary!.medications).toEqual([]);
    expect(after.summary!.fields.flatMap(f => f.evidence).every(e => after.turns.find(t => t.id === e.turnId)?.role === 'patient')).toBe(true);
    expect(modelSuggestions({ suggestions: [modelItem({ quote: 'warfarin', turn: 'A1' })] }, after)).toEqual([]);
  });
  it.each(['collecting', 'awaiting_review', 'needs_human', 'escalated'] as const)('accepts consult in %s', async status => {
    const s = createSession('en'); s.status = status; saveSession(s);
    await expect(addConsultTurn(s.id, utterance('Please describe the problem', 'clinician'), options)).resolves.toMatchObject({ sessionId: s.id });
    expect(getSession(s.id)!.status).toBe(status);
  });
  it.each(['approved', 'taken_over'] as const)('rejects new speech in %s', async status => {
    const s = createSession('en'); s.status = status; saveSession(s);
    await expect(addConsultTurn(s.id, utterance('Headache'), options)).rejects.toMatchObject({ status: 409 });
    expect(getSession(s.id)!.turns).toEqual([]);
  });
  it.each(['patient', 'clinician'] as const)('serializes concurrent %s retries with persistent idempotency', async speaker => {
    const s = createSession('en'); const req = utterance('Headache', speaker, 'nurse', 'same-1');
    const [a, b] = await Promise.all([addConsultTurn(s.id, req, options), addConsultTurn(s.id, req, options)]);
    expect(a).toEqual(b); expect(getSession(s.id)!.turns.filter(t => t.role === speaker)).toHaveLength(1);
    expect(getAudit(s.id).filter(a => a.type === 'consult_turn')).toHaveLength(1);
    const saved = JSON.parse(readFileSync(path.join(dir, 'store.json'), 'utf8'));
    expect(saved.sessions[0].turns[0]).not.toHaveProperty('clientTurnId');
    expect(saved.clientTurnIds).toContainEqual([s.id, ['same-1']]);
    const closed = getSession(s.id)!; closed.status = 'taken_over'; saveSession(closed);
    await expect(addConsultTurn(s.id, req, options)).resolves.toEqual(a);
  });
});

describe('suggestion rules, ranking, modes, and status memory', () => {
  it('loads any valid typed bank and validates malformed banks', () => {
    expect(validateConsultRules(consultRules)).toBe(true); expect(validateConsultRules({ ...consultRules, rules: [{}] })).toBe(false);
    expect(validateConsultRules(loadConsultRules())).toBe(true);
  });
  const spec = path.resolve(process.cwd(), '../../docs/clinical/CONSULT-SPEC.md');
  const cases = readFileSync(spec, 'utf8').split('\n').flatMap(line => {
    const match = line.match(/^\| (CR-[A-Z]+-\d+) \| (en|it|th) \| (fire|no) \| (.+) \|$/);
    return match ? [{ ruleId: match[1], lang: match[2] as Lang, fires: match[3] === 'fire', text: match[4] }] : [];
  });
  it.each(cases)('Doctor reference $ruleId $lang $fires: $text', ({ ruleId, lang, fires, text }) => {
    const s = createSession(lang, { persist: false }); s.turns = [{ id: 'p', role: 'patient', text, lang, at: '' }];
    expect(ruleSuggestions(s, loadConsultRules()).some(x => x.ruleId === ruleId)).toBe(fires);
  });
  it('retains verified evidence for dictionary stems inside patient words', () => {
    const s = createSession('en', { persist: false }); s.turns = [{ id: 'p', role: 'patient', text: 'I am wheezing', lang: 'en', at: '' }];
    const found = ruleSuggestions(s, loadConsultRules()).filter(x => x.ruleId === 'CR-SOB-01');
    expect(found.length).toBeGreaterThan(0); expect(found[0].evidence[0].quote).toBe('I am wheezing');
  });
  it.each(['ＨＥＡＤＡＣＨＥ', 'head\u200bache', 'ปวด หัว', 'mal di testa'])('shares matcher normalization for %s', async text => {
    const s = await setup(text); expect(ruleSuggestions(s, consultRules).some(x => x.ruleId === 'CR-HEAD')).toBe(true);
  });
  it('honors negation and AND-of-ORs across patient turns', async () => {
    const s = createSession('en'); s.turns = [{ id: 'p1', role: 'patient', text: 'No headache. Cough', lang: 'en', at: '' }, { id: 'c', role: 'clinician', text: 'fever', lang: 'en', at: '' }];
    expect(ruleSuggestions(s, consultRules).filter(x => x.ruleId)).toEqual([]);
    s.turns.push({ id: 'p2', role: 'patient', text: 'Fever', lang: 'en', at: '' });
    const hit = ruleSuggestions(s, consultRules).find(x => x.ruleId === 'CR-COUGH')!; expect(hit).toBeDefined(); expect(hit.evidence.map(e => e.turnId)).toEqual(['p1', 'p2']);
  });
  it('ranks rules before missing prompts before models, caps open suggestions, and scopes considerations', async () => {
    const s = await setup('Headache'); const doctor = await getConsult(s.id, 'doctor', options); const nurse = await getConsult(s.id, 'nurse', options);
    expect(doctor.suggestions[0]).toMatchObject({ kind: 'rule_out', ruleId: 'CR-HEAD' });
    expect(doctor.suggestions.filter(x => x.status === 'open').length).toBeLessThanOrEqual(8);
    expect(doctor.suggestions.some(x => x.kind === 'consider')).toBe(true); expect(nurse.suggestions.some(x => x.kind === 'consider')).toBe(false);
    const all = getConsultRecord(s.id).suggestions; expect(all.at(-1)!.source).toBe('model');
    expect(all.findIndex(x => x.kind === 'ask_next' && x.source === 'rule')).toBeGreaterThan(0);
    expect(all.filter(x => x.source === 'model')).toHaveLength(1);
  });
  it('marks matching clinician questions asked, with sticky statuses across refresh and patient updates', async () => {
    const s = await setup(); const q = getConsultRecord(s.id).suggestions.find(x => x.ruleId === 'CR-HEAD' && x.kind === 'rule_out')!;
    expect(askedMatch('Was the headache sudden?', q)).toBe(true); expect(askedMatch('Please sit down', q)).toBe(false);
    await addConsultTurn(s.id, utterance('Was the headache sudden?', 'clinician'), options);
    expect((await getConsult(s.id, 'doctor', options)).suggestions.find(x => x.id === q.id)!.status).toBe('asked');
    const missing = getConsultRecord(s.id).suggestions.find(x => x.field === 'allergies')!;
    await reviewConsultSuggestion(s.id, missing.id, 'doctor-1', 'dismissed');
    await addConsultTurn(s.id, utterance('Since today'), options);
    const refreshed = await getConsult(s.id, 'doctor', options);
    expect(refreshed.suggestions.find(x => x.id === missing.id)!.status).toBe('dismissed'); expect(refreshed.suggestions.find(x => x.id === q.id)!.status).toBe('asked');
    expect(getAudit(s.id).filter(a => a.type === 'consult_suggestion')).toHaveLength(2);
  });
  it('calls the consult model once per patient revision across modes and GETs', async () => {
    const s = await addTurn(createSession('en').id, 'Headache'); const client = vi.fn<ModelClient>(chatJSON);
    for (const mode of ['nurse', 'doctor', 'nurse'] as const) await getConsult(s.id, mode, { ...options, client });
    expect(client).toHaveBeenCalledTimes(1); expect(client.mock.calls[0][0].schemaName).toBe('consult_suggestions');
    await addConsultTurn(s.id, utterance('Could you clarify?', 'clinician'), { ...options, client }); expect(client).toHaveBeenCalledTimes(1);
  });
  it('keeps the canned model question verifiable for long utterances', async () => {
    const s = await setup(`Headache. ${'Some more patient words '.repeat(30)}`);
    const model = getConsultRecord(s.id).modelSuggestions[0]; expect(model).toBeDefined();
    expect(model.evidence[0].quote.length).toBeLessThanOrEqual(400);
  });
  it('reloads sticky suggestions and notes from disk independently of patient session responses', async () => {
    const s = await setup(); const suggestion = getConsultRecord(s.id).suggestions[0];
    await reviewConsultSuggestion(s.id, suggestion.id, 'dr', 'dismissed');
    const note = await consultNote(s.id, { reviewerId: 'dr', mode: 'doctor', action: 'draft' }, options);
    const main = path.join(dir, 'store.json'); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'other.json')); getSession('none'); vi.stubEnv('MEDX_STORE_PATH', main);
    expect(getConsultRecord(s.id).notes.doctor).toEqual(note.note);
    expect((await getConsult(s.id, 'doctor', options)).suggestions.find(x => x.id === suggestion.id)?.status).toBe('dismissed');
  });
});

describe('untrusted model suggestions', () => {
  it('sends at most one Gemma completion request, including compatibility failures', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', 'https://consult-gateway.example/v1'); vi.stubEnv('AMD_API_KEY', 'synthetic-key'); vi.stubEnv('AMD_MODEL', 'gemma-test'); vi.stubEnv('AMD_JSON_SCHEMA', 'true');
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('json_schema unsupported', { status: 400 }));
    const result = await chatJSON({ step: 'next_question', schemaName: 'consult_suggestions', system: 'test', user: 'test' });
    expect(result.failure).toBe('provider_error'); expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string); expect(body.response_format.json_schema.name).toBe('consult_suggestions'); expect(body.response_format.json_schema.schema.properties.suggestions).toBeDefined();
  });
  it('omits model suggestions entirely when the intake pipeline abstained', async () => {
    const s = await addTurn(createSession('en').id, 'Headache'); s.summary!.abstained = true; s.status = 'needs_human'; saveSession(s);
    const client = vi.fn<ModelClient>(chatJSON); const state = await getConsult(s.id, 'doctor', { ...options, client });
    expect(client).not.toHaveBeenCalled(); expect(state.suggestions.some(x => x.source === 'model')).toBe(false);
  });
  it.each(['invented patient quote', 'headache', 'Head ache'])('drops unverified or non-verbatim quote %s', async quote => {
    const s = await setup(); expect(modelSuggestions({ suggestions: [modelItem({ quote })] }, s)).toEqual([]);
  });
  it.each(['Ask for the diagnosis?', 'Ask the doctor to prescribe aspirin', 'You have migraine', 'Ask about treatment', 'Ask to start taking antibiotics', 'Ask: safe to wait?', 'Ask about d\u200biagnosis', 'Ask if migraine is likely', 'Ask about probable pneumonia', 'Ask: you must take aspirin', 'Ask about a 90% probability'])('rejects forbidden wording: %s', async text => {
    const s = await setup(); expect(modelSuggestions({ suggestions: [modelItem({ text: loc(text) })] }, s)).toEqual([]);
  });
  it('rejects unsafe rationale, low confidence, malformed output, and clinician quotes', async () => {
    const s = await setup();
    expect(modelSuggestions({ suggestions: [modelItem({ why: loc('You have migraine') })] }, s)).toEqual([]);
    expect(modelSuggestions({ suggestions: [modelItem({ confidence: 0.2 })] }, s)).toEqual([]);
    expect(modelSuggestions({ suggestions: [modelItem({ confidence: 'high' })] }, s)).toBeNull();
    expect(modelSuggestions({ suggestions: [modelItem({ quote: 'Headache' })] }, s)?.[0]).toMatchObject({ confidence: 0.9, evidence: [expect.objectContaining({ quote: 'Headache' })] });
  });
  it('rejects even evidenced doctor-only model considerations', async () => {
    const s = await setup(); const items = modelSuggestions({ suggestions: [modelItem({ kind: 'consider', text: loc('Consider: headache causes for clinician review') })] }, s)!;
    expect(items).toEqual([]);
  });
  it('keeps stable ids when a provider changes localized JSON key order', async () => {
    const s = await setup(); const a = modelItem(); const b = modelItem({ text: { th: a.text.th, en: a.text.en, it: a.text.it } });
    expect(modelSuggestions({ suggestions: [a] }, s)![0].id).toBe(modelSuggestions({ suggestions: [b] }, s)![0].id);
  });
  it.each(['provider', 'schema'] as const)('abstains to needs_human on consult %s failure', async failure => {
    const s = await addTurn(createSession('en').id, 'Headache');
    const client: ModelClient = async req => ({ data: failure === 'schema' ? {} : null, call: { step: req.step, provider: 'mock', model: 'test', latencyMs: 0, ok: failure === 'schema' }, failure: failure === 'provider' ? 'provider_error' : undefined });
    const state = await getConsult(s.id, 'doctor', { ...options, client }); expect(state.suggestions.some(x => x.source === 'model')).toBe(false);
    expect(getSession(s.id)).toMatchObject({ status: 'needs_human', summary: { abstained: true } });
  });
});

describe('deterministic consult notes and signing', () => {
  it('retains explicit no-known-allergies evidence even when the aggregate field is missing', async () => {
    const s = await setup('Headache. No allergies.'); const evidence = s.summary!.noKnownAllergiesEvidence!;
    expect(evidence.length).toBeGreaterThan(0);
    const f = s.summary!.fields.find(f => f.key === 'allergies')!; f.value = null; f.status = 'missing'; f.evidence = [];
    const note = draftConsultNote(s, [], 'nurse'); expect(note.lines.find(l => l.id === 'allergies:no-known')).toMatchObject({ status: 'supported', evidence });
  });
  it('includes summary, medications, allergies, flags, labeled considerations and open questions with evidence', async () => {
    const s = await setup('Headache since yesterday. I take warfarin. I am allergic to penicillin.');
    const note = draftConsultNote(s, getConsultRecord(s.id).suggestions, 'doctor');
    expect(note.disclaimer.en).toBe('Draft for clinician review. Not a diagnosis.');
    for (const section of ['presenting_complaint', 'history', 'medications', 'allergies', 'considerations', 'open_questions']) expect(note.lines.some(l => l.section === section)).toBe(true);
    expect(note.lines.find(l => l.section === 'considerations')!.text.en).toContain('clinician review');
    expect(note.lines.findIndex(l => l.section === 'considerations')).toBeLessThan(note.lines.findIndex(l => l.section === 'open_questions'));
    expect(note.lines.filter(l => !l.evidence.length).every(l => l.status === 'unsupported')).toBe(true);
    expect(draftConsultNote(s, getConsultRecord(s.id).suggestions, 'nurse').lines.some(l => l.section === 'considerations')).toBe(false);
    expect(JSON.stringify(s)).not.toContain('disclaimer');
  });
  it('blocks sign with unreviewed flags then signs edited lines after review, preserving escalation', async () => {
    const s = await setup('Chest pain'); const req = { reviewerId: 'doctor-1', mode: 'doctor' as const, action: 'draft' as const };
    const draft = await consultNote(s.id, req, options); expect(draft.note!.lines.some(l => l.section === 'red_flags')).toBe(true);
    const before = getAudit(s.id); const res = await postNote(request({ ...req, action: 'sign' }), context(s.id)); expect(res.status).toBe(409); expect(getAudit(s.id)).toEqual(before);
    await review(s.id, 'doctor-1', [], getSession(s.id)!.summary!.redFlags.map(f => ({ ruleId: f.ruleId, action: 'acknowledge' })));
    const lineId = draft.note!.lines[0].id;
    const signed = await consultNote(s.id, { ...req, action: 'sign', edits: [{ lineId, text: 'Clinician corrected wording' }] }, options);
    expect(signed.note!.signed?.reviewerId).toBe('doctor-1'); expect(signed.note!.lines[0]).toMatchObject({ status: 'edited', text: { en: 'Clinician corrected wording' } });
    expect(getSession(s.id)!.status).toBe('escalated'); expect(getAudit(s.id).filter(a => a.type === 'consult_note_signed')).toHaveLength(1);
    await expect(consultNote(s.id, req, options)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects invalid edits without modifying persisted drafts or audits', async () => {
    const s = await setup(); const req = { reviewerId: 'dr', mode: 'doctor' as const, action: 'draft' as const };
    const draft = await consultNote(s.id, req, options); const audit = getAudit(s.id);
    await expect(consultNote(s.id, { ...req, action: 'sign', edits: [{ lineId: draft.note!.lines[0].id, text: 'valid' }, { lineId: 'unknown', text: 'invalid' }] })).rejects.toMatchObject({ code: 'bad_request' });
    expect(getConsultRecord(s.id).notes.doctor).toEqual(draft.note); expect(getAudit(s.id)).toEqual(audit);
  });
});

describe('consult HTTP contracts', () => {
  it('serves the four routes, validates payloads, and preserves patient session isolation', async () => {
    const id = createSession('en').id;
    expect((await postTurn(request(utterance('Headache')), context(id))).status).toBe(200);
    const response = await GET(new Request('http://localhost/api?mode=doctor'), context(id)); expect(response.status).toBe(200); const state = await response.json();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const suggestionId = state.suggestions[0].id;
    expect((await postSuggestion(request({ reviewerId: 'nurse', status: 'dismissed' }), { params: Promise.resolve({ id, suggestionId }) })).status).toBe(200);
    expect((await postNote(request({ reviewerId: 'dr', mode: 'doctor', action: 'draft' }), context(id))).status).toBe(200);
    expect((await postNote(request({ reviewerId: 'dr', mode: 'doctor', action: 'sign' }), context(id))).status).toBe(200);
    expect(getSession(id)).not.toHaveProperty('note'); expect(getSession(id)).not.toHaveProperty('suggestions');
    expect((await GET(new Request('http://localhost/api?mode=patient'), context(id))).status).toBe(400);
    expect((await GET(new Request('http://localhost/api?mode=nurse'), context('absent'))).status).toBe(404);
  });
  it.each([{ speaker: 'assistant', text: 'x', mode: 'doctor' }, { speaker: 'patient', text: '', mode: 'doctor' }, { speaker: 'patient', text: 'x', mode: 'doctor', clientTurnId: null }, { speaker: 'patient', text: 'x', mode: 'doctor', extra: true }])('rejects invalid utterance %j', async value => {
    const s = createSession('en'); expect((await postTurn(request(value), context(s.id))).status).toBe(400); expect(getSession(s.id)!.turns).toEqual([]);
  });
});
