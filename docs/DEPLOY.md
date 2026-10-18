# Deploying MedX

Research prototype, synthetic data only. This guide covers the public demo on Vercel (primary), and Docker and Render as single-instance alternatives. Every value below was checked against the repo on Sun 18 Oct 2026: `apps/web/vercel.json`, `apps/web/next.config.ts`, `apps/web/package.json`, the root `.vercelignore`, `.env.example`, `render.yaml` and `docs/reports/w20-platform.md`.

## 1. The public demo at a glance

| Item | Value |
|---|---|
| Vercel account | `kanompung1988` |
| Project | `medx` |
| Production URL | https://medx.areazeroai.com |
| Deploy method | **Vercel CLI from the repo root.** The project is **not connected to GitHub** (owner decision, Sat 17 Oct 2026: the repository belongs to another account). Commits are still pushed to GitHub; Vercel never builds from GitHub. |
| Framework | Next.js 15.5 (`apps/web`) |
| Root directory | `apps/web`, with files outside the root directory included in the build |
| Node.js | 22.x |
| Region | `sin1` (Singapore) |
| Shared store | Neon serverless Postgres (`DATABASE_URL`, set by the Neon integration in all environments) |
| Cron | `GET /api/cron/reset`, daily at 03:00 ICT |
| Model | `MODEL_PROVIDER=mock` until an AMD Token Factory key is configured |

## 2. Project settings (Vercel dashboard, Settings → Build and Deployment)

| Setting | Value | Why |
|---|---|---|
| Framework preset | Next.js | `apps/web/vercel.json` also sets `"framework": "nextjs"` |
| Root directory | `apps/web` | The app lives there |
| Include files outside the root directory in the Build Step | **On** | `apps/web` imports `../../packages/shared` (contracts, rule files) and `../../data/cases` (demo fixtures). Without them the build fails |
| Node.js version | 22.x | `apps/web/package.json` `engines.node` is `22.x` |
| Install command | default (`npm install` in `apps/web`) | `@medx/shared` is a `file:../../packages/shared` dependency |
| Build command | default (`npm run build` = `next build --turbopack`) | The build type-checks app code with `tsconfig.build.json`, which excludes tests |
| Output | default | `next.config.ts` turns off `output: "standalone"` when `VERCEL` is set |
| Function region | `sin1` | `apps/web/vercel.json` `regions` |
| Fluid compute | On | `/api/demo/reset` and `/api/cron/reset` use `maxDuration = 300`, which needs Fluid compute on the Hobby plan |

`apps/web/vercel.json` (checked in):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["sin1"],
  "crons": [{ "path": "/api/cron/reset", "schedule": "0 20 * * *" }]
}
```

`0 20 * * *` is 20:00 UTC, which is 03:00 ICT.

## 3. Shared store: Neon Postgres

Vercel runs many short-lived instances that share neither memory nor `/tmp`. Without a shared store, the phone, the nurse and the pharmacist could each see a different copy of the demo. MedX therefore keeps the whole demo state in **one Neon Postgres row**.

1. In the Vercel dashboard, open **Storage** (or the Marketplace), add **Neon** Postgres and connect it to project `medx` for Production, Preview and Development. The integration sets `DATABASE_URL` (and `POSTGRES_URL`). Choose a Singapore (`ap-southeast-1`) database to sit next to `sin1`: the snapshot is read and written per change, so latency matters. On the public demo this is already done.
2. Nothing else is needed. With `MEDX_STORE` unset, the store is auto-detected in this order: `DATABASE_URL` or `POSTGRES_URL` → Postgres; Upstash URL and token → Redis; otherwise the JSON file.
3. On first use the server runs `CREATE TABLE IF NOT EXISTS medx_store(id text primary key, version bigint not null, data jsonb not null, updated_at timestamptz default now())`. The row id is `medx:{MEDX_STORE_NS || VERCEL_ENV || 'local'}:snapshot`, so Production and Preview never share data.
4. How writes stay correct across instances:
   - every request first syncs (`SELECT version`, full read only when it moved), runs, then flushes before the response is sent;
   - writes are compare-and-set: `UPDATE ... WHERE id = $1 AND version = $2` (or `INSERT ... ON CONFLICT DO NOTHING` for the first write);
   - on a conflict the row is re-read and the write-set merged (sessions by id, audit events as a union by id, so the audit log stays append-only); per-session locks check a revision and replay the locked step on fresh state instead of overwriting;
   - after 5 retries the request answers 503 `{"error":"Store busy, retry"}` with `Retry-After: 1`;
   - any database error answers 503 ("Shared store unavailable; this change may not have been saved...") and nothing is kept in memory. There is never a silent fallback to `/tmp`.
5. Size guard: above 2 MB the flush prunes non-demo sessions older than 24 hours, then idle per-visitor demo cases (idle 90 minutes or more), oldest first. Seeded cases and all audit events stay.

**Optional: Upstash Redis REST.** Set `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) to use Upstash as the snapshot store instead (same compare-and-set contract), or alongside Neon to make the POST rate limit shared across instances. Without Upstash the rate limit is counted in memory per instance; this is accepted for the demo.

## 4. Environment variables

Set in Settings → Environment Variables. Never commit real values; `.env` and `.env.*` are git-ignored and excluded from uploads by the root `.vercelignore`.

| Variable | Production value | Notes |
|---|---|---|
| `MODEL_PROVIDER` | `mock` | Set it explicitly. Anything other than `mock` selects the AMD provider |
| `DATABASE_URL` | from the Neon integration | `POSTGRES_URL` is read as a fallback |
| `DEMO_SEED` | `1` | Enables the synthetic demo routes (`/api/demo/*`, the persona launcher, the cron reset) |
| `DEMO_AUTOSEED` | `1` | Seeds the 14 synthetic demo cases once when the store is empty |
| `DEMO_TOKEN` | random secret (`openssl rand -hex 24`) | Header `x-demo-token` for `POST /api/demo/reset` and `/api/dev/seed`; without it those routes answer 404 |
| `CRON_SECRET` | random secret | Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without it the cron route answers 401 |
| `MEDX_STRICT_ROLES` | `1` | Clinical writes must come from a known staff id with the right role (403 otherwise). Closes the two-person-check alias bypass found in the wave 20 code review |
| `NEXT_PUBLIC_SITE_URL` | `https://medx.areazeroai.com` | Optional (this is the default). Used for landing links, Open Graph and the patient QR. Build-time |
| `MEDX_RATE_LIMIT_PER_MIN` | optional | POSTs per minute per client IP before 429 (default 30, `0` disables). The live consult posts one request per line and a venue shares one IP, so consider `120` for a judged live session |
| `MEDX_TZ` | optional | Clinic timezone for "today" counts (default `Asia/Bangkok`) |
| `MEDX_STORE` | leave unset | `postgres`, `redis` or `file` to force a store; an explicit store with a missing URL fails closed with 503 |
| `MEDX_STORE_NS` | leave unset | Defaults to `VERCEL_ENV` |
| `AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL` | only with `MODEL_PROVIDER=amd` | From the AMD Token Factory console. `AMD_MODEL_FALLBACK`, `AMD_JSON_SCHEMA`, `AMD_HARDWARE_LABEL`, `LLM_TIMEOUT_MS` are optional |
| `MEDX_COMMIT` | pass at deploy time | CLI deploys have no git metadata; see section 5 |

## 5. Deploy from the CLI

The deploy must upload the **repo root**, because the build needs `packages/shared` and `data/cases`. The root `.vercel/project.json` links the folder to project `medx`, and the root `.vercelignore` decides what is uploaded: it keeps `apps/web` (including `public/patient`, `public/media`, `public/landing`, `public/brand`), `packages/shared` and `data/cases`, and drops `docs/`, `pitch/`, `qa/`, `apps/mobile/`, `eval/runs`, build output, `node_modules` and every `.env*` except `.env.example`.

```bash
# once per machine, from the repo root
npm i -g vercel
vercel login
vercel link --project medx        # answers: scope kanompung1988, project medx

# every deploy, from the repo root, on a clean, committed tree
vercel deploy --prod --build-env MEDX_COMMIT=$(git rev-parse --short HEAD)
```

- `--build-env MEDX_COMMIT=...` puts the commit into `/api/health`; without it health reports `"commit":"unknown"` (Vercel sets `VERCEL_GIT_COMMIT_SHA` only for git deploys).
- A preview first: `vercel deploy` (without `--prod`) gives a preview URL with its own store namespace (`preview`).
- Rollback: `vercel rollback` or promote an earlier deployment in the dashboard. The store is not rolled back.
- `/media/*` is served with `Cache-Control: public, max-age=31536000, immutable`. A re-cut video must use a new file name, or returning visitors keep the old one.
- The landing page reads `public/media` and `public/landing` at build time: a new video or still appears only after the next deploy.
- After changing `apps/mobile/src` or `packages/shared/src`, run `bash scripts/build-patient-web.sh` before deploying (a test fails while the patient export is stale).

## 6. Domain: medx.areazeroai.com

`areazeroai.com` is on Vercel DNS in a **different** Vercel account from the one that owns project `medx`. The domain is already attached to project `medx`: at 07:15 ICT on Sun 18 Oct 2026 it answered with an earlier build of the project (before the wave 20 deploy). To set it up again (or on a new project):

1. Project `medx` → Settings → Domains → Add `medx.areazeroai.com`.
2. Because the apex domain belongs to another account, Vercel may ask to verify ownership with a TXT record. The owner of the `areazeroai.com` DNS zone adds it in that account: name `_vercel` (that is, `_vercel.areazeroai.com`), value exactly as the Domains page shows (`vc-domain-verify=medx.areazeroai.com,...`).
3. In the same DNS zone, point `medx` at Vercel: a `CNAME` to `cname.vercel-dns.com` (or the value the Domains page shows).
4. Wait until the Domains page shows "Valid Configuration"; Vercel issues the certificate itself.

## 7. Post-deploy checks

Read-only first:

```bash
curl -s https://medx.areazeroai.com/api/health
```

Expected keys: `status: "ok"`, `provider: "mock"`, `model: "deterministic-mock"`, `providerConfigured: true`, `store: "postgres"`, `storeOk: true`, `storeVersion`, `sessions` (a count), `commit` (your short sha), `region: "sin1"`. No credential ever appears in this body (a test checks it).

```bash
BASE=https://medx.areazeroai.com node qa/31-landing.mjs           # landing order, English, persona links, honest model label, video, robots, health
BASE=https://medx.areazeroai.com node qa/32-english-default.mjs   # English first render of /, /demo, staff pages and /patient
```

These write synthetic sessions (fine on the demo, cleared by the nightly reset):

```bash
BASE=https://medx.areazeroai.com node qa/06-store-coherence.mjs
BASE=https://medx.areazeroai.com node qa/30-deploy-coherence.mjs      # parallel requests across instances see one store
BASE=https://medx.areazeroai.com EXPECT_STRICT_ROLES=1 node qa/33-security.mjs
PLAYWRIGHT_MODULE=<path>/playwright/index.mjs BASE=https://medx.areazeroai.com node qa/34-browser.mjs   # optional
curl -X POST -H "x-demo-token: $DEMO_TOKEN" https://medx.areazeroai.com/api/demo/reset                 # expect 200
```

`scripts/e2e-journey.mjs` sends about 65 to 70 POSTs, more than the default 30 per minute per instance, so run it against a local `next start`, or raise `MEDX_RATE_LIMIT_PER_MIN` for a test window. Manual check: open two browsers on different networks, start a visit on the phone, and confirm it appears in the nurse queue; then confirm a pharmacist action appears on `/ops`.

## 8. Daily reset

`GET /api/cron/reset` answers 401 unless `Authorization` is exactly `Bearer $CRON_SECRET`, and 404 unless `DEMO_SEED=1`. With `MODEL_PROVIDER=mock` it reseeds synchronously and returns 200 with counts only; with a real provider it returns 202 and reseeds in the background. The reset clears demo cases and their audit log, which the landing page states as a limitation.

## 9. Security on the public URL

Set in `next.config.ts` for every route: a Content-Security-Policy that keeps everything first-party (`default-src 'self'`, fonts self-hosted by `next/font`, media from `/media`), `Permissions-Policy` (microphone for this origin only; camera, location and payment off), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, HSTS, and no `X-Powered-By`. In `app/api/_http.ts`: the per-IP POST rate limit, a 64 kB JSON body cap and constant-time comparison of the demo token and cron secret. Any external script, font or image added later is blocked by the CSP unless it is served from the app itself.

## 10. Alternatives (single instance)

**Docker** (JSON file store in `/app/apps/web/.data`; the build needs network access for `next/font/google`):

```bash
docker build -f apps/web/Dockerfile --build-arg MEDX_COMMIT=$(git rev-parse --short HEAD) -t medx .
docker run --rm -p 3000:3000 -e MODEL_PROVIDER=mock -e DEMO_SEED=1 -e DEMO_AUTOSEED=1 -e DEMO_TOKEN=pick-a-secret medx
# or: docker compose --env-file .env up --build
```

`docker build` was not re-run in wave 20 (the Docker daemon was not running on the build machine; see `docs/reports/w20-platform.md`).

**Render** ([`render.yaml`](../render.yaml)): a Blueprint for one Docker web service on the free plan with `MODEL_PROVIDER=mock`, `DEMO_SEED=1`, `DEMO_AUTOSEED=1`, a generated `DEMO_TOKEN` and the file store at `/tmp/medx/store.json` (ephemeral; `/api/health` reports `tmp-ephemeral`). One instance keeps the demo consistent without a database. To share state with Vercel instead, add `DATABASE_URL` (and a distinct `MEDX_STORE_NS` if it must not share Vercel's rows). Render → New → Blueprint → select the repo → Apply. Note that the rate limit trusts the first `x-forwarded-for` hop, which is safe behind Vercel's edge but not behind a proxy that passes the header through.
