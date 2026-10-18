# Architecture

Research prototype, synthetic data only. Overview: [README](../README.md). Spec of record: [SPEC.md](SPEC.md). Deploy: [DEPLOY.md](DEPLOY.md).

## Components

| Component | Path | Role |
|---|---|---|
| Patient app | `apps/mobile` (Expo SDK 58, Expo Router, React Native) | Guided intake in EN/TH/IT (English first), voice with confirm-before-send, follow-up questions, red-flag "go to the desk" screen, visit timeline and pickup card, "Start a new visit". Calls the web API (`EXPO_PUBLIC_API_URL`; same origin when served at `/patient`). Exported for the web to `apps/web/public/patient` by `scripts/build-patient-web.sh`. |
| Web app and API | `apps/web` (Next.js 15.5) | The only backend. Marketing: `/`, `/th`, `/it`, `/demo`, `/demo/<persona>`. Staff: `/review/**`, `/pharmacy/**`, `/ops`, `/home`. API: `app/api/**`. Standalone output for Docker and Render; Vercel builds its own output. |
| Pipeline (engine) | `apps/web/lib/pipeline` | All clinical logic, no UI imports: redaction, red flags, extraction and verifier, consult, vitals and triage, orders and prescribing checks, pharmacy, pickup, patient view, trace, store, rate limit, seed. |
| Contracts | `packages/shared` | `types.ts`, `api.ts`, `journey.ts` (stage model), `demo.ts` (personas, samples), `staff.ts` (synthetic staff, write roles), `tokens.ts`, and the clinical rule files `redflags.json`, `medrules.json`, `consultrules.json`, `vitalrules.json`, `investigations.json`. Imported by web and mobile. |
| Store | `lib/pipeline/store.ts`, `lib/pipeline/kvStore.ts` | One whole-state **snapshot** with an append-only audit array. **Shared mode (Vercel):** a single Neon serverless Postgres row (`medx_store`, `@neondatabase/serverless` `neon()` over HTTP), written with optimistic concurrency (version compare-and-set, re-read and merge or replay on conflict, per-session revision checks instead of in-process locks only). Upstash Redis REST is an optional alternative backend with the same contract. **File mode (local, Docker, Render, tests):** a JSON file with atomic writes and in-process per-session locks. Selection: `MEDX_STORE`, else `DATABASE_URL`/`POSTGRES_URL` → Postgres, Upstash → Redis, else file. |

## Request flow

Every API route goes through `handle()` in `app/api/_http.ts`:

1. Per-IP POST rate limit (`rateLimit.ts`; 30 per minute by default, `MEDX_RATE_LIMIT_PER_MIN`; shared through Upstash when configured, otherwise per instance). JSON bodies are capped at 64 kB.
2. `syncStore()`: in shared mode a `SELECT version`, and a full read only when the version moved. No-op with the file store.
3. The route function runs inside a request write-set (AsyncLocalStorage). The store API stays synchronous for the pipeline.
4. `flushStore()` lands the writes before the response is built: `UPDATE medx_store SET ... WHERE id = $1 AND version = $2`. On a conflict the row is re-read and the write-set merged (sessions by id, audit events as a union by event id, a colliding `B-0xx` code reassigned to the lowest free one and patched into the response). A locked step whose session changed elsewhere is replayed on fresh state. After 5 retries: 503 `Store busy, retry` with `Retry-After: 1`.
5. Any store error is 503 with "needs human review if it persists". Nothing that failed to land is kept in memory.

## Data flow for one patient turn

`POST /api/sessions/:id/turns` calls `addTurn` then `runTurn` (`pipeline.ts`):

1. Validate text (1 to 12000 chars). Reject if a clinician has taken over.
2. `redact()` (`redact.ts`): names, phone, ID, passport to tokens. Only redacted text is stored or sent anywhere.
3. `checkRedFlags()` (`redflags.ts`) over all patient turns using `redflags.json` (18 rules). On a hit: status `escalated`, **zero model calls**, only a dictionary-based medication pass for the pharmacist.
4. In parallel: `extract()` (`extract.ts`; JSON schema; fields with `evidence_quote` and confidence; translation to TH/IT/EN) and `redFlagScreen()` (`redFlagScreen.ts`; add-only safety screen).
5. `verify.ts`: each quote must be found in the patient's own turns (fuzzy match across translation); otherwise the field becomes `unsupported`. Model-proposed values are re-redacted.
6. Rules run again with extracted fields; model screen hits are added with `source: "model"` and need clinician confirmation.
7. Abstain: provider or schema failure, most proposed fields failing verification, mean confidence of required fields below 0.55, unsupported language, or the 40 s turn deadline → `needs_human`.
8. Otherwise `nextQuestion.ts` asks for the highest-priority missing required field (max 3 follow-ups) in the patient's language; nothing missing → `awaiting_review`.
9. Medications: extraction output goes through `medrules.ts` (deterministic, `medrules.json`) to produce `medAlerts`; a model cannot clear an alert.

## Clinical writes after intake

| Step | Route | Engine | Server-enforced rules |
|---|---|---|---|
| Intake review | `POST .../review`, `.../takeover` | `pipeline.ts` | Approve, edit (old value kept), take over; an unreviewed red flag blocks approval (409); an allergy or pregnancy edit re-runs medicine checks and order re-checks |
| Vitals, triage | `POST .../vitals`, `.../triage/confirm` | `vitals.ts`, `triage.ts` | NEWS2-based suggestion (`vitalrules.json`); a less urgent level needs a note; nurse role |
| Consult | `GET/POST .../consult`, `.../consult/turns`, `.../consult/suggestions/:id`, `.../consult/note` | `consult.ts`, `consultRules.ts` | Red-flag rules still run on consult lines (even after approval); considerations doctor-only; note signing doctor-only |
| Orders | `POST .../orders/investigations`, `.../orders/medications`, `.../:orderId/submit`, `.../:orderId/cancel` | `orders.ts`, `medrules.ts` | Checks on every draft and edit; alternatives from `medrules.alternatives`, each re-checked as a hypothetical order; submit needs an override reason per high alert (409) |
| Pharmacist 1 | `POST .../:orderId/pharmacy` (`verify` or `return`) | `orders.ts` | Verify refused while a high alert lacks a reason; return needs a note; report `alertIds` must be this order's checks, `suggestedGenerics` dictionary generics (max 5, not the ordered drug) |
| Pharmacist 2 | `POST .../:orderId/dispense` | `orders.ts` | 409 unless verified; 409 when the dispenser verified it (two-person check); 400 unless all six checklist items are true |
| Pickup | `POST .../pickup` (`call` or `collected`) | `orders.ts` | Re-checks first; 409 unless every non-cancelled medication order is dispensed; collected only after a call; a new high alert on a dispensed, uncollected order sends it back to pharmacist 1 |
| Reconciliation | `POST .../pharmacy-review` | `pharmacyReview.ts` | Pharmacist sign-off of the patient's own medicine list |
| Trace | `GET .../trace` | `trace.ts` | Derived from the record and audit; deterministic digest; no PII |

Every step is appended to the audit log with its actor (`redactActor` keeps known synthetic staff names, redacts anything else). With `MEDX_STRICT_ROLES=1`, writes from unknown actors or the wrong role get 403 (`WRITE_ROLES` in `staff.ts`). The patient view (`patientView.ts`, `PatientSessionView` in `api.ts`) is an explicit allowlist: code, language, status, the patient's own turns, the next question, the patient message of any red flag, `seenByStaff`, and `pickup { status: preparing | ready | collected, counter }`. It never carries drug names, alerts, staff ids or notes.

## Safety invariants to code

| Invariant | Where |
|---|---|
| Red flags are deterministic and run before any model call; no model output clears them | `redflags.ts`, `pipeline.ts` (early return before `extract`), `consult.ts` |
| No verified quote means `unsupported`, never displayed as fact | `verify.ts`; consult outbox marks unsaved lines as not part of the record |
| Provider or schema error or low confidence means abstain | `pipeline.ts` (`reason` block), `extract.ts`, `llm.ts`; store errors answer 503 |
| Nothing is final until a clinician approves; all actions audit-logged | review, takeover, consult, orders, dispense and pickup routes; `store.ts` `appendAudit`; audit union on merge |
| Raw patient text redacted before storage or model call | `redact.ts`, `runTurn`, `redactActor` |
| API keys from env only, server-side | `config.ts`, `llm.ts`, `kvStore.ts`; `.env*` git-, docker- and vercel-ignored; health never returns a credential |
| Model safety screen may only add flags | `redFlagScreen.ts`, merge in `runTurn` |
| Med alerts are code, not model; options never written into an order | `medrules.ts`, `orders.ts`, `medrules.json` |

Tests for all of the above live in `apps/web/lib/pipeline/__tests__` and next to the UI code (`./node_modules/.bin/vitest run` in `apps/web`: 2,436 tests in 51 files on Sun 18 Oct 2026).

## Contracts (`packages/shared`)

- `types.ts`: `IntakeSession` (with `orders`, `pickup`, `triage`), `IntakeSummary`, `ExtractedField` (status supported / unsupported / missing / edited / approved), `RedFlagHit`, `MedAlert` (with `alternatives`), `MedicationOrder` (status draft / submitted / verified / returned / dispensed / cancelled, `pharmacist.report`, `dispense`), `AuditEvent` (23 `AUDIT_TYPES`), `OpsMetrics` (with `pharmacy`).
- `api.ts`: request and response shapes for every route under `app/api/` (sessions, turns, review, takeover, vitals, triage, consult, orders, pharmacy, dispense, pickup, pharmacy-review, trace, metrics, health, demo start / cases / reset, cron reset).
- `journey.ts`: `JourneyStage` and `journeyStage()` (SPEC section 5). `demo.ts`: `DEMO_PERSONAS`, `DEMO_SAMPLES`. `staff.ts`: `STAFF`, `WRITE_ROLES`, storage keys.
- Contract changes go through the orchestrator only (`CLAUDE.md`).

## Model integration (AMD Token Factory)

- Endpoint: AMD Token Factory, OpenAI-compatible `POST {AMD_BASE_URL}/chat/completions`, bearer `AMD_API_KEY`, model `AMD_MODEL` (Gemma), optional `AMD_MODEL_FALLBACK`.
- One client, `lib/pipeline/llm.ts` (`chatJSON`): `response_format` json_schema (disable with `AMD_JSON_SCHEMA=false`), per-call timeout (`LLM_TIMEOUT_MS`, default 25 s, 8 s for the next question), latency recorded per `ModelCall`, one repair retry on schema error, one retry or the fallback model on provider error, 429 handled by abstaining unless `Retry-After` is short.
- `MODEL_PROVIDER=mock` swaps in `mock.ts` (deterministic). **The public demo runs the mock today.** `GET /api/health` and the UI report the provider honestly (`mock` vs `amd-tokenfactory`, plus `providerConfigured`); the landing page reads the label live.
- Details and assumptions: [docs/ai/DESIGN.md](ai/DESIGN.md).

## Deployment

- **Vercel (public demo):** project `medx`, root directory `apps/web` with files outside the root included, Node 22, region `sin1`, daily cron `/api/cron/reset`, deployed from the CLI at the repo root (not Git-connected). The **Neon Postgres snapshot row** is the shared store, so every instance sees one demo. Security headers and CSP in `next.config.ts`. Full steps: [DEPLOY.md](DEPLOY.md).
- **Docker:** `apps/web/Dockerfile` (multi-stage, standalone output, non-root, port 3000). Build context is the repo root because the app imports `packages/shared` and `data/cases`. JSON file store in `/app/apps/web/.data`.
- **Render:** `render.yaml`, one Docker service with the file store on ephemeral disk; one instance keeps the demo consistent. `DATABASE_URL` can point it at the shared Neon store instead.
- `scripts/build-patient-web.sh` puts the Expo web build in `apps/web/public/patient` and writes `source.sha`; `app/patient-stamp.test.ts` fails while the export is stale.
