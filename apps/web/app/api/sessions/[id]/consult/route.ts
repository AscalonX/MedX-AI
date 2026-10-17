import { consultMode, getConsult } from '../../../../../lib/pipeline/consult';
import { handle, type RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export async function GET(request: Request, context: RouteContext) {
  return handle(async () => getConsult((await context.params).id, consultMode(new URL(request.url).searchParams.get('mode'))), 200, request);
}
