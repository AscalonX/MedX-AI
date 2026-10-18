import type { ConsultNoteReq } from '@medx/shared';
import { consultMode, consultNote } from '../../../../../../lib/pipeline/consult';
import { PipelineError } from '../../../../../../lib/pipeline/pipeline';
import { body, handle, keys, type RouteContext } from '../../../../_http';
export { OPTIONS } from '../../../../_http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const value = await body(request); keys(value, ['reviewerId', 'mode', 'action', 'edits']);
    if (typeof value.reviewerId !== 'string' || (value.action !== 'draft' && value.action !== 'sign')) throw new PipelineError('Invalid note request', 'bad_request');
    return consultNote((await context.params).id, { reviewerId: value.reviewerId, mode: consultMode(value.mode), action: value.action, edits: value.edits as ConsultNoteReq['edits'] });
  }, 200, request);
}
