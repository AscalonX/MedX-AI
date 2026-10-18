# w21 orchestrator report: AMD Token Factory live, real evaluation, narrated videos

STATUS: done

## SUMMARY
- Production (https://medx.areazeroai.com, commit `8bdc9d1`) runs on the AMD Token Factory: Gemma-4-31B-IT for the add-only red-flag screen and the next question, DeepSeek-V4-Flash (`AMD_EXTRACT_MODEL`) for the structured extraction.
- A real evaluation on the AMD endpoint is in `eval/REPORT.md` (run `2026-10-18T05-38-22-421Z`); docs now quote it, including the missed targets.
- The narrated walkthrough (2 min 15 s) and the voiced 60 s promo are live; the landing plays the voiced promo first.
- origin/main (the team's AMD lanes: OmniVoice read-aloud, medicine-pack photo via MiniCPM-V, optional second screen, 429 backoff, eval live client) was merged with both sides kept.

## FILES CHANGED
- Engine: `apps/web/lib/pipeline/{extract,llm,config,pipeline,consult,redFlagScreen,trace}.ts`, `apps/web/app/api/health/route.ts`, `apps/web/app/_landing/HealthChip.tsx`, `apps/web/app/(ops)/components/SystemLedger.tsx`, `apps/mobile/src/api.ts` (client waits 58 s), tests `lib/pipeline/__tests__/{w21-amd,trace,wave10,llm-api}.test.ts`.
- Docs: README, pitch/SUBMISSION, pitch/SAFETY, docs/{PROGRESS,DEPLOY,SPEC,DEMO}.md, HANDOFF.md, eval/REPORT.md (orchestrator note), `.env.example` (`AMD_EXTRACT_MODEL`, timeout defaults).
- Media: `apps/web/public/media/{medx-demo-narrated.*,medx-promo-vo.*}`; `scripts/record-demo.mjs --narration`; `qa/31-landing.mjs` now checks the voiced promo.

## TESTS RUN + RESULTS
- Merged tree: vitest 2,508/2,508 (57 files); tsc 0 errors; eslint 0 errors; `next build` 24/24 pages; clinical checkers consult 87/0, medrules 253/0, red flags 175/0, vitals all passed.
- Production smoke (commit 8bdc9d1): every page 200; `/media/medx-promo-vo.mp4` (19.6 MB), `/media/medx-demo-narrated.mp4` (8.3 MB) and captions 200; `/api/health` provider amd-tokenfactory, model Gemma-4-31B-IT, extractModel DeepSeek-V4-Flash, store postgres.
- One real patient turn on production: 24.0 s; screen (Gemma) 1.2 s ok, extraction (DeepSeek) 18.8 s ok, next question (Gemma) 4.4 s ok; chief complaint, duration and allergy supported by quotes.
- QA against production: qa/30 7/7, qa/31 34/34, qa/32 15/15.

## EVIDENCE
- Endpoint probes: Gemma short JSON calls 2.6-4.7 s; Gemma full extraction 72 s and 300 s for ~880 output tokens; DeepSeek-V4-Flash extraction 17-48 s, schema-valid.
- Shared-key limit seen as HTTP 429 `token_concurrency_rate_limit_exceeded`, Retry-After 1 s.
- Evaluation headline: see eval/REPORT.md (M1 precision 88.1% not met; hallucination 3.4% met; M4 recall 8/8; holdout rules + Gemma 8/10 vs rules 7/10; turn latency p50 38.4 s not met).

## ASSUMPTIONS
- AMD settings are passed at deploy time (`vercel deploy -e ...`); the key is kept outside the repo. The optional second screen (`AMD_MODEL_SCREEN2`) is off in production to avoid extra concurrent calls on the shared key.

## RISKS
- Shared team key: concurrency and spend limits are per key, so heavy use by anyone on the team causes 429s; a failed call abstains ("needs human review").
- Turn latency (p50 38 s) is far above the 6 s target; the patient sees a wait.
- The narrated walkthrough was recorded on the mock model (it says so); the live site runs on AMD.
- Keys and the Neon password were exposed in chat during setup: rotate them after the event.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- Pitch deck files (`pitch/deck/*`) still carry "[pending AMD run]" cells; the deck owner should refresh them from eval/REPORT.md.
- Doctor sign-off is still pending for consult rule CR-THROAT-05 and the DEMO-GOLD pathway.

## NEXT ACTION
- Fill in the lablab form from `pitch/SUBMISSION.md` (live demo, videos, deck), then rotate the AMD key, the OpenAI key and the Neon password.
