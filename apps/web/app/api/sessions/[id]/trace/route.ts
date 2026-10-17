import { PipelineError } from '../../../../../lib/pipeline/pipeline';
import { getAudit, getConsultRecord, getSession } from '../../../../../lib/pipeline/store';
import { deriveTrace } from '../../../../../lib/pipeline/trace';
import { handle } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Clinician-only: the patient view never links to or includes the trace.
export function GET(request: Request, context: RouteContext) {
  return handle(async () => {
    const { id } = await context.params; const session = getSession(id);
    if (!session) throw new PipelineError('Session not found', 'not_found');
    return deriveTrace(session, getAudit(id), getConsultRecord(id));
  }, 200, request);
}
