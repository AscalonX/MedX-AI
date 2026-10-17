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
export interface ConsultTurnReq { speaker: "patient" | "clinician"; text: string; mode: ConsultMode; clientTurnId?: string; inputMode?: "text" | "voice" }
export type ConsultTurnRes = ConsultState;

/** GET /api/sessions/:id/consult?mode=nurse|doctor */
export type GetConsultRes = ConsultState;

/** POST /api/sessions/:id/consult/suggestions/:suggestionId — clinician marks a suggestion. */
export interface ConsultSuggestionReq { reviewerId: string; status: "asked" | "dismissed" }

/** POST /api/sessions/:id/consult/note — regenerate (action "draft") or sign (action "sign", with line edits). */
export interface ConsultNoteReq { reviewerId: string; mode: ConsultMode; action: "draft" | "sign"; edits?: { lineId: string; text: string }[] }
export type ConsultNoteRes = ConsultState;

/** POST /api/sessions/:id/vitals — nurse records a set; returns session with recomputed triage. */
export interface VitalsReq { recordedBy: string; vitals: Omit<import("./types").VitalSigns, "id" | "at" | "recordedBy"> }
/** POST /api/sessions/:id/triage/confirm */
export interface TriageConfirmReq { reviewerId: string; level: 1 | 2 | 3 | 4 | 5; note?: string }

/** POST /api/sessions/:id/orders/medications — create/update a draft; server runs prescribing checks and returns the session. */
export interface MedicationOrderReq { orderedBy: string; orderId?: string; drugText: string; dose: string; route: string; frequency: string; duration?: string }
/** POST /api/sessions/:id/orders/medications/:orderId/submit — 409 unless every high alert has an override reason. */
export interface SubmitOrderReq { orderedBy: string; overrides: { alertId: string; reason: string }[] }
/** POST /api/sessions/:id/orders/medications/:orderId/pharmacy — pharmacist 1 verifies, or returns to the doctor with a note + report.
 * "return" requires note. alertIds must be ids of this order's checks; suggestedGenerics must be dictionary generics
 * (max 5, deduped, not the ordered generic). The report { alertIds, suggestedGenerics } is stored only on "return";
 * suggested generics are options for the prescriber's review, never auto-applied. */
export interface PharmacyOrderActionReq { reviewerId: string; action: "verify" | "return"; note?: string; alertIds?: string[]; suggestedGenerics?: string[] }
/** POST /api/sessions/:id/orders/medications/:orderId/dispense — pharmacist 2 picks the medicine and does the final double check.
 * 409 unless the order is "verified"; 409 when reviewerId is the pharmacist who verified it (a second pharmacist is required);
 * 400 unless every checklist value is true. Sets status "dispensed" + dispense record; audit "order_dispensed". */
export interface DispenseOrderReq { reviewerId: string; checklist: import("./types").DispenseChecklist; note?: string }
/** POST /api/sessions/:id/pickup — call the patient to collect, then record collection.
 * "call": 409 unless at least one non-cancelled medication order exists and every non-cancelled one is "dispensed";
 * may be repeated while "ready" (re-call, audited); not allowed after "collected". Audit "pickup_called".
 * "collected": 409 unless pickup.status is "ready". Audit "pickup_collected".
 * Submitting a medication order while pickup is "ready" removes pickup (patient sees "preparing" again). */
export interface PickupReq { reviewerId: string; action: "call" | "collected"; counter?: string }
/** POST /api/sessions/:id/orders/medications/:orderId/cancel — 409 for verified or dispensed orders. */
export interface CancelOrderReq { orderedBy: string; reason?: string }
/** POST /api/sessions/:id/orders/investigations */
export interface InvestigationOrderReq { orderedBy: string; code: string; reason?: string; fromSuggestionId?: string }

/** GET /api/sessions/:id/trace — the executed case graph (JSON export). Clinician-only; never in the patient view. */
export type GetTraceRes = import("./types").CaseTrace;
