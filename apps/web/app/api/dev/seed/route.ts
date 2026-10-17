import { seedDemo } from '../../../../lib/pipeline/seed';
import { handle } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export function POST() { return handle(() => seedDemo()); }
