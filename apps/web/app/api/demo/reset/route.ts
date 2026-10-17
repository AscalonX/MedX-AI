import { seedDemo, startDemoSeed } from '../../../../lib/pipeline/seed';
import { handle, requireDemoToken } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) {
  return handle(() => {
    requireDemoToken(request);
    return process.env.MODEL_PROVIDER === 'mock' ? seedDemo({ reset: true }) : startDemoSeed({ reset: true });
  }, process.env.MODEL_PROVIDER === 'mock' ? 200 : 202, request);
}
