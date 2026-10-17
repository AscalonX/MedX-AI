// HTTP contract between apps/mobile, apps/web UI and apps/web/app/api. Base path: /api
import type { ConsultMode, ConsultState, AllergyReviewAction, AuditEvent, IntakeSession, Lang, MedAlertReviewAction, MedReviewAction, OpsMetrics, RedFlagReviewAction, ReviewAction } from "./types";

/** POST /api/sessions */
export interface CreateSessionReq { patientLang: Lang }
export type CreateSessionRes = IntakeSession;

/** POST /api/sessions/:id/turns — runs redact → red flags → (stop if escalated) → extract → verify → next question. */
export interface AddTurnReq {
  text: string;
  inputMode?: "text" | "voice";
  /** Client-generated id; the server ignores a repeat of the same id for the same session (idempotent retry). */
  clientTurnId?: string;
}
export type AddTurnRes = IntakeSession;

/** GET /api/sessions — clinician queue + ops, newest first, escalated pinned on top. */
export type ListSessionsRes = IntakeSession[];

/** GET /api/sessions/:id */
export interface GetSessionRes { session: IntakeSession; audit: AuditEvent[] }

/** POST /api/sessions/:id/review */
export interface ReviewReq { reviewerId: string; actions: ReviewAction[]; redFlagActions?: RedFlagReviewAction[] }
export type ReviewRes = IntakeSession;

/** POST /api/sessions/:id/takeover */
export interface TakeoverReq { reviewerId: string; reason?: string }
export type TakeoverRes = IntakeSession;

/** GET /api/metrics */
export type MetricsRes = OpsMetrics;

/** Every error response: HTTP 4xx/5xx with this body. */
export interface ApiError { error: string; code: "bad_request" | "not_found" | "provider_error" | "internal" }

/** POST /api/sessions/:id/pharmacy-review — pharmacist reconciles meds and handles med alerts. Alerts are never deleted. */
export interface PharmacyReviewReq { reviewerId: string; medActions: MedReviewAction[]; alertActions: MedAlertReviewAction[]; allergyActions?: AllergyReviewAction[]; /** true when the pharmacist signs off the list */ complete?: boolean }
export type PharmacyReviewRes = IntakeSession;
/** Audit payload for type "pharmacy_review": { medActions, alertActions, allergyActions, complete } exactly as received (no raw patient text). */

/** POST /api/sessions/:id/consult/turns — one transcribed utterance from the consult room.
 * speaker "patient" goes through redaction → red flags → extraction exactly like a patient turn;
 * speaker "clinician" is redacted and stored for context only (marks matching suggestions "asked"). */
export interface ConsultTurnReq { speaker: "patient" | "clinician"; text: string; mode: ConsultMode; clientTurnId?: string }
export type ConsultTurnRes = ConsultState;

/** GET /api/sessions/:id/consult?mode=nurse|doctor */
export type GetConsultRes = ConsultState;

/** POST /api/sessions/:id/consult/suggestions/:suggestionId — clinician marks a suggestion. */
export interface ConsultSuggestionReq { reviewerId: string; status: "asked" | "dismissed" }

/** POST /api/sessions/:id/consult/note — regenerate (action "draft") or sign (action "sign", with line edits). */
export interface ConsultNoteReq { reviewerId: string; mode: ConsultMode; action: "draft" | "sign"; edits?: { lineId: string; text: string }[] }
export type ConsultNoteRes = ConsultState;
