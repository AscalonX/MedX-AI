import { DEMO_PERSONAS, JOURNEY_STAGES, STAFF } from '@medx/shared';
import type { DemoCasesRes, DemoPersonaId, DemoStartRes, IntakeSession, JourneyStage, Lang, MedicationOrder, SessionStatus, VitalSigns } from '@medx/shared';
import en01 from '../../../../data/cases/EN-01.json';
import en02 from '../../../../data/cases/EN-02.json';
import en03 from '../../../../data/cases/EN-03.json';
import en04 from '../../../../data/cases/EN-04.json';
import en05 from '../../../../data/cases/EN-05.json';
import it01 from '../../../../data/cases/IT-01.json';
import it03 from '../../../../data/cases/IT-03.json';
import th05 from '../../../../data/cases/TH-05.json';
import med01 from '../../../../data/cases/MED-01.json';
import med03 from '../../../../data/cases/MED-03.json';
import med05 from '../../../../data/cases/MED-05.json';
import gold from '../../../../data/cases/DEMO-GOLD.json';
import { addConsultTurn, consultNote, getConsult, reviewConsultSuggestion } from './consult';
import { sessionStage } from './journey';
import { paceSeedCalls } from './llm';
import { dispenseOrder, investigationOrder, medicationAction, medicationOrder, pickupAction } from './orders';
import { addTurn, createSession, demoSessionId, PipelineError, review } from './pipeline';
import { getAudit, getSession, getSessions, resetDemoStore, withSessionLock } from './store';
import { confirmTriage, recordVitals } from './vitals';

// Demo staff directory (packages/shared/src/staff.ts). Two different pharmacists for the two-person check.
function staff(id: string) { const m = STAFF.find(s => s.id === id); if (!m) throw new Error(`Unknown demo staff member ${id}`); return m.name; }
const NURSE = staff('nurse-rossi'), PHARMACIST_1 = staff('pharm-conti'), PHARMACIST_2 = staff('pharm-wong');

interface Fixture { id: string; lang: string; synthetic: boolean; turns: { role: string; text: string }[] }
type Vitals = Omit<VitalSigns, 'id' | 'at' | 'recordedBy'>;
type OrderText = { drugText: string; dose: string; route: string; frequency: string; duration: string };
/**
 * Synthetic staff steps after the patient's own intake, each through the real engine (role checks, red flags,
 * deterministic checks, two-person dispense). Every step is an explicit synthetic action by a named demo staff member.
 */
interface Visit {
  /** Synthetic clinician approval of the verified intake; only runs when every required field is "supported". */
  approve: boolean;
  nurse: { vitals: Vitals; line: string };
  doctor: string;
  /** Doctor "Keep in note" on these rule considerations (consult suggestion ids). */
  keep?: string[];
  investigations?: string[];
  order?: OrderText;
  overrideReason?: string;
  /** Golden journey: pharmacist 1 returns the first order with options for prescriber review, the doctor re-orders. */
  returnLoop?: { note: string; suggestedGenerics: string[]; reorder: OrderText };
  counter?: string;
}
interface SeedPlan { fixture: Fixture; caseId?: string; expectedStatus: SessionStatus; repeatLast?: boolean; approve?: boolean; visit?: Visit; stage?: JourneyStage }

const SYNTHETIC_OVERRIDE = 'Synthetic demo case: prescriber asks pharmacy to review this alert';
const ALL_CHECKED = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const NORMAL: Vitals = { heartRate: 78, systolicBP: 122, diastolicBP: 78, respRate: 14, tempC: 36.9, spo2: 99, onOxygen: false, consciousness: 'alert' };

const goldDemo = gold.demo;
/** The golden English journey (data/cases/DEMO-GOLD.json): uncomplicated sore throat with white spots on the tonsils, penicillin rash allergy. */
export const GOLD_VISIT: Visit = {
  approve: true,
  nurse: { vitals: goldDemo.nurse.vitals as Vitals, line: goldDemo.nurse.consultLine },
  doctor: staff(goldDemo.doctor.by),
  keep: goldDemo.doctor.keepConsiderations,
  investigations: goldDemo.doctor.investigations,
  order: goldDemo.doctor.order,
  overrideReason: goldDemo.doctor.overrideReason,
  returnLoop: { note: goldDemo.pharmacist1.returnNote, suggestedGenerics: goldDemo.pharmacist1.suggestedGenerics, reorder: goldDemo.doctor.reorder },
  counter: goldDemo.pharmacist2.counter,
};
const plans: SeedPlan[] = [
  { fixture: en05, expectedStatus: 'escalated' },
  { fixture: th05, expectedStatus: 'escalated' },
  { fixture: en01, expectedStatus: 'approved', stage: 'ready_for_pickup', visit: { approve: true, doctor: staff('doctor-bianchi'), counter: '2',
    nurse: { vitals: { ...NORMAL, heartRate: 82, tempC: 37.1, painScore: 4 }, line: 'Any fever, back pain or blood in your urine?' },
    order: { drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' } } },
  { fixture: it01, expectedStatus: 'approved', stage: 'pharmacy_dispense', visit: { approve: true, doctor: staff('doctor-bianchi'),
    nurse: { vitals: { ...NORMAL, painScore: 4 }, line: 'Riesce a deglutire la saliva? Ha la voce cambiata?' },
    order: { drugText: 'ibuprofen', dose: '400 mg', route: 'oral', frequency: 'three times daily', duration: '3 days' } } },
  { fixture: en04, expectedStatus: 'needs_human', repeatLast: true },
  { fixture: en03, expectedStatus: 'collecting' },
  { fixture: it03, expectedStatus: 'collecting' },
  { fixture: en02, expectedStatus: 'approved', approve: true },
  // Penicillin-allergic patient: the order raises a high allergy alert for pharmacist 1 (with curated alternatives).
  { fixture: med01, expectedStatus: 'collecting', stage: 'pharmacy_verify', visit: { approve: false, doctor: staff('doctor-chaiyo'),
    nurse: { vitals: { ...NORMAL, heartRate: 88, tempC: 37.6, respRate: 16, painScore: 3 }, line: 'กลืนน้ำลายได้ไหม หายใจมีเสียงไหม' },
    order: { drugText: 'amoxicillin', dose: '500 mg', route: 'oral', frequency: 'three times daily', duration: '7 days' } } },
  { fixture: med05, expectedStatus: 'collecting' },
  { fixture: med03, expectedStatus: 'needs_human' },
  // Golden English case at the three demo hand-offs: nurse-ready, doctor-ready, pharmacist-1-ready.
  { fixture: gold, caseId: 'DEMO-GOLD:intake', expectedStatus: 'awaiting_review', stage: 'intake', visit: GOLD_VISIT },
  { fixture: gold, caseId: 'DEMO-GOLD:nurse_done', expectedStatus: 'approved', stage: 'nurse_done', visit: GOLD_VISIT },
  { fixture: gold, caseId: 'DEMO-GOLD:pharmacy_verify', expectedStatus: 'approved', stage: 'pharmacy_verify', visit: GOLD_VISIT },
];

/** Seeded case each landing-page persona opens (GET /api/demo/cases). The patient and the nurse share one record. */
export const PERSONA_CASES: Record<DemoPersonaId, string> = {
  patient: 'DEMO-GOLD:intake',
  'nurse-rossi': 'DEMO-GOLD:intake',
  'doctor-bianchi': 'DEMO-GOLD:nurse_done',
  'pharm-conti': 'DEMO-GOLD:pharmacy_verify',
  'pharm-wong': 'IT-01',
  'ops-head': 'EN-01',
};

const atOrAfter = (target: JourneyStage, step: JourneyStage) => JOURNEY_STAGES.indexOf(target) >= JOURNEY_STAGES.indexOf(step);
/** Escalation, abstention or takeover hands the case to people: no further synthetic step runs. */
const halted = (s: IntakeSession) => ['escalated', 'needs_human', 'taken_over'].includes(s.status);
const requiredSupported = (s: IntakeSession) => !!s.summary && s.summary.fields.filter(f => f.required).every(f => f.status === 'supported');
const highOverrides = (o: MedicationOrder, reason: string) => o.checks.filter(a => a.severity === 'high').map(a => ({ alertId: a.id, reason }));
const orderIn = (s: IntakeSession, orderId: string) => s.orders!.medications.find(o => o.id === orderId)!;

/** Replays the synthetic patient turns through the real pipeline (red flags first). */
async function replayIntake(session: IntakeSession, fixture: Fixture, repeatLast = false) {
  const amd = process.env.MODEL_PROVIDER !== 'mock';
  const turns = fixture.turns.filter(t => t.role === 'patient');
  // Reuse the final vague answer for a third clarification attempt; no invented patient text.
  const replay = repeatLast ? [...turns, turns[turns.length - 1]] : turns;
  for (const turn of replay) {
    if (amd) await new Promise(resolve => setTimeout(resolve, 50));
    session = await addTurn(session.id, turn.text);
    if (halted(session)) break;
  }
  return session;
}

/**
 * Moves a case forward to `target` with the visit's synthetic staff steps. It stops early, leaving the case
 * where it is, on escalation, abstention, or when an approval could not be justified by verified fields.
 */
export async function advanceVisit(id: string, visit: Visit, target: JourneyStage): Promise<IntakeSession> {
  let s = getSession(id)!;
  const go = (step: JourneyStage) => atOrAfter(target, step) && !halted(s);
  if (!go('intake_reviewed')) return s;
  if (visit.approve) {
    // Explicit synthetic nurse approval, using only fields the pipeline verified against the patient's words.
    if (s.status !== 'awaiting_review' || !requiredSupported(s)) return s;
    s = await review(id, NURSE, s.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
  }
  if (!go('triaged')) return s;
  s = await recordVitals(id, { recordedBy: NURSE, vitals: visit.nurse.vitals });
  s = await confirmTriage(id, { reviewerId: NURSE, level: s.triage!.suggestedLevel });
  if (!go('nurse_done')) return s;
  await addConsultTurn(id, { speaker: 'clinician', mode: 'nurse', text: visit.nurse.line, inputMode: 'voice' });
  s = getSession(id)!;
  if (!go('doctor_signed')) return s;
  let consult = await getConsult(id, 'doctor');
  s = getSession(id)!; if (halted(s)) return s;
  for (const sid of visit.keep || []) if (consult.suggestions.some(x => x.id === sid && x.status === 'open')) consult = await reviewConsultSuggestion(id, sid, visit.doctor, 'asked');
  consult = await consultNote(id, { reviewerId: visit.doctor, mode: 'doctor', action: 'draft' });
  s = getSession(id)!; if (halted(s)) return s;
  // Lines without a verified quote need an explicit doctor resolution before signing; say plainly that it was not assessed.
  const edits = (consult.note?.lines || []).filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed in this synthetic demo visit' }));
  await consultNote(id, { reviewerId: visit.doctor, mode: 'doctor', action: 'sign', edits });
  s = getSession(id)!;
  if (!go('orders_submitted')) return s;
  const kept = (visit.keep || []).find(k => consult.suggestions.some(x => x.id === k));
  for (const code of visit.investigations || []) s = await investigationOrder(id, { orderedBy: visit.doctor, code, ...(kept ? { fromSuggestionId: kept } : {}) });
  if (!go('pharmacy_verify') || !visit.order) return s;
  s = await medicationOrder(id, { orderedBy: visit.doctor, ...visit.order });
  const orderId = s.orders!.medications.at(-1)!.id;
  // Explicit synthetic override text: high alerts still reach pharmacist 1, who decides.
  s = await medicationAction(id, orderId, 'submit', { orderedBy: visit.doctor, overrides: highOverrides(orderIn(s, orderId), visit.overrideReason || SYNTHETIC_OVERRIDE) });
  if (!go('pharmacy_dispense')) return s;
  if (visit.returnLoop) {
    const o = orderIn(s, orderId);
    await medicationAction(id, orderId, 'pharmacy', { reviewerId: PHARMACIST_1, action: 'return', note: visit.returnLoop.note, alertIds: o.checks.filter(a => a.severity === 'high').map(a => a.id), suggestedGenerics: visit.returnLoop.suggestedGenerics });
    s = await medicationOrder(id, { orderedBy: visit.doctor, orderId, ...visit.returnLoop.reorder });
    s = await medicationAction(id, orderId, 'submit', { orderedBy: visit.doctor, overrides: highOverrides(orderIn(s, orderId), visit.overrideReason || SYNTHETIC_OVERRIDE) });
  }
  s = await medicationAction(id, orderId, 'pharmacy', { reviewerId: PHARMACIST_1, action: 'verify' });
  if (!go('ready_for_pickup')) return s;
  await dispenseOrder(id, orderId, { reviewerId: PHARMACIST_2, checklist: ALL_CHECKED });
  s = await pickupAction(id, { reviewerId: PHARMACIST_2, action: 'call', counter: visit.counter || '2' });
  if (!go('collected')) return s;
  return pickupAction(id, { reviewerId: PHARMACIST_2, action: 'collected' });
}

/** A seeded case by its demo case id: the deterministic id first, then the audit (stores seeded before stable ids). */
export function demoCaseSession(caseId: string): IntakeSession | undefined {
  const direct = getSession(demoSessionId(caseId));
  if (direct) return direct;
  const created = getAudit().find(e => e.type === 'session_created' && e.payload.demoCaseId === caseId);
  return created ? getSession(created.sessionId) : undefined;
}

type SeedJob = { id: string; status: 'running' | 'done' | 'failed'; completed: number; total: number; result?: Awaited<ReturnType<typeof seedDemo>>; error?: string };
let job: SeedJob | undefined;
export function demoSeedProgress() { return job || { status: 'idle', completed: 0, total: plans.length }; }
/**
 * Background seed for a real provider (paced calls take minutes). `keepAlive` is next/server `after`, so a
 * serverless function stays up until the seed finishes; outside a request scope (scripts, tests) it throws,
 * and the task simply keeps running in this process.
 */
export function startDemoSeed(options: { reset?: boolean } = {}, keepAlive?: (task: Promise<unknown>) => void) {
  if (job?.status === 'running') return { id: job.id, status: job.status, progressUrl: '/api/dev/seed' };
  const current: SeedJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: plans.length };
  job = current;
  // Errors are surfaced via guarded polling and the server log.
  const task = Promise.resolve().then(() => seedDemo(options)).then(result => { current.result = result; current.status = 'done'; }, error => { console.error('[medx] demo seed failed', error); current.status = 'failed'; current.error = 'Demo seed failed; inspect configuration and retry'; });
  try { keepAlive?.(task); } catch { /* no request scope: the task still runs in this process */ }
  return { id: current.id, status: current.status, progressUrl: '/api/dev/seed' };
}

/** Synthetic fixture replay only; never reads gold answers or overrides the configured provider. */
export async function seedDemo(options: { reset?: boolean } = {}) {
  if (process.env.DEMO_SEED !== '1') throw new PipelineError('Not found', 'not_found');
  return withSessionLock('dev-demo-seed', async () => {
    const amd = process.env.MODEL_PROVIDER !== 'mock';
    paceSeedCalls(amd);
    try {
    if (options.reset) resetDemoStore();
    const sessions: IntakeSession[] = [];
    const mismatches: { caseId: string; expected: SessionStatus; actual: SessionStatus }[] = [];
    const stageMismatches: { caseId: string; expected: JourneyStage; actual: JourneyStage }[] = [];
    let created = 0;
    for (const { fixture, caseId = fixture.id, expectedStatus, repeatLast, approve, visit, stage } of plans) {
      if (!fixture.synthetic || !['en', 'it', 'th'].includes(fixture.lang)) throw new Error('Invalid synthetic demo fixture');
      let session = demoCaseSession(caseId);
      if (!session) {
        session = createSession(fixture.lang as Lang, { demoCaseId: caseId });
        created++;
        session = await replayIntake(session, fixture, repeatLast);
        // Explicit synthetic clinician approval, using only verified pipeline fields.
        if (approve && session.status === 'awaiting_review' && requiredSupported(session)) {
          session = await review(session.id, staff('doctor-bianchi'), session.summary!.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
        }
        // Like the approval: only on a replay that reached a clean intake, never after a provider failure.
        if (visit && stage && !halted(session)) session = await advanceVisit(session.id, visit, stage);
      }
      sessions.push(session);
      if (job?.status === 'running') job.completed = sessions.length;
      if (session.status !== expectedStatus) mismatches.push({ caseId, expected: expectedStatus, actual: session.status });
      if (stage && sessionStage(session) !== stage) stageMismatches.push({ caseId, expected: stage, actual: sessionStage(session) });
    }
    const byStatus = Object.fromEntries(['collecting', 'escalated', 'awaiting_review', 'needs_human', 'approved', 'taken_over'].map(status => [status, sessions.filter(s => s.status === status).length])) as Record<SessionStatus, number>;
    return { created, reused: sessions.length - created, sessions, byStatus, mismatches, stageMismatches };
    } finally { paceSeedCalls(false); }
  });
}

/** Serverless demo hosts lose /tmp state on cold start; replay the synthetic seed once when the store is empty. */
export async function ensureDemoSeed() {
  if (process.env.DEMO_AUTOSEED !== '1' || process.env.DEMO_SEED !== '1' || getSessions().length > 0) return;
  // Best effort: the empty queue still renders, but the failure must be visible in the server log.
  try { await seedDemo(); } catch (error) { console.error('[medx] demo auto-seed failed', error); }
}

/**
 * GET /api/demo/cases with DEMO_AUTOSEED=1: seed (idempotently, only what is missing) when any persona case is
 * absent, even if visitor sessions already exist. Failures are logged; the response then shows null entries.
 */
export async function ensureDemoCases() {
  if (process.env.DEMO_AUTOSEED !== '1' || process.env.DEMO_SEED !== '1') return;
  if (Object.values(PERSONA_CASES).every(caseId => demoCaseSession(caseId))) return;
  try { await seedDemo(); } catch (error) { console.error('[medx] demo auto-seed failed', error); }
}

/** GET /api/demo/cases: the seeded case for every persona, with its live journey stage; null until seeded. */
export function demoCases(): DemoCasesRes {
  return Object.fromEntries(DEMO_PERSONAS.map(p => {
    const s = demoCaseSession(PERSONA_CASES[p.id]);
    return [p.id, s ? { id: s.id, code: s.code, status: s.status, stage: sessionStage(s) } : null];
  })) as DemoCasesRes;
}

/** At most this many per-visitor demo sessions (POST /api/demo/start) exist; then 429 until a demo reset. */
export const DEMO_START_LIMIT = 150;
export const demoStartCount = () => getAudit().filter(e => e.type === 'session_created' && typeof e.payload.demoStart === 'string').length;
/**
 * A fresh golden case for one visitor, built through the real pipeline up to `stage`. Returns the stage it
 * actually reached: a provider failure or abstention stops it early, honestly, instead of faking a step.
 */
export async function startDemoCase(stage: unknown, opts: { allow?: () => boolean } = {}): Promise<DemoStartRes & { stage: JourneyStage }> {
  if (process.env.DEMO_SEED !== '1') throw new PipelineError('Not found', 'not_found');
  if (typeof stage !== 'string' || !(JOURNEY_STAGES as readonly string[]).includes(stage)) throw new PipelineError(`stage must be one of: ${JOURNEY_STAGES.join(', ')}`, 'bad_request');
  if (opts.allow && !opts.allow()) throw new PipelineError('Too many demo starts from this client; try again in a few minutes', 'bad_request', 429);
  const target = stage as JourneyStage;
  // Count and create under one lock so concurrent visitors cannot pass the cap together.
  let session = await withSessionLock('demo-start', () => {
    if (demoStartCount() >= DEMO_START_LIMIT) throw new PipelineError('Demo limit reached; the shared demo cases are still available', 'bad_request', 429);
    return createSession(gold.lang as Lang, { demoStart: target });
  });
  session = await replayIntake(session, gold);
  if (!halted(session)) session = await advanceVisit(session.id, GOLD_VISIT, target);
  return { id: session.id, code: session.code, stage: sessionStage(session) };
}

/** In-memory, per server instance (documented): each client may start this many demo cases per window. */
const RATE = { max: 20, windowMs: 10 * 60 * 1000 };
const starts = new Map<string, number[]>();
export function demoStartAllowed(client: string, now = Date.now()) {
  const recent = (starts.get(client) || []).filter(t => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) { starts.set(client, recent); return false; }
  recent.push(now); starts.set(client, recent);
  if (starts.size > 5000) for (const [k, v] of starts) if (!v.some(t => now - t < RATE.windowMs)) starts.delete(k);
  return true;
}
