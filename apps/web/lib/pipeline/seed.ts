import type { IntakeSession, Lang, SessionStatus } from '@medx/shared';
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
import { addTurn, createSession, PipelineError, review } from './pipeline';
import { dispenseOrder, medicationAction, medicationOrder, pickupAction } from './orders';
import { getAudit, getSession, getSessions, resetDemoStore, withSessionLock } from './store';
import { paceSeedCalls } from './llm';

interface Fixture { id: string; lang: string; synthetic: boolean; turns: { role: string; text: string }[] }
/** Synthetic doctor + pharmacist steps so the demo queue shows every pharmacy stage. */
interface PharmacySeed { doctor: string; order: { drugText: string; dose: string; route: string; frequency: string; duration: string }; stage: 'to_verify' | 'to_dispense' | 'ready_for_pickup' }
interface SeedPlan { fixture: Fixture; expectedStatus: SessionStatus; repeatLast?: boolean; pharmacy?: PharmacySeed }
// Demo staff directory (packages/shared/src/staff.ts): two different pharmacists for the two-person check.
const PHARMACIST_1 = 'Pharmacist Laura Conti', PHARMACIST_2 = 'Pharmacist Nattaya Wong';
const plans: SeedPlan[] = [
  { fixture: en05, expectedStatus: 'escalated' },
  { fixture: th05, expectedStatus: 'escalated' },
  { fixture: en01, expectedStatus: 'awaiting_review', pharmacy: { doctor: 'Dr. Marco Bianchi', stage: 'ready_for_pickup', order: { drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' } } },
  { fixture: it01, expectedStatus: 'awaiting_review', pharmacy: { doctor: 'Dr. Marco Bianchi', stage: 'to_dispense', order: { drugText: 'ibuprofen', dose: '400 mg', route: 'oral', frequency: 'three times daily', duration: '3 days' } } },
  { fixture: en04, expectedStatus: 'needs_human', repeatLast: true },
  { fixture: en03, expectedStatus: 'collecting' },
  { fixture: it03, expectedStatus: 'collecting' },
  { fixture: en02, expectedStatus: 'approved' },
  // Penicillin-allergic patient: the order raises a high allergy alert for pharmacist 1 (with curated alternatives when medrules lists them).
  { fixture: med01, expectedStatus: 'collecting', pharmacy: { doctor: 'Dr. Somchai Chaiyo', stage: 'to_verify', order: { drugText: 'amoxicillin', dose: '500 mg', route: 'oral', frequency: 'three times daily', duration: '7 days' } } },
  { fixture: med05, expectedStatus: 'collecting' },
  { fixture: med03, expectedStatus: 'needs_human' },
];
const ALL_CHECKED = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
/** Runs the real order engine (checks, overrides, two-person dispense, pickup) on a synthetic case. */
async function seedPharmacy(sessionId: string, p: PharmacySeed) {
  let s = await medicationOrder(sessionId, { orderedBy: p.doctor, ...p.order });
  const order = s.orders!.medications.at(-1)!;
  // Explicit synthetic override text: high alerts still reach pharmacist 1, who decides.
  const overrides = order.checks.filter(a => a.severity === 'high').map(a => ({ alertId: a.id, reason: 'Synthetic demo case: prescriber asks pharmacy to review this alert' }));
  s = await medicationAction(sessionId, order.id, 'submit', { orderedBy: p.doctor, overrides });
  if (p.stage === 'to_verify') return s;
  s = await medicationAction(sessionId, order.id, 'pharmacy', { reviewerId: PHARMACIST_1, action: 'verify' });
  if (p.stage === 'to_dispense') return s;
  await dispenseOrder(sessionId, order.id, { reviewerId: PHARMACIST_2, checklist: ALL_CHECKED });
  return pickupAction(sessionId, { reviewerId: PHARMACIST_2, action: 'call', counter: '2' });
}
type SeedJob = { id: string; status: 'running' | 'done' | 'failed'; completed: number; total: number; result?: Awaited<ReturnType<typeof seedDemo>>; error?: string };
let job: SeedJob | undefined;
export function demoSeedProgress() { return job || { status: 'idle', completed: 0, total: plans.length }; }
export function startDemoSeed(options: { reset?: boolean } = {}) {
  if (job?.status === 'running') return { id: job.id, status: job.status, progressUrl: '/api/dev/seed' };
  const current: SeedJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: plans.length };
  job = current;
  // Single long-lived Node process demo only. Errors are surfaced via guarded polling.
  void Promise.resolve().then(() => seedDemo(options)).then(result => { current.result = result; current.status = 'done'; }, () => { current.status = 'failed'; current.error = 'Demo seed failed; inspect configuration and retry'; });
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
    let created = 0;
    for (const { fixture, expectedStatus, repeatLast, pharmacy } of plans) {
      if (!fixture.synthetic || !['en', 'it', 'th'].includes(fixture.lang)) throw new Error('Invalid synthetic demo fixture');
      const existing = getAudit().find(e => e.type === 'session_created' && e.payload.demoCaseId === fixture.id);
      let session = existing ? getSession(existing.sessionId) : undefined;
      if (!session) {
        session = createSession(fixture.lang as Lang, { demoCaseId: fixture.id });
        created++;
        const turns = fixture.turns.filter(t => t.role === 'patient');
        // Reuse the final vague answer for a third clarification attempt; no invented patient text.
        const replay = repeatLast ? [...turns, turns[turns.length - 1]] : turns;
        for (const turn of replay) {
          if (amd) await new Promise(resolve => setTimeout(resolve, 50));
          session = await addTurn(session.id, turn.text);
          if (['escalated', 'needs_human'].includes(session.status)) break;
        }
        // This is an explicit synthetic clinician approval, using only verified pipeline fields.
        if (expectedStatus === 'approved' && session.status === 'awaiting_review' && session.summary?.fields.filter(f => f.required).every(f => f.status === 'supported')) {
          session = await review(session.id, 'Dr. Marco Bianchi', session.summary.fields.filter(f => f.required).map(f => ({ fieldKey: f.key, action: 'approve' })));
        }
        // Like the approval above: only on a replay that reached its expected state, never after a provider failure.
        if (pharmacy && session.status === expectedStatus) session = await seedPharmacy(session.id, pharmacy);
      }
      sessions.push(session);
      if (job?.status === 'running') job.completed = sessions.length;
      if (session.status !== expectedStatus) mismatches.push({ caseId: fixture.id, expected: expectedStatus, actual: session.status });
    }
    const byStatus = Object.fromEntries(['collecting', 'escalated', 'awaiting_review', 'needs_human', 'approved', 'taken_over'].map(status => [status, sessions.filter(s => s.status === status).length])) as Record<SessionStatus, number>;
    return { created, reused: sessions.length - created, sessions, byStatus, mismatches };
    } finally { paceSeedCalls(false); }
  });
}

/** Serverless demo hosts lose /tmp state on cold start; replay the synthetic seed once when the store is empty. */
export async function ensureDemoSeed() {
  if (process.env.DEMO_AUTOSEED !== '1' || process.env.DEMO_SEED !== '1' || getSessions().length > 0) return;
  try { await seedDemo(); } catch { /* seeding is best-effort; the empty queue still renders */ }
}
