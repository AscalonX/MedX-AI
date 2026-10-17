import { PipelineError } from '../../../../lib/pipeline/pipeline';
import { getAudit, getSession } from '../../../../lib/pipeline/store';
import { handle } from '../../_http';
import type { RouteContext } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(_request: Request, context: RouteContext) {
  return handle(async () => {
    const { id } = await context.params; const session = getSession(id);
    if (!session) throw new PipelineError('Session not found', 'not_found');
    return { session, audit: getAudit(id) };
  }, 200, _request);
}
