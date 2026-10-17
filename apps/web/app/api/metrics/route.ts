import { metrics } from '../../../lib/pipeline/pipeline';
import { handle } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request?: Request) { return handle(metrics, 200, request); }
