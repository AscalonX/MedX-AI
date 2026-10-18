import type { ModelCall, PipelineStep } from '@medx/shared';
import { mockJSON } from './mock';
import { CONSULT_SCHEMA, EXTRACTION_SCHEMA, QUESTION_SCHEMA, SCREEN_SCHEMA } from './schema';

export interface ChatRequest {
  step: PipelineStep; system: string; user: string; schemaName: string;
  model?: string; timeoutMs?: number; signal?: AbortSignal;
  repair?: { raw: unknown; errors: string[] };
  onCall?: (call: ModelCall) => void;
}
export interface ChatResult { data: unknown | null; call: ModelCall; raw?: unknown; failure?: 'provider_error' | 'schema_error'; retryAfterMs?: number }
export type ModelClient = (request: ChatRequest) => Promise<ChatResult>;
const schemaCapabilities = new Map<string, { enabled: boolean; expires: number }>();
const compatibilityCapabilities = new Map<string, { format: 'json_schema' | 'json_object' | 'none'; noSystem: boolean }>();
// Demo seed calls share one paced lane, including retries/compatibility attempts.
let seedPacing = false;
let pacingTail = Promise.resolve();
let lastSeedCall = 0;
export function paceSeedCalls(enabled: boolean) { seedPacing = enabled; }
async function pace(signal: AbortSignal) {
  if (!seedPacing) return;
  const previous = pacingTail;
  let release!: () => void;
  pacingTail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const delay = Math.max(0, lastSeedCall + 2100 - Date.now());
    if (delay) await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error('Aborted')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    if (signal.aborted) throw new Error('Aborted');
    lastSeedCall = Date.now();
  } finally { release(); }
}
async function supportsSchema(model: string, signal: AbortSignal): Promise<boolean> {
  // Optional explicit override for gateways with an inaccessible /models endpoint.
  if (process.env.AMD_JSON_SCHEMA !== undefined) return process.env.AMD_JSON_SCHEMA === 'true';
  const base = process.env.AMD_BASE_URL!.replace(/\/$/, ''); const key = `${base}/${model}`;
  const cached = schemaCapabilities.get(key);
  if (cached && cached.expires > Date.now()) return cached.enabled;
  let enabled = false;
  try {
    const response = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${process.env.AMD_API_KEY}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) });
    if (response.ok) {
      const catalog = await response.json();
      enabled = Array.isArray(catalog?.data) && catalog.data.some((m: { id?: string; json_output?: boolean }) => m.id === model && m.json_output === true);
    }
  } catch { /* Capability discovery is optional; validation is always mandatory. */ }
  schemaCapabilities.set(key, { enabled, expires: Date.now() + 300000 }); return enabled;
}
export function parseJSON(raw: string): unknown {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
  return JSON.parse(start >= 0 && end >= start ? clean.slice(start, end + 1) : clean);
}
/** One logical call; compatibility HTTP attempts are recorded separately. Never throws. */
export async function chatJSON(req: ChatRequest): Promise<ChatResult> {
  const started = performance.now();
  const provider = process.env.MODEL_PROVIDER === 'mock' ? 'mock' : 'amd-tokenfactory';
  const model = provider === 'mock' ? 'deterministic-mock' : req.model || process.env.AMD_MODEL || 'unconfigured';
  const makeCall = (ok: boolean, latencyMs: number, error?: string): ModelCall => ({ step: req.step, provider, model, latencyMs: Math.round(latencyMs), ok, ...(error ? { error } : {}) });
  if (provider === 'mock') {
    try { const data = mockJSON(req); const call = makeCall(true, performance.now() - started); req.onCall?.(call); return { data, raw: data, call }; }
    catch { const call = makeCall(false, performance.now() - started, 'Mock generation failed'); req.onCall?.(call); return { data: null, call, failure: 'provider_error' }; }
  }
  // Per-step defaults measured on Gemma-4-31B-IT via Token Factory (screen ~2 s, extraction ~20 s, next question ~7 s);
  // the turn deadline (TURN_TIMEOUT_MS, 52 s) caps the sum inside the routes' 60 s maxDuration. A timeout abstains, never guesses.
  const timeout = req.timeoutMs ?? (Number(process.env.LLM_TIMEOUT_MS) > 0 ? Number(process.env.LLM_TIMEOUT_MS) : req.step === 'next_question' ? 11000 : req.step === 'red_flags' ? 15000 : 40000);
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal?.addEventListener('abort', abort, { once: true });
  if (req.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  try {
    if (!process.env.AMD_BASE_URL || !process.env.AMD_API_KEY || model === 'unconfigured') {
      const call = makeCall(false, performance.now() - started, 'Provider is not configured'); req.onCall?.(call); return { data: null, call, failure: 'provider_error' };
    }
    const useSchema = await supportsSchema(model, controller.signal);
    const key = `${process.env.AMD_BASE_URL}/${model}/${req.step}/${process.env.AMD_JSON_SCHEMA ?? 'auto'}`;
    const capability = compatibilityCapabilities.get(key) || { format: useSchema ? 'json_schema' as const : 'json_object' as const, noSystem: false };
    compatibilityCapabilities.set(key, capability);
    const consult = req.schemaName === 'consult_suggestions';
    for (let compatibility = 0; compatibility < (consult ? 1 : 4); compatibility++) {
      const attempt = performance.now();
      try {
        if (!process.env.AMD_BASE_URL || !process.env.AMD_API_KEY || model === 'unconfigured') throw new Error('Provider is not configured');
        const messages: { role: string; content: string }[] = capability.noSystem ? [{ role: 'user', content: `### INSTRUCTIONS\n${req.system}\n\n${req.user}` }] : [{ role: 'system', content: req.system }, { role: 'user', content: req.user }];
        if (req.repair) {
          messages.push({ role: 'assistant', content: (typeof req.repair.raw === 'string' ? req.repair.raw : JSON.stringify(req.repair.raw)).slice(0, 4000) });
          messages.push({ role: 'user', content: `Your previous output was not valid. Problems: ${req.repair.errors.slice(0, 10).join('\n')}. Return only the corrected JSON object with the same content and the exact required shape. Do not add fields or values that were not in the transcript.` });
        }
        const format = capability.format === 'json_schema' ? { type: 'json_schema', json_schema: { name: req.schemaName, schema: consult ? CONSULT_SCHEMA : req.step === 'red_flags' ? SCREEN_SCHEMA : req.step === 'next_question' ? QUESTION_SCHEMA : EXTRACTION_SCHEMA, strict: true } } : { type: 'json_object' };
        await pace(controller.signal);
        const response = await fetch(`${process.env.AMD_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AMD_API_KEY}` },
          body: JSON.stringify({ model, messages, temperature: 0, top_p: 1, stream: false, max_tokens: consult ? 1200 : req.step === 'red_flags' ? 400 : req.step === 'next_question' ? 250 : 1500, ...(capability.format !== 'none' ? { response_format: format } : {}) }),
        });
        if (!response.ok) {
          // Inspect gateway diagnostics only for compatibility; never persist response bodies.
          const diagnostic = (await response.text()).slice(0, 2000);
          const error = `HTTP ${response.status}`;
          const call = makeCall(false, performance.now() - attempt, error); req.onCall?.(call);
          if (response.status === 400 && !capability.noSystem && /system.{0,40}(unsupported|not supported|not allowed)|(?:unsupported|not supported).{0,40}system/i.test(diagnostic)) { capability.noSystem = true; continue; }
          if (response.status >= 400 && response.status < 500 && ![401, 403, 429].includes(response.status) && capability.format !== 'none') { capability.format = capability.format === 'json_schema' ? 'json_object' : 'none'; continue; }
          const retry = response.headers.get('Retry-After');
          const retryAfterMs = response.status === 429 ? retry ? (/^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 500 : undefined;
          return { data: null, call, failure: 'provider_error', retryAfterMs };
        }
        const envelope = await response.json();
        const raw: unknown = envelope?.choices?.[0]?.message?.content;
        try {
          if (typeof raw !== 'string') throw new Error('Missing content');
          const data = parseJSON(raw); const call = makeCall(true, performance.now() - attempt); req.onCall?.(call); return { data, raw: data, call };
        } catch {
          const call = makeCall(false, performance.now() - attempt, 'Invalid JSON response'); req.onCall?.(call); return { data: null, raw, call, failure: 'schema_error' };
        }
      } catch {
        const call = makeCall(false, performance.now() - attempt, controller.signal.aborted ? 'Provider timeout or turn deadline' : 'Provider request failed');
        req.onCall?.(call); return { data: null, call, failure: 'provider_error' };
      }
    }
    const call = makeCall(false, performance.now() - started, 'Provider compatibility failed');
    return { data: null, call, failure: 'provider_error' };
  } finally { clearTimeout(timer); req.signal?.removeEventListener('abort', abort); }
}
