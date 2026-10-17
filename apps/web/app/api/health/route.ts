import { providerInfo } from '../../../lib/pipeline/config';
import { json } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() { const info = providerInfo(); return json({ provider: info.name, model: info.model }); }
