// MedX Bridge shared contracts. Owned by the orchestrator: other roles read, never edit.
// Change requests go in docs/reports/<wave>-<role>.md under "open questions".

export type Lang = "th" | "it" | "en";
export const LANGS: Lang[] = ["th", "it", "en"];

/** Text in every UI language. */
export type Localized = Record<Lang, string>;

// ---------- Intake conversation ----------

export interface Turn {
  id: string;
  /** "clinician" = nurse/doctor speech captured in consult (ambient) mode; never fed to extraction as patient evidence. */
  role: "patient" | "assistant" | "clinician";
  lang: Lang;
  /** Patient text AFTER PII redaction (e.g. "[NAME_1]", "[PHONE_1]"). Raw text is never stored. */
  text: string;
  at: string; // ISO-8601
  /** How the patient gave this answer. "voice" = on-device speech-to-text, confirmed by the patient before sending. */
  inputMode?: "text" | "voice";
}

export type SessionStatus =
  | "collecting" // patient still answering follow-up questions
  | "escalated" // red flag hit: patient told to go to the desk now, clinician alerted
  | "awaiting_review" // summary ready, clinician has not acted
  | "needs_human" // pipeline abstained (model/schema failure, low confidence)
  | "approved" // clinician approved every field
  | "taken_over"; // clinician took over the intake manually

export interface IntakeSession {
  id: string;
  /** Short human code shown on the patient's phone and the clinician queue, e.g. "B-042". */
  code: string;
  patientLang: Lang;
  status: SessionStatus;
  turns: Turn[];
  summary: IntakeSummary | null;
  /** Pharmacist reconciliation state. */
  pharmacyStatus?: "pending" | "in_review" | "reconciled";
  pharmacyReviewerId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Summary produced by the pipeline ----------

/** Final list is set by the clinical spec (docs/clinical/SPEC.md); keys are stable identifiers. */
export type FieldKey =
  | "chief_complaint"
  | "onset"
  | "duration"
  | "severity"
  | "location"
  | "associated_symptoms"
  | "medications"
  | "allergies"
  | "medical_history"
  | "pregnancy_status"
  | "age"
  | "sex";

export interface Evidence {
  turnId: string;
  /** Exact substring of Turn.text in the patient's language. */
  quote: string;
  /** Character offsets of `quote` inside Turn.text, for the highlighter. */
  start: number;
  end: number;
}

export type FieldStatus =
  | "supported" // value backed by at least one verified evidence quote
  | "unsupported" // model produced a value but no quote verifies it: shown as pencil, never as fact
  | "missing" // patient has not said it
  | "edited" // clinician changed the value
  | "approved"; // clinician confirmed the value

export interface ExtractedField {
  key: FieldKey;
  /** Value translated for the clinician (all three languages, so the UI can switch). null when missing. */
  value: Localized | null;
  /** Value in the patient's own words/language. */
  valueOriginal: string | null;
  evidence: Evidence[];
  /** 0..1, calibrated by the pipeline; drives ink density in the UI. */
  confidence: number;
  status: FieldStatus;
  required: boolean;
}

export type RedFlagSeverity = "emergency" | "urgent";

export interface RedFlagHit {
  ruleId: string; // e.g. "RF-CHEST-01"; model-screen hits use "MODEL-<category>"
  /** "rule" = deterministic keyword rule; "model" = add-only Gemma safety screen (needs clinician confirmation). Default "rule". */
  source?: "rule" | "model";
  label: Localized;
  severity: RedFlagSeverity;
  /** What the clinician should do now. */
  action: Localized;
  /** What the patient sees on their phone. */
  patientMessage: Localized;
  evidence: Evidence[];
  /** Set by a clinician (CR-4). A red flag is never deleted, only acknowledged or marked a false alarm. */
  review?: { action: "acknowledge" | "false_alarm"; reviewerId: string; at: string; note?: string };
}

export interface RedFlagReviewAction {
  ruleId: string;
  action: "acknowledge" | "false_alarm";
  note?: string;
}

export interface NextQuestion {
  field: FieldKey;
  /** Asked to the patient in the patient's language (all three kept for display). */
  text: Localized;
}

export type PipelineStep = "redact" | "red_flags" | "extract" | "verify" | "translate" | "next_question";

export interface ModelCall {
  step: PipelineStep;
  provider: "amd-tokenfactory" | "mock";
  model: string; // e.g. "gemma-3-27b-it"
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface IntakeSummary {
  sessionId: string;
  fields: ExtractedField[];
  /** Medication list for the pharmacist view (one entry per medicine the patient mentioned). */
  medications?: MedicationEntry[];
  /** Patient-stated allergens, each with evidence (pharmacist view). */
  allergies?: AllergyEntry[];
  /** Evidence that the patient explicitly said they have no known allergies; absent/empty = not stated. */
  noKnownAllergiesEvidence?: Evidence[];
  /** Deterministic medication-safety alerts (packages/shared/src/medrules.json). Never cleared by a model. */
  medAlerts?: MedAlert[];
  redFlags: RedFlagHit[];
  nextQuestion: NextQuestion | null;
  /** True when the pipeline refused to produce a summary; UI shows "needs human review". */
  abstained: boolean;
  abstainReason?: "provider_error" | "schema_error" | "low_confidence" | "unsupported_language" | "out_of_scope" | "conflicting_information";
  modelCalls: ModelCall[];
  generatedAt: string;
}

// ---------- Clinician review + audit ----------

export interface ReviewAction {
  fieldKey: FieldKey;
  action: "approve" | "edit" | "reject";
  /** Required for "edit"; clinician-language text. */
  newValue?: string;
}

export type AuditType =
  | "session_created"
  | "turn_added"
  | "pii_redacted"
  | "red_flag"
  | "summary_generated"
  | "abstained"
  | "review"
  | "red_flag_review"
  | "pharmacy_review"
  | "consult_turn"
  | "consult_suggestion"
  | "consult_note_signed"
  | "takeover";

export interface AuditEvent {
  id: string;
  sessionId: string;
  at: string;
  actor: "patient" | "system" | "clinician";
  actorId?: string; // reviewer id for clinician actions
  type: AuditType;
  /** Never contains raw (un-redacted) patient text. */
  payload: Record<string, unknown>;
}

// ---------- Ops dashboard ----------

export interface OpsMetrics {
  sessionsToday: number;
  byStatus: Record<SessionStatus, number>;
  escalations: number;
  /** Share of required fields captured as "supported" before a clinician touched them. */
  autoCapturedRate: number;
  abstainRate: number;
  medianReviewSeconds: number | null;
  modelLatencyMs: { p50: number | null; p95: number | null };
  provider: { name: string; model: string; hardware: string };
}

// ---------- Red-flag rule file (packages/shared/src/redflags.json, written by the Doctor) ----------

export interface RedFlagRule {
  id: string; // "RF-CHEST-01"
  severity: RedFlagSeverity;
  label: Localized;
  action: Localized;
  patientMessage: Localized;
  /**
   * AND of ORs: the rule fires when EVERY group has at least one term present in the
   * (lower-cased, whitespace-normalised) patient text. Terms are listed in th, it and en,
   * including colloquial/lay phrasing. Thai terms match as substrings (no word spaces).
   */
  match: string[][];
  /** Optional extra condition on the extracted fields, e.g. { "pregnancy_status": "pregnant" }. Applied only if present. */
  requires?: Partial<Record<FieldKey, string>>;
  /** Guideline / literature reference supporting the rule. */
  source: string;
}

export interface RedFlagRuleFile {
  version: string;
  /** Negation cues in th/it/en; a term preceded by a cue within `negationWindowChars` does not count. */
  negationCues: string[];
  negationWindowChars: number;
  rules: RedFlagRule[];
}

// ---------- Pharmacist view (medication reconciliation) ----------

export type MedStatus =
  | "supported" // name backed by a verified quote and matched to a generic
  | "unmatched" // quoted but not in the drug dictionary: pharmacist must identify it
  | "unsupported" // model produced it, no verified quote: pencil, never fact
  | "verified" // pharmacist confirmed
  | "edited" // pharmacist corrected name/dose
  | "discontinued"; // pharmacist marked not currently taken

export interface MedicationEntry {
  id: string;
  /** As the patient said it, in their language/brand ("Tachipirina", "ยาพารา"). */
  nameOriginal: string;
  /** International generic name from the dictionary, null when unmatched. */
  generic: string | null;
  /** Drug class used by the safety rules, e.g. "nsaid", "penicillin", "ace_inhibitor". */
  drugClass: string | null;
  dose: string | null;
  frequency: string | null;
  /** e.g. "taking now", "stopped last week", as the patient said it. */
  timing: string | null;
  evidence: Evidence[];
  confidence: number;
  status: MedStatus;
  /** Set by the pharmacist; `previous` keeps the struck-through value across reloads. */
  review?: { reviewerId: string; at: string; previous?: { generic: string | null; dose: string | null; frequency: string | null } };
}

export interface AllergyEntry {
  id: string;
  allergenOriginal: string;
  /** Generic or class the allergen maps to ("penicillin", "nsaid"), null when unmatched. */
  allergenClass: string | null;
  reaction: string | null;
  evidence: Evidence[];
  status: "supported" | "unmatched" | "unsupported" | "verified" | "edited";
  review?: { reviewerId: string; at: string; previous?: { allergenClass: string | null; reaction: string | null } };
}

export interface AllergyReviewAction {
  allergyId: string;
  action: "verify" | "edit";
  allergenClass?: string;
  reaction?: string;
}

export type MedAlertKind =
  | "allergy_conflict" // med class matches a stated allergy class
  | "duplicate_therapy" // two meds with the same active ingredient/class
  | "pregnancy_caution" // med flagged for pregnancy and pregnancy_status pregnant/possible
  | "interaction" // listed pairwise interaction
  | "max_dose_risk" // e.g. paracetamol from several products
  | "unknown_medication"; // patient-named medicine not in the dictionary

export interface MedAlert {
  id: string;
  ruleId: string; // "MR-ALLERGY-01"
  kind: MedAlertKind;
  severity: "high" | "moderate";
  message: Localized;
  /** What the pharmacist should check, in clinician language. */
  action: Localized;
  medIds: string[];
  allergyIds: string[];
  evidence: Evidence[];
  source: string; // reference for the rule
  review?: { action: "acknowledge" | "resolved" | "false_alarm"; reviewerId: string; at: string; note?: string };
}

export interface MedReviewAction {
  medId: string;
  action: "verify" | "edit" | "discontinue";
  /** For edit: corrected generic/brand name, dose, frequency (clinician text). */
  generic?: string;
  dose?: string;
  frequency?: string;
}

export interface MedAlertReviewAction {
  alertId: string;
  action: "acknowledge" | "resolved" | "false_alarm";
  note?: string;
}

/** Drug dictionary + rules file (packages/shared/src/medrules.json, written by the Doctor). */
export interface MedRuleFile {
  version: string;
  /** Brand/lay names in th/it/en → generic + class. Matching: lower-case NFC substring, same as red flags. */
  drugs: { generic: string; drugClass: string; names: string[]; pregnancy?: "avoid" | "caution"; maxDailyMg?: number }[];
  /** Allergy terms in th/it/en → class. */
  allergens: { allergenClass: string; names: string[] }[];
  /** Allergy class → drug classes that conflict (e.g. penicillin → [penicillin, aminopenicillin]). */
  allergyConflicts: { allergenClass: string; drugClasses: string[]; ruleId: string; severity: "high" | "moderate"; source: string }[];
  interactions: { a: string; b: string; ruleId: string; severity: "high" | "moderate"; message: Localized; source: string }[];
  messages: Record<MedAlertKind, { message: Localized; action: Localized }>;
}

// ---------- Consult assistant (ambient listening for nurse / doctor) ----------

export type ConsultMode = "nurse" | "doctor";

export type ConsultSuggestionKind =
  | "ask_next" // a question the clinician could ask now (missing required info)
  | "rule_out" // a don't-miss question to rule out a serious cause (from clinical rules)
  | "consider"; // doctor mode only: a condition to consider — decision support, NOT a diagnosis

export interface ConsultSuggestion {
  id: string; // stable across refreshes (kind + ruleId/field + key)
  kind: ConsultSuggestionKind;
  mode: ConsultMode[]; // which modes may show it
  text: Localized; // the question to ask, or "Consider: …"
  why: Localized; // short clinical reason
  /** Patient quotes that triggered it (verified). Empty for generic missing-field prompts. */
  evidence: Evidence[];
  field?: FieldKey;
  ruleId?: string; // consult rule id from packages/shared/src/consultrules.json
  source: "rule" | "model";
  /** 0..1 for model suggestions; rules = 1. */
  confidence: number;
  status: "open" | "asked" | "dismissed" | "answered";
}

export interface ConsultNoteLine {
  id: string;
  section: "presenting_complaint" | "history" | "medications" | "allergies" | "red_flags" | "considerations" | "open_questions";
  text: Localized;
  evidence: Evidence[];
  /** "unsupported" lines are drafts without a verified quote — shown as needs-check, never as fact. */
  status: "supported" | "unsupported" | "edited" | "clinician";
}

export interface ConsultNote {
  lines: ConsultNoteLine[];
  generatedAt: string;
  signed?: { reviewerId: string; at: string };
  disclaimer: Localized; // "Draft for clinician review. Not a diagnosis."
}

export interface ConsultState {
  sessionId: string;
  mode: ConsultMode;
  suggestions: ConsultSuggestion[];
  note: ConsultNote | null;
  modelCalls: ModelCall[];
}

/** packages/shared/src/consultrules.json (Doctor-owned): deterministic don't-miss question bank. */
export interface ConsultRuleFile {
  version: string;
  rules: {
    id: string; // "CR-CHEST-01"
    /** Same AND-of-ORs matching as red flags, on patient speech. */
    match: string[][];
    questions: { id: string; text: Localized; why: Localized; modes: ConsultMode[] }[];
    /** Doctor-mode "consider" items: condition names framed for review, never diagnoses. */
    considerations?: { id: string; text: Localized; why: Localized }[];
    source: string;
  }[];
}
