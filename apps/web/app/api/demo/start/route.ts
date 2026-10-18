import { PipelineError } from '../../../../lib/pipeline/pipeline';
import { demoStartAllowed, startDemoCase } from '../../../../lib/pipeline/seed';
import { body, handle, keys } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
/** One visitor's own synthetic golden case at the requested stage. 404 unless DEMO_SEED=1; 429 at the cap or the per-client limit. */
export function POST(request: Request) {
  return handle(async () => {
    if (process.env.DEMO_SEED !== '1') throw new PipelineError('Not found', 'not_found');
    const value = await body(request); keys(value, ['stage']);
    // Per server instance, in memory (documented in docs/reports/w20-engine.md): a coarse brake, not an identity check.
    const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
    return startDemoCase(value.stage, { allow: () => demoStartAllowed(client) });
  }, 200, request);
}
