// Wave 20 platform: Vercel config (M-03), daily cron reset (C-02), security for a public URL, health honesty.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ignore from 'ignore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from '../pipeline';
import { getAudit, getSessions, StoreBusyError, StoreUnavailableError } from '../store';
import { body, handle, requireDemoToken, sameSecret } from '../../../app/api/_http';
import { GET as cronReset } from '../../../app/api/cron/reset/route';
import { POST as demoReset } from '../../../app/api/demo/reset/route';
import { GET as health } from '../../../app/api/health/route';

const web = path.resolve(__dirname, '../../..');
const repo = path.resolve(web, '../..');
const read = (...p: string[]) => readFileSync(path.join(...p), 'utf8');
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); rmSync(dir, { recursive: true, force: true }); });

async function loadNextConfig(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import('../../../next.config')).default;
}
async function headersFor(config: Awaited<ReturnType<typeof loadNextConfig>>, source: string) {
  const rules = await config.headers!();
  return Object.fromEntries(rules.find(r => r.source === source)!.headers.map(h => [h.key, h.value]));
}

describe('Vercel and build configuration (M-03)', () => {
  it('apps/web/vercel.json has the schema, Singapore region and the daily 03:00 ICT reset cron', () => {
    const vercel = JSON.parse(read(web, 'vercel.json'));
    expect(vercel.$schema).toBe('https://openapi.vercel.sh/vercel.json');
    expect(vercel.regions).toEqual(['sin1']);
    expect(vercel.crons).toEqual([{ path: '/api/cron/reset', schedule: '0 20 * * *' }]);
  });

  it('package.json pins Node 22 and depends on the official Neon serverless driver', () => {
    const pkg = JSON.parse(read(web, 'package.json'));
    expect(pkg.engines).toEqual({ node: '22.x' });
    expect(pkg.dependencies['@neondatabase/serverless']).toMatch(/^\^1\./);
    const lock = JSON.parse(read(web, 'package-lock.json'));
    expect(lock.packages['node_modules/@neondatabase/serverless'].version).toMatch(/^1\./);
  });

  it('next.config emits standalone output only off Vercel, caches /media for a year and type-checks with tsconfig.build.json', async () => {
    const docker = await loadNextConfig({ VERCEL: '' });
    expect(docker.output).toBe('standalone');
    const vercel = await loadNextConfig({ VERCEL: '1' });
    expect(vercel.output).toBeUndefined();
    expect(vercel.typescript?.tsconfigPath).toBe('tsconfig.build.json');
    expect(vercel.poweredByHeader).toBe(false);
    expect(await headersFor(vercel, '/media/:path*')).toEqual({ 'Cache-Control': 'public, max-age=31536000, immutable' });
    // The only build-time env exposed to bundles is the commit id (never a secret).
    expect(Object.keys(vercel.env || {})).toEqual(['MEDX_BUILD_COMMIT']);
  });

  it('tsconfig.build.json extends the full config and leaves tests out of the build type-check', () => {
    const build = JSON.parse(read(web, 'tsconfig.build.json'));
    expect(build.extends).toBe('./tsconfig.json');
    expect(build.exclude).toEqual(expect.arrayContaining(['**/__tests__/**', '**/*.test.ts']));
    expect(JSON.parse(read(web, 'tsconfig.json')).exclude).not.toContain('**/__tests__/**');
  });

  it('.vercelignore drops working folders and local state but never packages/shared, data/cases or the served media', () => {
    const ig = ignore().add(read(repo, '.vercelignore'));
    for (const p of ['NANOPROMPT/prompt.md', 'F/notes.txt', 'apps/web/node_modules/next/package.json', 'node_modules/x/index.js', 'apps/web/.next/server/app.js',
      'apps/web/.data/store.json', 'eval/runs/2026-10-17.json', 'apps/mobile/app.json', 'apps/web/.env.local', '.env', 'pitch/deck/MedX-deck.pdf', 'docs/reports/screens/a.png']) {
      expect(ig.ignores(p), p).toBe(true);
    }
    for (const p of ['packages/shared/src/index.ts', 'packages/shared/package.json', 'data/cases/EN-01.json', 'apps/web/app/page.tsx', 'apps/web/vercel.json',
      'apps/web/public/media/medx-demo.mp4', 'apps/web/public/patient/index.html', 'apps/web/public/landing/ops.webp', '.env.example', 'apps/web/package-lock.json']) {
      expect(ig.ignores(p), p).toBe(false);
    }
    const local = ignore().add(read(web, '.vercelignore'));
    expect(local.ignores('node_modules/next/package.json')).toBe(true);
    expect(local.ignores('.env.local')).toBe(true);
    expect(local.ignores('app/page.tsx')).toBe(false);
  });

  it('.env.example documents every variable the platform reads, with MODEL_PROVIDER=mock set explicitly', () => {
    const env = read(repo, '.env.example');
    expect(env).toMatch(/^MODEL_PROVIDER=mock$/m);
    for (const name of ['DEMO_SEED', 'DEMO_AUTOSEED', 'DEMO_TOKEN', 'MEDX_STORE', 'MEDX_STORE_PATH', 'MEDX_STORE_NS', 'DATABASE_URL', 'POSTGRES_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
      'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NEXT_PUBLIC_SITE_URL', 'CRON_SECRET', 'MEDX_STRICT_ROLES', 'MEDX_RATE_LIMIT_PER_MIN', 'MEDX_COMMIT', 'ALLOWED_ORIGINS',
      'AMD_BASE_URL', 'AMD_API_KEY', 'AMD_MODEL', 'AMD_MODEL_FALLBACK', 'AMD_JSON_SCHEMA', 'AMD_HARDWARE_LABEL', 'LLM_TIMEOUT_MS']) {
      expect(env, name).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
    }
    // The reset route is POST with the x-demo-token header (never a GET).
    expect(env).toMatch(/POST \/api\/demo\/reset/);
    expect(env).toMatch(/x-demo-token/);
    expect(env).not.toMatch(/GET \/api\/demo\/reset/);
  });

  it('every process.env variable read by app, lib or components code is documented in .env.example', () => {
    const platform = new Set(['NODE_ENV', 'VITEST', 'VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_GIT_COMMIT_SHA', 'RENDER_GIT_COMMIT', 'MEDX_BUILD_COMMIT', 'MEDX_REGION', 'MEDX_DIST_DIR']);
    const env = read(repo, '.env.example');
    const used = new Set<string>();
    const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
      const p = path.join(d, n);
      if (n === 'node_modules' || n === '__tests__' || n.startsWith('.')) return [];
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
    });
    for (const file of ['app', 'lib', 'components'].flatMap(d => walk(path.join(web, d)))) for (const m of read(file).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(m[1]);
    const missing = [...used].filter(name => !platform.has(name) && !new RegExp(`^#? ?${name}=`, 'm').test(env));
    expect(missing, `document these in .env.example: ${missing.join(', ')}`).toEqual([]);
  });

  it('the Dockerfile no longer claims lint is skipped and still builds the standalone image', () => {
    const docker = read(web, 'Dockerfile');
    expect(docker).not.toMatch(/skip here so a lint nit/);
    expect(docker).toMatch(/next build runs ESLint and the type check/);
    expect(docker).toMatch(/tsconfig\.build\.json/);
    expect(docker).toMatch(/\.next\/standalone/);
  });
});

describe('security for a public URL', () => {
  it('sends a CSP that fits the app (self-hosted fonts, video, QR data URLs) and allows the microphone for this origin only', async () => {
    const config = await loadNextConfig({ NODE_ENV: 'production', VERCEL_ENV: 'production' });
    const h = await headersFor(config, '/:path*');
    const csp = Object.fromEntries(h['Content-Security-Policy'].split('; ').map((d: string) => { const [k, ...v] = d.split(' '); return [k, v.join(' ')]; }));
    expect(csp['default-src']).toBe("'self'");
    expect(csp['script-src']).toBe("'self' 'unsafe-inline'");
    expect(csp['font-src']).toContain("'self'");
    expect(csp['media-src']).toContain("'self'");
    expect(csp['img-src']).toContain('data:');
    expect(csp['connect-src']).toBe("'self'");
    expect(csp['object-src']).toBe("'none'");
    expect(csp['frame-ancestors']).toBe("'self'");
    expect(h['Permissions-Policy']).toMatch(/microphone=\(self\)/);
    expect(h['Permissions-Policy']).toMatch(/camera=\(\)/);
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    // Development keeps eval and the HMR socket working; previews allow the Vercel toolbar.
    const dev = await headersFor(await loadNextConfig({ NODE_ENV: 'development' }), '/:path*');
    expect(dev['Content-Security-Policy']).toMatch(/'unsafe-eval'/);
    const preview = await headersFor(await loadNextConfig({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), '/:path*');
    expect(preview['Content-Security-Policy']).toMatch(/script-src [^;]*https:\/\/vercel\.live/);
  });

  it('client components read no server secrets (only NEXT_PUBLIC_* or NODE_ENV)', () => {
    const offenders: string[] = [];
    const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
      const p = path.join(d, n);
      if (n === 'node_modules' || n === 'api' || n.startsWith('.')) return [];
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
    for (const file of ['app', 'components'].flatMap(d => walk(path.join(web, d)))) {
      const src = read(file);
      if (!/^\s*['"]use client['"]/m.test(src)) continue;
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) if (!m[1].startsWith('NEXT_PUBLIC_') && m[1] !== 'NODE_ENV') offenders.push(`${path.relative(web, file)}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });

  it('demo reset and seed need DEMO_SEED=1 plus the exact x-demo-token (constant-time compare)', async () => {
    const req = (token?: string) => new Request('http://localhost/api/demo/reset', { method: 'POST', headers: token === undefined ? {} : { 'x-demo-token': token } });
    vi.stubEnv('DEMO_SEED', '1'); vi.stubEnv('DEMO_TOKEN', '');
    expect(() => requireDemoToken(req('anything'))).toThrow('Not found');
    vi.stubEnv('DEMO_TOKEN', 'tok-123');
    expect(() => requireDemoToken(req())).toThrow('Invalid demo token');
    expect(() => requireDemoToken(req('tok-12'))).toThrow('Invalid demo token');
    expect(() => requireDemoToken(req('tok-123'))).not.toThrow();
    expect((await demoReset(req('wrong'))).status).toBe(403);
    vi.stubEnv('DEMO_SEED', '');
    expect((await demoReset(req('tok-123'))).status).toBe(404);
    expect([sameSecret('a', 'a'), sameSecret('a', 'b'), sameSecret('', ''), sameSecret(null, 'x'), sameSecret('x', undefined)]).toEqual([true, false, false, false, false]);
  });

  it('JSON bodies over 64 kB are refused with 413, by header or by streamed size', async () => {
    const big = new Request('http://localhost/api/x', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(70_000) }) });
    expect((await handle(() => body(big), 200, big)).status).toBe(413);
    const declared = new Request('http://localhost/api/x', { method: 'POST', headers: { 'Content-Length': '999999' }, body: '{}' });
    expect((await handle(() => body(declared), 200, declared)).status).toBe(413);
    const fine = new Request('http://localhost/api/x', { method: 'POST', body: JSON.stringify({ text: 'ok' }) });
    expect(await (await handle(() => body(fine), 200, fine)).json()).toEqual({ text: 'ok' });
  });

  it('a busy or unreachable store answers 503 with Retry-After, never a guessed success', async () => {
    const busy = await handle(() => { throw new StoreBusyError(); });
    expect(busy.status).toBe(503); expect(busy.headers.get('Retry-After')).toBe('1');
    expect(await busy.json()).toEqual({ error: 'Store busy, retry', code: 'internal' });
    const down = await handle(() => { throw new StoreUnavailableError(); });
    expect(down.status).toBe(503); expect(down.headers.get('Retry-After')).toBe('5');
    expect((await down.json()).error).toMatch(/needs human review/);
  });
});

describe('daily demo reset via Vercel Cron (C-02)', () => {
  const cron = (auth?: string) => new Request('http://localhost/api/cron/reset', { headers: auth === undefined ? {} : { authorization: auth } });

  it('401 unless Authorization is exactly "Bearer ${CRON_SECRET}"', async () => {
    vi.stubEnv('DEMO_SEED', '1');
    vi.stubEnv('CRON_SECRET', '');
    expect((await cronReset(cron('Bearer '))).status).toBe(401);
    vi.stubEnv('CRON_SECRET', 'cron-s3cret');
    expect((await cronReset(cron())).status).toBe(401);
    expect((await cronReset(cron('Bearer wrong'))).status).toBe(401);
    expect((await cronReset(cron('cron-s3cret'))).status).toBe(401);
    expect(await (await cronReset(cron('Bearer wrong'))).json()).toEqual({ error: 'Unauthorized', code: 'bad_request' });
  });

  it('404 unless DEMO_SEED=1', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-s3cret'); vi.stubEnv('DEMO_SEED', '');
    expect((await cronReset(cron('Bearer cron-s3cret'))).status).toBe(404);
  });

  it('otherwise reseeds the synthetic demo from scratch in mock mode and returns 200 with counts only', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-s3cret'); vi.stubEnv('DEMO_SEED', '1');
    const visitor = createSession('en');
    const res = await cronReset(cron('Bearer cron-s3cret'));
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result).toMatchObject({ status: 'reset', reused: 0 });
    expect(result.created).toBeGreaterThan(0);
    expect(typeof result.mismatches).toBe('number');
    expect(Object.keys(result).sort()).toEqual(['byStatus', 'created', 'mismatches', 'reused', 'status']);
    const sessions = getSessions();
    expect(sessions.map(s => s.id)).not.toContain(visitor.id);
    const demo = new Set(getAudit().filter(e => e.type === 'session_created' && e.payload.demoCaseId).map(e => e.sessionId));
    expect(sessions.every(s => demo.has(s.id))).toBe(true);
    expect(getAudit().some(e => e.sessionId === visitor.id)).toBe(false);
  });
});

describe('health honesty', () => {
  it('reports a 7-character commit when one is known, and the region', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '38e3382aa1b2c3d4e5f60718293a4b5c6d7e8f90'); vi.stubEnv('VERCEL_REGION', 'sin1');
    expect(await (await health(new Request('http://localhost/api/health'))).json()).toMatchObject({ commit: '38e3382', region: 'sin1', provider: 'mock', providerConfigured: true });
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', ''); vi.stubEnv('MEDX_COMMIT', 'not-a-sha'); vi.stubEnv('VERCEL_REGION', '');
    expect(await (await health(new Request('http://localhost/api/health'))).json()).toMatchObject({ commit: 'unknown', region: 'local' });
  });

  it('says when the AMD provider is selected but not configured (every call would abstain)', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'amd'); vi.stubEnv('AMD_BASE_URL', ''); vi.stubEnv('AMD_API_KEY', ''); vi.stubEnv('AMD_MODEL', '');
    expect(await (await health(new Request('http://localhost/api/health'))).json()).toMatchObject({ provider: 'amd-tokenfactory', providerConfigured: false });
  });
});
