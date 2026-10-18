// HTTP contract between apps/mobile, apps/web UI and apps/web/app/api. Base path: /api
import type { ConsultMode, ConsultState, AllergyReviewAction, AuditEvent, IntakeSession, Lang, Localized, MedAlertReviewAction, MedReviewAction, OpsMetrics, RedFlagReviewAction, RedFlagSeverity, ReviewAction, SessionStatus } from "./types";
import type { JourneyStage } from "./journey";
import type { DemoPersonaId } from "./demo";

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

/** One row of GET /api/sessions: the session plus its server-derived journey stage (shared journeyStage with the consult record). */
export type SessionListItem = IntakeSession & { stage?: JourneyStage };
/** GET /api/sessions — clinician queue + ops, newest first, escalated pinned on top. */
export type ListSessionsRes = SessionListItem[];

/**
 * Patient projection: GET /api/sessions/:id?view=patient (as { session }) and POST /turns with x-medx-client: patient.
 * Explicit allowlist; never clinician state, audit, drug names, staff ids or notes.
 */
export interface PatientSessionView {
  id: string; code: string; patientLang: Lang; status: SessionStatus;
  turns: { id: string; role: "patient"; lang: Lang; text: string; at: string; inputMode?: "text" | "voice" }[];
  summary: null | { nextQuestion: { field: string; text: Localized } | null; redFlags: { patientMessage: Localized; severity: RedFlagSeverity }[]; abstained: boolean };
  /** null until a prescription reaches the pharmacy. */
  pickup: { status: "preparing" | "ready" | "collected"; counter?: string } | null;
  /** true once staff acted on the case: intake approved or taken over, triage confirmed, or a consult note signed. Older servers omit it. */
  seenByStaff?: boolean;
}

/** GET /api/demo/cases — 404 unless DEMO_SEED=1. The seeded synthetic case for each DEMO_PERSONAS id; null until the seed has run. */
export type DemoCasesRes = Record<DemoPersonaId, { id: string; code: string; status: SessionStatus; stage: JourneyStage } | null>;
/**
 * POST /api/demo/start — a fresh synthetic golden case (data/cases/DEMO-GOLD.json) for one visitor, built through the
 * real pipeline up to `stage` (red flags first, deterministic checks, two-person dispense). 404 unless DEMO_SEED=1;
 * 429 at the demo-start cap (150 sessions) or the per-client rate limit (in memory, per server instance).
 * For "pharmacy_dispense" the order is verified by Pharmacist Laura Conti, so Pharmacist Nattaya Wong can dispense.
 */
export interface DemoStartReq { stage: JourneyStage }
export interface DemoStartRes { id: string; code: string }

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
/** Safety (every order write and patient turn): when refreshed prescribing checks raise a high alert with no prescriber
 * override on a "verified" order, the engine sets it back to "submitted" with `recheck` ("Re-check needed"), moves the
 * pharmacist record to `pharmacistHistory` and audits "order_recheck" (actor system). A dispense attempt on such an
 * order returns 409 after the re-check is saved. Pharmacist 1 must then return it to the prescriber, because a verify
 * still needs an override reason for every high alert. */
export type OrderRecheckAudit = { orderId: string; reason: "new_high_alert"; alertIds: string[]; ruleIds: string[]; previousPharmacist?: string; message: string };
/** Role enforcement on clinical writes: see WRITE_ROLES in ./staff. A STAFF member (matched by name or id) with another
 * role gets 403 { code: "bad_request" }. Actors not in STAFF are allowed unless MEDX_STRICT_ROLES=1. */
/** POST /api/sessions/:id/pickup — call the patient to collect, then record collection. Pharmacists only (403 for other staff).
 * "call": 409 while any medication order is "submitted", "returned" or "verified" (drafts do not block), and 409 unless at
 * least one "dispensed" order has not been collected yet; may be repeated while "ready" (re-call, audited); 409 after
 * "collected" until a new order is submitted. Audit "pickup_called" (orderIds = the dispensed orders in this cycle).
 * "collected": 409 unless pickup.status is "ready". Audit "pickup_collected".
 * Submitting a medication order while pickup is "ready" or "collected" removes pickup (audit order_submitted
 * pickupReset: true): the patient sees "preparing" again and a new pickup cycle starts. */
export interface PickupReq { reviewerId: string; action: "call" | "collected"; counter?: string }
/** POST /api/sessions/:id/orders/medications/:orderId/cancel — 409 for verified or dispensed orders. */
export interface CancelOrderReq { orderedBy: string; reason?: string }
/** POST /api/sessions/:id/orders/investigations */
export interface InvestigationOrderReq { orderedBy: string; code: string; reason?: string; fromSuggestionId?: string }

/** GET /api/sessions/:id/trace — the executed case graph (JSON export). Clinician-only; never in the patient view. */
export type GetTraceRes = import("./types").CaseTrace;
