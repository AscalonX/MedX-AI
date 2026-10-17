import type { IntakeSession, TriageAssessment, VitalRuleFile, VitalSigns } from '@medx/shared';
import rules from '@medx/shared/src/vitalrules.json';

const params = ['respRate', 'spo2', 'onOxygen', 'systolicBP', 'heartRate', 'consciousness', 'tempC'] as const;
const ordinal = { alert: 0, new_confusion: 1, voice: 2, pain: 3, unresponsive: 4 };
const incompleteReason = (count: number) => ({ en: `Vitals incomplete — partial score from ${count} of 7 parameters; complete NEWS2 before confirming`, th: `สัญญาณชีพยังไม่ครบ — คะแนนบางส่วนจาก ${count} ใน 7 พารามิเตอร์; วัดให้ครบก่อนยืนยัน`, it: `Parametri incompleti — punteggio parziale da ${count} di 7 parametri; completare il NEWS2 prima di confermare` });
const roomAirReason = { en: 'Oxygen support omitted — assumed room air for scoring', th: 'ไม่ได้ระบุการให้ออกซิเจน — สมมติว่าหายใจอากาศปกติในการคำนวณคะแนน', it: 'Supporto di ossigeno omesso — aria ambiente presunta per il punteggio' };
/** Suggestions only. Existing clinician confirmation is historical and never replaced. */
export function assessTriage(s: IntakeSession, values?: Partial<VitalSigns>, bank: VitalRuleFile = rules as VitalRuleFile): TriageAssessment & { vitalSources: Partial<Record<typeof params[number], { entryId: string; at: string }>> } {
  const v: Partial<VitalSigns> = {};
  const vitalSources: Partial<Record<typeof params[number], { entryId: string; at: string }>> = {};
  for (const entry of s.vitals || []) for (const k of params) if (entry[k] !== undefined) {
    Object.assign(v, { [k]: entry[k] }); vitalSources[k] = { entryId: entry.id, at: entry.at };
  }
  if (values) for (const k of params) if (values[k] !== undefined) {
    Object.assign(v, { [k]: values[k] });
    if (values.id && values.at) vitalSources[k] = { entryId: values.id, at: values.at };
    else delete vitalSources[k];
  }
  const carried = Object.values(vitalSources).some(source => source.entryId !== (values?.id || s.vitals?.at(-1)?.id));
  const hits = params.flatMap(k => {
    // Optional onOxygen defaults to room air for scoring; keep recorded evidence unchanged.
    const raw = k === 'onOxygen' ? v.onOxygen ?? false : v[k]; if (raw === undefined) return [];
    const numeric = k === 'consciousness' ? ordinal[raw as keyof typeof ordinal] : k === 'onOxygen' ? Number(raw) : k === 'tempC' ? Math.round(Number(raw) * 10) / 10 : Math.round(Number(raw));
    const b = bank.bands.find(b => b.vital === k && (b.equals !== undefined ? raw === b.equals : (b.min === undefined || numeric >= b.min) && (b.max === undefined || numeric <= b.max)));
    return b ? [b] : [];
  });
  const incomplete = hits.length !== params.length;
  const score = hits.reduce((sum, b) => sum + b.points, 0);
  const flags = s.summary?.redFlags || [];
  const matches = bank.levels.filter(({ when: w }) =>
    (!w.anyEmergencyRedFlag || flags.some(f => f.severity === 'emergency')) &&
    (!w.anyUrgentRedFlag || flags.some(f => f.severity === 'urgent')) &&
    (w.minScore === undefined || score >= w.minScore) &&
    (w.anySingleBandPoints === undefined || hits.some(b => b.points >= w.anySingleBandPoints!)) &&
    (w.incompleteVitals === undefined || w.incompleteVitals === incomplete));
  // Rule order cannot let an incomplete-vitals floor suppress a more urgent match.
  const row = matches.reduce<VitalRuleFile['levels'][number] | undefined>((best, candidate) => !best || candidate.level < best.level ? candidate : best, undefined);
  const level = row?.level || 3;
  const suggestedLevel = incomplete && level > 3 ? 3 : level;
  return {
    suggestedLevel,
    reasons: [...(row && !(incomplete && level > 3) ? [row.reason] : []), ...(incomplete ? [incompleteReason(hits.length)] : []), ...(v.onOxygen === undefined ? [roomAirReason] : []),
      ...(carried ? [{ en: 'Some values carried forward from an earlier set', it: 'Alcuni valori sono ripresi da una rilevazione precedente', th: 'ใช้ค่าบางรายการจากการวัดครั้งก่อน' }] : []),
      ...(s.triage?.confirmed && suggestedLevel < s.triage.confirmed.level ? [{ en: 'Suggested level is now more urgent than the confirmed level — re-confirm', it: 'Il livello suggerito è ora più urgente di quello confermato — riconfermare', th: 'ระดับที่เสนอขณะนี้เร่งด่วนกว่าระดับที่ยืนยันไว้ — กรุณายืนยันอีกครั้ง' }] : [])],
    vitalSources,
    warningScore: score,
    vitalAlerts: hits.flatMap(b => b.alert ? [{ ...b.alert, id: b.alert.ruleId, vital: b.vital as keyof VitalSigns }] : []),
    ...(s.triage?.confirmed ? { confirmed: s.triage.confirmed } : {}),
  };
}
