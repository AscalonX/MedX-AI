import { after } from 'next/server';
import { seedDemo, startDemoSeed, demoSeedProgress } from '../../../../lib/pipeline/seed';
import { handle, requireDemoToken } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
// A real-provider seed is paced (one call per 2.1 s); `after` keeps the function alive until it finishes.
export const maxDuration = 300;
export function POST(request: Request) { return handle(() => { requireDemoToken(request); return process.env.MODEL_PROVIDER === 'mock' ? seedDemo() : startDemoSeed({}, after); }, process.env.MODEL_PROVIDER === 'mock' ? 200 : 202, request); }
export function GET(request: Request) { return handle(() => { requireDemoToken(request); return demoSeedProgress(); }, 200, request); }
