import { providerInfo } from '../../../lib/pipeline/config';
import { storeInfo } from '../../../lib/pipeline/store';
import { cors } from '../_http';
export { OPTIONS } from '../_http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Short commit id: Vercel git deploys set VERCEL_GIT_COMMIT_SHA; CLI deploys pass MEDX_COMMIT; next.config bakes MEDX_BUILD_COMMIT. */
function buildCommit() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.MEDX_COMMIT || process.env.RENDER_GIT_COMMIT || process.env.MEDX_BUILD_COMMIT || '';
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : 'unknown';
}

/**
 * Honest runtime facts for the landing page and uptime checks. No patient data: a session count only.
 * `provider` is "mock" whenever the deterministic mock runs; `providerConfigured` is false when the AMD
 * provider is selected but its URL, key or model is missing (every call would then abstain).
 * `status` is "degraded" when the shared store cannot be reached (writes then answer 503).
 */
async function healthBody() {
  const info = providerInfo();
  const store = await storeInfo();
  return {
    status: store.ok ? 'ok' : 'degraded',
    provider: info.name,
    model: info.model,
    hardware: info.hardware,
    providerConfigured: info.name === 'mock' || Boolean(process.env.AMD_BASE_URL && process.env.AMD_API_KEY && process.env.AMD_MODEL),
    store: store.kind,
    storeOk: store.ok,
    storeVersion: store.version,
    sessions: store.sessions,
    commit: buildCommit(),
    region: process.env.VERCEL_REGION || process.env.MEDX_REGION || 'local',
  };
}

/** Returns the Response synchronously (existing callers read it without awaiting GET); the JSON body streams once the store answers. */
export function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text: string;
      try { text = JSON.stringify(await healthBody()); } catch { text = JSON.stringify({ status: 'degraded', error: 'Health check failed' }); }
      controller.enqueue(encoder.encode(text)); controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { ...cors(request), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } });
}
