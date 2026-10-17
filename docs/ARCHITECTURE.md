# Architecture

Research prototype, synthetic data only. See [README](../README.md) for the overview.

## Components

| Component | Path | Role |
|---|---|---|
| Patient app | `apps/mobile` (Expo Router, RN) | Guided chat in TH/IT/EN, follow-up questions, red-flag "go to the desk" screen. Calls the web API (`EXPO_PUBLIC_API_URL`; same origin when served at `/patient`). |
| Web app and API | `apps/web` (Next.js 15, standalone output) | The only backend. UI: `/review` (clinician), `/pharmacy`, `/ops`. API: `app/api/**`. |
| Pipeline | `apps/web/lib/pipeline` | All intake logic. No UI imports. |
| Contracts | `packages/shared` | `types.ts`, `api.ts`, `tokens.ts`, `redflags.json`, `medrules.json`. Imported by web and mobile. |
| Store | `lib/pipeline/store.ts` | JSON file (`MEDX_STORE_PATH`), atomic writes, in-memory cache, per-session locks, append-only audit array. Single instance only (swap for SQLite or Postgres to scale out). |

## Data flow for one patient turn

`POST /api/sessions/:id/turns` calls `addTurn` then `runTurn` (`pipeline.ts`):

1. Validate text (1 to 12000 chars). Reject if a clinician has taken over.
2. `redact()` (`redact.ts`): names, phone, ID, passport to tokens. Only redacted text is stored or sent anywhere.
3. `checkRedFlags()` (`redflags.ts`) over all patient turns using `packages/shared/src/redflags.json`. On a hit: status `escalated`, **zero model calls**, only a dictionary-based medication pass for the pharmacist.
4. In parallel: `extract()` (`extract.ts`, Gemma, JSON schema, fields with `evidence_quote` and confidence, plus translation to TH/IT/EN) and `redFlagScreen()` (`redFlagScreen.ts`, Gemma safety screen, add-only).
5. `verify.ts`: each quote must be found in the patient's own turns (fuzzy match across translation); otherwise the field becomes `unsupported`. Model-proposed values are re-redacted.
6. Rules run again with extracted fields (`checkRedFlags(turns, fields)`); model screen hits are added with `source: "model"` and need clinician confirmation.
7. Abstain rules: provider/schema failure, majority of proposed fields failing verification, mean confidence of required fields below 0.55, unsupported language, or deadline (40 s per turn) exceeded give status `needs_human`.
8. Otherwise `nextQuestion.ts` picks the highest-priority missing required field (max 3 follow-ups) and asks in the patient's language; no missing field means `awaiting_review`.
9. Medications: extraction output goes through `medrules.ts` (deterministic rules from `medrules.json`) to produce `medAlerts`; a model cannot clear an alert.
10. Clinician actions (`/review`, `/takeover`, `/pharmacy-review` routes): approve, edit (old value kept, new value plus reviewer), take over. Every step is appended to the audit log with provider, model, latency, reviewer.

## Safety invariants to code

| Invariant | Where |
|---|---|
| Red flags are deterministic and run before any model call; no model output clears them | `redflags.ts`, `pipeline.ts` (early return before `extract`) |
| No verified quote means `unsupported`, never displayed as fact | `verify.ts` |
| Provider/schema error or low confidence means abstain | `pipeline.ts` (`reason` block), `extract.ts` |
| Nothing is final until a clinician approves; all actions audit-logged | `pipeline.ts` `review`/`takeover`, `store.ts` `appendAudit` |
| Raw patient text redacted before storage or model call | `redact.ts`, `runTurn` |
| API keys from env only, server-side | `llm.ts`, `config.ts`; `.env*` git- and docker-ignored |
| Model safety screen may only add flags | `redFlagScreen.ts`, merge in `runTurn` |
| Med alerts are code, not model | `medrules.ts`, `packages/shared/src/medrules.json` |

Tests for all of the above live in `apps/web/lib/pipeline/__tests__` (`npm --prefix apps/web test`).

## Contracts (`packages/shared`)

- `types.ts`: `IntakeSession`, `IntakeSummary`, `ExtractedField` (value in TH/IT/EN, `valueOriginal`, `evidence[]`, `confidence`, `status` supported/unsupported/missing/edited/approved), `RedFlagHit`, `MedAlert`, `AuditEvent`, `OpsMetrics`.
- `api.ts`: request/response shapes for every route: `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/:id`, `POST .../turns`, `.../review`, `.../takeover`, `.../pharmacy-review`, `GET /api/metrics`, `GET /api/health`, `POST /api/demo/reset` (gated by `DEMO_SEED=1`, needs the `x-demo-token` header).
- Contract changes go through the orchestrator only (see `CLAUDE.md`).

## AMD integration

- Endpoint: AMD Token Factory, OpenAI-compatible `POST {AMD_BASE_URL}/chat/completions`, Bearer `AMD_API_KEY`, model `AMD_MODEL` (Gemma), optional `AMD_MODEL_FALLBACK`.
- One client, `lib/pipeline/llm.ts` (`chatJSON`): `response_format` json_schema (disable with `AMD_JSON_SCHEMA=false`), per-call timeout (`LLM_TIMEOUT_MS`, default 25 s, 8 s for next question), latency recorded in each `ModelCall`, one repair retry on schema error, one retry or fallback model on provider error, 429 handled by abstaining unless `Retry-After` is short.
- `MODEL_PROVIDER=mock` swaps in `mock.ts` (deterministic). `GET /api/health` and the UI report the provider honestly (`mock` vs `amd-tokenfactory`).
- Hardware label shown in the UI comes from `providerInfo()` in `config.ts`; it says AMD (via Token Factory) only when the AMD provider is configured; mock runs are labelled mock.
- Unknowns at time of writing (base URL, model ids, rate limits) are env-driven, not hard-coded. Details and assumptions: [docs/ai/DESIGN.md](ai/DESIGN.md).

## Deployment

- Docker: `apps/web/Dockerfile` (multi-stage, standalone output, non-root, port 3000). Build context is the repo root because the app imports `packages/shared` and `data/cases`.
- `scripts/build-patient-web.sh` puts the Expo web build in `apps/web/public/patient`.
- Persistence is a local JSON file: fine for one container or one VM, ephemeral on serverless platforms (the demo reseeds via `POST /api/demo/reset` with the `x-demo-token` header).
