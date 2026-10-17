import { metrics } from '../../../lib/pipeline/pipeline';
import { ensureDemoSeed } from '../../../lib/pipeline/seed';
import { handle } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handle(async () => { await ensureDemoSeed(); return metrics(); }, 200, request); }
