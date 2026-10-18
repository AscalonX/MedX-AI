import { createHash, randomUUID } from 'node:crypto';
import type { AuditEvent, ExtractedField, IntakeSession, IntakeSummary, Lang, OpsMetrics, RedFlagReviewAction, ReviewAction, SessionStatus } from '@medx/shared';
import { PipelineError } from './errors';
import { auditRechecks, refreshOrders } from './orders';
import { applyRequiredFields, emptyFields, FIELD_KEYS, isPresent, providerInfo } from './config';
import { extract } from './extract';
import type { EngineContext } from './extract';
import type { ModelClient } from './llm';
import { nextQuestion } from './nextQuestion';
import { refreshMedAlerts } from './medrules';
import { checkRedFlags } from './redflags';
import { redFlagScreen } from './redFlagScreen';
import { redact, redactActor } from './redact';
import { appendAudit, getAudit, getSession, getSessions, hasClientTurnId, saveSession, withSessionLock } from './store';
import { words } from './verify';
import { mergePharmacy, mockPharmacy, pharmacyEntries } from './pharmacyExtraction';
import { aliases } from './prompts';
import { quickAnswer } from './quickAnswers';
import { assessTriage } from './triage';
export type { ModelClient } from './llm';
// Sized for Gemma-4-31B-IT on Token Factory (long extractions take 20-40 s); stays under the routes' 60 s maxDuration.
export const TURN_TIMEOUT_MS = 52000;

export { PipelineError };
/** Seeded demo cases get a stable id (same link after every reset): sha256('medx-demo:' + demoCaseId), UUID-shaped. */
export function demoSessionId(demoCaseId: string) {
  const h = createHash('sha256').update(`medx-demo:${demoCaseId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
/**
 * Patient sessions get a random id. `demoCaseId` (seed only) gives the deterministic demo id; `demoStart` marks a
 * per-visitor demo session (random id, counted for the demo-start cap). Neither is ever exposed to the patient view.
 */
export function createSession(patientLang: Lang, opts: { persist?: boolean; now?: () => string; demoCaseId?: string; demoStart?: string } = {}): IntakeSession {
  if (!['th', 'it', 'en'].includes(patientLang)) throw new PipelineError('Invalid patient language', 'bad_request');
  const at = opts.now?.() || new Date().toISOString();
  const used = new Set(opts.persist === false ? [] : getSessions().map(s => s.code));
  let code = '';
  for (let n = 1; n <= used.size + 1; n++) { const candidate = `B-${String(n).padStart(3, '0')}`; if (!used.has(candidate)) { code = candidate; break; } }
  const id = opts.demoCaseId ? demoSessionId(opts.demoCaseId) : randomUUID();
  // A deterministic id must never silently replace an existing record.
  if (opts.persist !== false && opts.demoCaseId && getSession(id)) throw new PipelineError('Demo case already exists', 'bad_request', 409);
  const session: IntakeSession = { id, code, patientLang, status: 'collecting', turns: [], summary: null, createdAt: at, updatedAt: at };
  if (opts.persist !== false) { saveSession(session); appendAudit(session.id, 'session_created', 'patient', { patientLang, ...(opts.demoCaseId ? { demoCaseId: opts.demoCaseId } : {}), ...(opts.demoStart ? { demoStart: opts.demoStart } : {}) }, undefined, at); }
  return session;
}
export interface RunOptions {
  /**
   * Patient speech captured in the consult room (POST /consult/turns, speaker "patient"). Only this skips the
   * "approved" guard: approval ends the patient's own intake, not the visit. Red flags still run first.
   */
  fromConsult?: boolean;
  inputMode?: 'text' | 'voice';
  client?: ModelClient;
  trace?: EngineContext['trace'];
  now?: () => string;
  /** Optional sink; runTurn itself never persists, for reproducible isolated evaluation. */
  audit?: (type: AuditEvent['type'], payload: Record<string, unknown>) => void;
}
type ReviewedField = ExtractedField & { reviewMemory?: { rejectedTurnIds?: string[]; flags?: ('new evidence' | 'conflict')[] } };
function preserveReviewed(previous: ReviewedField[], next: ReviewedField[], audit?: RunOptions['audit']) {
  return next.map(f => {
    const p = previous.find(p => p.key === f.key);
    if (p?.reviewMemory?.rejectedTurnIds) {
      const fresh = f.status === 'supported' && f.evidence.some(e => !p.reviewMemory!.rejectedTurnIds!.includes(e.turnId));
      if (!fresh) return p;
      audit?.('summary_generated', { event: 'field_review_change', key: f.key, note: 'new evidence' });
      return { ...f, reviewMemory: { flags: ['new evidence'] } } as ReviewedField;
    }
    if (p?.status === 'approved' && f.status === 'supported' && f.value?.en.normalize('NFC').trim().toLowerCase() !== p.value?.en.normalize('NFC').trim().toLowerCase() && f.evidence.some(e => !p.evidence.some(old => old.turnId === e.turnId && old.start === e.start && old.end === e.end))) {
      audit?.('summary_generated', { event: 'field_review_change', key: f.key, note: 'conflict' });
      return { ...f, reviewMemory: { flags: ['conflict'] } } as ReviewedField;
    }
    if (p?.reviewMemory?.flags?.length) return { ...(f.status === 'supported' ? f : p), reviewMemory: p.reviewMemory };
    return p && ['edited', 'approved'].includes(p.status) ? p : f;
  });
}
function unsupportedLanguage(text: string, modelLang: string | undefined, lang: Lang) {
  if (modelLang !== 'other') return false;
  const chars = [...text]; const thaiRatio = chars.filter(c => /\p{Script=Thai}/u.test(c)).length / Math.max(chars.length, 1);
  const tokens = words(text.toLowerCase(), lang).map(w => w.segment);
  const stops = new Set(['i', 'the', 'a', 'an', 'my', 'is', 'have', 'and', 'of', 'to', 'in', 'it', 'no', 'for', 'am', 'ho', 'il', 'la', 'di', 'da', 'e', 'un', 'una', 'non', 'sono', 'mi', 'che', 'per']);
  return thaiRatio < 0.2 && tokens.filter(w => stops.has(w)).length < 2 && tokens.length >= 6;
}
export async function runTurn(input: IntakeSession, rawText: string, opts: RunOptions = {}): Promise<IntakeSession> {
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  if (typeof rawText !== 'string' || !rawText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() || rawText.length > 4000) throw new PipelineError('Text must contain 1–4000 characters', 'bad_request');
  if (input.status === 'taken_over' || (input.status === 'approved' && !opts.fromConsult)) throw new PipelineError(input.status === 'taken_over' ? 'A clinician has taken over this session' : 'Session no longer accepts patient turns', 'bad_request', 409);
  // Approved intake + consult speech: new findings are added for review, the approved fields stay approved, and the
  // patient is not asked intake follow-ups. Escalation, abstention and conflicts still change the status below.
  const keepApproved = opts.fromConsult === true && input.status === 'approved';
  if (input.turns.filter(t => t.role === 'patient').length >= 20) throw new PipelineError('Patient turn limit reached', 'bad_request', 409);
  if (opts.inputMode !== undefined && !['text', 'voice'].includes(opts.inputMode)) throw new PipelineError('Invalid inputMode', 'bad_request');
  const session = structuredClone(input);
  const now = opts.now || (() => new Date().toISOString());
  const audit = opts.audit || (() => undefined);
  const raw = rawText.normalize('NFC');
  const turnId = randomUUID();
  // Raw NFC exists only in memory and is checked before any redaction/model call.
  const rawHits = checkRedFlags([...session.turns, { id: turnId, role: 'patient', lang: session.patientLang, text: raw, at: now() }]);
  const redacted = redact(raw);
  const turn = { id: turnId, role: 'patient' as const, lang: session.patientLang, text: redacted.text, at: now(), inputMode: opts.inputMode || 'text' };
  for (const hit of rawHits) hit.evidence = hit.evidence.map(e => {
    if (e.turnId !== turnId) return e;
    const token = [...redacted.text.matchAll(/\[[A-Z]+_\d+\]/g)].find(m => redacted.positions[m.index!].start < e.end && redacted.positions[m.index!].end > e.start);
    if (token) return { turnId, quote: '[redacted]', start: token.index!, end: token.index! + token[0].length };
    const start = redacted.positions.findIndex(p => p.end > e.start);
    let end = start; while (end < redacted.positions.length && redacted.positions[end].start < e.end) end++;
    return { turnId, quote: redacted.text.slice(start, end), start, end };
  });
  session.turns.push(turn); session.updatedAt = now();
  audit('turn_added', { turnId: turn.id, inputMode: turn.inputMode });
  if (redacted.replaced.length) audit('pii_redacted', { turnId: turn.id, replaced: redacted.replaced });
  const previous = session.summary;
  const summary: IntakeSummary = { sessionId: session.id, fields: preserveReviewed(previous?.fields || [], emptyFields()), redFlags: previous?.redFlags || [], nextQuestion: null, abstained: false, modelCalls: [], generatedAt: now() };
  session.summary = summary;
  const addFlags = (hits: IntakeSummary['redFlags']) => { for (const hit of hits) if (!summary.redFlags.some(f => f.ruleId === hit.ruleId)) summary.redFlags.push(hit); };
  const auditSummary = () => audit('summary_generated', { status: session.status, supported: summary.fields.filter(f => f.status === 'supported').length, required: summary.fields.filter(f => f.required).length, autoCaptured: summary.fields.filter(f => f.required && f.status === 'supported').length, modelCalls: summary.modelCalls });
  const escalate = () => { session.status = 'escalated'; summary.nextQuestion = null; summary.generatedAt = now(); auditSummary(); audit('red_flag', { ruleIds: summary.redFlags.map(r => r.ruleId) }); return session; };
  addFlags(checkRedFlags(session.turns));
  addFlags(rawHits);
  if (summary.redFlags.length || input.status === 'escalated') {
    summary.fields = previous?.fields || summary.fields;
    // Safety escalation still makes zero model calls. A narrow dictionary-only
    // pass keeps pharmacy data available for clinician review on this path.
    mergePharmacy(session, pharmacyEntries(mockPharmacy(aliases(session).filter(t => t.role === 'patient')), session), previous);
    return escalate();
  }
  const answeredFields = (previous?.fields || []).filter(isPresent).flatMap(f => f.evidence.filter(e => quickAnswer(f.key, e.quote) && session.turns.some(t => t.id === e.turnId && t.role === 'patient' && t.text.trim() === e.quote)).map(e => ({ turnId: e.turnId, field: f.key })));
  const ctx: EngineContext = { askedField: previous?.nextQuestion?.field, answeredFields, client: opts.client, trace: opts.trace, deadline, modelCalls: summary.modelCalls, log: (event, detail) => { const safe = { ...detail }; delete safe.modelCalls; audit('summary_generated', { event, ...safe }); } };
  const [extracted, modelFlags] = await Promise.all([extract(session, ctx), redFlagScreen(session, ctx)]);
  summary.fields = applyRequiredFields(preserveReviewed(previous?.fields || [], extracted.fields, audit));
  mergePharmacy(session, extracted.pharmacy || { medications: [], allergies: [], noKnownAllergiesEvidence: [] }, previous);
  // Redact model-proposed values too: an untrusted provider cannot reintroduce PII into storage.
  summary.fields = summary.fields.map(f => ({ ...f, value: f.value ? { th: redact(f.value.th).text, it: redact(f.value.it).text, en: redact(f.value.en).text } : null, valueOriginal: f.valueOriginal === null ? null : redact(f.valueOriginal).text }));
  addFlags(checkRedFlags(session.turns, summary.fields));
  addFlags(modelFlags);
  if (summary.redFlags.length) return escalate();
  let reason = extracted.reason as IntakeSummary['abstainReason'];
  const supportedRequired = summary.fields.filter(f => f.required && f.status === 'supported');
  if (!reason && ((extracted.proposed >= 2 && extracted.failed / extracted.proposed >= 0.5) || (supportedRequired.length > 0 && supportedRequired.reduce((n, f) => n + f.confidence, 0) / supportedRequired.length < 0.55) || (session.turns.filter(t => t.role === 'patient').length >= 3 && !summary.fields.some(f => f.key === 'chief_complaint' && isPresent(f))))) reason = 'low_confidence';
  if (!reason && unsupportedLanguage(session.turns.filter(t => t.role === 'patient').map(t => t.text).join(' '), extracted.language, session.patientLang)) reason = 'unsupported_language';
  if (!reason && Date.now() >= ctx.deadline) reason = 'provider_error';
  if (!reason && !keepApproved) {
    summary.nextQuestion = await nextQuestion(session, summary.fields, ctx);
    if (summary.nextQuestion) summary.nextQuestion.text = { th: redact(summary.nextQuestion.text.th).text, it: redact(summary.nextQuestion.text.it).text, en: redact(summary.nextQuestion.text.en).text };
    if (Date.now() >= ctx.deadline) reason = 'provider_error';
  }
  if (reason) {
    summary.abstained = true; summary.abstainReason = reason; summary.nextQuestion = null; session.status = 'needs_human';
    summary.fields = applyRequiredFields(summary.fields.map(f => f.status === 'supported' ? { ...f, status: 'unsupported', confidence: Math.min(0.3, f.confidence) } : f));
    audit('abstained', { reason });
  } else {
    session.status = keepApproved ? 'approved' : summary.nextQuestion ? 'collecting' : 'awaiting_review';
    if ((summary.fields as ReviewedField[]).some(f => f.reviewMemory?.flags?.includes('conflict'))) { session.status = 'awaiting_review'; summary.nextQuestion = null; }
    if (summary.nextQuestion) session.turns.push({ id: randomUUID(), role: 'assistant', lang: session.patientLang, text: redact(summary.nextQuestion.text[session.patientLang]).text, at: now() });
  }
  summary.generatedAt = now(); session.updatedAt = now();
  auditSummary();
  return session;
}
function requireSession(id: string) { const session = getSession(id); if (!session) throw new PipelineError('Session not found', 'not_found'); return session; }
export async function addTurn(sessionId: string, rawText: string, inputMode?: 'text' | 'voice', clientTurnId?: string) {
  return withSessionLock(sessionId, () => addTurnInLock(sessionId, rawText, inputMode, clientTurnId));
}
/** Caller must hold the session lock; shared by intake and ambient consult (`fromConsult`). */
export async function addTurnInLock(sessionId: string, rawText: string, inputMode?: 'text' | 'voice', clientTurnId?: string, opts: { fromConsult?: boolean } = {}) {
  if (clientTurnId !== undefined && (typeof clientTurnId !== 'string' || !clientTurnId.trim() || clientTurnId.length > 200)) throw new PipelineError('Invalid clientTurnId', 'bad_request');
  const current = requireSession(sessionId);
  if (clientTurnId !== undefined && hasClientTurnId(sessionId, clientTurnId)) return current;
  const events: { type: AuditEvent['type']; payload: Record<string, unknown> }[] = [];
  const session = await runTurn(current, rawText, { inputMode, fromConsult: opts.fromConsult, audit: (type, payload) => events.push({ type, payload }) });
  if (session.triage) session.triage = assessTriage(session);
  // New allergies or medicines change prescribing checks; a verified order with a new high alert goes back to pharmacist 1.
  const rechecks = refreshOrders(session);
  saveSession(session, clientTurnId);
  for (const e of events) appendAudit(sessionId, e.type, 'system', e.payload);
  auditRechecks(sessionId, rechecks);
  return session;
}
export async function review(sessionId: string, reviewerId: string, actions: ReviewAction[], redFlagActions: RedFlagReviewAction[] = []) {
  return withSessionLock(sessionId, () => {
    const session = requireSession(sessionId);
    if (typeof reviewerId !== 'string' || !reviewerId.trim() || reviewerId.length > 80 || !Array.isArray(actions) || !Array.isArray(redFlagActions) || (!actions.length && !redFlagActions.length) || actions.length > 24 || redFlagActions.length > 18 || actions.some(a => !a || !FIELD_KEYS.includes(a.fieldKey) || !['approve', 'edit', 'reject'].includes(a.action) || (a.action === 'edit' && (typeof a.newValue !== 'string' || !a.newValue.trim() || a.newValue.length > 300))) || redFlagActions.some(a => !a || typeof a.ruleId !== 'string' || !['acknowledge', 'false_alarm'].includes(a.action) || (a.note !== undefined && (typeof a.note !== 'string' || a.note.length > 2000)) || (a.action === 'false_alarm' && !a.note?.trim()))) throw new PipelineError('Invalid review actions', 'bad_request');
    if (!session.summary) throw new PipelineError('Session has no summary to review', 'bad_request');
    if (redFlagActions.some(a => !session.summary!.redFlags.some(f => f.ruleId === a.ruleId))) throw new PipelineError('Unknown red flag', 'bad_request');
    const unreviewed = session.summary.redFlags.filter(f => !f.review && !redFlagActions.some(a => a.ruleId === f.ruleId));
    if (actions.some(a => a.action === 'approve' || a.action === 'edit') && unreviewed.length) throw new PipelineError(`Cannot approve or edit: red flags require review: ${unreviewed.map(f => f.ruleId).join('; ')}`, 'bad_request', 409);
    for (const action of actions) {
      const f = session.summary.fields.find(f => f.key === action.fieldKey);
      if (!f) throw new PipelineError('Unknown field', 'bad_request');
      if (action.action === 'approve') {
        if (!f.value || !['supported', 'edited', 'approved'].includes(f.status)) throw new PipelineError('Edit unsupported or missing values before approving', 'bad_request');
        f.status = 'approved';
      } else if (action.action === 'edit') {
        const value = redact(action.newValue!.trim()).text;
        f.value = { th: value, it: value, en: value }; f.valueOriginal = value; f.status = 'edited';
      } else { f.status = 'missing'; f.value = null; f.valueOriginal = null; f.evidence = []; f.confidence = 0; (f as ReviewedField).reviewMemory = { rejectedTurnIds: session.turns.filter(t => t.role === 'patient').map(t => t.id) }; }
      if (action.action !== 'reject') delete (f as ReviewedField).reviewMemory;
    }
    session.summary.fields = applyRequiredFields(session.summary.fields);
    const at = new Date().toISOString();
    const actorId = redactActor(reviewerId);
    const safeFlagActions = redFlagActions.map(a => ({ ...a, ...(a.note !== undefined ? { note: redact(a.note.trim()).text } : {}) }));
    for (const action of safeFlagActions) {
      session.summary.redFlags.find(f => f.ruleId === action.ruleId)!.review = { action: action.action, reviewerId: actorId, at, ...(action.note !== undefined ? { note: action.note } : {}) };
    }
    if (session.summary.redFlags.length) { session.summary.nextQuestion = null; if (session.status !== 'taken_over') session.status = 'escalated'; }
    else if (session.status !== 'taken_over') session.status = session.summary.fields.filter(f => f.required).every(f => ['approved', 'edited'].includes(f.status)) ? 'approved' : session.summary.abstained ? 'needs_human' : 'awaiting_review';
    if (session.status === 'approved') session.summary.nextQuestion = null;
    // Edited pregnancy or allergy fields change prescribing checks: refresh the pharmacy alerts and the orders, so a
    // verified order with a new high alert goes back to pharmacist 1 now, not at dispense.
    if (actions.some(a => a.fieldKey === 'pregnancy_status' || a.fieldKey === 'allergies') && (session.summary.medAlerts || session.summary.medications?.length)) refreshMedAlerts(session.summary);
    const rechecks = refreshOrders(session, at);
    session.updatedAt = at; saveSession(session);
    if (actions.length) appendAudit(sessionId, 'review', 'clinician', { actions: actions.map(a => ({ ...a, ...(a.newValue ? { newValue: redact(a.newValue).text } : {}) })) }, actorId, at);
    if (safeFlagActions.length) appendAudit(sessionId, 'red_flag_review', 'clinician', { actions: safeFlagActions }, actorId, at);
    auditRechecks(sessionId, rechecks);
    return session;
  });
}
export async function takeover(sessionId: string, reviewerId: string, reason?: string) {
  return withSessionLock(sessionId, () => {
    if (!reviewerId?.trim() || reviewerId.length > 80 || (reason !== undefined && (typeof reason !== 'string' || reason.length > 2000))) throw new PipelineError('Invalid takeover request', 'bad_request');
    const session = requireSession(sessionId);
    if (session.status === 'approved') throw new PipelineError('Approved session cannot be taken over', 'bad_request', 409);
    session.status = 'taken_over'; session.updatedAt = new Date().toISOString();
    if (session.summary) session.summary.nextQuestion = null;
    saveSession(session); appendAudit(sessionId, 'takeover', 'clinician', { reason: reason ? redact(reason).text : undefined }, redactActor(reviewerId)); return session;
  });
}
export function listSessions() { return getSessions().filter(s => s.turns.some(t => t.role === 'patient')).sort((a, b) => Number(b.status === 'escalated') - Number(a.status === 'escalated') || b.createdAt.localeCompare(a.createdAt)); }
/**
 * "Today" follows the clinic's calendar day (MEDX_TZ, default Asia/Bangkok), not the server's UTC clock, so the ops and
 * landing counts agree with the pharmacy queue and the times staff see. An invalid MEDX_TZ falls back to UTC.
 */
function clinicDay(): (iso: string | undefined) => string {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  let fmt: Intl.DateTimeFormat;
  try { fmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: process.env.MEDX_TZ || 'Asia/Bangkok' }); } catch { fmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'UTC' }); }
  return iso => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? fmt.format(d) : ''; };
}
export function metrics(): OpsMetrics {
  // Ops uses exactly the queue's visibility filter: empty abandoned starts
  // stay addressable by ID, but are excluded from every metric and audit sample.
  const sessions = listSessions(); const visible = new Set(sessions.map(s => s.id));
  const audit = getAudit().filter(e => visible.has(e.sessionId)); const day = clinicDay(); const today = day(new Date().toISOString());
  const byStatus = Object.fromEntries(['collecting', 'escalated', 'awaiting_review', 'needs_human', 'approved', 'taken_over'].map(s => [s, sessions.filter(x => x.status === s).length])) as Record<SessionStatus, number>;
  const summaries = sessions.flatMap(s => s.summary ? [s.summary] : []);
  const generated = sessions.flatMap(s => { const firstReview = audit.findIndex(a => a.sessionId === s.id && a.type === 'review'); const beforeReview = firstReview < 0 ? audit : audit.slice(0, firstReview); const e = beforeReview.filter(a => a.sessionId === s.id && a.type === 'summary_generated' && typeof a.payload.autoCaptured === 'number').at(-1); return e ? [e] : []; });
  const required = generated.reduce((n, e) => n + Number(e.payload.required), 0);
  const calls = audit.filter(e => e.type === 'summary_generated' && !e.payload.event).flatMap(e => Array.isArray(e.payload.modelCalls) ? e.payload.modelCalls as IntakeSummary['modelCalls'] : []);
  const latencies = calls.map(c => c.latencyMs).sort((a, b) => a - b);
  const quantile = (xs: number[], p: number) => xs.length ? xs[Math.max(0, Math.ceil(xs.length * p) - 1)] : null;
  const reviews = sessions.flatMap(s => { const start = audit.find(e => e.sessionId === s.id && e.type === 'summary_generated' && !e.payload.event && e.payload.status === 'awaiting_review'); const end = start && audit.find(e => e.sessionId === s.id && ['review', 'red_flag_review', 'pharmacy_review'].includes(e.type) && Date.parse(e.at) >= Date.parse(start.at)); return start && end ? [Math.max(0, (Date.parse(end.at) - Date.parse(start.at)) / 1000)] : []; }).sort((a, b) => a - b);
  // Pharmacy queue: orders waiting for pharmacist 1 (verify) / pharmacist 2 (dispense); patients at the pickup stage.
  const medOrders = sessions.flatMap(s => s.orders?.medications || []);
  const pharmacy = {
    toVerify: medOrders.filter(o => o.status === 'submitted').length,
    toDispense: medOrders.filter(o => o.status === 'verified').length,
    readyForPickup: sessions.filter(s => s.pickup?.status === 'ready').length,
    collectedToday: sessions.filter(s => s.pickup?.status === 'collected' && day(s.pickup.collectedAt) === today).length,
  };
  return { sessionsToday: sessions.filter(s => day(s.createdAt) === today).length, byStatus, escalations: sessions.filter(s => s.summary?.redFlags.length).length, autoCapturedRate: required ? generated.reduce((n, e) => n + Number(e.payload.autoCaptured), 0) / required : 0, abstainRate: summaries.length ? summaries.filter(s => s.abstained).length / summaries.length : 0, medianReviewSeconds: quantile(reviews, 0.5), modelLatencyMs: { p50: quantile(latencies, 0.5), p95: quantile(latencies, 0.95) }, provider: providerInfo(), pharmacy };
}
