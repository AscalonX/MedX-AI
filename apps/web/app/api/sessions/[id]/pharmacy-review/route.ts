import { pharmacyReview } from '../../../../../lib/pipeline/pharmacyReview';
import { body, handle } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: RouteContext) {
  return handle(async () => pharmacyReview((await context.params).id, await body(request)));
}
