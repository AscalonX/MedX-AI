import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApiError } from '@medx/shared';
import { PipelineError } from '../../lib/pipeline/pipeline';
import { checkRateLimit } from '../../lib/pipeline/rateLimit';
import { object } from '../../lib/pipeline/schema';
import { applyReassignedCodes, flushStore, StoreBusyError, storeScope, StoreUnavailableError, syncStore } from '../../lib/pipeline/store';
export function cors(request?: Request): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-demo-token, x-medx-client', 'Access-Control-Max-Age': '86400' };
  const origin = request?.headers.get('Origin');
  const allowed = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:8081').split(',').map(s => s.trim()).filter(Boolean);
  if (request) allowed.push(new URL(request.url).origin);
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
export function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: cors(request) }); }
export function json(data: unknown, status = 200, request?: Request) { return Response.json(data, { status, headers: { ...cors(request), 'Cache-Control': 'no-store' } }); }
function refusal(body: ApiError, status: number, request: Request | undefined, retryAfter: number) {
  const response = json(body, status, request); response.headers.set('Retry-After', String(retryAfter)); return response;
}
/**
 * Every API route runs through here: per-IP POST rate limit, then the shared store is synced before the
 * route function and this request's writes are flushed after it (no-ops with the file store), then JSON.
 * A store that is busy or unreachable answers 503: the client is told the change may not be saved.
 */
export async function handle(fn: () => unknown | Promise<unknown>, status = 200, request?: Request) {
  try {
    if (request) {
      const limit = await checkRateLimit(request);
      if (limit.limited) return refusal({ error: 'Too many requests from this network; retry in a minute', code: 'bad_request' }, 429, request, limit.retryAfter);
    }
    await syncStore();
    return await storeScope(async scope => {
      let value: unknown; let failure: unknown; let failed = false;
      try { value = await fn(); } catch (error) { failed = true; failure = error; }
      // Writes made before an error still land (as with the file store), then the error is reported.
      await flushStore();
      if (failed) throw failure;
      return json(applyReassignedCodes(value, scope.reassigned), status, request);
    });
  } catch (error) {
    if (error instanceof StoreBusyError) return refusal({ error: 'Store busy, retry', code: 'internal' }, 503, request, 1);
    if (error instanceof StoreUnavailableError) return refusal({ error: 'Shared store unavailable; this change may not have been saved. Reload and retry; needs human review if it persists.', code: 'internal' }, 503, request, 5);
    const known = error instanceof PipelineError;
    const body: ApiError = { error: known ? error.message : 'Unable to complete request', code: known ? error.code : 'internal' };
    return json(body, known && error.status ? error.status : body.code === 'not_found' ? 404 : body.code === 'bad_request' ? 400 : 500, request);
  }
}
/** JSON bodies are capped at 64 kB (header and streamed size) before parsing. */
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length') || 0) > 64000) throw new PipelineError('Request body too large', 'bad_request', 413);
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 64000) { await reader.cancel(); throw new PipelineError('Request body too large', 'bad_request', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(text);
    if (!object(value)) throw new Error();
    return value;
  } catch (error) { if (error instanceof PipelineError) throw error; throw new PipelineError('Expected a JSON object', 'bad_request'); }
}
/** Constant-time secret comparison (hashing first makes the lengths equal). */
export function sameSecret(given: string | null | undefined, expected: string | undefined) {
  if (!given || !expected) return false;
  return timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());
}
export function requireDemoToken(request: Request) {
  if (process.env.DEMO_SEED !== '1' || !process.env.DEMO_TOKEN) throw new PipelineError('Not found', 'not_found');
  if (!sameSecret(request.headers.get('x-demo-token'), process.env.DEMO_TOKEN)) throw new PipelineError('Invalid demo token', 'bad_request', 403);
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new PipelineError('Unknown request property', 'bad_request');
}
export type RouteContext = { params: Promise<{ id: string }> };
