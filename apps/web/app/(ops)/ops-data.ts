import type { ExtractedField, IntakeSession, ModelCall, OpsMetrics, PipelineStep, SessionStatus } from "@medx/shared";

export const statusOrder: SessionStatus[] = ["escalated", "needs_human", "awaiting_review", "collecting", "approved", "taken_over"];
export const stepOrder: PipelineStep[] = ["redact", "red_flags", "extract", "verify", "translate", "next_question"];

export function orderedQueue(sessions: IntakeSession[]) {
  return [...sessions].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
    || (a.status === "escalated" ? Number(isEmergency(b)) - Number(isEmergency(a)) : 0)
    || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.code.localeCompare(b.code));
}

export function isEmergency(session: IntakeSession) {
  return session.status === "escalated" && Boolean(session.summary?.redFlags.some(f => f.severity === "emergency"));
}

export function isModelFlag(flag: { source?: "rule" | "model"; ruleId: string }) {
  return flag.source === "model" || flag.ruleId.startsWith("MODEL-");
}

/** Recheck exact patient evidence before permitting an ink-rendered complaint. */
export function verifiedComplaint(session: IntakeSession): ExtractedField {
  const field = session.summary?.fields.find(f => f.key === "chief_complaint");
  const missing: ExtractedField = { key: "chief_complaint", value: null, valueOriginal: null, evidence: [], confidence: 0, status: "missing", required: true };
  if (!field) return missing;
  const verified = field.evidence.some(e => {
    const turn = session.turns.find(t => t.id === e.turnId && t.role === "patient");
    return turn && e.quote.trim().length > 0 && Number.isInteger(e.start) && Number.isInteger(e.end)
      && e.start >= 0 && e.end > e.start && e.end <= turn.text.length && turn.text.slice(e.start, e.end) === e.quote;
  });
  return verified || field.status === "missing" ? field : { ...field, status: "unsupported" };
}

export function waitingSeconds(session: IntakeSession, now: number): number | null {
  if (session.status === "approved" || session.status === "taken_over") return null;
  return Math.max(0, Math.floor((now - Date.parse(session.createdAt)) / 1000));
}

export type RecordedCall = ModelCall & { sessionId: string; code: string; index: number };
export function recordedCalls(sessions: IntakeSession[]): RecordedCall[] {
  return sessions.flatMap(s => (s.summary?.modelCalls ?? []).map((call, index) => ({ ...call, sessionId: s.id, code: s.code, index })));
}

// A malformed response becomes a visible fetch error; it must never render invented metrics.
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v: unknown) => number(v) && Number.isInteger(v);
const nullableNumber = (v: unknown) => v === null || number(v);
const localized = (v: unknown) => object(v) && ["th", "it", "en"].every(k => text(v[k]));
const evidence = (v: unknown) => Array.isArray(v) && v.every(e => object(e) && text(e.turnId) && text(e.quote) && integer(e.start) && integer(e.end));
const timestamp = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));

export function isSessions(value: unknown): value is IntakeSession[] {
  return Array.isArray(value) && value.every(s => object(s) && text(s.id) && text(s.code)
    && ["th", "it", "en"].includes(String(s.patientLang)) && statusOrder.includes(s.status as SessionStatus)
    && timestamp(s.createdAt) && timestamp(s.updatedAt)
    && Array.isArray(s.turns) && s.turns.every(t => object(t) && text(t.id) && ["patient", "assistant"].includes(String(t.role)) && text(t.text))
    && (s.summary === null || (object(s.summary) && typeof s.summary.abstained === "boolean"
      && Array.isArray(s.summary.fields) && s.summary.fields.every(f => object(f) && text(f.key)
        && ["supported", "unsupported", "missing", "edited", "approved"].includes(String(f.status))
        && (f.value === null || localized(f.value)) && evidence(f.evidence) && number(f.confidence) && f.confidence <= 1)
      && Array.isArray(s.summary.redFlags) && s.summary.redFlags.every(f => object(f) && text(f.ruleId) && localized(f.label)
        && ["emergency", "urgent"].includes(String(f.severity)) && (f.source === undefined || ["rule", "model"].includes(String(f.source)))
        && (f.review === undefined || (object(f.review) && ["acknowledge", "false_alarm"].includes(String(f.review.action)) && text(f.review.reviewerId))))
      && Array.isArray(s.summary.modelCalls) && s.summary.modelCalls.every(c => object(c) && stepOrder.includes(c.step as PipelineStep)
        && ["mock", "amd-tokenfactory"].includes(String(c.provider)) && text(c.model) && number(c.latencyMs) && typeof c.ok === "boolean"))));
}

export function isMetrics(value: unknown): value is OpsMetrics {
  return object(value) && integer(value.sessionsToday) && integer(value.escalations)
    && number(value.autoCapturedRate) && value.autoCapturedRate <= 1 && number(value.abstainRate) && value.abstainRate <= 1
    && object(value.byStatus) && statusOrder.every(k => integer((value.byStatus as Record<string, unknown>)[k]))
    && nullableNumber(value.medianReviewSeconds) && object(value.modelLatencyMs)
    && nullableNumber(value.modelLatencyMs.p50) && nullableNumber(value.modelLatencyMs.p95)
    && object(value.provider) && ["name", "model", "hardware"].every(k => text((value.provider as Record<string, unknown>)[k]));
}
