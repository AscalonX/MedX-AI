import { clause, negatedBefore } from './redflags';

// Use the clinical negation window/cues, plus Thai pharmacy verbs' prefixes.
// Thai does not have the Latin word boundaries present in the clinical cues.
const PHARMACY_NEGATION = ['ไม่', 'ไม่ได้', 'ไม่เคย'];
export const stoppedTiming = (timing: string | null) => !!timing && /\b(?:stop(?:ped)?|smesso|interrott\w*)\b|หยุด/i.test(timing);

/** Classify the action attached to one mention, never the whole transcript. */
export function pharmacyContext(text: string, start: number) {
  const before = clause(text.slice(Math.max(0, start - 100), start));
  const base = start - before.length;
  const allergy = [...before.matchAll(/allerg(?:ic\w*|y|ies|ia)\s*(?:to|a(?:ll[ao])?)?\s*|แพ้/ig)].at(-1);
  const taking = [...before.matchAll(/\btake\b|\btaking\b|\bprend\w*|\bassum\w*|\bgave\b|กิน|รับประทาน|ทาน|ใช้|จ่าย|ทา|ต้ม/ig)].at(-1);
  const isAllergy = !!allergy && (!taking || allergy.index! > taking.index!);
  const cue = isAllergy ? allergy : taking;
  // Check at the action as well as at the mention: "never been allergic to"
  // must retain its denial even when the allergen follows a long preposition.
  const denied = (s: string) => negatedBefore(s) || PHARMACY_NEGATION.some(cue => s.trimEnd().endsWith(cue));
  const stopped = [...before.matchAll(/smesso di prendere|stop(?:ped)?(?: taking)?|หยุด(?:กิน)?(?:ยา)?/ig)].at(-1);
  const stopNegated = !!stopped && denied(before.slice(0, stopped.index));
  // A later taking action belongs to the current mention, not the stopped one.
  const localStop = stopped && (!taking || taking.index! < stopped.index! + stopped[0].length);
  return {
    isAllergy,
    negated: stopNegated && localStop ? false : cue ? denied(before.slice(0, cue.index)) || denied(before.slice(cue.index! + cue[0].length)) : denied(before),
    stopped: localStop && !stopNegated ? { text: stopped[0], start: base + stopped.index! } : null,
  };
}

/** A specific denied allergen never means that all allergies were denied. */
export function allergyDenials(text: string) {
  return [...text.matchAll(/\bno (?:known )?allergies(?: at all)?\b(?!\s+(?:to|except)\b)|\bnessuna allergia\b(?!\s+(?:a|alla|al)\b)|\bnon sono allergico a nulla\b|ไม่มีประวัติแพ้(?:ยา)?(?=$|[\s.,;!?]|ค่ะ|ครับ)|ไม่แพ้ยา(?=$|[\s.,;!?]|ค่ะ|ครับ)/ig)];
}
