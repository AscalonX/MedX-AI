import { randomUUID } from 'node:crypto';
import { STAFF } from '@medx/shared';
import type { DispenseChecklist, IntakeSession, Localized, MedAlert, MedicationEntry, MedicationOrder, MedRuleFile } from '@medx/shared';
import catalog from '@medx/shared/src/investigations.json';
import { actorId, conflict, invalid, optionalText, properties, sessionFor, text, written } from './clinicalWrites';
import { checkMedRules, lookupDrug, MEDRULES, stableId } from './medrules';
import { PipelineError } from './pipeline';
import { object, shortString } from './schema';
import { getConsultRecord, withSessionLock } from './store';

// References are opaque server-issued identities, not prose. Validate shape here
// and membership below before saving; redacting a numeric hash breaks provenance.
function reference(value: unknown, name: string, max = 200): string {
  if (!shortString(value, max)) invalid(`Invalid ${name}`);
  return value.trim();
}

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
// A candidate alternative is dropped when it would itself raise one of these for THIS patient.
// max_dose_risk is the same-ingredient (paracetamol) form of duplicate therapy, so it is dropped too.
const ALTERNATIVE_BLOCKERS = new Set<MedAlert['kind']>(['allergy_conflict', 'interaction', 'duplicate_therapy', 'pregnancy_caution', 'max_dose_risk']);
type AlternativeRule = NonNullable<MedRuleFile['alternatives']>[number];
/**
 * Deterministic, no model: curated medrules "alternatives" for this alert and the ordered drug's class,
 * minus the ordered generic, minus any candidate that fails this patient's own checks when it replaces
 * the order (allergies, current meds, other active orders, pregnancy). Options for prescriber review only.
 */
export function alternativesFor(s: IntakeSession, order: MedicationOrder, alert: MedAlert, table: AlternativeRule[] = MEDRULES.alternatives ?? []): string[] {
  const drugClass = order.drugClass;
  if (!drugClass) return [];
  const candidates = [...new Set(table.filter(e => e.kinds.includes(alert.kind) && e.drugClasses.includes(drugClass)).flatMap(e => e.consider))];
  return candidates.filter(generic => {
    if (generic === order.generic || generic.endsWith('(unspecified)')) return false;
    const drug = MEDRULES.drugs.find(d => d.generic === generic);
    if (!drug) return false;
    // Same id: the hypothetical replaces the ordered drug instead of sitting next to it.
    const hypothetical: MedicationOrder = { ...order, drugText: generic, generic, drugClass: drug.drugClass, checks: [], overrides: [] };
    return !baseChecks(s, hypothetical).some(a => ALTERNATIVE_BLOCKERS.has(a.kind));
  });
}
export function prescribingChecks(s: IntakeSession, order: MedicationOrder) {
  const checks = baseChecks(s, order);
  for (const alert of checks) {
    const alternatives = alternativesFor(s, order, alert);
    if (alternatives.length) alert.alternatives = alternatives;
  }
  return checks;
}
function baseChecks(s: IntakeSession, order: MedicationOrder) {
  const others = (s.orders?.medications || []).filter(o => o.id !== order.id && o.status !== 'cancelled');
  const current = s.summary?.medications || [];
  const pregnancyField = s.summary?.fields.find(f => f.key === 'pregnancy_status' && ['supported', 'approved', 'edited'].includes(f.status));
  const p = pregnancyField?.value?.en.toLowerCase() || '';
  const pregnancy = /not pregnant|non.*pregnan/.test(p) ? 'no' : /possib|maybe|late period/.test(p) ? 'possible' : /pregnan/.test(p) ? 'pregnant' : undefined;
  const checks = checkMedRules([...current, ...others.map(entry), entry(order)], s.summary?.allergies || [], pregnancy).filter(a => a.medIds.includes(order.id));
  const drug = lookupDrug(order.drugText);
  const add = (ruleId: string, kind: MedAlert['kind'], severity: MedAlert['severity'], message: Localized) => checks.push({ id: stableId(ruleId, [order.id]), ruleId, kind, severity, message, action: MEDRULES.messages[kind].action, medIds: [order.id], allergyIds: [], evidence: [], source: `medrules ${MEDRULES.version}` });
  if (!drug?.doseRange || order.doseMg === undefined || order.timesPerDay === undefined) add('MR-DOSE-UNCHECKED', 'dose_range', 'moderate', {
    en: 'Dose not checked — verify against a full reference', th: 'ยังไม่ได้ตรวจขนาดยา — โปรดตรวจสอบกับเอกสารอ้างอิงฉบับเต็ม', it: 'Dose non verificata — consultare un riferimento completo',
  });
  if (drug?.generic === 'methotrexate' && order.timesPerDay !== undefined && order.timesPerDay >= 1) add('MR-METHOTREXATE-DAILY', 'dose_range', 'high', {
    en: 'Methotrexate daily frequency — verify intended weekly dosing with the prescriber', th: 'สั่งเมโธเทร็กเซตทุกวัน — ยืนยันการให้ยารายสัปดาห์ที่ตั้งใจกับผู้สั่งยา', it: 'Metotrexato con frequenza giornaliera — verificare la prevista somministrazione settimanale con il prescrittore',
  });
  const allergyField = s.summary?.fields.find(f => f.key === 'allergies');
  const recordedAllergy = s.summary?.allergies?.some(a => a.status !== 'unsupported' && (a.evidence.length > 0 || a.status === 'edited' || !!a.review));
  if ((!allergyField || !['supported', 'approved', 'edited'].includes(allergyField.status)) && !recordedAllergy) {
    if (!s.summary?.noKnownAllergiesEvidence?.length) add('MR-ALLERGY-UNKNOWN', 'allergy_conflict', 'moderate', {
      en: 'Allergy status not recorded — ask before prescribing', th: 'ยังไม่ได้บันทึกประวัติแพ้ยา — สอบถามก่อนสั่งยา', it: 'Allergie non registrate — chiedere prima di prescrivere',
    });
  }
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
  const actor = actorId(req.orderedBy, 'orderedBy'); const code = text(req.code, 'code', 200);
  const item = catalog.items.find(i => i.id === code); if (!item) invalid('Unknown investigation code');
  const reason = optionalText(req.reason, 'reason'); const fromSuggestionId = req.fromSuggestionId === undefined ? undefined : reference(req.fromSuggestionId, 'fromSuggestionId', 300);
  return withSessionLock(id, () => {
    const s = sessionFor(id);
    if (fromSuggestionId && !getConsultRecord(id).suggestions.some(x => x.id === fromSuggestionId)) invalid('Unknown consult suggestion for this session');
    const o = { id: randomUUID(), code, label: item.label, category: item.category as 'lab' | 'imaging' | 'ecg' | 'other', orderedBy: actor, at: new Date().toISOString(), status: 'submitted' as const, ...(reason ? { reason } : {}), ...(fromSuggestionId ? { fromSuggestionId } : {}) };
    (s.orders ||= { medications: [], investigations: [] }).investigations.push(o);
    return written(s, 'order_submitted', actor, { orderId: o.id, kind: 'investigation', code, fromSuggestionId });
  });
}
export function medicationOrder(id: string, req: unknown) {
  properties(req, ['orderedBy', 'orderId', 'drugText', 'dose', 'route', 'frequency', 'duration']);
  const actor = actorId(req.orderedBy, 'orderedBy'); const orderId = req.orderId === undefined ? undefined : reference(req.orderId, 'orderId');
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
  properties(req, action === 'submit' ? ['orderedBy', 'overrides'] : action === 'cancel' ? ['orderedBy', 'reason'] : ['reviewerId', 'action', 'note', 'alertIds', 'suggestedGenerics']);
  const actor = actorId(action === 'pharmacy' ? req.reviewerId : req.orderedBy, 'reviewer');
  const note = optionalText(action === 'cancel' ? req.reason : action === 'pharmacy' ? req.note : undefined, 'note');
  if (action === 'pharmacy' && ((req.action !== 'verify' && req.action !== 'return') || (req.action === 'return' && !note))) invalid('Return requires a note');
  // Pharmacist report (stored only on return): shape and dictionary checks here, membership inside the lock.
  const alertIds = action === 'pharmacy' ? references(req.alertIds, 'alertIds', 50) : [];
  const suggestedGenerics = action === 'pharmacy' ? dictionaryGenerics(req.suggestedGenerics) : [];
  const overrides = action === 'submit' ? req.overrides : [];
  if (!Array.isArray(overrides) || overrides.length > 100) invalid('Invalid overrides');
  const seen = new Set<string>();
  const parsed = overrides.map(value => {
    properties(value, ['alertId', 'reason']); const alertId = reference(value.alertId, 'alertId'), reason = text(value.reason, 'override reason');
    if ((reason.match(/[\p{L}\p{N}]/gu) || []).length < 5) invalid('Override reason must contain at least five letters or digits');
    if (seen.has(alertId)) invalid('Duplicate override'); seen.add(alertId); return { alertId, reason, by: actor, at: new Date().toISOString() };
  });
  return withSessionLock(id, () => {
    const s = sessionFor(id), o = orderFor(s, orderId); refresh(s);
    if (action === 'cancel') {
      if (o.status === 'cancelled') conflict('Order already cancelled');
      if (o.status === 'verified') conflict('Verified orders cannot be cancelled');
      if (o.status === 'dispensed') conflict('Dispensed orders cannot be cancelled');
      o.status = 'cancelled'; refresh(s);
      // Contract has no cancellation audit type; record the action explicitly.
      return written(s, 'order_drafted', actor, { orderId, action: 'cancel', ...(note ? { reason: note } : {}) });
    }
    if (action === 'submit') {
      if (!['draft', 'returned'].includes(o.status)) conflict('Only draft or returned orders can be submitted');
      if (parsed.some(p => !o.checks.some(a => a.id === p.alertId))) invalid('Unknown alert override');
      if (o.checks.some(a => a.severity === 'high' && !parsed.some(p => p.alertId === a.id))) conflict('Every high alert requires an override reason');
      o.overrides = parsed; o.status = 'submitted'; delete o.pharmacist; delete o.dispense;
      // A new prescription after the patient was called: medicines are being prepared again.
      const pickupReset = s.pickup?.status === 'ready';
      if (pickupReset) delete s.pickup;
      return written(s, 'order_submitted', actor, { orderId, overrides: parsed, ...(pickupReset ? { pickupReset: true } : {}) });
    }
    if (o.status !== 'submitted') conflict('Only submitted orders can be reviewed by pharmacy');
    if (alertIds.some(a => !o.checks.some(c => c.id === a))) invalid('Unknown alert for this order');
    if (o.generic && suggestedGenerics.includes(o.generic)) invalid('Suggested generic is the ordered drug');
    if (req.action === 'verify' && o.checks.some(a => a.severity === 'high' && !o.overrides.some(p => p.alertId === a.id && p.reason.trim()))) conflict('Every high alert requires an override reason');
    o.status = req.action === 'verify' ? 'verified' : 'returned';
    o.pharmacist = { action: req.action as 'verify' | 'return', by: actor, at: new Date().toISOString(), ...(note ? { note } : {}), ...(req.action === 'return' ? { report: { alertIds, suggestedGenerics } } : {}) };
    return written(s, 'order_pharmacy_action', actor, { orderId, ...o.pharmacist });
  });
}

function references(value: unknown, name: string, max: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) invalid(`Invalid ${name}`);
  return [...new Set(value.map(v => reference(v, name)))];
}
/** Specific dictionary generics only (canonical spelling), deduped, at most five. */
function dictionaryGenerics(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) invalid('Invalid suggestedGenerics');
  const out = [...new Set(value.map(v => {
    if (!shortString(v, 200)) invalid('Invalid suggestedGenerics');
    const generic = v.normalize('NFC').trim().toLowerCase();
    if (generic.endsWith('(unspecified)') || !MEDRULES.drugs.some(d => d.generic === generic)) invalid('Suggested generic is not in the drug dictionary');
    return generic;
  }))];
  if (out.length > 5) invalid('At most five suggested generics');
  return out;
}

const CHECKLIST: (keyof DispenseChecklist)[] = ['rightPatient', 'rightDrug', 'rightDose', 'rightRoute', 'allergyRechecked', 'labelled'];
const norm = (v: string) => v.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
/** Staff id and display name are the same person; any other string is compared as written (case-insensitive). */
function person(value: string) {
  const n = norm(value);
  return STAFF.find(m => norm(m.id) === n || norm(m.name) === n)?.id ?? n;
}

/** Pharmacist 2: pick + final double check. Two-person rule: never the pharmacist who verified the order. */
export function dispenseOrder(id: string, orderId: string, req: unknown) {
  properties(req, ['reviewerId', 'checklist', 'note']);
  const actor = actorId(req.reviewerId, 'reviewerId'); const note = optionalText(req.note, 'note');
  const list = req.checklist;
  if (!object(list) || Object.keys(list).some(k => !(CHECKLIST as string[]).includes(k)) || CHECKLIST.some(k => typeof list[k] !== 'boolean')) invalid('Invalid checklist');
  if (CHECKLIST.some(k => list[k] !== true)) invalid('Every dispense checklist item must be confirmed');
  const checklist = Object.fromEntries(CHECKLIST.map(k => [k, true])) as unknown as DispenseChecklist;
  return withSessionLock(id, () => {
    const s = sessionFor(id), o = orderFor(s, orderId); refresh(s);
    if (o.status !== 'verified') conflict('Only verified orders can be dispensed');
    if (!o.pharmacist || person(o.pharmacist.by) === person(actor)) conflict('A second pharmacist must dispense: the pharmacist who verified this order cannot also dispense it');
    o.status = 'dispensed';
    o.dispense = { by: actor, at: new Date().toISOString(), checklist, ...(note ? { note } : {}) };
    return written(s, 'order_dispensed', actor, { orderId, verifiedBy: o.pharmacist.by, ...o.dispense });
  });
}

/** Call the patient to the counter once every active medication order is dispensed; then record collection. */
export function pickupAction(id: string, req: unknown) {
  properties(req, ['reviewerId', 'action', 'counter']);
  const actor = actorId(req.reviewerId, 'reviewerId');
  if (req.action !== 'call' && req.action !== 'collected') invalid('Invalid pickup action');
  const counter = optionalText(req.counter, 'counter', 40);
  if (counter !== undefined && req.action !== 'call') invalid('counter applies only to call');
  return withSessionLock(id, () => {
    const s = sessionFor(id); const at = new Date().toISOString();
    if (req.action === 'call') {
      if (s.pickup?.status === 'collected') conflict('Medicines already collected');
      const active = (s.orders?.medications || []).filter(o => o.status !== 'cancelled');
      if (!active.length) conflict('No medication orders to collect');
      if (active.some(o => o.status !== 'dispensed')) conflict('Every active medication order must be dispensed before calling the patient');
      const recall = s.pickup?.status === 'ready';
      const where = counter ?? (recall ? s.pickup?.counter : undefined);
      s.pickup = { status: 'ready', ...(where ? { counter: where } : {}), calledBy: actor, calledAt: at };
      return written(s, 'pickup_called', actor, { orderIds: active.map(o => o.id), recall, ...(where ? { counter: where } : {}) });
    }
    if (s.pickup?.status !== 'ready') conflict('Patient has not been called for pickup');
    s.pickup = { ...s.pickup, status: 'collected', collectedBy: actor, collectedAt: at };
    return written(s, 'pickup_collected', actor, { calledBy: s.pickup.calledBy, calledAt: s.pickup.calledAt, orderIds: (s.orders?.medications || []).filter(o => o.status === 'dispensed').map(o => o.id) });
  });
}
