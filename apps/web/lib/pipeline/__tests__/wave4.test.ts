import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { AllergyEntry, Lang, MedicationEntry, MedAlertKind } from '@medx/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMedRules, lookupAllergen, lookupDrug } from '../medrules';
import { addTurn, createSession, runTurn } from '../pipeline';
import { pharmacyReview } from '../pharmacyReview';
import { pharmacyEntries } from '../pharmacyExtraction';
import { getAudit, getSession, saveSession } from '../store';
import { mockJSON } from '../mock';
import { EXTRACTION_SCHEMA, validateExtraction } from '../schema';
import type { ModelClient } from '../llm';
import { POST, OPTIONS } from '../../../app/api/sessions/[id]/pharmacy-review/route';
import { seedDemo } from '../seed';

const root = new URL('../../../../../', import.meta.url);
const md = readFileSync(new URL('docs/clinical/MEDRULES-TESTS.md', root), 'utf8');
const rows = md.split('\n').filter(s => /^\| (L|AL|A) \| (en|it|th) \|/.test(s)).map(s => s.split('|').slice(1, -1).map(s => s.trim()));
const split = (s: string) => s === '-' ? [] : s.split(';').map(s => s.trim()).filter(Boolean);
const med = (name: string, id = name): MedicationEntry => { const d = lookupDrug(name); return { id, nameOriginal: name, generic: d?.generic ?? null, drugClass: d?.drugClass ?? null, dose: null, frequency: null, timing: null, evidence: [], confidence: 1, status: d ? 'supported' : 'unmatched' }; };
const allergy = (name: string, id = name): AllergyEntry => ({ id, allergenOriginal: name, allergenClass: lookupAllergen(name)?.allergenClass ?? null, reaction: null, evidence: [], status: 'supported' });
const cases = readdirSync(new URL('data/cases/', root)).filter(f => /^MED-.*\.json$/.test(f)).map(f => JSON.parse(readFileSync(new URL(`data/cases/${f}`, root), 'utf8')));
let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-w4-')); vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
const request = (value: unknown) => new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(value) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe(`Doctor medrules reference: ${rows.length} rows`, () => {
  it.each(rows)('%s %s %s', (kind, _lang, input, expected, alls, pregnancy) => {
    if (kind === 'L') expect(lookupDrug(input)?.generic ?? '(none)').toBe(expected);
    else if (kind === 'AL') expect(lookupAllergen(input)?.allergenClass ?? '(none)').toBe(expected);
    else {
      const alerts = checkMedRules(split(expected).map((s, i) => med(s, String(i))), split(alls).map(s => allergy(s)), pregnancy);
      expect(alerts.some(a => a.ruleId === input.replace('!', ''))).toBe(!input.startsWith('!'));
    }
  });
});

const expectedKinds: Record<string, MedAlertKind[]> = {
  'MED-01': ['allergy_conflict'], 'MED-02': ['max_dose_risk'], 'MED-03': ['interaction'],
  'MED-04': ['unknown_medication'], 'MED-05': ['max_dose_risk'], 'MED-06': ['pregnancy_caution'],
  'MED-07': [], 'MED-08': ['unknown_medication'], 'MED-09': ['interaction'],
  'MED-10': ['unknown_medication'], 'MED-11': ['unknown_medication'], 'MED-12': [],
};
describe('MED extraction through mock provider and alerts', () => {
  it.each(cases)('$id', async c => {
    let s = createSession(c.lang as Lang, { persist: false });
    for (const t of c.turns.filter((t: { role: string }) => t.role === 'patient')) s = await runTurn(s, t.text);
    const got = [...new Set(s.summary!.medAlerts!.map(a => a.kind))].sort();
    const gold = [...new Set(c.gold.medAlerts.map((a: { kind: string }) => a.kind))].sort();
    console.log(`MED agreement ${c.id}: gold=${gold.join(',') || 'none'} actual=${got.join(',') || 'none'} meds=${s.summary!.medications!.length} unsupported=${s.summary!.medications!.filter(m => m.status === 'unsupported').length}`);
    expect(got).toEqual(expectedKinds[c.id].sort());
    for (const e of [...s.summary!.medications!, ...s.summary!.allergies!].flatMap(m => m.evidence)) expect(s.turns.find(t => t.id === e.turnId)?.text.slice(e.start, e.end)).toBe(e.quote);
    expect(s.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(1);
  });
  it('keeps allergy mentions out of the medicine list, and requires explicit no-allergy evidence', async () => {
    const s = await runTurn(createSession('en', { persist: false }), 'I am allergic to ibuprofen. I take metformin 500 mg twice a day.');
    expect(s.summary?.medications?.map(m => m.generic)).toEqual(['metformin']);
    expect(s.summary?.allergies?.[0].allergenClass).toBe('nsaid'); expect(s.summary?.noKnownAllergiesEvidence).toEqual([]);
    const no = await runTurn(createSession('en', { persist: false }), 'No known allergies. I take metformin.');
    expect(no.summary?.noKnownAllergiesEvidence?.[0].quote).toBe('No known allergies');
  });
  it('marks invented or boundary-embedded names unsupported, redacts model strings', () => {
    const s = createSession('en', { persist: false }); s.turns = [{ id: 't', lang: 'en', role: 'patient', at: '', text: 'I take metformin. painting.' }];
    const result = pharmacyEntries({ medications: [{ nameOriginal: 'ibuprofen', turn: 'T1', quote: 'I take metformin.', dose: null, frequency: null, timing: '0812345678' }, { nameOriginal: 'pain', turn: 'T1', quote: 'pain', dose: null, frequency: null, timing: null }] }, s);
    expect(result.medications.every(m => m.status === 'unsupported' && m.evidence.length === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('0812345678');
  });
  it('rejects hallucinated dose/reaction despite a real quote', () => {
    const s = createSession('en', { persist: false }); s.turns = [{ id: 't', lang: 'en', role: 'patient', at: '', text: 'I take metformin. Allergic to latex.' }];
    const entries = pharmacyEntries({ medications: [{ nameOriginal: 'metformin', turn: 'T1', quote: 'I take metformin.', dose: '5000 mg', frequency: null, timing: null }], allergies: [{ allergenOriginal: 'latex', turn: 'T1', quote: 'Allergic to latex.', reaction: 'anaphylaxis' }] }, s);
    expect(entries.medications[0].status).toBe('unsupported'); expect(entries.allergies[0].status).toBe('unsupported');
  });
  it('requires pharmacy lists in both transport schema and runtime validation', () => {
    expect(EXTRACTION_SCHEMA.required).toEqual(expect.arrayContaining(['medications', 'allergies', 'noKnownAllergies']));
    expect(validateExtraction({ language_detected: 'en', fields: {} }).data).toBeNull();
    expect(validateExtraction({ language_detected: 'en', fields: {}, medications: [], allergies: [], noKnownAllergies: null }).data).not.toBeNull();
  });
  it('abstains on malformed pharmacy extraction after one repair', async () => {
    const client = vi.fn<ModelClient>(async r => {
      const data = mockJSON(r) as Record<string, unknown>;
      if (r.step === 'extract') data.medications = [{ nameOriginal: 'metformin', quote: 123 }];
      return { data, call: { step: r.step, provider: 'mock', model: 'schema-test', latencyMs: 1, ok: true } };
    });
    const s = await runTurn(createSession('en', { persist: false }), 'I take metformin.', { client });
    expect(s.summary?.abstainReason).toBe('schema_error'); expect(s.summary?.medications).toEqual([]);
    expect(s.summary?.modelCalls.filter(c => c.step === 'extract')).toHaveLength(2);
  });
  it('still collects dictionary medicines on escalation with no model calls', async () => {
    const client = vi.fn(); const s = await runTurn(createSession('en', { persist: false }), 'chest pain. I take warfarin and ibuprofen.', { client });
    expect(client).not.toHaveBeenCalled(); expect(s.status).toBe('escalated'); expect(s.summary?.medAlerts?.some(a => a.kind === 'interaction')).toBe(true);
  });
});

describe('pharmacy review endpoint', () => {
  const setup = () => addTurn(createSession('en').id, 'I take warfarin every evening and ibuprofen 200 mg. I am allergic to penicillin.');
  it('returns CORS, blocks high alerts atomically with a reason, then reconciles', async () => {
    const s = await setup(); expect(s.pharmacyStatus).toBe('pending');
    const before = getAudit(s.id);
    const blocked = await POST(request({ reviewerId: 'pharmacist-1', medActions: [], alertActions: [], complete: true }), context(s.id));
    expect(blocked.status).toBe(409); expect(await blocked.json()).toMatchObject({ code: 'bad_request', error: expect.stringContaining('high alert') });
    expect(getSession(s.id)).toEqual(s); expect(getAudit(s.id)).toEqual(before);
    const payload = { medActions: [], alertActions: s.summary!.medAlerts!.map(a => ({ alertId: a.id, action: 'acknowledge' })), allergyActions: [], complete: true };
    const response = await POST(request({ reviewerId: 'pharmacist-1', ...payload }), context(s.id));
    expect(response.status).toBe(200); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await response.json()).pharmacyStatus).toBe('reconciled');
    expect(getAudit(s.id).at(-1)).toMatchObject({ type: 'pharmacy_review', actorId: 'pharmacist-1', payload });
    expect(OPTIONS().status).toBe(204);
  });
  it('blocks unmatched and unsupported medicines until reviewed', async () => {
    const s = await addTurn(createSession('en').id, 'I take a white pill every morning.');
    const blocked = await POST(request({ reviewerId: 'p', medActions: [], alertActions: [], complete: true }), context(s.id));
    expect(blocked.status).toBe(409);
    const done = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: s.summary!.medications![0].id, action: 'verify' }], alertActions: [], complete: true });
    expect(done.pharmacyStatus).toBe('reconciled');
  });
  it('blocks a provider-invented unsupported medicine until a pharmacist acts', async () => {
    const client: ModelClient = async r => {
      const data = mockJSON(r) as Record<string, unknown>;
      if (r.step === 'extract') data.medications = [{ nameOriginal: 'metformin', turn: 'T1', quote: 'I take metformin.', dose: null, frequency: null, timing: null }];
      return { data, call: { step: r.step, provider: 'mock', model: 'invented-test', latencyMs: 1, ok: true } };
    };
    const s = await runTurn(createSession('en'), 'I have a headache.', { client }); saveSession(s);
    expect(s.summary?.medications?.[0].status).toBe('unsupported');
    expect((await POST(request({ reviewerId: 'p', medActions: [], alertActions: [], complete: true }), context(s.id))).status).toBe(409);
    const done = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: s.summary!.medications![0].id, action: 'discontinue' }], alertActions: [], complete: true });
    expect(done.pharmacyStatus).toBe('reconciled');
  });
  it('reopens reconciliation for a new product, while preserving verified entries', async () => {
    const s = await addTurn(createSession('en').id, 'I take metformin. No allergies.');
    const reconciled = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: s.summary!.medications![0].id, action: 'verify' }], alertActions: [], complete: true });
    const again = await addTurn(s.id, 'I also take atorvastatin.');
    expect(again.pharmacyStatus).toBe('in_review'); expect(again.summary?.medications?.[0]).toEqual(reconciled.summary?.medications?.[0]);
    expect(again.summary?.medications).toHaveLength(2);
  });
  it('retains exact optional payload shape and verified allergy review across turns', async () => {
    const s = await setup(); const payload = { medActions: [], alertActions: [], allergyActions: [{ allergyId: s.summary!.allergies![0].id, action: 'verify' }] };
    const reviewed = await pharmacyReview(s.id, { reviewerId: 'p', ...payload });
    expect(getAudit(s.id).at(-1)?.payload).toEqual(payload); expect(getAudit(s.id).at(-1)?.payload).not.toHaveProperty('complete');
    const again = await addTurn(s.id, 'No change to my medicines.'); expect(again.summary?.allergies).toEqual(reviewed.summary?.allergies);
  });
  it('preserves medicine/allergy edits, previous values, and alert decisions across turns', async () => {
    const s = await setup(); const m = s.summary!.medications![0]; const a = s.summary!.allergies![0];
    const result = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: m.id, action: 'edit', dose: '5 mg' }], allergyActions: [{ allergyId: a.id, action: 'edit', reaction: 'rash' }], alertActions: s.summary!.medAlerts!.map(a => ({ alertId: a.id, action: 'false_alarm', note: 'Pharmacist reviewed synthetic case.' })) });
    expect(result.pharmacyStatus).toBe('in_review');
    expect(result.summary?.medications?.[0].review?.previous).toEqual({ generic: m.generic, dose: m.dose, frequency: m.frequency });
    expect(result.summary?.allergies?.[0].review?.previous).toEqual({ allergenClass: a.allergenClass, reaction: a.reaction });
    const again = await addTurn(s.id, 'I still take warfarin and ibuprofen.');
    expect(again.summary?.medications?.[0]).toEqual(result.summary?.medications?.[0]);
    expect(again.summary?.allergies).toEqual(result.summary?.allergies);
    expect(again.summary?.medAlerts?.map(a => [a.id, a.review])).toEqual(result.summary?.medAlerts?.map(a => [a.id, a.review]));
    const editedAgain = await pharmacyReview(s.id, { reviewerId: 'p2', medActions: [{ medId: m.id, action: 'edit', frequency: 'daily' }], alertActions: [] });
    expect(editedAgain.summary?.medications?.[0].review?.previous).toEqual(result.summary?.medications?.[0].review?.previous);
  });
  it('recomputes on edit/discontinue and retains existing alerts and reviews', async () => {
    const s = await setup(); const ibuprofen = s.summary!.medications!.find(m => m.generic === 'ibuprofen')!;
    const reviewed = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: ibuprofen.id, action: 'discontinue' }], alertActions: s.summary!.medAlerts!.map(a => ({ alertId: a.id, action: 'resolved' })) });
    expect(reviewed.summary?.medAlerts).toHaveLength(s.summary!.medAlerts!.length);
    expect(checkMedRules(reviewed.summary!.medications!, reviewed.summary!.allergies!)).toEqual([]);
    const changed = await pharmacyReview(s.id, { reviewerId: 'p', medActions: [{ medId: ibuprofen.id, action: 'edit', generic: 'amoxicillin' }], alertActions: [] });
    expect(changed.summary?.medAlerts?.some(a => a.kind === 'allergy_conflict')).toBe(true);
    expect(changed.summary?.medications?.find(m => m.id === ibuprofen.id)?.drugClass).toBe('penicillin');
  });
  it.each([
    {}, { reviewerId: '', medActions: [], alertActions: [], complete: true },
    { reviewerId: 'p', medActions: [], alertActions: [], complete: 'yes' },
    { reviewerId: 'p', medActions: [], alertActions: [] },
    { reviewerId: 'p', medActions: [null], alertActions: [] },
    { reviewerId: 'p', medActions: [{ medId: 'x', action: 'edit' }], alertActions: [] },
    { reviewerId: 'p', medActions: [{ medId: 'x', action: 'verify', rawText: 'oops' }], alertActions: [] },
    { reviewerId: 'p', medActions: [], alertActions: [{ alertId: 'x', action: 'delete' }] },
    { reviewerId: 'p', medActions: [], alertActions: [{ alertId: 'x', action: 'resolved', note: 'Call 0812345678' }] },
    { reviewerId: 'p', medActions: [], alertActions: [], allergyActions: null, complete: true },
  ])('rejects invalid payloads without writes (%#)', async payload => {
    const s = await setup(); const before = getAudit(s.id);
    const response = await POST(request(payload), context(s.id)); expect(response.status).toBe(400);
    expect(getSession(s.id)).toEqual(s); expect(getAudit(s.id)).toEqual(before);
  });
  it('returns 404 and rejects unknown IDs atomically', async () => {
    expect((await POST(request({ reviewerId: 'p', medActions: [], alertActions: [], complete: true }), context('missing'))).status).toBe(404);
    const s = await setup();
    for (const payload of [{ medActions: [{ medId: 'missing', action: 'verify' }], alertActions: [] }, { medActions: [], alertActions: [{ alertId: 'missing', action: 'resolved' }] }, { medActions: [], alertActions: [], allergyActions: [{ allergyId: 'missing', action: 'verify' }] }]) {
      expect((await POST(request({ reviewerId: 'p', ...payload }), context(s.id))).status).toBe(400); expect(getSession(s.id)).toEqual(s);
    }
  });
  it('seeds three live pharmacy cases idempotently', async () => {
    vi.stubEnv('DEMO_SEED', '1'); const first = await seedDemo(); const again = await seedDemo();
    expect(first.created).toBe(11); expect(again.created).toBe(0);
    const ids = ['MED-01', 'MED-05', 'MED-03']; const kinds = ['allergy_conflict', 'max_dose_risk', 'interaction'];
    ids.forEach((id, i) => { const event = getAudit().find(e => e.payload.demoCaseId === id)!; const s = getSession(event.sessionId)!; expect(s.pharmacyStatus).toBe('pending'); expect(s.summary?.medAlerts?.some(a => a.kind === kinds[i])).toBe(true); });
  });
});
