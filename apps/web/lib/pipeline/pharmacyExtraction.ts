import type { AllergyEntry, IntakeSession, IntakeSummary, MedicationEntry } from '@medx/shared';
import { lookupAllergen, lookupDrug, MEDRULES, medNorm, refreshMedAlerts, stableId } from './medrules';
import type { ModelAllergy, ModelExtraction, ModelMedicine } from './schema';
import { verifyDetailed, words } from './verify';
import { redact } from './redact';
import { allergyDenials, pharmacyContext } from './pharmacyContext';

/** Offline demo only: split dictionary mentions first, classify allergy context,
 * then map each entry independently. Never uses fixture IDs or gold answers. */
export function mockPharmacy(turns: { alias: string; text: string }[]): Pick<ModelExtraction, 'medications' | 'allergies' | 'noKnownAllergies'> {
  const medications: ModelMedicine[] = []; const allergies: ModelAllergy[] = [];
  let noKnownAllergies: ModelExtraction['noKnownAllergies'] = null;
  for (const { alias: turn, text } of turns) {
    const safe = text.split(/(?<=[.!?\n])/).filter(s => !/ignore|output|say I|mark this|istruzion|คำสั่ง/i.test(s)).join('');
    const negative = allergyDenials(safe);
    if (negative.length) noKnownAllergies = { turn, quote: negative.at(-1)![0] };
    const candidates: { start: number; end: number; name: string }[] = [];
    const lower = safe.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'");
    for (const entry of [...MEDRULES.drugs, ...MEDRULES.allergens]) for (const term of entry.names) {
      const needle = term.trim().normalize('NFC');
      for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
        const start = at; let end = at + needle.length;
        // Complete Latin dictionary stems (sertralin -> sertralina); do not
        // expand Thai spans into entire sentences without spaces.
        if (/^[a-z]/.test(needle)) {
          if (start > 0 && /[a-z]/i.test(safe[start - 1])) continue;
          while (end < safe.length && /[a-z]/i.test(safe[end])) end++;
        }
        const name = safe.slice(start, end);
        if (!medNorm(name).includes(term.normalize('NFC'))) continue;
        candidates.push({ start, end, name });
      }
    }
    // Unknown named remedies and unnamed pills remain visible for identification.
    const unknown = /(?:ยาสมุนไพร|ยาหม่อง|(?:a\s+)?(?:white|yellow|little|small)(?:\s+(?:white|yellow|little|small))*\s+(?:pill|tablet|one)(?:\s+for\s+(?:my\s+)?[a-z ]+?)?(?=\s+every|,|\.|$)|(?:a\s+)?(?:white|yellow|little|small)(?:\s+(?:white|yellow|little|small))*\s+(?:pill|tablet|one)|Muscoril|(?:erba di San Giovanni)|(?:St[.'’]?\s*John['’]s wort))/ig;
    for (const m of safe.matchAll(unknown)) candidates.push({ start: m.index!, end: m.index! + m[0].length, name: m[0] });
    const chosen = candidates.sort((a, b) => b.name.length - a.name.length).filter((c, i, all) => !all.slice(0, i).some(p => p.start < c.end && p.end > c.start)).sort((a, b) => a.start - b.start);
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      if (negative.some(n => c.start >= n.index! && c.start < n.index! + n[0].length)) continue;
      const context = pharmacyContext(safe, c.start);
      if (context.negated) continue;
      const { isAllergy } = context;
      const nextStart = chosen[i + 1]?.start ?? safe.length;
      const end = Math.min(nextStart, c.end + 150);
      const tail = safe.slice(c.end, end).split(/[.!?]|\b(?:and|but)\b|แต่/)[0];
      // Keep complete verifier segments, including Italian apostrophes and
      // Thai compounds, rather than quoting a substring inside a segment.
      const segments = words(safe, /\p{Script=Thai}/u.test(safe) ? 'th' : 'en');
      const first = segments.find(s => s.index <= c.start && s.index + s.segment.length > c.start);
      const quoteEnd = c.end + tail.length;
      const last = segments.find(s => s.index < quoteEnd && s.index + s.segment.length > quoteEnd);
      let quote = safe.slice(first?.index ?? c.start, last ? last.index + last.segment.length : quoteEnd).trim().slice(0, 400);
      if (isAllergy) {
        const reaction = /ผื่นขึ้น(?:ตามตัว)?|rash|hives|ผื่น|gonfiore|swelling|eruzione/i.exec(tail)?.[0] ?? null;
        allergies.push({ allergenOriginal: c.name, reaction, turn, quote });
      } else if (lookupDrug(c.name) || /ยาสมุนไพร|ยาหม่อง|pill|tablet|one|muscoril|san giovanni|wort/i.test(c.name)) {
        const dose = /\b\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|sachets?)\b|\b(?:da\s+)?\d{3,4}\b|\d+\s*(?:เม็ด|มก\.)/i.exec(tail)?.[0] ?? null;
        const frequency = /(?:twice|three times|once)\s+a\s+day|every\s+(?:morning|evening|night)|at night|(?:tre|due) volte al giorno|ogni mattina|la sera|เช้า-เย็น|ทุก(?:เช้า|เย็น|คืน)|วันละ[^\s,.]+/i.exec(tail)?.[0] ?? null;
        const timing = context.stopped?.text ?? null;
        if (context.stopped) quote = safe.slice(context.stopped.start, last ? last.index + last.segment.length : quoteEnd).trim().slice(0, 400);
        medications.push({ nameOriginal: c.name, dose, frequency, timing, turn, quote });
      }
    }
  }
  // One row per named product; brands with the same ingredient stay separate.
  const unique = <T>(xs: T[], name: (x: T) => string) => [...new Map(xs.map(x => [medNorm(name(x)), x])).values()].slice(0, 40);
  return { medications: unique(medications, m => m.nameOriginal), allergies: unique(allergies, a => a.allergenOriginal), noKnownAllergies };
}

export function pharmacyEntries(model: Pick<ModelExtraction, 'medications' | 'allergies' | 'noKnownAllergies'>, session: IntakeSession) {
  const evidence = (e: { turn: string; quote: string }) => {
    const patients = session.turns.filter(t => t.role === 'patient');
    const hit = verifyDetailed(e.quote, session.turns, patients[Number(e.turn.slice(1)) - 1]?.id, false, false);
    return hit ? [hit.evidence] : [];
  };
  const safe = (s: string | null) => s === null ? null : redact(s).text;
  const contextFor = (ev: MedicationEntry['evidence'], name: string, alias: string) => {
    const e = ev[0]; const turn = e && session.turns.find(t => t.id === e.turnId);
    const index = e?.quote.indexOf(name) ?? -1;
    if (turn && index >= 0) return pharmacyContext(turn.text, e.start + index);
    // Even a rejected quote must not leave a denied named allergy/medicine
    // as an unsupported row. This fallback can only omit, never verify data.
    const original = session.turns.filter(t => t.role === 'patient')[Number(alias.slice(1)) - 1];
    const at = original?.text.indexOf(name) ?? -1;
    return original && at >= 0 ? pharmacyContext(original.text, at) : null;
  };
  const medications: MedicationEntry[] = (model.medications || []).flatMap(m => {
    let ev = evidence(m); const d = lookupDrug(m.nameOriginal);
    const context = contextFor(ev, m.nameOriginal, m.turn);
    if (context?.negated) return [];
    const timing = context?.stopped?.text ?? m.timing;
    if (context?.stopped && ev.length) {
      const turn = session.turns.find(t => t.id === ev[0].turnId)!;
      const start = Math.min(context.stopped.start, ev[0].start);
      const end = Math.max(ev[0].end, context.stopped.start + context.stopped.text.length);
      ev = [{ ...ev[0], start, end, quote: turn.text.slice(start, end) }];
    }
    // Name must also occur in the verified quote; a real unrelated quote is insufficient.
    const supported = ev.length > 0 && ev[0].quote.includes(m.nameOriginal) && [m.dose, m.frequency, timing].every(v => v === null || ev[0].quote.includes(v));
    return [{ id: stableId('med', supported ? [ev[0].turnId, String(ev[0].start + ev[0].quote.indexOf(m.nameOriginal)), d?.generic || medNorm(m.nameOriginal)] : [medNorm(m.nameOriginal)]), nameOriginal: safe(m.nameOriginal)!, generic: d?.generic ?? null, drugClass: d?.drugClass ?? null, dose: safe(m.dose), frequency: safe(m.frequency), timing: safe(timing), evidence: supported ? ev : [], confidence: supported ? 0.9 : 0, status: !supported ? 'unsupported' as const : !d || d.generic.endsWith('(unspecified)') ? 'unmatched' as const : 'supported' as const }];
  });
  const allergies: AllergyEntry[] = (model.allergies || []).flatMap(a => {
    const ev = evidence(a); const d = lookupAllergen(a.allergenOriginal);
    if (contextFor(ev, a.allergenOriginal, a.turn)?.negated) return [];
    const supported = ev.length > 0 && ev[0].quote.includes(a.allergenOriginal) && (a.reaction === null || ev[0].quote.includes(a.reaction));
    return [{ id: stableId('allergy', [medNorm(a.allergenOriginal)]), allergenOriginal: safe(a.allergenOriginal)!, allergenClass: d?.allergenClass ?? null, reaction: safe(a.reaction), evidence: supported ? ev : [], status: !supported ? 'unsupported' as const : d ? 'supported' as const : 'unmatched' as const }];
  });
  const denial = model.noKnownAllergies;
  const globalDenial = denial && (allergyDenials(denial.quote).length > 0 || /^(?:none|no|nessun[oa]?|niente|nulla|ไม่มี)[.!]?$/iu.test(denial.quote.trim()));
  return { medications, allergies, noKnownAllergiesEvidence: denial && globalDenial ? evidence(denial) : [] };
}

export function mergePharmacy(session: IntakeSession, next: ReturnType<typeof pharmacyEntries>, previous: IntakeSummary | null) {
  const merge = <T extends { id: string; review?: unknown; generic?: string | null; nameOriginal?: string; allergenOriginal?: string; evidence: MedicationEntry['evidence'] }>(old: T[], fresh: T[]) => {
    const entries = old.filter(m => m.review);
    const spans = (m: T) => m.evidence.flatMap(e => { const name = m.nameOriginal || m.allergenOriginal || ''; const i = e.quote.indexOf(name); return name && i >= 0 ? [{ turnId: e.turnId, start: e.start + i, end: e.start + i + name.length }] : []; });
    const product = (m: T) => medNorm(m.nameOriginal || m.allergenOriginal || '').replace(/(?<!\p{L})\d+(?:\.\d+)?(?:\s*(?:mg|g|ml))?/gu, '').trim();
    const sameMention = (a: T, b: T) => a.id === b.id || (!!product(a) && product(a) === product(b)) || spans(a).some(e => spans(b).some(f => e.turnId === f.turnId && e.start < f.end && f.start < e.end && (a.review || !a.generic || !b.generic || a.generic === b.generic)));
    for (const m of fresh) if (!entries.some(p => sameMention(p, m))) {
      // Keep row/alert identity across repeated mentions, rebuilding all unreviewed content.
      const prior = old.find(p => sameMention(p, m));
      entries.push(prior ? { ...m, id: prior.id } : m);
    }
    return entries;
  };
  const summary = session.summary!;
  summary.medications = merge(previous?.medications || [], next.medications);
  summary.allergies = merge(previous?.allergies || [], next.allergies);
  summary.noKnownAllergiesEvidence = next.noKnownAllergiesEvidence;
  // Shared by mock, real-provider and deterministic escalation paths. Only
  // verified pharmacy entries may supply a missing clinician summary field.
  const field = summary.fields.find(f => f.key === 'medications');
  const supported = summary.medications.filter(m => ['supported', 'discontinued'].includes(m.status) && m.evidence.length);
  if (field?.status === 'missing' && supported.length) {
    const label = (m: MedicationEntry, thai = false) => `${thai ? m.nameOriginal : m.generic || m.nameOriginal}${m.timing ? ` (${m.timing})` : ''}`;
    const value = supported.map(m => label(m)).join(', ');
    Object.assign(field, { valueOriginal: supported.map(m => label(m, true)).join(', '), value: { en: value, it: value, th: `ยาที่แจ้ง: ${supported.map(m => label(m, true)).join(', ')}` }, evidence: supported.flatMap(m => m.evidence), confidence: Math.min(...supported.map(m => m.confidence)), status: 'supported' });
  }
  // Same rule for allergies: the clinician field mirrors supported pharmacy allergy entries (or the verified denial) with the same evidence.
  const allergyField = summary.fields.find(f => f.key === 'allergies');
  const allergic = summary.allergies.filter(x => ['supported', 'verified', 'edited'].includes(x.status) && x.evidence.length);
  if (allergyField?.status === 'missing' && (allergic.length || summary.noKnownAllergiesEvidence.length)) {
    const one = (x: typeof allergic[number]) => `${x.allergenOriginal}${x.reaction ? ` (${x.reaction})` : ''}`;
    const value = allergic.length ? allergic.map(one).join(', ') : 'No known allergies';
    Object.assign(allergyField, { valueOriginal: allergic.length ? value : null, value: { en: value, it: value, th: allergic.length ? `แพ้: ${value}` : 'ไม่มีประวัติแพ้' }, evidence: allergic.length ? allergic.flatMap(x => x.evidence) : summary.noKnownAllergiesEvidence, confidence: 0.9, status: 'supported' });
  }
  refreshMedAlerts(summary, previous?.medAlerts);
  if (summary.medications.length || summary.allergies.length) {
    const changed = JSON.stringify([summary.medications, summary.allergies, summary.medAlerts, summary.noKnownAllergiesEvidence]) !== JSON.stringify([previous?.medications, previous?.allergies, previous?.medAlerts, previous?.noKnownAllergiesEvidence]);
    session.pharmacyStatus = session.pharmacyReviewerId ? changed ? 'in_review' : session.pharmacyStatus || 'in_review' : 'pending';
  }
}
