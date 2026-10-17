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
import { getAudit, getSession, getSessions, resetDemoStore, withSessionLock } from './store';
import { paceSeedCalls } from './llm';

interface Fixture { id: string; lang: string; synthetic: boolean; turns: { role: string; text: string }[] }
interface SeedPlan { fixture: Fixture; expectedStatus: SessionStatus; repeatLast?: boolean }
const plans: SeedPlan[] = [
  { fixture: en05, expectedStatus: 'escalated' },
  { fixture: th05, expectedStatus: 'escalated' },
  { fixture: en01, expectedStatus: 'awaiting_review' },
  { fixture: it01, expectedStatus: 'awaiting_review' },
  { fixture: en04, expectedStatus: 'needs_human', repeatLast: true },
  { fixture: en03, expectedStatus: 'collecting' },
  { fixture: it03, expectedStatus: 'collecting' },
  { fixture: en02, expectedStatus: 'approved' },
  { fixture: med01, expectedStatus: 'collecting' },
  { fixture: med05, expectedStatus: 'collecting' },
  { fixture: med03, expectedStatus: 'needs_human' },
];
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
    for (const { fixture, expectedStatus, repeatLast } of plans) {
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
