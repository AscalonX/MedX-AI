import { randomUUID } from 'node:crypto';
import type { AuditEvent, ExtractedField, IntakeSession, IntakeSummary, Lang, OpsMetrics, ReviewAction, SessionStatus } from '@medx/shared';
import { emptyFields, FIELD_KEYS, isPresent, providerInfo } from './config';
import { extract } from './extract';
import type { EngineContext } from './extract';
import type { ModelClient } from './llm';
import { nextQuestion } from './nextQuestion';
import { checkRedFlags } from './redflags';
import { redact } from './redact';
import { appendAudit, getAudit, getSession, getSessions, saveSession, withSessionLock } from './store';
import { words } from './verify';
export type { ModelClient } from './llm';

export class PipelineError extends Error {
  constructor(message: string, public code: 'bad_request' | 'not_found') { super(message); }
}
export function createSession(patientLang: Lang, opts: { persist?: boolean; now?: () => string } = {}): IntakeSession {
  if (!['th', 'it', 'en'].includes(patientLang)) throw new PipelineError('Invalid patient language', 'bad_request');
  const at = opts.now?.() || new Date().toISOString();
  const used = new Set(opts.persist === false ? [] : getSessions().map(s => s.code));
  let code = '';
  for (let n = 1; n <= 1000; n++) { const candidate = `B-${String(n % 1000).padStart(3, '0')}`; if (!used.has(candidate)) { code = candidate; break; } }
  if (!code) throw new PipelineError('Session code capacity reached', 'bad_request');
  const session: IntakeSession = { id: randomUUID(), code, patientLang, status: 'collecting', turns: [], summary: null, createdAt: at, updatedAt: at };
  if (opts.persist !== false) { saveSession(session); appendAudit(session.id, 'session_created', 'patient', { patientLang }, undefined, at); }
  return session;
}
export interface RunOptions {
  client?: ModelClient;
  trace?: EngineContext['trace'];
  now?: () => string;
  /** Optional sink; runTurn itself never persists, for reproducible isolated evaluation. */
  audit?: (type: AuditEvent['type'], payload: Record<string, unknown>) => void;
}
function preserveReviewed(previous: ExtractedField[], next: ExtractedField[]) {
  return next.map(f => previous.find(p => p.key === f.key && ['edited', 'approved'].includes(p.status)) || f);
}
function unsupportedLanguage(text: string, modelLang: string | undefined, lang: Lang) {
  if (modelLang !== 'other') return false;
  const chars = [...text]; const thaiRatio = chars.filter(c => /\p{Script=Thai}/u.test(c)).length / Math.max(chars.length, 1);
  const tokens = words(text.toLowerCase(), lang).map(w => w.segment);
  const stops = new Set(['i', 'the', 'a', 'an', 'my', 'is', 'have', 'and', 'of', 'to', 'in', 'it', 'no', 'for', 'am', 'ho', 'il', 'la', 'di', 'da', 'e', 'un', 'una', 'non', 'sono', 'mi', 'che', 'per']);
  return thaiRatio < 0.2 && tokens.filter(w => stops.has(w)).length < 2 && tokens.length >= 6;
}
export async function runTurn(input: IntakeSession, rawText: string, opts: RunOptions = {}): Promise<IntakeSession> {
  const deadline = Date.now() + 40000;
  if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 12000) throw new PipelineError('Text must contain 1–12000 characters', 'bad_request');
  if (input.status === 'taken_over') throw new PipelineError('A clinician has taken over this session', 'bad_request');
  const session = structuredClone(input);
  const now = opts.now || (() => new Date().toISOString());
  const audit = opts.audit || (() => undefined);
  const redacted = redact(rawText);
  const turn = { id: randomUUID(), role: 'patient' as const, lang: session.patientLang, text: redacted.text, at: now() };
  session.turns.push(turn); session.updatedAt = now();
  audit('turn_added', { turnId: turn.id });
  if (redacted.replaced.length) audit('pii_redacted', { turnId: turn.id, replaced: redacted.replaced });
  const previous = session.summary;
  const summary: IntakeSummary = { sessionId: session.id, fields: preserveReviewed(previous?.fields || [], emptyFields()), redFlags: previous?.redFlags || [], nextQuestion: null, abstained: false, modelCalls: [], generatedAt: now() };
  session.summary = summary;
  const addFlags = (hits: IntakeSummary['redFlags']) => { for (const hit of hits) if (!summary.redFlags.some(f => f.ruleId === hit.ruleId)) summary.redFlags.push(hit); };
  const escalate = () => { session.status = 'escalated'; summary.nextQuestion = null; audit('red_flag', { ruleIds: summary.redFlags.map(r => r.ruleId) }); return session; };
  addFlags(checkRedFlags(session.turns));
  if (summary.redFlags.length || input.status === 'escalated') return escalate();
  const ctx: EngineContext = { client: opts.client, trace: opts.trace, deadline, modelCalls: summary.modelCalls, log: (event, detail) => audit('summary_generated', { event, ...detail }) };
  const extracted = await extract(session, ctx);
  summary.fields = preserveReviewed(previous?.fields || [], extracted.fields);
  // Redact model-proposed values too: an untrusted provider cannot reintroduce PII into storage.
  summary.fields = summary.fields.map(f => ({ ...f, value: f.value ? { th: redact(f.value.th).text, it: redact(f.value.it).text, en: redact(f.value.en).text } : null, valueOriginal: f.valueOriginal === null ? null : redact(f.valueOriginal).text }));
  addFlags(checkRedFlags(session.turns, summary.fields));
  if (summary.redFlags.length) return escalate();
  let reason = extracted.reason as IntakeSummary['abstainReason'];
  const supportedRequired = summary.fields.filter(f => f.required && f.status === 'supported');
  if (!reason && ((extracted.proposed >= 2 && extracted.failed / extracted.proposed >= 0.5) || (supportedRequired.length > 0 && supportedRequired.reduce((n, f) => n + f.confidence, 0) / supportedRequired.length < 0.55) || (session.turns.filter(t => t.role === 'patient').length >= 3 && !summary.fields.some(f => f.key === 'chief_complaint' && isPresent(f))))) reason = 'low_confidence';
  if (!reason && unsupportedLanguage(session.turns.filter(t => t.role === 'patient').map(t => t.text).join(' '), extracted.language, session.patientLang)) reason = 'unsupported_language';
  if (!reason && Date.now() >= ctx.deadline) reason = 'provider_error';
  if (!reason) {
    summary.nextQuestion = await nextQuestion(session, summary.fields, ctx);
    if (summary.nextQuestion) summary.nextQuestion.text = { th: redact(summary.nextQuestion.text.th).text, it: redact(summary.nextQuestion.text.it).text, en: redact(summary.nextQuestion.text.en).text };
    if (Date.now() >= ctx.deadline) reason = 'provider_error';
  }
  if (reason) {
    summary.abstained = true; summary.abstainReason = reason; summary.nextQuestion = null; session.status = 'needs_human';
    summary.fields = summary.fields.map(f => f.status === 'supported' ? { ...f, status: 'unsupported', confidence: Math.min(0.3, f.confidence) } : f);
    audit('abstained', { reason });
  } else {
    session.status = summary.nextQuestion ? 'collecting' : 'awaiting_review';
    if (summary.nextQuestion) session.turns.push({ id: randomUUID(), role: 'assistant', lang: session.patientLang, text: redact(summary.nextQuestion.text[session.patientLang]).text, at: now() });
  }
  summary.generatedAt = now(); session.updatedAt = now();
  audit('summary_generated', { status: session.status, supported: summary.fields.filter(f => f.status === 'supported').length, required: summary.fields.filter(f => f.required).length, autoCaptured: summary.fields.filter(f => f.required && f.status === 'supported').length, modelCalls: summary.modelCalls });
  return session;
}
function requireSession(id: string) { const session = getSession(id); if (!session) throw new PipelineError('Session not found', 'not_found'); return session; }
export async function addTurn(sessionId: string, rawText: string) {
  return withSessionLock(sessionId, async () => {
    const events: { type: AuditEvent['type']; payload: Record<string, unknown> }[] = [];
    const session = await runTurn(requireSession(sessionId), rawText, { audit: (type, payload) => events.push({ type, payload }) });
    saveSession(session);
    for (const e of events) appendAudit(sessionId, e.type, 'system', e.payload);
    return session;
  });
}
export async function review(sessionId: string, reviewerId: string, actions: ReviewAction[]) {
  return withSessionLock(sessionId, () => {
    const session = requireSession(sessionId);
    if (!reviewerId?.trim() || reviewerId.length > 200 || !Array.isArray(actions) || !actions.length || actions.some(a => !a || !FIELD_KEYS.includes(a.fieldKey) || !['approve', 'edit', 'reject'].includes(a.action) || (a.action === 'edit' && (typeof a.newValue !== 'string' || !a.newValue.trim() || a.newValue.length > 300)))) throw new PipelineError('Invalid review actions', 'bad_request');
    if (!session.summary) throw new PipelineError('Session has no summary to review', 'bad_request');
    for (const action of actions) {
      const f = session.summary.fields.find(f => f.key === action.fieldKey);
      if (!f) throw new PipelineError('Unknown field', 'bad_request');
      if (action.action === 'approve') {
        if (!f.value || !['supported', 'edited', 'approved'].includes(f.status)) throw new PipelineError('Edit unsupported or missing values before approving', 'bad_request');
        f.status = 'approved';
      } else if (action.action === 'edit') {
        const value = redact(action.newValue!.trim()).text;
        f.value = { th: value, it: value, en: value }; f.valueOriginal = value; f.status = 'edited';
      } else { f.status = 'missing'; f.value = null; f.valueOriginal = null; f.evidence = []; f.confidence = 0; }
    }
    if (!session.summary.redFlags.length && session.status !== 'taken_over') session.status = session.summary.fields.filter(f => f.required).every(f => ['approved', 'edited'].includes(f.status)) ? 'approved' : session.summary.abstained ? 'needs_human' : 'awaiting_review';
    if (session.status === 'approved') session.summary.nextQuestion = null;
    session.updatedAt = new Date().toISOString(); saveSession(session);
    appendAudit(sessionId, 'review', 'clinician', { actions: actions.map(a => ({ ...a, ...(a.newValue ? { newValue: redact(a.newValue).text } : {}) })) }, redact(reviewerId).text);
    return session;
  });
}
export async function takeover(sessionId: string, reviewerId: string, reason?: string) {
  return withSessionLock(sessionId, () => {
    if (!reviewerId?.trim() || reviewerId.length > 200 || (reason !== undefined && (typeof reason !== 'string' || reason.length > 2000))) throw new PipelineError('Invalid takeover request', 'bad_request');
    const session = requireSession(sessionId); session.status = 'taken_over'; session.updatedAt = new Date().toISOString();
    if (session.summary) session.summary.nextQuestion = null;
    saveSession(session); appendAudit(sessionId, 'takeover', 'clinician', { reason: reason ? redact(reason).text : undefined }, redact(reviewerId).text); return session;
  });
}
export function listSessions() { return getSessions().sort((a, b) => Number(b.status === 'escalated') - Number(a.status === 'escalated') || b.createdAt.localeCompare(a.createdAt)); }
export function metrics(): OpsMetrics {
  const sessions = getSessions(); const audit = getAudit(); const today = new Date().toISOString().slice(0, 10);
  const byStatus = Object.fromEntries(['collecting', 'escalated', 'awaiting_review', 'needs_human', 'approved', 'taken_over'].map(s => [s, sessions.filter(x => x.status === s).length])) as Record<SessionStatus, number>;
  const summaries = sessions.flatMap(s => s.summary ? [s.summary] : []);
  const generated = sessions.flatMap(s => { const firstReview = audit.findIndex(a => a.sessionId === s.id && a.type === 'review'); const beforeReview = firstReview < 0 ? audit : audit.slice(0, firstReview); const e = beforeReview.filter(a => a.sessionId === s.id && a.type === 'summary_generated' && typeof a.payload.autoCaptured === 'number').at(-1); return e ? [e] : []; });
  const required = generated.reduce((n, e) => n + Number(e.payload.required), 0);
  const calls = audit.filter(e => e.type === 'summary_generated').flatMap(e => Array.isArray(e.payload.modelCalls) ? e.payload.modelCalls as IntakeSummary['modelCalls'] : []);
  const latencies = calls.map(c => c.latencyMs).sort((a, b) => a - b);
  const quantile = (xs: number[], p: number) => xs.length ? xs[Math.max(0, Math.ceil(xs.length * p) - 1)] : null;
  const reviews = sessions.flatMap(s => { const start = audit.find(e => e.sessionId === s.id && e.type === 'summary_generated' && !e.payload.event); const end = audit.find(e => e.sessionId === s.id && e.type === 'review'); return start && end ? [Math.max(0, (Date.parse(end.at) - Date.parse(start.at)) / 1000)] : []; }).sort((a, b) => a - b);
  return { sessionsToday: sessions.filter(s => s.createdAt.startsWith(today)).length, byStatus, escalations: sessions.filter(s => s.summary?.redFlags.length).length, autoCapturedRate: required ? generated.reduce((n, e) => n + Number(e.payload.autoCaptured), 0) / required : 0, abstainRate: summaries.length ? summaries.filter(s => s.abstained).length / summaries.length : 0, medianReviewSeconds: quantile(reviews, 0.5), modelLatencyMs: { p50: quantile(latencies, 0.5), p95: quantile(latencies, 0.95) }, provider: providerInfo() };
}
