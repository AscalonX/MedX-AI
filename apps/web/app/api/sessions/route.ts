import type { Lang } from '@medx/shared';
import { createSession, listSessions, PipelineError } from '../../../lib/pipeline/pipeline';
import { body, handle, keys } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request?: Request) { return handle(listSessions, 200, request); }
export function POST(request: Request) {
  return handle(async () => {
    const value = await body(request); keys(value, ['patientLang']);
    if (!['th', 'it', 'en'].includes(String(value.patientLang))) throw new PipelineError('patientLang must be th, it or en', 'bad_request');
    return createSession(value.patientLang as Lang);
  }, 201, request);
}
