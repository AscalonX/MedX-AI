// w20 S-01 (engine): the shared journeyStage, one session per stage, and `stage` on GET /api/sessions.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JOURNEY_STAGES, journeyStage, type IntakeSession, type InvestigationOrder, type JourneyStage, type MedicationOrder, type RedFlagHit } from '@medx/shared';
import { listSessionItems, sessionStage } from '../journey';
import { startDemoCase } from '../seed';
import { getSession } from '../store';
import { GET as listRoute } from '../../../app/api/sessions/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-journey-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('DEMO_SEED', '1');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const at = '2026-10-18T08:00:00.000Z';
const base = (over: Partial<IntakeSession> = {}): IntakeSession => ({ id: 's', code: 'B-001', patientLang: 'en', status: 'awaiting_review', turns: [{ id: 't1', role: 'patient', lang: 'en', text: 'Sore throat', at }], summary: null, createdAt: at, updatedAt: at, ...over });
const med = (status: MedicationOrder['status'], id: string = status): MedicationOrder => ({ id, drugText: 'paracetamol', generic: 'paracetamol', drugClass: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', orderedBy: 'Dr. Marco Bianchi', at, status, checks: [], overrides: [] });
const inv = (status: InvestigationOrder['status']): InvestigationOrder => ({ id: 'i1', code: 'fbc', label: { en: 'FBC', it: 'FBC', th: 'FBC' }, category: 'lab', orderedBy: 'Dr. Marco Bianchi', at, status });
const triaged = { triage: { suggestedLevel: 3 as const, reasons: [], vitalAlerts: [], confirmed: { level: 3 as const, by: 'Nurse Anna Rossi', at } } };
const consulted = { turns: [{ id: 't1', role: 'patient' as const, lang: 'en' as const, text: 'Sore throat', at }, { id: 'c1', role: 'clinician' as const, lang: 'en' as const, text: 'Any drooling?', at }] };
const signed = { notes: { doctor: { lines: [], generatedAt: at, disclaimer: { en: '', it: '', th: '' }, signed: { reviewerId: 'Dr. Marco Bianchi', at } } } };
const pickup = (status: 'ready' | 'collected') => ({ pickup: { status, calledBy: 'Pharmacist Nattaya Wong', calledAt: at, ...(status === 'collected' ? { collectedBy: 'Pharmacist Nattaya Wong', collectedAt: at } : {}) } });
const orders = (medications: MedicationOrder[], investigations: InvestigationOrder[] = []) => ({ orders: { medications, investigations } });

describe('journeyStage: one session per stage', () => {
  const cases: [JourneyStage, IntakeSession, Parameters<typeof journeyStage>[1]][] = [
    ['intake', base({ status: 'collecting' }), null],
    ['intake_reviewed', base({ status: 'approved' }), null],
    ['triaged', base({ ...triaged }), null],
    ['nurse_done', base({ ...triaged, ...consulted }), null],
    ['doctor_signed', base({ ...triaged, ...consulted }), signed],
    ['orders_submitted', base({ ...triaged, ...orders([], [inv('submitted')]) }), signed],
    ['pharmacy_verify', base({ ...orders([med('submitted')]) }), signed],
    ['pharmacy_dispense', base({ ...orders([med('verified')]) }), signed],
    ['ready_for_pickup', base({ ...orders([med('dispensed')]), ...pickup('ready') }), signed],
    ['collected', base({ ...orders([med('dispensed')]), ...pickup('collected') }), signed],
  ];
  it('covers every stage exactly once', () => { expect(cases.map(c => c[0])).toEqual([...JOURNEY_STAGES]); });
  it.each(cases)('%s', (stage, session, consult) => { expect(journeyStage(session, consult)).toBe(stage); });
});

describe('journeyStage edge cases', () => {
  const flag = (reviewed: boolean): RedFlagHit => ({ ruleId: 'RF-CHEST-01', label: { en: 'x', it: 'x', th: 'x' }, severity: 'emergency', action: { en: 'x', it: 'x', th: 'x' }, patientMessage: { en: 'x', it: 'x', th: 'x' }, evidence: [], ...(reviewed ? { review: { action: 'acknowledge' as const, reviewerId: 'Nurse Anna Rossi', at } } : {}) });
  const summary = (redFlags: RedFlagHit[]) => ({ summary: { sessionId: 's', fields: [], redFlags, nextQuestion: null, abstained: false, modelCalls: [], generatedAt: at } });
  it('an escalated case is intake until every red flag is reviewed', () => {
    expect(journeyStage(base({ status: 'escalated', ...summary([flag(false)]) }), null)).toBe('intake');
    expect(journeyStage(base({ status: 'escalated', ...summary([flag(true)]) }), null)).toBe('intake_reviewed');
    expect(journeyStage(base({ status: 'taken_over' }), null)).toBe('intake_reviewed');
  });
  it('triage without intake approval still counts (scripted journey with no approval)', () => {
    expect(journeyStage(base({ status: 'awaiting_review', ...triaged }), null)).toBe('triaged');
  });
  it('a nurse or doctor consult note also marks the nurse part done', () => {
    const draft = { lines: [], generatedAt: at, disclaimer: { en: '', it: '', th: '' } };
    expect(journeyStage(base({ ...triaged }), { notes: { nurse: draft } })).toBe('nurse_done');
    expect(journeyStage(base({ ...triaged }), { notes: { doctor: draft } })).toBe('nurse_done');
  });
  it('drafts and cancelled orders never move the stage; returned orders are back with the prescriber', () => {
    expect(journeyStage(base({ ...triaged, ...consulted, ...orders([med('draft'), med('cancelled', 'c')], [inv('cancelled')]) }), signed)).toBe('doctor_signed');
    expect(journeyStage(base({ ...orders([med('returned')]) }), signed)).toBe('orders_submitted');
  });
  it('pending pharmacy work wins: pharmacist 1 first, then pharmacist 2, then the patient call', () => {
    expect(journeyStage(base({ ...orders([med('submitted', 'a'), med('verified', 'b')]) }), null)).toBe('pharmacy_verify');
    expect(journeyStage(base({ ...orders([med('verified', 'a'), med('dispensed', 'b')]) }), null)).toBe('pharmacy_dispense');
    expect(journeyStage(base({ ...orders([med('dispensed'), med('draft', 'd')]) }), null)).toBe('pharmacy_dispense'); // dispensed, patient not called yet
    expect(journeyStage(base({ ...orders([med('dispensed'), med('returned', 'r')]) }), null)).toBe('orders_submitted');
    expect(journeyStage(base({ ...orders([med('dispensed'), med('submitted', 'n')]), ...pickup('collected') }), null)).toBe('pharmacy_verify');
  });
});

describe('GET /api/sessions attaches the stage', () => {
  it('each queue row carries the stage the engine derives with its consult record', async () => {
    const built: Record<string, JourneyStage> = {};
    for (const stage of ['intake', 'doctor_signed', 'pharmacy_dispense', 'collected'] as const) built[(await startDemoCase(stage)).id] = stage;
    const rows = await (await listRoute(new Request('http://localhost/api/sessions'))).json() as { id: string; stage: JourneyStage }[];
    expect(rows).toHaveLength(4);
    for (const row of rows) { expect(row.stage).toBe(built[row.id]); expect(row.stage).toBe(sessionStage(getSession(row.id)!)); }
    // The engine helper keeps the queue order and adds nothing but `stage`.
    const items = listSessionItems();
    expect(items.map(i => i.id)).toEqual(rows.map(r => r.id));
    for (const i of items) { const { stage, ...rest } = i; expect(rest).toEqual(getSession(i.id)); expect(stage).toBe(built[i.id]); }
  });
});
