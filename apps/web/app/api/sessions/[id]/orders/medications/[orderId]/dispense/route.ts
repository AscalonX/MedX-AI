import { dispenseOrder } from '../../../../../../../../lib/pipeline/orders';
import { body, handle } from '../../../../../../_http';
export { OPTIONS } from '../../../../../../_http';
export const runtime = 'nodejs';
/** Pharmacist 2: final double check + dispense (two-person rule enforced in the engine). */
export function POST(request: Request, context: { params: Promise<{ id: string; orderId: string }> }) {
  return handle(async () => {
    const { id, orderId } = await context.params;
    return dispenseOrder(id, orderId, await body(request));
  }, 200, request);
}
