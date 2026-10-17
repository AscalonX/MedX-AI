import { randomUUID } from 'node:crypto';
import type { IntakeSession, MedicationEntry, MedicationOrder } from '@medx/shared';
import catalog from '@medx/shared/src/investigations.json';
import { conflict, invalid, optionalText, properties, sessionFor, text, written } from './clinicalWrites';
import { checkMedRules, lookupDrug, MEDRULES, stableId } from './medrules';
import { PipelineError } from './pipeline';
import { withSessionLock } from './store';

export function parsePrescription(dose: string, frequency: string): { doseMg?: number; timesPerDay?: number } {
  const amount = dose.trim().match(/^(\d+(?:\.\d+)?)\s*(mg|g|mcg|μg)\.?$/iu);
  const doseMg = amount ? Number(amount[1]) * ({ mg: 1, g: 1000, mcg: 0.001, 'μg': 0.001 }[amount[2].toLowerCase()]!) : undefined;
  const f = frequency.trim().toLowerCase();
  const hours = f.match(/^(?:every\s*|q\s*)(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)$/);
  const times = f.match(/^(\d+(?:\.\d+)?)\s*(?:times?\s*(?:a|per)?\s*day|x\s*\/\s*day|\/\s*day)$/);
  const named: Record<string, number> = { daily: 1, 'once daily': 1, 'once a day': 1, od: 1, qd: 1, bid: 2, bd: 2, 'twice daily': 2, 'twice a day': 2, tid: 3, tds: 3, 'three times daily': 3, qid: 4, qds: 4, 'four times daily': 4 };
  const timesPerDay = hours && Number(hours[1]) > 0 ? 24 / Number(hours[1]) : times ? Number(times[1]) : named[f];
  return { ...(doseMg !== undefined && Number.isFinite(doseMg) ? { doseMg } : {}), ...(timesPerDay !== undefined && Number.isFinite(timesPerDay) && timesPerDay > 0 ? { timesPerDay } : {}) };
}
function entry(o: MedicationOrder): MedicationEntry {
  return { id: o.id, nameOriginal: o.drugText, generic: o.generic, drugClass: o.drugClass, dose: o.dose, frequency: o.frequency, timing: 'current', evidence: [], confidence: 1, status: 'edited' };
}
export function prescribingChecks(s: IntakeSession, order: MedicationOrder) {
  const others = (s.orders?.medications || []).filter(o => o.id !== order.id && o.status !== 'cancelled');
  const current = s.summary?.medications || [];
  const pregnancyField = s.summary?.fields.find(f => f.key === 'pregnancy_status' && ['supported', 'approved', 'edited'].includes(f.status));
  const p = pregnancyField?.value?.en.toLowerCase() || '';
  const pregnancy = /not pregnant|non.*pregnan/.test(p) ? 'no' : /possib|maybe|late period/.test(p) ? 'possible' : /pregnan/.test(p) ? 'pregnant' : undefined;
  const checks = checkMedRules([...current, ...others.map(entry), entry(order)], s.summary?.allergies || [], pregnancy).filter(a => a.medIds.includes(order.id));
  const drug = lookupDrug(order.drugText);
  if (drug?.doseRange && order.doseMg !== undefined) {
    const { maxSingleMg, maxDailyMg } = drug.doseRange;
    const single = maxSingleMg !== undefined && order.doseMg > maxSingleMg;
    const dailyMg = order.timesPerDay !== undefined ? order.doseMg * order.timesPerDay : undefined;
    const daily = maxDailyMg !== undefined && dailyMg !== undefined && dailyMg > maxDailyMg;
    if (single || daily) {
      // One identity per order, even when a later edit changes which limits exceed.
      const ruleId = 'MR-DOSE-RANGE';
      const copy = structuredClone(MEDRULES.messages.dose_range);
      const labels = { en: ['single dose', 'daily dose'], it: ['dose singola', 'dose giornaliera'], th: ['ขนาดยาต่อครั้ง', 'ขนาดยาต่อวัน'] };
      for (const lang of ['en', 'it', 'th'] as const) {
        const limits = [
          ...(single ? [`${labels[lang][0]} ${order.doseMg} mg > ${maxSingleMg} mg`] : []),
          ...(daily ? [`${labels[lang][1]} ${dailyMg} mg > ${maxDailyMg} mg`] : []),
        ];
        copy.message[lang] += ` (${limits.join('; ')})`;
      }
      checks.push({ id: stableId(ruleId, [order.id]), ruleId, kind: 'dose_range', severity: 'high', ...copy, medIds: [order.id], allergyIds: [], evidence: [], source: MEDRULES.doseRangeSource || `medrules ${MEDRULES.version}` });
    }
  }
  return checks;
}
function refresh(s: IntakeSession) {
  for (const o of s.orders?.medications || []) if (o.status !== 'cancelled') o.checks = prescribingChecks(s, o);
}
function orderFor(s: IntakeSession, id: string) {
  const o = s.orders?.medications.find(o => o.id === id);
  if (!o) throw new PipelineError('Order not found', 'not_found'); return o;
}
export function investigationOrder(id: string, req: unknown) {
  properties(req, ['orderedBy', 'code', 'reason', 'fromSuggestionId']);
  const actor = text(req.orderedBy, 'orderedBy', 200); const code = text(req.code, 'code', 200);
  const item = catalog.items.find(i => i.id === code); if (!item) invalid('Unknown investigation code');
  const reason = optionalText(req.reason, 'reason'); const fromSuggestionId = optionalText(req.fromSuggestionId, 'fromSuggestionId', 300);
  return withSessionLock(id, () => {
    const s = sessionFor(id); const o = { id: randomUUID(), code, label: item.label, category: item.category as 'lab' | 'imaging' | 'ecg' | 'other', orderedBy: actor, at: new Date().toISOString(), status: 'submitted' as const, ...(reason ? { reason } : {}), ...(fromSuggestionId ? { fromSuggestionId } : {}) };
    (s.orders ||= { medications: [], investigations: [] }).investigations.push(o);
    return written(s, 'order_submitted', actor, { orderId: o.id, kind: 'investigation', code, fromSuggestionId });
  });
}
export function medicationOrder(id: string, req: unknown) {
  properties(req, ['orderedBy', 'orderId', 'drugText', 'dose', 'route', 'frequency', 'duration']);
  const actor = text(req.orderedBy, 'orderedBy', 200); const orderId = optionalText(req.orderId, 'orderId', 200);
  const drugText = text(req.drugText, 'drugText', 300), dose = text(req.dose, 'dose', 200), route = text(req.route, 'route', 100), frequency = text(req.frequency, 'frequency', 200), duration = optionalText(req.duration, 'duration', 200);
  return withSessionLock(id, () => {
    const s = sessionFor(id); const old = orderId ? orderFor(s, orderId) : undefined;
    if (old && !['draft', 'returned'].includes(old.status)) conflict('Only draft or returned orders can be edited');
    const drug = lookupDrug(drugText);
    const o: MedicationOrder = { id: old?.id || randomUUID(), drugText, dose, route, frequency, ...(duration ? { duration } : {}), ...parsePrescription(dose, frequency), generic: drug?.generic || null, drugClass: drug?.drugClass || null, orderedBy: actor, at: new Date().toISOString(), status: 'draft', checks: [], overrides: [] };
    const orders = (s.orders ||= { medications: [], investigations: [] }).medications;
    if (old) orders[orders.indexOf(old)] = o; else orders.push(o);
    refresh(s); return written(s, 'order_drafted', actor, { orderId: o.id, updated: !!old, checkIds: o.checks.map(a => a.id) });
  });
}
export function medicationAction(id: string, orderId: string, action: 'submit' | 'cancel' | 'pharmacy', req: unknown) {
  properties(req, action === 'submit' ? ['orderedBy', 'overrides'] : action === 'cancel' ? ['orderedBy', 'reason'] : ['reviewerId', 'action', 'note']);
  const actor = text(action === 'pharmacy' ? req.reviewerId : req.orderedBy, 'reviewer', 200);
  const note = optionalText(action === 'cancel' ? req.reason : action === 'pharmacy' ? req.note : undefined, 'note');
  if (action === 'pharmacy' && ((req.action !== 'verify' && req.action !== 'return') || (req.action === 'return' && !note))) invalid('Return requires a note');
  const overrides = action === 'submit' ? req.overrides : [];
  if (!Array.isArray(overrides) || overrides.length > 100) invalid('Invalid overrides');
  const seen = new Set<string>();
  const parsed = overrides.map(value => {
    properties(value, ['alertId', 'reason']); const alertId = text(value.alertId, 'alertId', 200), reason = text(value.reason, 'override reason');
    if (seen.has(alertId)) invalid('Duplicate override'); seen.add(alertId); return { alertId, reason, by: actor, at: new Date().toISOString() };
  });
  return withSessionLock(id, () => {
    const s = sessionFor(id), o = orderFor(s, orderId); refresh(s);
    if (action === 'cancel') {
      if (o.status === 'cancelled') conflict('Order already cancelled');
      o.status = 'cancelled'; refresh(s);
      // Contract has no cancellation audit type; record the action explicitly.
      return written(s, 'order_drafted', actor, { orderId, action: 'cancel', ...(note ? { reason: note } : {}) });
    }
    if (action === 'submit') {
      if (!['draft', 'returned'].includes(o.status)) conflict('Only draft or returned orders can be submitted');
      if (parsed.some(p => !o.checks.some(a => a.id === p.alertId))) invalid('Unknown alert override');
      if (o.checks.some(a => a.severity === 'high' && !parsed.some(p => p.alertId === a.id))) conflict('Every high alert requires an override reason');
      o.overrides = parsed; o.status = 'submitted'; delete o.pharmacist;
      return written(s, 'order_submitted', actor, { orderId, overrides: parsed });
    }
    if (o.status !== 'submitted') conflict('Only submitted orders can be reviewed by pharmacy');
    if (req.action === 'verify' && o.checks.some(a => a.severity === 'high' && !o.overrides.some(p => p.alertId === a.id && p.reason.trim()))) conflict('Every high alert requires an override reason');
    o.status = req.action === 'verify' ? 'verified' : 'returned';
    o.pharmacist = { action: req.action as 'verify' | 'return', by: actor, at: new Date().toISOString(), ...(note ? { note } : {}) };
    return written(s, 'order_pharmacy_action', actor, { orderId, ...o.pharmacist });
  });
}
