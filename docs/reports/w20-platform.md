# W20 platform report: shared Neon store, Vercel config, security headers, rate limit, daily reset

STATUS: partial. Everything inside my scope is built and tested. Three items need someone else:
- One existing test (`llm-api.test.ts:102`) pins the old 3-field health body, and M-02 itself requires new fields there. It needs a one-line change by its owner.
- The `maxDuration = 60` exports on the five long routes are in route files outside my scope.
- `docker build` was not run: the Docker daemon is not running on this machine.

Not committed; the orchestrator handles git and Vercel.

## SUMMARY
Phone, clinician and pharmacy now see one state on Vercel. Local dev, Docker, Render and every existing test keep the file store, with no change in behaviour.

1. Store selection (`lib/pipeline/kvStore.ts`). `MEDX_STORE=postgres|redis|file` wins. When it is unset, the store is auto-detected: `DATABASE_URL`/`POSTGRES_URL` → Neon Postgres, then Upstash (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*`) → Redis, else file.
   - Under vitest the file store is always used, unless a test injects a backend.
   - An explicit store with a missing URL, or an unknown `MEDX_STORE` value, fails safe with 503 on every request. It never falls back to `/tmp` silently.
2. Neon (primary, owner decision 6). The backend uses the official `@neondatabase/serverless` `neon()` tagged queries over HTTP. On first use it runs `CREATE TABLE IF NOT EXISTS medx_store(id text primary key, version bigint not null, data jsonb not null, updated_at timestamptz default now())`. If two cold instances race that statement, a `to_regclass` check covers the catalog collision.
   - One whole-snapshot row per namespace: `medx:{MEDX_STORE_NS || VERCEL_ENV || 'local'}:snapshot`.
   - Writes are compare-and-set: `UPDATE ... WHERE id = $1 AND version = $2`, or `INSERT ... ON CONFLICT DO NOTHING` for the first write.
   - Upstash REST is the optional alternative backend, with the same contract (Lua compare-and-set).
3. Request flow (`app/api/_http.ts` `handle()`):
   1. per-IP POST rate limit;
   2. `syncStore()`: a `SELECT version`, plus a full read only when the version moved;
   3. the route function, in a request write-set;
   4. `flushStore()` lands the writes before the response is built.

   `syncStore()` and `flushStore()` are no-ops with the file store.
4. Write-sets and concurrency (`lib/pipeline/store.ts`). The store API stays synchronous, so no pipeline file had to change. In shared mode, writes are staged in a write-set (AsyncLocalStorage): one per request and one per `withSessionLock`. A lock commits its write-set, and any not-yet-committed ancestors, before it releases.
   - On a version conflict the row is re-read and the write-set merged on top. Sessions are merged by id. Audit events are a union by event id (invariant 4). A newly created session whose B-0xx code collides gets the lowest free code. `handle()` patches that code into the response.
   - Per-session locking uses a version check, not only in-process locks. Each session id, and each lock key (for example `demo-start`), carries a revision in the snapshot. If another instance changed it after this write-set read it, the locked function is replayed on fresh state; it never overwrites the other change.
   - After 5 retries the request returns 503 `{error:'Store busy, retry'}` with `Retry-After: 1`. A conflicting write outside any lock is refused with 503, never merged.
   - Writes made before an error still land, as with the file store (an abstention is recorded and then reported).
   - A write identical to what is stored is not staged, so polling GETs (consult refresh) do not rewrite the row.
   - A write that arrives after its response was sent (work scheduled with `after()`) moves to the instance root, which is flushed on a timer.
5. Fail safe. Any database error, or an unreadable snapshot, returns 503 for reads and writes: "Shared store unavailable; this change may not have been saved. Reload and retry; needs human review if it persists." A write that cannot land is not kept in memory either. Server logs name only the operation (driver messages are cut at 200 characters and never sent to clients).
6. Seeded-once guard (row-level). `withSessionLock('dev-demo-seed')` takes a lease row first (`medx:{ns}:seed-lease`, TTL 120 s, wait up to 30 s, released in `finally`). Only one instance seeds or resets at a time. A waiting instance then refreshes, and the seed reuses the demo cases it finds.
7. Snapshot cap (C-01). When the serialized snapshot exceeds 2 MB, the flush prunes non-demo sessions older than 24 h that the current commit did not touch. Their audit events stay.
8. File-store fallback. The path is `MEDX_STORE_PATH`, else `os.tmpdir()/medx/store.json` on Vercel (not the read-only `/var/task`), else `apps/web/.data/store.json`.
9. Rate limit (`lib/pipeline/rateLimit.ts`, C-01). POST only; 30 per minute per IP by default (`MEDX_RATE_LIMIT_PER_MIN`, 0 disables; off under vitest unless set).
   - The key is `medx:{ns}:rl:{first x-forwarded-for hop}:{minute}`.
   - With Upstash: `INCR`, then `EXPIRE 60` on the first hit. Without it, or when Redis errors, the count is in memory per instance (accepted and documented).
   - The 31st POST gets 429 with `Retry-After`.
10. Health (`GET /api/health`) adds:
    - `status` (`ok`/`degraded`);
    - `providerConfigured` (false when AMD is selected but its URL, key or model is missing);
    - `store` (`postgres`|`redis`|`tmp-ephemeral`|`file`), `storeOk`, `storeVersion`;
    - `sessions` (a count only), `commit` (7 characters, or `unknown`), `region`.

    `GET` still returns the Response synchronously (existing callers read it without awaiting); the JSON body streams in once the store answers.
11. Daily reset (C-02). `GET /api/cron/reset`:
    - 401 unless `Authorization` is exactly `Bearer ${CRON_SECRET}` (401 also when `CRON_SECRET` is unset);
    - 404 unless `DEMO_SEED=1`;
    - with `MODEL_PROVIDER=mock`: runs `seedDemo({reset:true})` and returns 200 with counts only;
    - with a real provider: runs `startDemoSeed({reset:true}, after)` and returns 202, the same pattern as `/api/demo/reset`.

    The cron is in `apps/web/vercel.json`: `0 20 * * *` = 03:00 ICT. `maxDuration = 300`, the same as the demo reset route.
12. Security for a public URL (`next.config.ts` `headers()`):
    - CSP: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (Next inline bootstrap, no nonce; `'unsafe-eval'` and `ws:` in dev only), `img-src 'self' data: blob:` (QR data URLs), `font-src 'self' data:` (next/font is self-hosted), `media-src 'self' blob:`, `connect-src 'self'`, `worker-src 'self' blob:`, `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Preview deployments also allow the Vercel toolbar (vercel.live).
    - `Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=(), browsing-topics=()`.
    - nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, HSTS, and `poweredByHeader: false`.
    - Demo token and cron secret are compared in constant time (`sameSecret`).
    - JSON bodies stay capped at 64 kB (413), by header or by streamed size.
13. Vercel and build config (M-03):
    - `apps/web/vercel.json`: `$schema`, `framework: nextjs`, `regions ["sin1"]`, crons.
    - `engines.node 22.x`.
    - `output: 'standalone'` only when `!VERCEL`.
    - `/media/:path*` is cached `public, max-age=31536000, immutable`.
    - `typescript.tsconfigPath: 'tsconfig.build.json'`, which excludes `**/__tests__/**`, `**/*.test.ts(x)` and `vitest.config.ts`; vitest keeps the full tsconfig.
    - `env.MEDX_BUILD_COMMIT` holds the commit (from git, `MEDX_COMMIT` or `VERCEL_GIT_COMMIT_SHA`).
    - `MEDX_DIST_DIR` allows a check build that does not collide with `.next`.
    - Root `.vercelignore` excludes `/NANOPROMPT/`, `/F/`, `**/node_modules`, `**/.next`, `**/.data`, `/eval/runs`, `/apps/mobile/`, `/docs/`, `/pitch/`, `/qa/`, `.env*` (except `.env.example`) and large media sources. It keeps `packages/shared`, `data/cases` and `apps/web/public/**`, the video included.
    - `apps/web/.vercelignore` covers uploads made from `apps/web`.
    - `.env.example` documents every variable; the reset line says POST plus the `x-demo-token` header.
    - Dockerfile: the lint comment is fixed, it copies `tsconfig.build.json`, and it takes an optional `MEDX_COMMIT` build arg.
    - `.gitignore` adds `.next-*/`, `.data/` and `*.tsbuildinfo`.
    - `render.yaml` explains the store choice in a comment.
14. `middleware.ts` was not created on purpose. Static headers in `next.config.ts` cover security without a per-request Edge invocation. Rate limiting and body limits live in `handle()`.

## FILES CHANGED
- `apps/web/lib/pipeline/store.ts` (shared mode, write-sets, commit/merge/replay, lease, cap, `storeInfo`, test hooks `setStoreBackend`, `newStoreInstance`, `storeTuning`)
- `apps/web/lib/pipeline/kvStore.ts` (new: Neon and Upstash backends, env selection, namespacing)
- `apps/web/lib/pipeline/rateLimit.ts` (new)
- `apps/web/app/api/_http.ts` (rate limit, sync/flush, 503 mapping, `sameSecret`)
- `apps/web/app/api/health/route.ts`
- `apps/web/app/api/cron/reset/route.ts` (new)
- `apps/web/lib/pipeline/__tests__/store-remote.test.ts` (new, 56 tests)
- `apps/web/lib/pipeline/__tests__/w20-platform.test.ts` (new, 18 tests)
- `apps/web/next.config.ts`, `apps/web/vercel.json` (new), `apps/web/tsconfig.build.json` (new)
- `apps/web/package.json` (engines, `@neondatabase/serverless ^1.2.0`), `apps/web/package-lock.json` (from `npm install`)
- `apps/web/Dockerfile`, `.vercelignore` (new), `apps/web/.vercelignore` (new), `.env.example`, `.gitignore`, `render.yaml`

## TESTS RUN + RESULTS
- Baseline before my changes: 29 files, 1959 tests, all passing.
- Final full suite (`vitest run`, apps/web): 39 files, 2186 tests. 2185 passed, 1 failed: `llm-api.test.ts > returns health metadata without credentials` (`toEqual` on the old 3-field health body; see request 1). Other agents added files during the wave, which accounts for the higher count.
- New: `store-remote.test.ts` 56/56 and `w20-platform.test.ts` 18/18. Each shared-store scenario runs twice: on a fake Neon tagged-SQL driver, and on a fake Upstash REST fetch implementing GET, SET (NX/PX), INCR, EXPIRE, EVAL and DEL. M-02 acceptance:
  - (a) Two instances (`globalThis.medxStore` reset between them) create sessions at once; both exist after `syncStore()`. Also two concurrent `POST /api/sessions` on simulated instances.
  - (b) Concurrent patient turns via `POST /api/sessions/:id/turns` from two instances keep both turns. A gated `withSessionLock` replays: run count 2, order `['from B','from A']`. Locked writes within one instance never overlap.
  - (c) Audit union: 5 events kept, ids unique.
  - (d) The B-0xx collision is reassigned (B-001/B-002) and the response carries the final code. A non-session lock key (cap) lets exactly one of two instances claim.
  - (e) `resetDemoStore` empties the remote snapshot. A demo reset replaces every shared session.
  - (f) Under a hostile compare-and-set: 503 `{error:'Store busy, retry', code:'internal'}`, `Retry-After: 1`, exactly 6 write attempts (first plus 5 retries), nothing stored. A session that keeps changing elsewhere gives `StoreBusyError` after 6 runs, with no blind overwrite.
  - Also covered: `handle()` sync-before and flush-after; DB down gives 503 for GET and POST with nothing stored; writes failing gives 503 and the turn is not kept in memory; a corrupt snapshot fails closed; two cold auto-seeding instances seed once (unique demo ids and codes); the lease (one owner, non-owner cannot release, a waiting seed is blocked then reuses, a stale lease expires); identical rewrites make no DB writes; the 2 MB cap prunes 25 stale sessions but keeps the demo, the recent session and all audit; health shape and degraded; namespacing; an `after()`-late write lands; a nested-lock commit followed by a request write is not a false conflict; env selection, Vercel `/tmp` path and namespace fallback.
  - C-01 rate limit: 31st POST → 429, other IP 200, `INCR medx:test:rl:198.51.100.1:<minute>` ×31, `EXPIRE … 60` once per key, GET never limited, memory fallback when Redis is null or down.
- Mutation checks (each change made to `store.ts` temporarily, then restored and verified identical with `cmp`):
  - lock-key revision check removed → 2 tests fail (the cap test).
  - per-session conflict check removed → 6 fail; with the write delay added to the fakes, the realistic concurrent-turns test also fails (2).
  - code reassignment removed → 4 fail.
- Real SQL check (scratchpad only, nothing added to the repo): `postgresBackend` against PGlite 0.3.7 (Postgres in WASM). 10/10 checks pass: missing row, create once, CAS on version, 2.5 MB Thai jsonb round-trip, lease exclusivity and non-owner release, stale-lease takeover after the TTL, repeat CREATE TABLE, `to_regclass`.
- The real `neon()` driver from `@neondatabase/serverless` 1.2.0, with `neonConfig.fetchFunction` routed to PGlite in Neon's wire format: all assertions pass. Queries go to `https://<host>/sql` as `$1..$n` with string params, and int8/jsonb are parsed. The password does not appear in any body param.
- `tsc --noEmit -p .`: exit 0, 0 errors (whole app). `eslint` on my 9 TS files: exit 0.
- `next build --turbopack` with `MEDX_DIST_DIR=.next-w20` (isolated, so no collision with `.next`): exit 0 in 53.9 s. "Using tsconfig file: tsconfig.build.json"; lint and type check ran; 40 routes listed, `/api/cron/reset` among them; `standalone/apps/web/server.js` emitted (VERCEL unset). Next rewrote `tsconfig.build.json` include and `next-env.d.ts` for the custom distDir; I restored both from backup and deleted `.next-w20`.
- No secrets in client bundles. The 48 files in `.next-w20/static` contain no `.env.local` value (`VERCEL_OIDC_TOKEN` checked by value, not printed) and none of the names DATABASE_URL, POSTGRES_URL, DEMO_TOKEN, CRON_SECRET, AMD_API_KEY or KV_REST_API_TOKEN. A static test also checks that `'use client'` files read only `NEXT_PUBLIC_*`/`NODE_ENV`. The HEAD commit `38e3382` is baked into the server bundle.
- `docker build`: NOT RUN. `docker version` says the daemon pipe is missing (Docker Desktop not running).

## EVIDENCE
- Build log: `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\next-build.log`
- SQL validators: `...\scratchpad\scripts\pg-validate.mjs` and `...\scratchpad\scripts\neon-driver-validate.mjs` (same scratchpad folder).
- Numbers: 2185/2186 tests; 74 new tests; 6 write attempts before 503; 2 MB cap; 30 POST/min; lease TTL 120 s, wait 30 s.

## ASSUMPTIONS
- Deploys upload the repo root. `apps/web` imports `../../packages/shared` and `../../data/cases`, so a source deploy from `apps/web` alone cannot build. The project link currently lives in `apps/web/.vercel`, but the root `.vercelignore` is the one that applies to a root upload.
- The Neon database is in, or near, Singapore. The whole snapshot is read and written per change, so latency matters.
- In C-02, "in mock mode" means the synchronous reseed is for `MODEL_PROVIDER=mock`. With a real provider the route follows `/api/demo/reset` (202 plus `after`).
- The health route returns 200 even when the store is down (`status: 'degraded'`, `storeOk: false`), so the landing page can still read the model label. Writes then answer 503.
- `maxDuration = 300` for the cron route is valid because `/api/demo/reset` already uses 300, which needs Fluid compute on Hobby.

## RISKS
- Whole-snapshot writes: every locked write uploads the full snapshot (CAS on one row). That is fine at demo scale. But `DEMO_START_LIMIT = 150` per-visitor sessions could take the snapshot past 2 MB within a day, and only sessions older than 24 h are pruned. Each write then costs more until the 03:00 reset. Hot spots under heavy concurrent use answer 503 "Store busy, retry", by design.
- The rate limit of 30 POST/min per IP is shared by everyone behind one venue NAT, and the live consult posts one request per utterance. For a judged live demo, consider `MEDX_RATE_LIMIT_PER_MIN=120`. Without Upstash the limit is per instance.
- CSP: any external image, font or script added by the landing builders (a CDN logo, Google Fonts `<link>`) will be blocked. Assets must be local, which next/font already is.
- `/media/*` is immutable for a year. A re-cut video under the same name will not refresh for returning visitors. Use a new filename (or the orchestrator changes the header).
- Commit id on CLI deploys: Vercel sets `VERCEL_GIT_COMMIT_SHA` only for git deploys. Pass `--build-env MEDX_COMMIT=$(git rev-parse --short HEAD)`; otherwise health says `unknown`. Local and Docker builds get it from git or the build arg.
- Not exercised against the real Neon service (no credentials used locally). The SQL and the real driver were validated against PGlite only.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. `apps/web/lib/pipeline/__tests__/llm-api.test.ts:102` (AI engineer/orchestrator): replace `toEqual({ provider: 'mock', model: 'deterministic-mock', hardware: '\u2014' })` with `toMatchObject(...)`. M-02 requires the extra health fields. This is the only failing test.
2. M-03 `maxDuration = 60` (route owners): add `export const maxDuration = 60;` to `app/api/sessions/[id]/turns/route.ts`, `.../consult/route.ts`, `.../consult/turns/route.ts`, `.../consult/note/route.ts` and `.../orders/medications/route.ts`. I left `vercel.json` `functions` globs out because an unmatched pattern fails the Vercel build.
3. Optional contract change (`packages/shared/src/api.ts`): `ApiError.code` has no `store_busy`/`rate_limited`, so 503/429 use `internal`/`bad_request` plus the HTTP status and `Retry-After`. Clients should branch on the status.
4. M-13 (orchestrator):
   - Deploy from the repo root: copy or link `.vercel/project.json` there, or `vercel link --repo`.
   - Set `CRON_SECRET`, `DEMO_TOKEN`, `DEMO_SEED=1` and `DEMO_AUTOSEED=1`, and set `MODEL_PROVIDER` explicitly.
   - Optionally set `MEDX_RATE_LIMIT_PER_MIN` and `NEXT_PUBLIC_SITE_URL=https://medx.areazeroai.com`.
   - Pass `--build-env MEDX_COMMIT=…`.
   - `DATABASE_URL` is already set, so the store auto-selects Postgres. Then check `GET /api/health` → `store: "postgres"`, `storeOk: true`, `region: "sin1"`.

## NEXT ACTION
The orchestrator applies requests 1 and 2, runs `docker build -f apps/web/Dockerfile .` on a machine with Docker, then deploys (M-13). After deploying, open two browsers on different networks and check one shared queue: a patient turn on the phone appears in the clinician view, and a pharmacist action appears in ops.
