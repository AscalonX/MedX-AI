import { PipelineError } from '../../../../lib/pipeline/pipeline';
import { demoCases, ensureDemoCases } from '../../../../lib/pipeline/seed';
import { handle } from '../../_http';
export { OPTIONS } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Landing "Try a role": the seeded synthetic case for each DEMO_PERSONAS id with its live stage. 404 unless DEMO_SEED=1. */
export function GET(request: Request) {
  return handle(async () => {
    if (process.env.DEMO_SEED !== '1') throw new PipelineError('Not found', 'not_found');
    await ensureDemoCases();
    return demoCases();
  }, 200, request);
}
