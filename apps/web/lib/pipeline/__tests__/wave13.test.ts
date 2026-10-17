import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VitalRuleFile, VitalSigns } from '@medx/shared';
import vitalrules from '@medx/shared/src/vitalrules.json';
import { POST as vitals } from '../../../app/api/sessions/[id]/vitals/route';
import { addTurn, createSession } from '../pipeline';
import { getAudit, getSession } from '../store';
import { assessTriage } from '../triage';

const normal = { respRate: 16, spo2: 98, onOxygen: false, systolicBP: 120, heartRate: 70, consciousness: 'alert' as const, tempC: 37 };
const reported = { heartRate: 118, systolicBP: 92, diastolicBP: 60, respRate: 24, tempC: 39.1, spo2: 93, consciousness: 'alert' as const, painScore: 5 };
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w13-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe('partial NEWS2 safety regression', () => {
  it.each([
    ['reported case without oxygen support', reported, 2, 10],
    ['normal incomplete set', { heartRate: 70 }, 3, 0],
    ['complete normal set', normal, 4, 0],
    ['normal with oxygen omitted', { ...normal, onOxygen: undefined }, 4, 0],
    ['partial score seven without a single band three', { heartRate: 118, systolicBP: 92, respRate: 24, tempC: 38.5 }, 2, 7],
    ['no measured parameters', { painScore: 5 }, 3, 0],
    ['explicit oxygen support retained', { ...normal, onOxygen: true }, 3, 2],
  ])('%s via POST /vitals', async (_name, values, level, score) => {
    const s = createSession('en');
    const response = await vitals(new Request('http://localhost/api', {
      method: 'POST', body: JSON.stringify({ recordedBy: 'synthetic-w13-nurse', vitals: values }),
    }), { params: Promise.resolve({ id: s.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.triage).toMatchObject({ suggestedLevel: level, warningScore: score });
    expect(body.triage).not.toHaveProperty('scoreComplete');
    expect(body.triage).not.toHaveProperty('confirmed');
    expect(getSession(s.id)?.triage).toEqual(body.triage);
    expect(getAudit(s.id).at(-1)?.type).toBe('vitals_recorded');
    if (_name.startsWith('reported')) {
      expect(body.triage.vitalAlerts).toHaveLength(5);
      expect(body.triage.reasons.some((r: { en: string }) => /assumed room air/.test(r.en))).toBe(true);
      expect(body.vitals.at(-1)).not.toHaveProperty('onOxygen');
    }
  });

  it.each(Object.keys(normal).filter(k => k !== 'onOxygen') as (keyof typeof normal)[])('labels the partial score when %s is missing', key => {
    const values: Partial<VitalSigns> = { ...normal };
    delete values[key];
    const result = assessTriage(createSession('en', { persist: false }), values);
    expect(result).toMatchObject({ suggestedLevel: 3, warningScore: 0 });
    expect(result.reasons).toContainEqual({
      en: 'Vitals incomplete — partial score from 6 of 7 parameters; complete NEWS2 before confirming',
      th: 'สัญญาณชีพยังไม่ครบ — คะแนนบางส่วนจาก 6 ใน 7 พารามิเตอร์; วัดให้ครบก่อนยืนยัน',
      it: 'Parametri incompleti — punteggio parziale da 6 di 7 parametri; completare il NEWS2 prima di confermare',
    });
  });

  it('counts the room-air default and exposes zero even with no measured score parameters', () => {
    const result = assessTriage(createSession('en', { persist: false }), {});
    expect(result).toMatchObject({ suggestedLevel: 3, warningScore: 0 });
    expect(result.reasons.some(r => r.en.includes('partial score from 1 of 7 parameters'))).toBe(true);
  });

  const bank = vitalrules as VitalRuleFile;
  it.each(bank.bands.filter(b => b.points === 3))('applies the single-band rule for $vital at $min/$max with incomplete vitals', band => {
    const value = band.vital === 'consciousness' ? 'new_confusion' : band.min ?? band.max!;
    const result = assessTriage(createSession('en', { persist: false }), { [band.vital]: value });
    expect(result.warningScore).toBe(3);
    expect(result.suggestedLevel).toBe(bank.levels.find(r => r.when.anySingleBandPoints === 3)!.level);
    expect(result.vitalAlerts.some(a => a.ruleId === band.alert?.ruleId)).toBe(true);
  });

  it.each([false, true])('takes the most urgent match with incomplete floor first (reverse=%s)', reverse => {
    const reordered = structuredClone(bank);
    if (reverse) reordered.levels.reverse();
    reordered.levels.unshift({ level: 3, when: { incompleteVitals: true }, reason: { en: 'Incomplete floor', th: 'ยังไม่ครบ', it: 'Incompleto' } });
    const result = assessTriage(createSession('en', { persist: false }), { ...reported, consciousness: undefined }, reordered);
    expect(result).toMatchObject({ suggestedLevel: 2, warningScore: 10 });
    expect(result.reasons[0]).toEqual(bank.levels.find(r => r.when.minScore === (reverse ? 5 : 7))!.reason);
  });

  it('retains emergency red flags and clinician confirmation with partial scoring', async () => {
    const s = await addTurn(createSession('en').id, 'Chest pain and I feel sweaty');
    expect(s.summary?.redFlags.some(f => f.severity === 'emergency')).toBe(true);
    const confirmed = { level: 4 as const, by: 'synthetic-reviewer', at: new Date().toISOString(), note: 'Prior review' };
    s.triage = { suggestedLevel: 4, reasons: [], vitalAlerts: [], confirmed };
    expect(assessTriage(s, { heartRate: 118 })).toMatchObject({ suggestedLevel: 1, warningScore: 2, confirmed });
  });
});
