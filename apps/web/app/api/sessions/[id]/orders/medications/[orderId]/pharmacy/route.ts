import { medicationAction } from '../../../../../../../../lib/pipeline/orders';
import { body, handle } from '../../../../../../_http';
export { OPTIONS } from '../../../../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: { params: Promise<{ id: string; orderId: string }> }) {
  return handle(async () => {
    const { id, orderId } = await context.params;
    return medicationAction(id, orderId, 'pharmacy', await body(request));
  }, 200, request);
}
