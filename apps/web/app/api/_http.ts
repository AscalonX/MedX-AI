import type { ApiError } from '@medx/shared';
import { PipelineError } from '../../lib/pipeline/pipeline';
import { object } from '../../lib/pipeline/schema';
export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } }); }
export async function handle(fn: () => unknown | Promise<unknown>, status = 200) {
  try { return json(await fn(), status); }
  catch (error) {
    const known = error instanceof PipelineError;
    const body: ApiError = { error: known ? error.message : 'Unable to complete request', code: known ? error.code : 'internal' };
    return json(body, body.code === 'not_found' ? 404 : body.code === 'bad_request' ? 400 : 500);
  }
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length') || 0) > 64000) throw new PipelineError('Request body too large', 'bad_request');
  try {
    const text = await request.text();
    if (text.length > 64000) throw new Error();
    const value: unknown = JSON.parse(text);
    if (!object(value)) throw new Error();
    return value;
  } catch { throw new PipelineError('Expected a JSON object', 'bad_request'); }
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new PipelineError('Unknown request property', 'bad_request');
}
export type RouteContext = { params: Promise<{ id: string }> };
