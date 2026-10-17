import type { ApiError } from '@medx/shared';
import { PipelineError } from '../../lib/pipeline/pipeline';
import { object } from '../../lib/pipeline/schema';
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
export async function handle(fn: () => unknown | Promise<unknown>, status = 200, request?: Request) {
  try { return json(await fn(), status, request); }
  catch (error) {
    const known = error instanceof PipelineError;
    const body: ApiError = { error: known ? error.message : 'Unable to complete request', code: known ? error.code : 'internal' };
    return json(body, known && error.status ? error.status : body.code === 'not_found' ? 404 : body.code === 'bad_request' ? 400 : 500, request);
  }
}
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
export function requireDemoToken(request: Request) {
  if (process.env.DEMO_SEED !== '1' || !process.env.DEMO_TOKEN) throw new PipelineError('Not found', 'not_found');
  if (request.headers.get('x-demo-token') !== process.env.DEMO_TOKEN) throw new PipelineError('Invalid demo token', 'bad_request', 403);
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new PipelineError('Unknown request property', 'bad_request');
}
export type RouteContext = { params: Promise<{ id: string }> };
