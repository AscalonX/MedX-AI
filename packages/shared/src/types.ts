// MedX shared contracts. Owned by the orchestrator: other roles read, never edit.
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
  /** Nurse-recorded vital signs, newest last. */
  vitals?: VitalSigns[];
  /** Deterministic triage suggestion; only `confirmed` is the clinical decision. */
  triage?: TriageAssessment;
  /** Doctor orders (medications + investigations). */
  orders?: { medications: MedicationOrder[]; investigations: InvestigationOrder[] };
  pharmacyReviewerId?: string;
  /** Medicine pickup: set when a pharmacist calls the patient after every active medication order is dispensed. */
  pickup?: PickupState;
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
  | "vitals_recorded"
  | "triage_confirmed"
  | "order_drafted"
  | "order_submitted"
  | "order_pharmacy_action"
  | "order_cancelled"
  | "order_dispensed"
  | "pickup_called"
  | "pickup_collected"
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
  /** Pharmacy queue: medication orders to verify (submitted) / dispense (verified); patients ready for pickup / collected today. */
  pharmacy?: { toVerify: number; toDispense: number; readyForPickup: number; collectedToday: number };
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
  | "dose_range" // prescribed dose outside the dictionary's single/daily range
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
  /**
   * Generics from the curated medrules "alternatives" table that ALSO pass this patient's deterministic
   * checks (allergy, interaction, duplicate therapy, pregnancy). Options for prescriber review, never
   * auto-applied and never a prescription. Omitted when none.
   */
  alternatives?: string[];
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
  drugs: { generic: string; drugClass: string; names: string[]; pregnancy?: "avoid" | "caution"; maxDailyMg?: number; doseRange?: { maxSingleMg?: number; maxDailyMg?: number } }[];
  /** Allergy terms in th/it/en → class. */
  allergens: { allergenClass: string; names: string[] }[];
  /** Allergy class → drug classes that conflict (e.g. penicillin → [penicillin, aminopenicillin]). */
  allergyConflicts: { allergenClass: string; drugClasses: string[]; ruleId: string; severity: "high" | "moderate"; source: string }[];
  interactions: { a: string; b: string; ruleId: string; severity: "high" | "moderate"; message: Localized; source: string }[];
  messages: Record<MedAlertKind, { message: Localized; action: Localized }>;
  doseRangeSource?: string;
  /**
   * Curated options a prescriber may review when an alert fires. When an alert whose kind is in `kinds`
   * fires for an ordered drug whose drugClass is in `drugClasses`, `consider` lists generics (each must
   * exist in drugs[]). The engine drops any option that fails this patient's own checks.
   */
  alternatives?: { id: string; kinds: MedAlertKind[]; drugClasses: string[]; consider: string[]; note: Localized; source: string }[];
}

// ---------- Consult assistant (ambient listening for nurse / doctor) ----------

export type ConsultMode = "nurse" | "doctor";

export type ConsultSuggestionKind =
  | "ask_next" // a question the clinician could ask now (missing required info)
  | "rule_out" // a don't-miss question to rule out a serious cause (from clinical rules)
  | "consider"; // doctor mode only: a condition to consider — decision support, NOT a diagnosis

export interface ConsultSuggestion {
  id: string; // stable across refreshes (kind + ruleId/field + key)
  /** "consider" items: investigations worth considering (from consultrules.json) — doctor chooses. */
  workup?: { id: string; label: Localized }[];
  /** "consider" items: guideline to read — never a drug or dose. */
  guideline?: { title: string; url: string };
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
    considerations?: { id: string; text: Localized; why: Localized; workup?: string[]; guideline?: { title: string; url: string } }[];
    source: string;
  }[];
}

// ---------- Vitals + triage (nurse) ----------

export type Consciousness = "alert" | "voice" | "pain" | "unresponsive" | "new_confusion";

export interface VitalSigns {
  id: string;
  at: string;
  recordedBy: string;
  heartRate?: number; // bpm
  systolicBP?: number; // mmHg
  diastolicBP?: number;
  respRate?: number; // /min
  tempC?: number;
  spo2?: number; // %
  onOxygen?: boolean;
  painScore?: number; // 0-10
  consciousness?: Consciousness;
}

export interface VitalAlert {
  id: string;
  ruleId: string; // vitalrules.json
  vital: keyof VitalSigns;
  severity: "high" | "moderate";
  message: Localized;
}

export interface TriageAssessment {
  /** Suggested level 1 (most urgent) … 5, from red flags + vitals rules (vitalrules.json). */
  suggestedLevel: 1 | 2 | 3 | 4 | 5;
  reasons: Localized[];
  /** Early-warning style aggregate score from vitals, when computable. */
  warningScore?: number;
  vitalAlerts: VitalAlert[];
  confirmed?: { level: 1 | 2 | 3 | 4 | 5; by: string; at: string; note?: string };
}

/** packages/shared/src/vitalrules.json (Doctor-owned). */
export interface VitalRuleFile {
  version: string;
  /** Per-vital bands → score points and optional alert (NEWS2-style). */
  bands: { vital: string; min?: number; max?: number; /** exact match for categorical vitals (onOxygen, consciousness) */ equals?: string | boolean; points: number; alert?: { ruleId: string; severity: "high" | "moderate"; message: Localized } }[];
  /** Score / red-flag → suggested triage level mapping, first match wins. */
  levels: { level: 1 | 2 | 3 | 4 | 5; when: { anyEmergencyRedFlag?: boolean; anyUrgentRedFlag?: boolean; minScore?: number; anySingleBandPoints?: number; /** vitals set missing required values: never suggest a reassuring level */ incompleteVitals?: boolean }; reason: Localized }[];
  source: string;
}

// ---------- Orders (doctor) + prescription checks (pharmacy) ----------

/** draft → submitted → verified (pharmacist 1) → dispensed (pharmacist 2); "returned" goes back to the prescriber. */
export type OrderStatus = "draft" | "submitted" | "verified" | "returned" | "dispensed" | "cancelled";

/** Sent back to the prescriber with a "return". Alternatives are options for the prescriber's review, never auto-applied. */
export interface PharmacistReport {
  /** Ids of this order's checks the pharmacist is flagging. */
  alertIds: string[];
  /** Dictionary generics the prescriber may consider instead (max 5). */
  suggestedGenerics: string[];
}

/** Second-pharmacist final check before handing medicine to the patient. Every item must be true. */
export interface DispenseChecklist {
  rightPatient: boolean;
  rightDrug: boolean;
  rightDose: boolean;
  rightRoute: boolean;
  allergyRechecked: boolean;
  labelled: boolean;
}

/** Patient is called to the pharmacy counter once every active medication order is dispensed. */
export interface PickupState {
  status: "ready" | "collected";
  /** Counter / window the patient is called to, e.g. "2". */
  counter?: string;
  calledBy: string;
  calledAt: string;
  collectedBy?: string;
  collectedAt?: string;
}

export interface MedicationOrder {
  id: string;
  /** Doctor's entry as typed; matched to the drug dictionary. */
  drugText: string;
  generic: string | null;
  drugClass: string | null;
  dose: string; // e.g. "500 mg"
  doseMg?: number;
  route: string; // "oral"
  frequency: string; // "every 6 hours"
  timesPerDay?: number;
  duration?: string;
  orderedBy: string;
  at: string;
  status: OrderStatus;
  /** Prescribing alerts against allergies, current meds, other new orders, pregnancy, dose limits. Deterministic. */
  checks: MedAlert[];
  /** Doctor's documented reason for proceeding despite an alert (required for high alerts). */
  overrides: { alertId: string; reason: string; by: string; at: string }[];
  /** Pharmacist 1 (prescription check). `report` is stored only on "return". */
  pharmacist?: { action: "verify" | "return"; by: string; at: string; note?: string; report?: PharmacistReport };
  /** Pharmacist 2 (pick + final double check); must be a different person from `pharmacist.by`. */
  dispense?: { by: string; at: string; checklist: DispenseChecklist; note?: string };
}

export interface InvestigationOrder {
  id: string;
  code: string; // catalog id from packages/shared/src/investigations.json
  label: Localized;
  category: "lab" | "imaging" | "ecg" | "other";
  reason?: string;
  /** Set when the order came from a consult "consider" suggestion. */
  fromSuggestionId?: string;
  orderedBy: string;
  at: string;
  status: OrderStatus;
}

/** packages/shared/src/investigations.json (Doctor-owned) catalog. */
export interface InvestigationCatalog { version: string; items: { id: string; category: "lab" | "imaging" | "ecg" | "other"; label: Localized }[] }

// ---------- Case trace (executed per-case graph; derived from audit + summary, never changes clinical logic) ----------

export type TraceNodeKind =
  | "input" // a patient / clinician turn
  | "redact"
  | "red_flag_rules"
  | "model_screen"
  | "extract"
  | "verify"
  | "abstain"
  | "next_question"
  | "consult_rules"
  | "vitals_news2"
  | "triage_confirm"
  | "med_rules"
  | "order_check"
  | "clinician_action" // review, sign, override, takeover
  | "pharmacist_action"
  | "output"; // summary / note / escalation shown to a human

export interface TraceNode {
  id: string;
  kind: TraceNodeKind;
  label: Localized;
  at: string;
  /** "rule" deterministic code, "model" Gemma call, "human" clinician/patient action. */
  actor: "rule" | "model" | "human" | "system";
  status: "ok" | "skipped" | "failed" | "escalated" | "abstained";
  /** Short, PII-free description of what happened (e.g. "RF-CHEST-01 fired", "3 fields verified, 1 unsupported"). */
  detail: Localized;
  evidence: Evidence[];
  latencyMs?: number;
  /** Audit event ids this node was derived from (for replay/inspection). */
  auditIds: string[];
}

export interface TraceEdge { from: string; to: string; label?: string }

export interface CaseTrace {
  sessionId: string;
  version: "1";
  generatedAt: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  /** Hash of the audit events used, so a re-derivation can be compared (deterministic replay check). */
  auditDigest: string;
}
