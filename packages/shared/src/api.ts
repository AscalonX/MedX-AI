// HTTP contract between apps/mobile, apps/web UI and apps/web/app/api. Base path: /api
import type { AllergyReviewAction, AuditEvent, IntakeSession, Lang, MedAlertReviewAction, MedReviewAction, OpsMetrics, RedFlagReviewAction, ReviewAction } from "./types";

/** POST /api/sessions */
export interface CreateSessionReq { patientLang: Lang }
export type CreateSessionRes = IntakeSession;

/** POST /api/sessions/:id/turns — runs redact → red flags → (stop if escalated) → extract → verify → next question. */
export interface AddTurnReq { text: string; inputMode?: "text" | "voice" }
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
