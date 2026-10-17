import type { IntakeSession, TriageAssessment, VitalRuleFile, VitalSigns } from '@medx/shared';
import rules from '@medx/shared/src/vitalrules.json';

const params = ['respRate', 'spo2', 'onOxygen', 'systolicBP', 'heartRate', 'consciousness', 'tempC'] as const;
const ordinal = { alert: 0, new_confusion: 1, voice: 2, pain: 3, unresponsive: 4 };
const incompleteReason = { en: 'Vitals incomplete — complete NEWS2 before confirming', th: 'สัญญาณชีพยังไม่ครบ — วัดให้ครบก่อนยืนยัน', it: 'Parametri incompleti — completare il NEWS2 prima di confermare' };
/** Suggestions only. Existing clinician confirmation is historical and never replaced. */
export function assessTriage(s: IntakeSession, v: Partial<VitalSigns> = s.vitals?.at(-1) || {}, bank: VitalRuleFile = rules as VitalRuleFile): TriageAssessment {
  const hits = params.flatMap(k => {
    const raw = v[k]; if (raw === undefined) return [];
    const numeric = k === 'consciousness' ? ordinal[raw as keyof typeof ordinal] : k === 'onOxygen' ? Number(raw) : k === 'tempC' ? Math.round(Number(raw) * 10) / 10 : Math.round(Number(raw));
    const b = bank.bands.find(b => b.vital === k && (b.equals !== undefined ? raw === b.equals : (b.min === undefined || numeric >= b.min) && (b.max === undefined || numeric <= b.max)));
    return b ? [b] : [];
  });
  const incomplete = hits.length !== params.length;
  const score = incomplete ? undefined : hits.reduce((sum, b) => sum + b.points, 0);
  const flags = s.summary?.redFlags || [];
  const row = bank.levels.find(({ when: w }) =>
    (!w.anyEmergencyRedFlag || flags.some(f => f.severity === 'emergency')) &&
    (!w.anyUrgentRedFlag || flags.some(f => f.severity === 'urgent')) &&
    (w.minScore === undefined || (score !== undefined && score >= w.minScore)) &&
    (w.anySingleBandPoints === undefined || hits.some(b => b.points >= w.anySingleBandPoints!)) &&
    (w.incompleteVitals === undefined || w.incompleteVitals === incomplete));
  const level = row?.level || 3;
  return {
    suggestedLevel: incomplete && level > 3 ? 3 : level,
    reasons: [...(row && !(incomplete && level > 3) ? [row.reason] : []), ...(incomplete ? [incompleteReason] : [])],
    ...(score !== undefined ? { warningScore: score } : {}),
    vitalAlerts: hits.flatMap(b => b.alert ? [{ ...b.alert, id: b.alert.ruleId, vital: b.vital as keyof VitalSigns }] : []),
    ...(s.triage?.confirmed ? { confirmed: s.triage.confirmed } : {}),
  };
}
