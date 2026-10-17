import { providerInfo } from '../../../lib/pipeline/config';
import { json } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request?: Request) { const info = providerInfo(); return json({ provider: info.name, model: info.model, hardware: info.hardware }, 200, request); }
