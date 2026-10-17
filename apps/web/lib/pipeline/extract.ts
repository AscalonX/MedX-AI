import type { ExtractedField, FieldKey, IntakeSession, ModelCall, PipelineStep } from '@medx/shared';
import { emptyFields } from './config';
import { chatJSON } from './llm';
import type { ChatRequest, ChatResult, ModelClient } from './llm';
import { aliases, EXTRACTION_SYSTEM, extractionPrompt } from './prompts';
import { languageOK, validateExtraction } from './schema';
import { verifyDetailed, words } from './verify';
import { pharmacyEntries } from './pharmacyExtraction';
import { applyQuickAnswer } from './quickAnswers';
export interface EngineContext {
  askedField?: FieldKey;
  answeredFields?: { turnId: string; field: FieldKey }[];
  client?: ModelClient;
  trace?: (e: { step: PipelineStep; raw: unknown }) => void;
  deadline: number;
  modelCalls: ModelCall[];
  log?: (event: string, detail: Record<string, unknown>) => void;
}
export async function invoke(req: ChatRequest, ctx: EngineContext): Promise<ChatResult> {
  const controller = new AbortController();
  const configured = Number(process.env.LLM_TIMEOUT_MS);
  const timeoutMs = Math.max(1, Math.min(ctx.deadline - Date.now(), req.timeoutMs ?? (configured > 0 ? configured : req.step === 'next_question' ? 8000 : 25000)));
  let closed = false; let last: ModelCall | undefined;
  const onCall = (call: ModelCall) => { if (!closed) { ctx.modelCalls.push(call); last = call; } };
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<ChatResult>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      const call: ModelCall = { step: req.step, provider: process.env.MODEL_PROVIDER === 'mock' ? 'mock' : 'amd-tokenfactory', model: req.model || process.env.AMD_MODEL || 'unconfigured', latencyMs: timeoutMs, ok: false, error: 'Provider timeout or turn deadline' };
      resolve({ data: null, call, failure: 'provider_error' });
    }, timeoutMs);
  });
  const attempt = Promise.resolve().then(() => (ctx.client || chatJSON)({ ...req, timeoutMs, signal: controller.signal, onCall })).catch((): ChatResult => ({ data: null, call: { step: req.step, provider: process.env.MODEL_PROVIDER === 'mock' ? 'mock' : 'amd-tokenfactory', model: req.model || process.env.AMD_MODEL || 'unconfigured', latencyMs: 0, ok: false, error: 'Provider request failed' }, failure: 'provider_error' }));
  try {
    const result = await Promise.race([attempt, timeout]);
    if (last !== result.call) ctx.modelCalls.push(result.call);
    ctx.trace?.({ step: req.step, raw: result.raw ?? result.data });
    return result;
  } finally { closed = true; clearTimeout(timer!); }
}
function failCall(call: ModelCall, error: string) { call.ok = false; call.error = error; }
export async function extract(session: IntakeSession, ctx: EngineContext) {
  const request: ChatRequest = { step: 'extract', system: EXTRACTION_SYSTEM, user: extractionPrompt(session, ctx.askedField), schemaName: 'intake_extraction' };
  let result = await invoke(request, ctx);
  if (!result.call.ok && result.failure !== 'schema_error' && result.data === null) {
    const delay = result.retryAfterMs ?? 500;
    if (delay <= 2000 && Date.now() + delay < ctx.deadline) {
      await new Promise(resolve => setTimeout(resolve, delay));
      result = await invoke({ ...request, model: process.env.AMD_MODEL_FALLBACK || process.env.AMD_MODEL }, ctx);
    }
  }
  if (!result.call.ok && result.failure !== 'schema_error' && result.data === null) return { fields: emptyFields(), reason: 'provider_error' as const, proposed: 0, failed: 0, language: undefined };
  let validation = validateExtraction(result.data);
  if (!validation.data) {
    failCall(result.call, 'Extraction schema validation failed');
    result = await invoke({ ...request, repair: { raw: result.raw ?? result.data, errors: validation.errors } }, ctx);
    if (!result.call.ok && result.failure !== 'schema_error' && result.data === null) return { fields: emptyFields(), reason: 'provider_error' as const, proposed: 0, failed: 0, language: undefined };
    validation = validateExtraction(result.data);
  }
  if (!validation.data) { failCall(result.call, 'Extraction schema validation failed after repair'); return { fields: emptyFields(), reason: 'schema_error' as const, proposed: 0, failed: 0, language: undefined }; }
  if (validation.ignored.length) ctx.log?.('unknown_field_keys', { count: validation.ignored.length });
  const model = validation.data;
  let proposed = 0; let failed = 0;
  const aliasTurns = aliases(session);
  const patientTurns = aliasTurns.filter(t => t.role === 'patient');
  for (const t of patientTurns) {
    const field = t === patientTurns.at(-1) ? ctx.askedField : ctx.answeredFields?.find(a => a.turnId === t.id)?.field;
    // Restore an earlier chip only when the provider has no newer evidence.
    // A later explicit allergy or other correction must take precedence.
    if (field && (t === patientTurns.at(-1) || !model.fields[field] || model.fields[field]?.evidence.some(e => e.turn === t.alias))) applyQuickAnswer(model, field, t.text, t.alias);
  }
  const fields: ExtractedField[] = emptyFields().map(base => {
    const f = model.fields[base.key]; if (!f) return base;
    proposed++;
    const verified = f.evidence.flatMap(e => {
      const id = aliasTurns.find(t => t.alias === e.turn)?.id || e.turn;
      const hit = verifyDetailed(e.quote, session.turns, id, base.key === 'severity', !['allergies', 'medications', 'pregnancy_status'].includes(base.key));
      if (hit?.correctedTurn) ctx.log?.('corrected_evidence_turn', { key: base.key, from: e.turn, to: hit.evidence.turnId });
      return hit ? [hit] : [];
    });
    const best = [...verified].sort((a, b) => b.matchFactor - a.matchFactor || words(b.evidence.quote, session.patientLang).length - words(a.evidence.quote, session.patientLang).length)[0];
    const selfRating = { high: 0.9, medium: 0.7, low: 0.45 }[f.certainty];
    const langOK = languageOK(f.value);
    if (!langOK) ctx.log?.('field_language_failed', { key: base.key });
    // Bare answers and short Thai segments carry less context; apply this once.
    const score = best && langOK ? Math.round(selfRating * best.matchFactor * (words(best.evidence.quote, session.patientLang).length <= 2 ? 0.85 : 1) * 100) / 100 : 0;
    const supported = score >= 0.5;
    if (!verified.length || !langOK) failed++;
    return { ...base, value: f.value, valueOriginal: f.value_original, evidence: verified.map(v => v.evidence), confidence: supported ? score : Math.round(Math.min(selfRating * 0.3, 0.3) * 100) / 100, status: supported ? 'supported' : 'unsupported' };
  });
  return { fields, reason: undefined, proposed, failed, language: model.language_detected, pharmacy: pharmacyEntries(model, session) };
}
