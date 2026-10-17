import { createHash } from 'node:crypto';
import type { AllergyEntry, IntakeSummary, MedicationEntry, MedAlert, MedAlertKind, MedRuleFile } from '@medx/shared';
import dictionary from '@medx/shared/src/medrules.json';
import { stoppedTiming } from './pharmacyContext';

export const MEDRULES = dictionary as MedRuleFile;
// Exact port of check-medrules.mjs. Spaces in dictionary terms are intentional;
// Thai terms remain substrings, rather than imposing Latin word boundaries.
export const medNorm = (t: string) => ' ' + t.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
export function lookup<T extends { names: string[] }>(text: string, entries: T[]): T | null {
  const t = medNorm(text); let best: T | null = null; let len = 0;
  for (const e of entries) for (const n of e.names) if (n.length > len && t.includes(n.normalize('NFC'))) { best = e; len = n.length; }
  return best;
}
export const lookupDrug = (text: string) => lookup(text, MEDRULES.drugs);
export const lookupAllergen = (text: string) => lookup(text, MEDRULES.allergens);
export const stableId = (prefix: string, parts: string[]) => `${prefix}-${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24)}`;
const ingredients = (s: string) => s.split('+').map(t => t.trim());
const maxDose = new Set(MEDRULES.drugs.filter(d => d.maxDailyMg && !d.generic.includes('+')).map(d => d.generic));
const HIGH_DUP = new Set(['nsaid', 'anticoagulant', 'opioid', 'ssri']);
const SOURCES: Partial<Record<MedAlertKind, string>> = {
  duplicate_therapy: 'BNF: Medicines, duplication of therapy',
  pregnancy_caution: 'BNF: Pregnancy sections of the named drug',
  max_dose_risk: 'BNF: Paracetamol, adult maximum 4 g in 24 hours',
  unknown_medication: 'MedX Bridge pharmacy spec §3 (unidentified medicine)',
};

/** Pure deterministic decision support; no model can remove or review an alert. */
export function checkMedRules(medications: MedicationEntry[], allergies: AllergyEntry[], pregnancy?: string): MedAlert[] {
  const out = new Map<string, MedAlert>();
  const meds = medications.filter(m => m.status !== 'discontinued' && !stoppedTiming(m.timing)).map(m => {
    const d = MEDRULES.drugs.find(d => d.generic === m.generic) ?? (m.review ? lookupDrug(m.generic || '') : lookupDrug(m.nameOriginal));
    return { m, d, tokens: new Set(d ? [d.drugClass, ...ingredients(d.generic)] : []) };
  });
  const add = (ruleId: string, kind: MedAlertKind, severity: MedAlert['severity'], ms: MedicationEntry[], als: AllergyEntry[] = [], source = SOURCES[kind] || `medrules ${MEDRULES.version}: ${ruleId}`) => {
    const medIds = ms.map(m => m.id).sort(); const id = stableId(ruleId, medIds);
    const existing = out.get(id);
    if (existing) { existing.allergyIds = [...new Set([...existing.allergyIds, ...als.map(a => a.id)])]; return; }
    out.set(id, { id, ruleId, kind, severity, ...MEDRULES.messages[kind], medIds, allergyIds: als.map(a => a.id), evidence: ms.flatMap(m => m.evidence), source });
  };
  for (const { m, d, tokens } of meds) {
    if (!d || d.generic.endsWith('(unspecified)')) add('MR-UNKNOWN-01', 'unknown_medication', 'moderate', [m]);
    if (d?.pregnancy && (pregnancy === 'pregnant' || pregnancy === 'possible')) add(d.pregnancy === 'avoid' ? 'MR-PREG-01' : 'MR-PREG-02', 'pregnancy_caution', d.pregnancy === 'avoid' ? 'high' : 'moderate', [m]);
    for (const a of allergies) for (const c of MEDRULES.allergyConflicts) if (c.allergenClass === a.allergenClass && c.drugClasses.some(t => tokens.has(t))) add(c.ruleId, 'allergy_conflict', c.severity, [m], [a], c.source);
  }
  for (let i = 0; i < meds.length; i++) for (let j = i + 1; j < meds.length; j++) {
    const [x, y] = [meds[i], meds[j]]; if (!x.d || !y.d) continue;
    const shared = [...x.tokens].filter(t => y.tokens.has(t) && t !== 'insulin');
    if (shared.some(t => maxDose.has(t))) add('MR-MAXDOSE-01', 'max_dose_risk', 'high', [x.m, y.m]);
    const dup = shared.filter(t => !maxDose.has(t));
    if (dup.length) { const high = dup.some(t => HIGH_DUP.has(t)); add(high ? 'MR-DUP-01' : 'MR-DUP-02', 'duplicate_therapy', high ? 'high' : 'moderate', [x.m, y.m]); }
    const hits = MEDRULES.interactions.filter(r => (x.tokens.has(r.a) && y.tokens.has(r.b)) || (x.tokens.has(r.b) && y.tokens.has(r.a)));
    const top = hits.find(r => r.severity === 'high') ?? hits[0];
    if (top) add(top.ruleId, 'interaction', top.severity, [x.m, y.m], [], top.source);
  }
  return [...out.values()].sort((a, b) => Number(b.severity === 'high') - Number(a.severity === 'high') || a.id.localeCompare(b.id));
}

/** Retain clinician-reviewed history; rebuild unreviewed alerts from current entries. */
export function refreshMedAlerts(summary: IntakeSummary, previous: MedAlert[] = summary.medAlerts || []) {
  const pregnancyField = summary.fields.find(f => f.key === 'pregnancy_status');
  const text = pregnancyField && ['supported', 'approved', 'edited'].includes(pregnancyField.status) ? pregnancyField.value?.en.toLowerCase() || '' : '';
  const pregnancy = /not pregnant|non.*pregnan/.test(text) ? 'no' : /possib|maybe|late period/.test(text) ? 'possible' : /pregnan/.test(text) ? 'pregnant' : undefined;
  const next = checkMedRules(summary.medications || [], summary.allergies || [], pregnancy);
  const current = new Set(next.map(a => a.id));
  const medIds = new Set((summary.medications || []).map(m => m.id));
  const allergyIds = new Set((summary.allergies || []).map(a => a.id));
  const merged = new Map(previous.filter(a => (a.review || current.has(a.id)) && a.medIds.every(id => medIds.has(id)) && a.allergyIds.every(id => allergyIds.has(id))).map(a => [a.id, a]));
  for (const a of next) merged.set(a.id, { ...a, ...(merged.get(a.id)?.review ? { review: merged.get(a.id)!.review } : {}) });
  summary.medAlerts = [...merged.values()].sort((a, b) => Number(b.severity === 'high') - Number(a.severity === 'high') || a.id.localeCompare(b.id));
}
