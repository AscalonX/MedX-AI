import { PipelineError, takeover } from '../../../../../lib/pipeline/pipeline';
import { body, handle, keys } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const value = await body(request); keys(value, ['reviewerId', 'reason']);
    if (typeof value.reviewerId !== 'string' || (value.reason !== undefined && typeof value.reason !== 'string')) throw new PipelineError('Invalid takeover body', 'bad_request');
    return takeover((await context.params).id, value.reviewerId, value.reason as string | undefined);
  });
}
