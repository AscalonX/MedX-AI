import type { ConsultMode, ConsultNote, ConsultNoteLine, ConsultState, ConsultSuggestion, Evidence, Localized } from "@medx/shared";

export interface Line { id: string; speaker: "patient" | "clinician"; text: string; at: string; /** intake question from the system, not the clinician */ system?: boolean; /** how a local line was entered */ input?: "text" | "voice" }

const L = (en: string, th = en, it = en): Localized => ({ en, th, it });

/**
 * Typed sample logic used only while the consult routes are not answering (the UI shows a "fixture" badge).
 * Keyword matching on patient lines: deterministic, no model, evidence quotes are exact substrings.
 */
const RULES: { id: string; re: RegExp; ask: { id: string; text: Localized; why: Localized; kind: "rule_out" | "ask_next" }[]; consider?: { id: string; text: Localized; why: Localized } }[] = [
  {
    id: "CR-CHEST-01", re: /chest|petto|หน้าอก/i,
    ask: [
      { id: "radiation", kind: "rule_out", text: L("Does the pain spread to the arm, jaw or back?", "ความเจ็บร้าวไปที่แขน กราม หรือหลังไหม", "Il dolore si irradia al braccio, alla mascella o alla schiena?"), why: L("Radiation raises concern for a cardiac cause.") },
      { id: "sweat", kind: "rule_out", text: L("Any sweating, nausea or shortness of breath with it?", "มีเหงื่อออก คลื่นไส้ หรือหายใจลำบากร่วมด้วยไหม", "Sudorazione, nausea o mancanza di respiro associati?"), why: L("Associated symptoms change how urgently this is assessed.") },
    ],
    consider: { id: "acs", text: L("Consider: acute coronary syndrome, for clinician review"), why: L("Chest pain with autonomic symptoms is a don't-miss pattern.") },
  },
  {
    id: "CR-HEAD-01", re: /headache|mal di testa|ปวดหัว/i,
    ask: [
      { id: "thunder", kind: "rule_out", text: L("Did it come on suddenly, like the worst headache of your life?", "ปวดขึ้นมาทันทีและรุนแรงที่สุดในชีวิตไหม", "È comparso all'improvviso, il peggior mal di testa della sua vita?"), why: L("Sudden severe onset needs urgent assessment.") },
      { id: "neck", kind: "rule_out", text: L("Any fever, stiff neck or change in vision?", "มีไข้ คอแข็ง หรือการมองเห็นเปลี่ยนไปไหม", "Febbre, rigidità del collo o alterazioni della vista?"), why: L("Possible meningeal or neurological features.") },
    ],
    consider: { id: "sah", text: L("Consider: serious intracranial cause, for clinician review"), why: L("Only if onset was sudden or neurological signs are present.") },
  },
];
const MISSING: { field: ConsultSuggestion["field"]; id: string; has: RegExp; text: Localized; why: Localized }[] = [
  { field: "onset", id: "onset", has: /since|ago|yesterday|today|days?|hours?|morning|week|ieri|oggi|เมื่อ|วัน/i, text: L("When did this start?", "เริ่มมีอาการเมื่อไหร่", "Quando è iniziato?"), why: L("Onset is required to triage.") },
  { field: "severity", id: "severity", has: /\d\s*(?:\/|out of|su)\s*10|mild|severe|moderate|worst|strong/i, text: L("How strong is it, from 0 to 10?", "ความรุนแรงระดับ 0 ถึง 10 เท่าไหร่", "Quanto è forte da 0 a 10?"), why: L("Severity is required to triage.") },
  { field: "allergies", id: "allergies", has: /allerg/i, text: L("Any allergies to medicines?", "แพ้ยาหรือไม่", "Allergie a farmaci?"), why: L("Needed before any medicine is given.") },
  { field: "medications", id: "meds", has: /medic|tablet|pill|taking|farmac|ยา/i, text: L("Which medicines do you take, including blood thinners?", "ใช้ยาอะไรอยู่บ้าง รวมถึงยาละลายลิ่มเลือด", "Quali farmaci prende, anche anticoagulanti?"), why: L("Some medicines change risk and management.") },
];

export function buildFixture(mode: ConsultMode, lines: Line[], status: Record<string, ConsultSuggestion["status"]>, sessionId: string): ConsultState {
  const patient = lines.filter((l) => l.speaker === "patient");
  const all = patient.map((l) => l.text).join(" ");
  const quoteOf = (re: RegExp): Evidence[] => {
    for (const l of patient) {
      const m = re.exec(l.text);
      if (m) return [{ turnId: l.id, quote: m[0], start: m.index, end: m.index + m[0].length }];
    }
    return [];
  };
  const out: ConsultSuggestion[] = [];
  const mk = (s: Omit<ConsultSuggestion, "status" | "confidence" | "mode">, modes: ConsultMode[], source: "rule" | "model" = "rule") => {
    out.push({ ...s, mode: modes, source, confidence: 1, status: status[s.id] ?? "open" });
  };
  for (const r of RULES) {
    if (!r.re.test(all)) continue;
    for (const a of r.ask) mk({ id: `${a.kind}:${r.id}:${a.id}`, kind: a.kind, text: a.text, why: a.why, evidence: quoteOf(r.re), ruleId: r.id, source: "rule" }, ["nurse", "doctor"]);
    if (r.consider) mk({ id: `consider:${r.id}:${r.consider.id}`, kind: "consider", text: r.consider.text, why: r.consider.why, evidence: quoteOf(r.re), ruleId: r.id, source: "model" }, ["doctor"], "model");
  }
  if (patient.length) {
    for (const m of MISSING) if (!m.has.test(all)) mk({ id: `ask_next:${m.id}`, kind: "ask_next", text: m.text, why: m.why, evidence: [], field: m.field, source: "rule" }, ["nurse", "doctor"]);
  }
  const suggestions = out.filter((s) => s.mode.includes(mode));

  const first = patient[0];
  const noteLines: ConsultNoteLine[] = [];
  const add = (section: ConsultNoteLine["section"], text: Localized, evidence: Evidence[], st: ConsultNoteLine["status"] = evidence.length ? "supported" : "unsupported") =>
    noteLines.push({ id: `${section}-${noteLines.length}`, section, text, evidence, status: st });
  if (first) add("presenting_complaint", L(first.text), [{ turnId: first.id, quote: first.text, start: 0, end: first.text.length }]);
  const al = quoteOf(/[^.]*allerg[^.]*/i);
  if (al.length) add("allergies", L(al[0].quote.trim()), al);
  const me = quoteOf(/[^.]*(?:medic|taking|tablet)[^.]*/i);
  if (me.length) add("medications", L(me[0].quote.trim()), me);
  if (mode === "doctor") {
    for (const s of suggestions.filter((x) => x.kind === "consider")) add("considerations", s.text, s.evidence, "unsupported");
  }
  for (const s of suggestions.filter((x) => x.kind !== "consider" && x.status === "open").slice(0, 4)) add("open_questions", s.text, [], "unsupported");
  const note: ConsultNote | null = patient.length
    ? { lines: noteLines, generatedAt: new Date().toISOString(), disclaimer: L("Draft for clinician review. Not a diagnosis.", "ร่างเพื่อให้บุคลากรตรวจสอบ ไม่ใช่การวินิจฉัย", "Bozza per revisione del clinico. Non è una diagnosi.") }
    : null;
  return { sessionId, mode, suggestions, note: mode === "doctor" ? note : null, modelCalls: [] };
}
