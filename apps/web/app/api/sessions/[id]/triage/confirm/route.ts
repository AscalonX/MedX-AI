import { confirmTriage } from '../../../../../../lib/pipeline/vitals';
import { body, handle, type RouteContext } from '../../../../_http';
export { OPTIONS } from '../../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: RouteContext) {
  return handle(async () => confirmTriage((await context.params).id, await body(request)), 200, request);
}
