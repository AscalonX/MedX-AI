import { after } from 'next/server';
import { seedDemo, startDemoSeed } from '../../../../lib/pipeline/seed';
import { handle, json, sameSecret } from '../../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A real-provider reseed is paced; `after` keeps the function alive for it (same budget as /api/demo/reset).
export const maxDuration = 300;

/**
 * Daily demo reset, called by Vercel Cron (apps/web/vercel.json, 20:00 UTC = 03:00 ICT). Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}`. 401 without it (or when CRON_SECRET is unset), 404 unless
 * DEMO_SEED=1, then the synthetic demo is reseeded from scratch. Synthetic fixtures only; never real data.
 */
export function GET(request: Request) {
  if (!sameSecret(request.headers.get('authorization'), process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined)) {
    return json({ error: 'Unauthorized', code: 'bad_request' }, 401, request);
  }
  if (process.env.DEMO_SEED !== '1') return json({ error: 'Not found', code: 'not_found' }, 404, request);
  const mock = process.env.MODEL_PROVIDER === 'mock';
  return handle(async () => {
    if (!mock) return startDemoSeed({ reset: true }, after);
    const result = await seedDemo({ reset: true });
    // Counts only: the cron log never carries session content.
    return { status: 'reset', created: result.created, reused: result.reused, byStatus: result.byStatus, mismatches: result.mismatches.length };
  }, mock ? 200 : 202, request);
}
