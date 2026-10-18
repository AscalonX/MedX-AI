import { PipelineError } from '../../../../../lib/pipeline/errors';
import { decideMedPhoto, MED_PHOTO_MAX_BYTES, suggestFromPhoto } from '../../../../../lib/pipeline/medPhoto';
import { handle, type RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export const maxDuration = 90;
const tooLarge = () => new PipelineError('Photo is larger than 4 MB', 'bad_request', 413);
/** Reads the body with a hard byte cap (header first, then the stream), so a lying Content-Length cannot buffer more. */
async function capped(request: Request): Promise<Uint8Array> {
  const limit = Math.ceil(MED_PHOTO_MAX_BYTES * 4 / 3) + 4096;
  if (Number(request.headers.get('Content-Length') || 0) > limit) throw tooLarge();
  const reader = request.body?.getReader(); if (!reader) throw new PipelineError('Expected a photo', 'bad_request');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > limit) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
/**
 * POST /api/sessions/:id/med-photo (pharmacists only; the raw image is used for one model call and never stored or logged)
 *  - multipart: reviewerId + image (file), or JSON: { reviewerId, mime, imageBase64 } -> SUGGESTED entries
 *  - JSON: { reviewerId, action: "confirm" | "discard", suggestionId } -> the pharmacist's decision
 */
export function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const { id } = await context.params;
    const bytes = await capped(request);
    if ((request.headers.get('Content-Type') || '').startsWith('multipart/form-data')) {
      const form = await new Request(request.url, { method: 'POST', headers: request.headers, body: new Blob([bytes as BlobPart]) }).formData().catch(() => { throw new PipelineError('Invalid form data', 'bad_request'); });
      const file = form.get('image');
      if (!(file instanceof Blob)) throw new PipelineError('Expected an image file', 'bad_request');
      return suggestFromPhoto(id, { reviewerId: form.get('reviewerId'), image: { mime: file.type, base64: Buffer.from(await file.arrayBuffer()).toString('base64') } });
    }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new PipelineError('Expected a JSON object', 'bad_request'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PipelineError('Expected a JSON object', 'bad_request');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(k => !['reviewerId', 'action', 'suggestionId', 'mime', 'imageBase64'].includes(k))) throw new PipelineError('Unknown request property', 'bad_request');
    if (v.action !== undefined) return decideMedPhoto(id, v as { reviewerId: unknown; suggestionId: unknown; action: unknown });
    return suggestFromPhoto(id, { reviewerId: v.reviewerId, image: { mime: v.mime, base64: v.imageBase64 } });
  }, 200, request);
}
