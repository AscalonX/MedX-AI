import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTurn, createSession } from '../../lib/pipeline/pipeline';
import { pharmacyReview } from '../../lib/pipeline/pharmacyReview';
import { getAudit } from '../../lib/pipeline/store';
import { alertNeedsFollowUp, blockers, buildQuestions, openHigh } from './_lib';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-pharmacy-ui-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const setup = () => addTurn(createSession('en').id, 'I have a headache since yesterday. It is 4/10. I am 35 years old. I take amoxicillin 500 mg twice daily. I am allergic to penicillin and get a rash.');

describe('pharmacy alert review and follow-up', () => {
  it('keeps follow-up after acknowledgement while satisfying the existing review gate', async () => {
    const session = await setup();
    const alert = session.summary!.medAlerts!.find(a => a.kind === 'allergy_conflict')!;
    expect(alert).toBeDefined();
    expect(openHigh(session)).toContainEqual(alert);
    expect(blockers(session).some(b => b.en.includes('not reviewed'))).toBe(true);
    const acknowledged = await pharmacyReview(session.id, { reviewerId: 'synthetic-pharmacist', medActions: [], alertActions: [{ alertId: alert.id, action: 'acknowledge' }] });
    const current = acknowledged.summary!.medAlerts!.find(a => a.id === alert.id)!;
    expect(alertNeedsFollowUp(current)).toBe(true);
    expect(buildQuestions(acknowledged).some(q => q.id === `al-${alert.id}`)).toBe(true);
    expect(openHigh(acknowledged)).toEqual([]);
    expect(blockers(acknowledged)).toEqual([]);
  });

  it.each(['resolved', 'false_alarm'] as const)('can progress acknowledgement to %s without deleting earlier audit history', async action => {
    const session = await setup();
    const alert = session.summary!.medAlerts!.find(a => a.kind === 'allergy_conflict')!;
    const request = { reviewerId: 'synthetic-pharmacist', medActions: [] };
    await pharmacyReview(session.id, { ...request, alertActions: [{ alertId: alert.id, action: 'acknowledge' }] });
    const updated = await pharmacyReview(session.id, { ...request, alertActions: [{ alertId: alert.id, action, note: 'Synthetic QA: follow-up recorded.' }] });
    expect(alertNeedsFollowUp(updated.summary!.medAlerts!.find(a => a.id === alert.id)!)).toBe(false);
    expect(buildQuestions(updated).some(q => q.id === `al-${alert.id}`)).toBe(false);
    const history = getAudit(session.id).filter(e => e.type === 'pharmacy_review');
    expect(history.map(e => (e.payload.alertActions as { action: string }[])[0].action)).toEqual(['acknowledge', action]);
  });
});
