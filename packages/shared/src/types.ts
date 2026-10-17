// MedX Bridge shared contracts. Owned by the orchestrator: other roles read, never edit.
// Change requests go in docs/reports/<wave>-<role>.md under "open questions".

export type Lang = "th" | "it" | "en";
export const LANGS: Lang[] = ["th", "it", "en"];

/** Text in every UI language. */
export type Localized = Record<Lang, string>;

// ---------- Intake conversation ----------

export interface Turn {
  id: string;
  role: "patient" | "assistant";
  lang: Lang;
  /** Patient text AFTER PII redaction (e.g. "[NAME_1]", "[PHONE_1]"). Raw text is never stored. */
  text: string;
  at: string; // ISO-8601
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
  ruleId: string; // e.g. "RF-CHEST-01"
  label: Localized;
  severity: RedFlagSeverity;
  /** What the clinician should do now. */
  action: Localized;
  /** What the patient sees on their phone. */
  patientMessage: Localized;
  evidence: Evidence[];
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
  redFlags: RedFlagHit[];
  nextQuestion: NextQuestion | null;
  /** True when the pipeline refused to produce a summary; UI shows "needs human review". */
  abstained: boolean;
  abstainReason?: "provider_error" | "schema_error" | "low_confidence" | "unsupported_language";
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
