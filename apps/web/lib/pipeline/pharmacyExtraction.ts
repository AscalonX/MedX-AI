import type { AllergyEntry, IntakeSession, IntakeSummary, MedicationEntry } from '@medx/shared';
import { lookupAllergen, lookupDrug, MEDRULES, medNorm, refreshMedAlerts, stableId } from './medrules';
import type { ModelAllergy, ModelExtraction, ModelMedicine } from './schema';
import { verifyDetailed, words } from './verify';
import { redact } from './redact';

/** Offline demo only: split dictionary mentions first, classify allergy context,
 * then map each entry independently. Never uses fixture IDs or gold answers. */
export function mockPharmacy(turns: { alias: string; text: string }[]): Pick<ModelExtraction, 'medications' | 'allergies' | 'noKnownAllergies'> {
  const medications: ModelMedicine[] = []; const allergies: ModelAllergy[] = [];
  let noKnownAllergies: ModelExtraction['noKnownAllergies'] = null;
  for (const { alias: turn, text } of turns) {
    const safe = text.split(/(?<=[.!?\n])/).filter(s => !/ignore|output|say I|mark this|istruzion|คำสั่ง/i.test(s)).join('');
    const denial = /no (?:known )?allergies(?: at all)?|nessuna allergia|non sono allergico a nulla|ไม่มีประวัติแพ้|ไม่แพ้ยา/ig;
    const negative = [...safe.matchAll(denial)];
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
      const before = safe.slice(Math.max(0, c.start - 100), c.start);
      const allergyCue = [...before.matchAll(/allergic\w*\s*(?:to|a[il]?)?\s*|allergia\s*(?:a)?\s*|แพ้/ig)].at(-1)?.index ?? -1;
      const takingCue = [...before.matchAll(/\btake\b|\btaking\b|\bprend\w*|\bgave\b|กิน|จ่าย|ทา|ต้ม|แต่/ig)].at(-1)?.index ?? -1;
      const isAllergy = allergyCue >= 0 && allergyCue > takingCue && !/[.!?]/.test(before.slice(allergyCue));
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
        const stopped = /(?:smesso di prendere|stopped(?: taking)?|หยุด(?:กิน)?ยา?)/i.exec(before);
        const timing = stopped?.[0] ?? null;
        if (stopped) quote = safe.slice(c.start - before.length + stopped.index, last ? last.index + last.segment.length : quoteEnd).trim().slice(0, 400);
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
    const hit = verifyDetailed(e.quote, session.turns, patients[Number(e.turn.slice(1)) - 1]?.id);
    return hit ? [hit.evidence] : [];
  };
  const safe = (s: string | null) => s === null ? null : redact(s).text;
  const medications: MedicationEntry[] = (model.medications || []).map(m => {
    const ev = evidence(m); const d = lookupDrug(m.nameOriginal);
    // Name must also occur in the verified quote; a real unrelated quote is insufficient.
    const supported = ev.length > 0 && ev[0].quote.includes(m.nameOriginal) && [m.dose, m.frequency, m.timing].every(v => v === null || ev[0].quote.includes(v));
    return { id: stableId('med', [medNorm(m.nameOriginal)]), nameOriginal: safe(m.nameOriginal)!, generic: d?.generic ?? null, drugClass: d?.drugClass ?? null, dose: safe(m.dose), frequency: safe(m.frequency), timing: safe(m.timing), evidence: supported ? ev : [], confidence: supported ? 0.9 : 0, status: !supported ? 'unsupported' : !d || d.generic.endsWith('(unspecified)') ? 'unmatched' : 'supported' };
  });
  const allergies: AllergyEntry[] = (model.allergies || []).map(a => {
    const ev = evidence(a); const d = lookupAllergen(a.allergenOriginal);
    const supported = ev.length > 0 && ev[0].quote.includes(a.allergenOriginal) && (a.reaction === null || ev[0].quote.includes(a.reaction));
    return { id: stableId('allergy', [medNorm(a.allergenOriginal)]), allergenOriginal: safe(a.allergenOriginal)!, allergenClass: d?.allergenClass ?? null, reaction: safe(a.reaction), evidence: supported ? ev : [], status: !supported ? 'unsupported' : d ? 'supported' : 'unmatched' };
  });
  return { medications, allergies, noKnownAllergiesEvidence: model.noKnownAllergies ? evidence(model.noKnownAllergies) : [] };
}

export function mergePharmacy(session: IntakeSession, next: ReturnType<typeof pharmacyEntries>, previous: IntakeSummary | null) {
  const merge = <T extends { id: string; review?: unknown }>(old: T[], fresh: T[]) => {
    const entries = new Map(old.map(m => [m.id, m]));
    for (const m of fresh) { const prev = entries.get(m.id); entries.set(m.id, prev?.review ? prev : m); }
    return [...entries.values()];
  };
  const summary = session.summary!;
  summary.medications = merge(previous?.medications || [], next.medications);
  summary.allergies = merge(previous?.allergies || [], next.allergies);
  summary.noKnownAllergiesEvidence = next.noKnownAllergiesEvidence.length ? next.noKnownAllergiesEvidence : previous?.noKnownAllergiesEvidence || [];
  refreshMedAlerts(summary, previous?.medAlerts);
  if (summary.medications.length || summary.allergies.length) {
    const changed = JSON.stringify([summary.medications, summary.allergies, summary.medAlerts, summary.noKnownAllergiesEvidence]) !== JSON.stringify([previous?.medications, previous?.allergies, previous?.medAlerts, previous?.noKnownAllergiesEvidence]);
    session.pharmacyStatus = session.pharmacyReviewerId ? changed ? 'in_review' : session.pharmacyStatus || 'in_review' : 'pending';
  }
}
