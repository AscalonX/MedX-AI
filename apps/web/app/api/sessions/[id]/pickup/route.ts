import { pickupAction } from '../../../../../lib/pipeline/orders';
import { body, handle, type RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
/** Call the patient to collect medicines (after every active order is dispensed), then record collection. */
export function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const { id } = await context.params;
    return pickupAction(id, await body(request));
  }, 200, request);
}
