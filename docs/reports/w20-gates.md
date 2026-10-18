# w20 gates

## Gate A, round 1 (integration gate, Sun 18 Oct 2026, about 02:16 to 02:25 ICT)

STATUS: done (every gate command green in the final run). Live-browser checks are still open. They were not part of this gate and no server was started.

### SUMMARY
I ran the full gate on the merged working tree (branch feat/pharmacy-two-stage, uncommitted w20 work from all builders). It found one failure. `llm-api.test.ts` pinned the old 3-field `/api/health` body with `toEqual`. M-02 (platform) extended that body on purpose with status, providerConfigured, store, storeOk, storeVersion, sessions, commit and region.

Root-cause fix: I updated the test to match the new health contract without weakening it. It now checks:
- the exact key set (11 keys), so any extra field such as a credential fails the test;
- the provider, model and hardware values, plus status ok, storeOk and providerConfigured;
- a new no-leak check: AMD_API_KEY and AMD_BASE_URL are stubbed with sentinel values, and the raw response text must contain neither;
- the no-CORS-header and preflight-204 checks, as before.

I made no product code changes. After the fix, every command passed.

### FILES CHANGED
- `apps/web/lib/pipeline/__tests__/llm-api.test.ts`: the health test at line 101 (+7/-1)
- `docs/reports/w20-gates.md`: this report (new)

### TESTS RUN + RESULTS

All commands ran from apps/web unless noted.

| Command | Round-1 first run | Final run |
|---|---|---|
| `./node_modules/.bin/vitest run` | FAIL. 45 files: 1 failed, 44 passed. 2336 tests: 1 failed, 2335 passed. The failure was `llm-api.test.ts > HTTP contracts and CORS > returns health metadata without credentials and permits preflight` | PASS, exit 0. `Test Files 45 passed (45)`, `Tests 2336 passed (2336)`, 63.47 s |
| `./node_modules/.bin/tsc --noEmit -p .` | PASS, exit 0, no output | PASS, exit 0, no output |
| `./node_modules/.bin/eslint .` | PASS, exit 0, no output | PASS, exit 0, no output |
| `MODEL_PROVIDER=mock ./node_modules/.bin/next build` | PASS, exit 0 (run before the test edit) | PASS, exit 0. `Compiled successfully`, `Generating static pages (24/24)`, no warnings or errors in the log. Next.js 15.5.28 type-checks with tsconfig.build.json, which excludes tests |
| `node docs/clinical/check-consultrules.mjs` (repo root) | exit 0: `80 passed, 0 failed, 50 rules` | same |
| `node docs/clinical/check-medrules.mjs` | exit 0: `253 passed, 0 failed · medrules 1.2 · 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries` | same |
| `node docs/clinical/check-redflags.mjs` | exit 0: `175 passed, 0 failed, 18 rules` | same |
| `node docs/clinical/check-vitalrules.mjs` | exit 0: `13 cases + band coverage: all passed` | same |

### EVIDENCE

**Build routes.** These include `/`, `/th`, `/it`, `/demo`, `/demo/[persona]` (6 SSG paths), `/home`, `/ops`, `/pharmacy`, `/pharmacy/[id]`, `/review/**`, `/robots.txt`, `/sitemap.xml` and `/opengraph-image.png`. API routes include `/api/cron/reset`, `/api/demo/{cases,start,reset}`, `/sessions/[id]/pickup`, `.../dispense` and `.../pharmacy`. The landing `/` first-load JS is 129 kB.

**Static checks on the build output (no server):**
- **Landing images.** Every `/landing/*.webp` and `/brand/*.webp` path in the prerendered index, th, it and demo HTML exists in `public/`. Every `/brand` and `/landing` path referenced in app, components and lib source exists too.
- **Patient web export.** `public/patient/index.html` references the favicon plus the `__common`, `__expo-metro-runtime` and `entry` bundles. All of them exist. Every lazy chunk the bundles reference also exists: `_layout`, `done`, `help`, `index`, `intake`, `redflag`.
- **AMD wording.** The prerendered `/` contains "on AMD" 6 times, and every instance is honest:
  - "Gemma on AMD is the designed model target; the live label under the hood says what runs today"
  - "Demo runs a mock model; Gemma on AMD pending"
  - "Gemma accuracy and latency on AMD are not measured yet"

  It never says "runs on AMD".
- **Secrets.** `apps/web/.env.local` exists (the build reported "Environments: .env.local") and is git-ignored by `apps/web/.gitignore:43 .env*.local`. `.env.example` has no secret-shaped values (I scanned for postgres URLs with a password, `sk-` keys and `npg_` tokens).
- **.vercelignore.** The root file drops `/docs/`, `/apps/mobile/`, `/eval/runs` and `/pitch/`. No non-test file under `apps/web/app`, `lib`, `components` or `next.config.ts` imports or reads from those folders.

### ASSUMPTIONS
- The extended `/api/health` body is the intended M-02 contract. `docs/reports/w20-platform.md` request 1 asks for exactly this test change, and `w20-platform.test.ts` and `store-remote.test.ts` already cover the new fields.
- "Final run" means the last invocation of each command after my only edit, which was the test file. I reran the build after that edit as well.

### RISKS
- **No video yet.** `apps/web/public/media/` does not exist, so `medx-demo.mp4`, `medx-demo-poster.jpg` and `medx-demo.en.vtt` are missing. The landing handles this (the prerendered `/` has 0 `medx-demo.mp4` references), so the page is not broken. The "MedX in 60 seconds" section stays without a video until the video agent delivers and the site is redeployed.
- **html lang.** `/th` and `/it` render `<html lang="en">`. The language is set on inner wrappers instead (`/th`: 11 `lang="th"`, `/it`: 9 `lang="it"`). The page-level language is still English. This is a WCAG 3.1.1 concern for screen readers, not a gate failure. The landing builder or orchestrator should decide on a per-route root layout or `lang` handling.
- **Untracked build inputs.** Many files the build needs are untracked, so they must be committed with the wave: `apps/web/tsconfig.build.json` (next.config points at it), `apps/web/vercel.json`, both `.vercelignore` files, `app/_landing/`, `app/(marketing)/`, `app/demo/`, `app/home/`, `app/_shared/*`, `app/api/cron/`, `app/api/demo/{cases,start}/`, `components/ui/*` (new files), `lib/pipeline/{errors,journey,kvStore,rateLimit}.ts`, `packages/shared/src/{demo,journey}.ts`, `public/brand/`, `public/landing/`, the new `public/patient` bundles and `data/cases/DEMO-GOLD.json`. A commit that misses any of them breaks the GitHub copy. The Vercel CLI deploy uploads the working tree, so it would still build.
- **Not tested in a browser.** I did not click through anything in a live browser: no persona flow, no two-stage pharmacy and no landing visual pass at 1440 or 390.

### OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- None from this gate. Builder requests (TH-01 in DEMO_SAMPLES, the staff landing at /home or /demo, NEXT_PUBLIC_SITE_URL, the OG image variant) are still open in their own reports.

### NEXT ACTION
- **Orchestrator:** commit all the untracked w20 files listed above together with the modified files. Then run the live checks after `next build` + `next start`, which this gate did not run:
  - M-07: click each persona card, check the identity, and `curl /`.
  - M-06: nurse approves, then doctor signs.
  - C-03: polling pauses while hidden.
  - A two-stage pharmacy click-through.
  - Design sign-off S-06 at 1440 and 390.
- **Video agent:** deliver `public/media/medx-demo.mp4`, the poster and the `.en.vtt` captions, then redeploy.
