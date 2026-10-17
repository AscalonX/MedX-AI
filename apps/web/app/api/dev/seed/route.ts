import { seedDemo, startDemoSeed, demoSeedProgress } from '../../../../lib/pipeline/seed';
import { handle, requireDemoToken } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export function POST(request: Request) { return handle(() => { requireDemoToken(request); return process.env.MODEL_PROVIDER === 'mock' ? seedDemo() : startDemoSeed(); }, process.env.MODEL_PROVIDER === 'mock' ? 200 : 202, request); }
export function GET(request: Request) { return handle(() => { requireDemoToken(request); return demoSeedProgress(); }, 200, request); }
