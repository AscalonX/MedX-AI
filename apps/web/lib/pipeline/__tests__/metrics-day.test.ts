// w20 QA (code review on main...feat/pharmacy-two-stage): "today" in /api/metrics follows the clinic's calendar day
// (MEDX_TZ, default Asia/Bangkok), so ops and the pharmacy queue agree in the 00:00-07:00 ICT window.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTurn, createSession, metrics } from '../pipeline';
import { getSession, saveSession } from '../store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-day-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

async function collectedAt(at: string) {
  const s = await addTurn(createSession('en').id, 'Headache since yesterday 7/10. I am 45 years old.');
  const saved = getSession(s.id)!;
  saved.pickup = { status: 'collected', counter: '2', calledBy: 'Pharmacist Nattaya Wong', calledAt: at, collectedBy: 'Pharmacist Nattaya Wong', collectedAt: at };
  saveSession(saved);
}

describe('metrics: clinic calendar day', () => {
  it('a collection at 06:30 ICT (23:30 UTC the day before) counts as today in Bangkok', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-18T00:30:00.000Z')); // 07:30 ICT, 18 Oct
    await collectedAt('2026-10-17T23:30:00.000Z');
    const m = metrics();
    expect(m.pharmacy!.collectedToday).toBe(1);
    expect(m.sessionsToday).toBe(1);
  });
  it('MEDX_TZ=UTC keeps the UTC day; an invalid MEDX_TZ falls back to UTC instead of throwing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-18T00:30:00.000Z'));
    await collectedAt('2026-10-17T23:30:00.000Z');
    vi.stubEnv('MEDX_TZ', 'UTC'); expect(metrics().pharmacy!.collectedToday).toBe(0);
    vi.stubEnv('MEDX_TZ', 'Not/AZone'); expect(metrics().pharmacy!.collectedToday).toBe(0);
  });
  it('yesterday in Bangkok is not today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-18T10:00:00.000Z')); // 17:00 ICT, 18 Oct
    await collectedAt('2026-10-17T16:59:00.000Z'); // 23:59 ICT, 17 Oct
    expect(metrics().pharmacy!.collectedToday).toBe(0);
  });
});
