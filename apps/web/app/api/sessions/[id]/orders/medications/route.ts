import { medicationOrder } from '../../../../../../lib/pipeline/orders';
import { body, handle, type RouteContext } from '../../../../_http';
export { OPTIONS } from '../../../../_http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export function POST(request: Request, context: RouteContext) {
  return handle(async () => medicationOrder((await context.params).id, await body(request)), 200, request);
}
