import { seedDemo } from '../../../../lib/pipeline/seed';
import { handle } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() { return handle(() => seedDemo({ reset: true })); }
