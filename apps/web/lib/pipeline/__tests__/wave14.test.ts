import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AllergyEntry, MedicationOrder } from '@medx/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTurn, createSession } from '../pipeline';
import { checkMedRules, MEDRULES } from '../medrules';
import { prescribingChecks } from '../orders';
import { getAudit, getSession } from '../store';
import { verifyEvidence } from '../verify';
import { POST as medication } from '../../../app/api/sessions/[id]/orders/medications/route';
import { POST as submit } from '../../../app/api/sessions/[id]/orders/medications/[orderId]/submit/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w14-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const draft = { orderedBy: 'synthetic-dr', drugText: 'paracetamol', dose: '1500 mg', route: 'oral', frequency: 'every 6 hours' };
const order: MedicationOrder = { ...draft, id: 'synthetic-order', generic: 'paracetamol', drugClass: 'analgesic', doseMg: 1500, timesPerDay: 4, at: '', status: 'draft', checks: [], overrides: [] };
const request = (value: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(value) });
const context = (id: string, orderId = '') => ({ params: Promise.resolve({ id, orderId }) });

describe('Wave 14 allergy evidence', () => {
  it('returns verified patient allergy quotes on the prescribing route and on refresh', async () => {
    const s = await addTurn(createSession('en').id, 'I am allergic to penicillin.');
    const allergy = s.summary!.allergies![0];
    expect(allergy.evidence.length).toBeGreaterThan(0);
    const response = await medication(request({ ...draft, drugText: 'amoxicillin', dose: '500 mg' }), context(s.id));
    expect(response.status).toBe(200);
    const saved = await response.json();
    const created: MedicationOrder = saved.orders.medications[0];
    const alert = created.checks.find(a => a.kind === 'allergy_conflict')!;
    expect(alert.evidence).toEqual(allergy.evidence);
    expect(alert.allergyIds).toEqual([allergy.id]);
    expect(alert.message.en).not.toContain('clinician-edited');
    for (const e of alert.evidence) {
      const turn = s.turns.find(t => t.id === e.turnId)!;
      expect(turn.role).toBe('patient');
      expect(turn.text.slice(e.start, e.end)).toBe(e.quote);
    }
    expect(prescribingChecks(saved, created).find(a => a.id === alert.id)?.evidence).toEqual(alert.evidence);
  });

  it('merges every matching allergy quote with the existing patient medication quote, without duplicates', async () => {
    const s = await addTurn(createSession('en').id, 'I take amoxicillin. I am allergic to penicillin.');
    const med = s.summary!.medications![0], allergy = s.summary!.allergies![0];
    const extra = verifyEvidence('allergic to penicillin', s.turns)!;
    expect(extra).toBeTruthy();
    const another: AllergyEntry = { ...allergy, id: 'another-allergy', evidence: [extra, ...allergy.evidence] };
    const alerts = checkMedRules([med], [allergy, another]).filter(a => a.kind === 'allergy_conflict');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].allergyIds).toEqual([allergy.id, another.id]);
    for (const e of [...med.evidence, ...allergy.evidence, extra]) expect(alerts[0].evidence).toContainEqual(e);
    expect(new Set(alerts[0].evidence.map(e => JSON.stringify(e))).size).toBe(alerts[0].evidence.length);
    expect(alerts[0].evidence.length).toBeGreaterThan(med.evidence.length);
  });

  it.each(['edited', 'verified'] as const)('labels a quote-free clinician edit after status becomes %s', async status => {
    const s = await addTurn(createSession('en').id, 'I am allergic to penicillin.');
    const allergy = s.summary!.allergies![0];
    allergy.status = status; allergy.evidence = [];
    allergy.review = { reviewerId: 'synthetic-ph', at: '', previous: { allergenClass: null, reaction: null } };
    const amoxicillin = { ...order, drugText: 'amoxicillin', generic: 'amoxicillin', drugClass: 'penicillin' };
    const alerts = prescribingChecks(s, amoxicillin).filter(a => a.kind === 'allergy_conflict');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].evidence).toEqual([]);
    expect(alerts[0].message.en).toMatch(/\(from clinician-edited allergy\)$/);
    for (const lang of ['th', 'it'] as const) expect(alerts[0].message[lang]).not.toBe(MEDRULES.messages.allergy_conflict.message[lang]);
    // An actual patient quote is retained even when the allergy was reviewed/edited.
    allergy.evidence = [verifyEvidence('allergic to penicillin', s.turns)!];
    const evidenced = prescribingChecks(s, amoxicillin).find(a => a.kind === 'allergy_conflict')!;
    expect(evidenced.evidence).toEqual(allergy.evidence);
    expect(evidenced.message.en).not.toContain('clinician-edited');
  });

  it('keeps medication evidence and adds the clinician-edit suffix when matches are merged', async () => {
    const s = await addTurn(createSession('en').id, 'I take amoxicillin. I am allergic to penicillin.');
    const med = s.summary!.medications![0], allergy = s.summary!.allergies![0];
    const edited: AllergyEntry = { ...allergy, id: 'edited-allergy', evidence: [], status: 'edited' };
    for (const allergies of [[allergy, edited], [edited, allergy]]) {
      const alerts = checkMedRules([med], allergies).filter(a => a.kind === 'allergy_conflict');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].evidence).toEqual(expect.arrayContaining([...med.evidence, ...allergy.evidence]));
      expect(alerts[0].message.en.match(/from clinician-edited allergy/g)).toHaveLength(1);
    }
  });
});

describe('Wave 14 one dose alert per order', () => {
  it.each([
    [1500, 1, ['single dose 1500 mg > 1000 mg']],
    [1000, 5, ['daily dose 5000 mg > 4000 mg']],
    [1500, 4, ['single dose 1500 mg > 1000 mg', 'daily dose 6000 mg > 4000 mg']],
  ] as const)('lists exceeded limits for %s mg × %s/day with one stable high alert', (doseMg, timesPerDay, details) => {
    const s = createSession('en', { persist: false });
    const checks = prescribingChecks(s, { ...order, doseMg, timesPerDay }).filter(a => a.kind === 'dose_range');
    expect(checks).toHaveLength(1);
    expect(checks[0].severity).toBe('high');
    for (const detail of details) expect(checks[0].message.en).toContain(detail);
    expect(checks[0].message.en.includes('single dose')).toBe(details.length === 2 || doseMg === 1500);
    expect(checks[0].message.en.includes('daily dose')).toBe(timesPerDay > 1);
    expect(checks[0].id).toBe(prescribingChecks(s, order).find(a => a.kind === 'dose_range')!.id);
    expect(checks[0].medIds).toEqual([order.id]);
    for (const lang of ['th', 'it'] as const) {
      for (const detail of details) for (const number of detail.match(/\d+/g)!) expect(checks[0].message[lang]).toContain(number);
      expect(checks[0].message[lang]).not.toContain('single dose');
      expect(checks[0].message[lang]).not.toContain('daily dose');
    }
    expect(prescribingChecks(s, { ...order, id: 'other-order', doseMg, timesPerDay }).find(a => a.kind === 'dose_range')!.id).not.toBe(checks[0].id);
  });

  it.each([
    { doseMg: 1000, timesPerDay: 4 }, { doseMg: undefined }, { doseMg: 500, timesPerDay: undefined },
    { drugText: 'unknown synthetic medicine' },
  ])('does not invent a dose alert for safe or unknown values %j', changes => {
    expect(prescribingChecks(createSession('en', { persist: false }), { ...order, ...changes }).filter(a => a.kind === 'dose_range')).toEqual([]);
  });

  it('reports a single limit even when the daily frequency is unknown', () => {
    const checks = prescribingChecks(createSession('en', { persist: false }), { ...order, timesPerDay: undefined }).filter(a => a.kind === 'dose_range');
    expect(checks).toHaveLength(1);
    expect(checks[0].message.en).toContain('single dose 1500 mg > 1000 mg');
    expect(checks[0].message.en).not.toContain('daily dose');
  });

  it('blocks submission without an override and accepts exactly one documented dose override with audit', async () => {
    const s = createSession('en');
    const created = await medication(request(draft), context(s.id));
    expect(created.status).toBe(200);
    const o: MedicationOrder = (await created.json()).orders.medications[0];
    expect(o.checks).toHaveLength(1);
    expect((await submit(request({ orderedBy: draft.orderedBy, overrides: [] }), context(s.id, o.id))).status).toBe(409);
    const overrides = [{ alertId: o.checks[0].id, reason: 'Synthetic clinician-reviewed override' }];
    expect((await submit(request({ orderedBy: draft.orderedBy, overrides }), context(s.id, o.id))).status).toBe(200);
    expect(getSession(s.id)!.orders!.medications[0]).toMatchObject({ status: 'submitted', overrides });
    expect(getAudit(s.id).at(-1)).toMatchObject({ type: 'order_submitted', payload: { orderId: o.id, overrides } });
  });
});
