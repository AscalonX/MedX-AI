# W7 AI engineer — independent engine review fixes

STATUS: done

Date: 17 October 2026 (ICT). Input: `docs/reports/w6-engine-review.md` and the Wave 6 fix request. All patient strings used here are synthetic. No commits, dependency installs, or application server starts/restarts. The existing server on :3000 was left alone. The explicitly requested p6 probe starts and closes its own ephemeral fake HTTP gateway; no live AMD endpoint was called.

## SUMMARY

Implemented all requested engine/API findings, both new requirements, and the default seed change within ownership. Clinician authentication remains an explicitly declared demo limitation, as requested for P1-9. No shared contracts, clinical rules, UI, research fixtures, or evaluator sources were edited.

| Finding | Result |
|---|---|
| P0-1 | NFC raw patient text is checked in memory before redaction and any model call. Raw/post-redaction rule hits are unioned by rule ID. Raw evidence is mapped into stored redacted UTF-16 offsets; a hidden span uses `[redacted]` and the containing placeholder's offsets. Raw text/source maps are never persisted or sent to a model. |
| P0-1 / P2-17 | Removed the bare Thai `ชื่อ` trigger. Thai self-introductions capture one token of at most 20 characters, stopping before symptom terms. A contextual `สวัสดีค่ะ/ครับ ชื่อ` introduction remains supported for the existing synthetic PII fixture. Explicit Latin introductions capture lowercase first/surnames. Italian/English clinical stopwords prevent `Sono Svenuto` from becoming a name. |
| P0-2 / P2-16 | NFC-normalize evidence quotes; reject tolerant candidate windows with changed negation cues, including English/Italian/Thai cues and contractions. Safety summary fields (`allergies`, `medications`, `pregnancy_status`) and all pharmacy evidence, including no-known-allergy evidence, use exact/normalized matching only. Relevant immediately preceding denials also block omitted-negation matches. |
| P1-3 | Join patient turns with `.\n`, preserving clause boundaries through normalization. |
| P1-4 | Deterministic/sticky escalation carries previous extracted fields forward without a model call. |
| P1-5 | Thai localized values permit numbers, units, and identical multilingual values; Thai-script checks remain for ordinary translated prose. |
| P1-6 | Rebuild unreviewed pharmacy rows from fresh extraction. Preserve reviewed rows. Deduplicate actual medication mention spans/products, retaining distinct brands with the same generic. Preserve row identity across repeated mentions so reviewed alert decisions do not duplicate. Stale unreviewed hallucinations disappear. |
| P1-7 | PII screening checks free-text review properties only, never medication/allergy/alert IDs or action enums. |
| P1-8 | Reset is POST-only. Both reset and dev seed require `DEMO_SEED=1`, a nonempty `DEMO_TOKEN`, and matching `x-demo-token`. Missing configuration gives 404; absent/wrong token gives 403. Compose defaults `DEMO_SEED=0` and forwards `DEMO_TOKEN`. |
| P1-9 | Request-aware CORS accepts `ALLOWED_ORIGINS` as a comma list. Defaults are `http://localhost:3000`, `http://localhost:8081`, plus the request's own origin. Responses vary on Origin; unrelated origins receive no allow-origin header. All API routes forward the request to this policy. |
| P2-10 | Cache format/system-role compatibility per gateway/model/step (and explicit schema mode), stepping `json_schema → json_object → none`. Each HTTP attempt is still recorded. |
| P2-11 | Normalize text domains outside the red-flag rule loop. Maximum 20 patient turns/session, 4000 UTF-16 characters/turn. `approved` and `taken_over` return 409 before any model call; turn 21 also returns 409. |
| P2-12 | Diagnostic audit events no longer carry duplicate model calls. Metrics also ignore events with `payload.event`. Normal and model-escalation paths each record calls once in their final summary event. Review timing starts at the first `awaiting_review` summary and accepts field, red-flag, or pharmacy review as the end. |
| P2-13 | Unknown model field keys are dropped from extracted fields; audit retains only their count. |
| P2-14 | Rejection stores an internal review marker listing existing patient turn IDs. Re-extraction from those turns remains missing. Verified evidence from a later turn can reopen the field, with a `new evidence` flag and audit note. A conflicting supported value with new evidence reopens an approved field as supported, flags `conflict`, records the audit note, and returns the session to awaiting review. Flags remain until explicit clinician action; abstention still takes precedence. |
| P2-15 | Pharmacy alert `false_alarm` requires a nonblank note; otherwise 400. |
| P2-18 | AMD reset/seed returns 202 with a job ID and guarded progress URL. Seed replay is sequential, with 50 ms between turns and a paced lane enforcing at least 2100 ms between chat attempts during seeding, including compatibility/retry attempts. Concurrent seed requests reuse the running job. Mock seeding remains synchronous. |
| P2-19 | Read request bodies incrementally with a byte counter. Cancel the stream as soon as it exceeds 64,000 bytes; over-limit responses are 413. Do not trust Content-Length alone. |
| P2-20 | Hardware label comes only from `AMD_HARDWARE_LABEL`, default `AMD (via Token Factory)`. No automatic Instinct/ROCm assertion. Provider/model still identify mock mode. |
| NEW (a) | Validate and pass `inputMode` through AddTurnReq → addTurn/runTurn → patient Turn and `turn_added` audit. Omission defaults to text. |
| NEW (b) | Pharmacy edit `dose`, `frequency`, or `reaction` accepts exactly `""` as explicit clear, stores null, preserves `review.previous`, and retains the exact signed request action in audit. Other empty corrections remain invalid. |

## FILES CHANGED

All repository changes made by this task:

```text
apps/web/lib/pipeline/config.ts
apps/web/lib/pipeline/extract.ts
apps/web/lib/pipeline/llm.ts
apps/web/lib/pipeline/pharmacyExtraction.ts
apps/web/lib/pipeline/pharmacyReview.ts
apps/web/lib/pipeline/pipeline.ts
apps/web/lib/pipeline/redact.ts
apps/web/lib/pipeline/redflags.ts
apps/web/lib/pipeline/schema.ts
apps/web/lib/pipeline/seed.ts
apps/web/lib/pipeline/verify.ts
apps/web/lib/pipeline/__tests__/wave7.test.ts
apps/web/lib/pipeline/__tests__/llm-api.test.ts
apps/web/lib/pipeline/__tests__/pipeline.test.ts
apps/web/lib/pipeline/__tests__/safety.test.ts
apps/web/lib/pipeline/__tests__/wave2.test.ts
apps/web/lib/pipeline/__tests__/wave4.test.ts
apps/web/lib/pipeline/__tests__/wave5.test.ts
apps/web/app/api/_http.ts
apps/web/app/api/demo/reset/route.ts
apps/web/app/api/dev/seed/route.ts
apps/web/app/api/health/route.ts
apps/web/app/api/metrics/route.ts
apps/web/app/api/sessions/route.ts
apps/web/app/api/sessions/[id]/route.ts
apps/web/app/api/sessions/[id]/turns/route.ts
apps/web/app/api/sessions/[id]/review/route.ts
apps/web/app/api/sessions/[id]/takeover/route.ts
apps/web/app/api/sessions/[id]/pharmacy-review/route.ts
docker-compose.yml
docs/reports/w7-ai-engineer.md
```

Existing/concurrent mobile changes and audit screenshots were left untouched. Temporary helpers/artifacts live under `/tmp`: `medx-w7-eval-redirect.cjs`, `medx-w7-review-probe.ts`, its synthetic store, and `medx-w7-eval/`.

## TESTS RUN + RESULTS

1. Added the first 28 W7 regression cases before production changes. `npx --no-install vitest run lib/pipeline/__tests__/wave7.test.ts`: **25 failed, 3 passed**. Every P0/P1 finding has a demonstrated failing regression in that baseline, including the destructive GET/token and CORS cases. The four raw safety cases initially reached the injected model client instead of escalating, which caused their baseline failures.
2. Expanded W7 coverage to **47 passing tests** for review persistence/conflicts, raw-only evidence mapping, fallback caching, stream cancellation, metrics including model escalation, input mode, limits, explicit pharmacy clearing, and hardware labels. Legacy tests were updated for the requested POST/CORS/Thai-name/hardware contracts; the old Thai parameterization was consolidated.
3. Final exact required command:

   ```sh
   cd apps/web && npx vitest run && npx tsc --noEmit && npx eslint lib app/api
   ```

   **Exit 0. Vitest: 11 files, 765 tests passed, 0 failed, 15.30 s. TypeScript: clean. ESLint: clean, no warnings.** Final Vitest start: 15:33:14 ICT.

4. Ran p1–p6 before fixes, then again after fixes (all exit 0), using the installed vite-node with `--no-install`. These are observational probes; the Vitest assertions are the regression gates. Also ran p5b after fixes: **accepted**. Full relevant before/after stdout follows below.
5. Mock eval, unchanged runner, development split:

   ```sh
   cd apps/web && MODEL_PROVIDER=mock NODE_OPTIONS=--require=/tmp/medx-w7-eval-redirect.cjs npx --no-install vite-node ../../eval/run.ts -- --split dev
   ```

   **EVAL_EXIT=0**. Ten dev cases plus the harness's automatic 18 holdout cases. A temporary filesystem-output shim redirects generated eval artifacts to `/tmp` so the evaluator-owned files remain unchanged. Actual final artifacts: `/tmp/medx-w7-eval/runs/2026-10-17T08-33-32-833Z/` (`config.json`, `raw.jsonl`, `results.json`, `metrics.json`, `manual.csv`) and `/tmp/medx-w7-eval/REPORT.md`. The runner's stdout still prints its original relative output paths; the actual writes use the redirected paths above.
6. `git diff --check`: clean. No live AMD calls, browser mutation of :3000, or application server launch was required.

## EVIDENCE

### Regression mapping

| Priority | Baseline failing tests in `wave7.test.ts` |
|---|---|
| P0-1 | Four raw-red-flag inputs, retained clinical prose, lowercase surname |
| P0-2 | Changed negation, NFC/NFD quote, three safety-field tolerant-match cases; pharmacy/no-known-allergy evidence is checked in the same cases |
| P1-3 | Three-turn sweating / no / chest-pain emergency |
| P1-4 | Supported fields remain identical across deterministic escalation |
| P1-5 | Numeric/unit values: `7/10`, `45`, `38.5 °C`, `500 mg` |
| P1-6 | Fresh overlapping Tachipirina extracts deduplicate and stale unreviewed rows disappear |
| P1-7 | ID `med-6762937494768adc59b80df4` remains reviewable |
| P1-8 | No GET export, missing/wrong token rejection on both endpoints, token-unset disable |
| P1-9 | Configured origin allowed; unrelated origin gets no allow-origin header |

The updated AMD seed transport test uses fake time and a fake gateway. It checks reset returns 202, concurrent seed requests share the job, seeding finishes, and **every adjacent chat attempt is spaced at least 2100 ms apart**. It does not claim live-provider throughput.

### p1 — before

```text
"ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก" => "[NAME_1] เหงื่อออก" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags:
"ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก" => "[NAME_1]" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags:
"ดิฉันชื่อมาลี หายใจไม่ออก" => "[NAME_1]" | raw flags: RF-BREATH-01 | redacted flags:
"จำชื่อยาไม่ได้ ยาละลายลิ่มเลือด" => "จำ[NAME_1]" | raw flags:  | redacted flags:
"my name is mario rossi, chest pain and sweating" => "[NAME_1] rossi, chest pain and sweating" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags: RF-CHEST-01,RF-CHEST-02
"Mi chiamo mario rossi" => "[NAME_1] rossi" | raw flags:  | redacted flags:
"Sono Svenuto stamattina" => "[NAME_1] stamattina" | raw flags: RF-SYNC-01 | redacted flags:
```

### p1 — after

```text
"ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก" => "[NAME_1] เจ็บหน้าอกมาก เหงื่อออก" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags: RF-CHEST-01,RF-CHEST-02
"ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก" => "[NAME_1]เจ็บหน้าอกมากเหงื่อออก" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags: RF-CHEST-01,RF-CHEST-02
"ดิฉันชื่อมาลี หายใจไม่ออก" => "[NAME_1] หายใจไม่ออก" | raw flags: RF-BREATH-01 | redacted flags: RF-BREATH-01
"จำชื่อยาไม่ได้ ยาละลายลิ่มเลือด" => "จำชื่อยาไม่ได้ ยาละลายลิ่มเลือด" | raw flags:  | redacted flags:
"my name is mario rossi, chest pain and sweating" => "[NAME_1], chest pain and sweating" | raw flags: RF-CHEST-01,RF-CHEST-02 | redacted flags: RF-CHEST-01,RF-CHEST-02
"Mi chiamo mario rossi" => "[NAME_1]" | raw flags:  | redacted flags:
"Sono Svenuto stamattina" => "Sono Svenuto stamattina" | raw flags: RF-SYNC-01 | redacted flags: RF-SYNC-01
```

### p2 — before

```text
A turn1 status collecting supported [ 'chief_complaint', 'onset', 'severity', 'allergies', 'age' ]
A turn2 status escalated supported []
B "I am not allergic to penicillin" -> 0.8 "I am allergic to penicillin, it"
B "I take warfarin every day" -> 0.8 "I do not take warfarin every day"
B it Ho dolore al petto e
C NFD null | NFC so perché ho
D single RF-CHEST-01,RF-CHEST-02
D negleak RF-CHEST-02
E actual calls extract,red_flags,next_question | counted by metrics red_flags,extract,red_flags,next_question
```

### p2 — after

```text
A turn1 status collecting supported [ 'chief_complaint', 'onset', 'severity', 'allergies', 'age' ]
A turn2 status escalated supported [ 'chief_complaint', 'onset', 'severity', 'allergies', 'age' ]
B "I am not allergic to penicillin" -> null
B "I take warfarin every day" -> null
B it undefined
C NFD so perché ho | NFC so perché ho
D single RF-CHEST-01,RF-CHEST-02
D negleak RF-CHEST-01,RF-CHEST-02
E actual calls extract,red_flags,next_question | counted by metrics extract,red_flags,next_question
```

### p3 — before

```text
F needs_human low_confidence chief_complaint:unsupported onset:unsupported severity:unsupported age:unsupported
G status collecting undefined
G allergies supported 0.72 no known allergies ["I am allergic to penicillin. Headache"] noKnownAllergiesEvidence 1
H RF-CHEST-02/urgent | same in one turn: RF-CHEST-01/emergency,RF-CHEST-02/urgent
I redact(12k) 0 ms | checkRedFlags 6x12k turns 774 ms
I redact adversarial phone 0 ms
```

### p3 — after

```text
F collecting - chief_complaint:supported onset:supported severity:supported age:supported
G status needs_human low_confidence
G allergies unsupported 0.27 no known allergies [] noKnownAllergiesEvidence 0
H RF-CHEST-01/emergency,RF-CHEST-02/urgent | same in one turn: RF-CHEST-01/emergency,RF-CHEST-02/urgent
I redact(12k) 0 ms | checkRedFlags 6x12k turns 82 ms
I redact adversarial phone 1 ms
```

Probe I calls the low-level matcher directly with inputs above the new public turn cap. These timings are single observations, not a benchmark or live-provider latency claim.

### p4 — before

```text
turn1 meds Tachipirina/paracetamol/supported | alerts
turn2 meds Tachipirina/paracetamol/supported ; Tachipirina 1000/paracetamol/supported | alerts MR-MAXDOSE-01/high
```

### p4 — after

```text
turn1 meds Tachipirina/paracetamol/supported | alerts
turn2 meds Tachipirina 1000/paracetamol/supported | alerts
```

### p5 — before

```text
random stableIds altered by redact: 279 / 20000 [
  'med-7b50cf81bac9fc3659102248 -> med-7b50cf81bac9fc[PHONE_1]',
  'med-6762937494768adc59b80df4 -> med-[ID_1]adc59b80df4',
  'med-d0053508597b2d9fa47e5dc3 -> med-d[PHONE_1]b2d9fa47e5dc3'
]
dictionary-name med ids altered: 3 / 289
session UUIDs altered: 105 / 20000
```

### p5 — after

```text
random stableIds altered by redact: 279 / 20000 [
  'med-7b50cf81bac9fc3659102248 -> med-7b50cf81bac9fc[PHONE_1]',
  'med-6762937494768adc59b80df4 -> med-[ID_1]adc59b80df4',
  'med-d0053508597b2d9fa47e5dc3 -> med-d[PHONE_1]b2d9fa47e5dc3'
]
dictionary-name med ids altered: 3 / 289
session UUIDs altered: 105 / 20000
```

p5 intentionally remains unchanged: it calls the general-purpose redactor on IDs. The fix removes IDs from pharmacy free-text PII screening; it does not weaken phone/ID redaction. The failing-before Vitest ID case now passes. Supplemental p5b after-fix stdout:

```text
"keflex" med-55155c47dbd3758198319a6f
"klaricid" med-afa2f8696a9ad035948292d2
"claritin" med-1897a90c582a9c0023191051
accepted
```

### p6 — before

```text
call 0 ok true {"flags":[]}
call 1 ok true {"flags":[]}
call 2 ok true {"flags":[]}
HTTP requests for 3 logical calls: models | chat+json_schema | chat(no format) | chat+json_schema | chat(no format) | chat+json_schema | chat(no format)
```

### p6 — after

```text
call 0 ok true {"flags":[]}
call 1 ok true {"flags":[]}
call 2 ok true {"flags":[]}
HTTP requests for 3 logical calls: models | chat+json_schema | chat+json_object | chat+json_object | chat+json_object
```

Six chat attempts become four, plus one cached model discovery request. The dedicated Vitest transport test also checks gateways that reject both JSON formats and system roles.

### Mock eval numbers and limits

Final dev run: asserted precision **22/22**, mechanical evidence validity **22/22**, capture recall **22/47 (0.468)**. Dev red-flag recall **3/3**, false alarms **0/7**. The harness's separate automatic holdout red-flag recall remains **7/10 (0.700, Wilson 95% CI 0.397–0.892)**, including its mock-screen combination. Exit 0 means the harness completed; it does not mean every clinical/performance threshold passed. Capture recall and holdout misses remain limitations. These numbers are mock-only and must not be presented as live Gemma or clinical validation.

## ASSUMPTIONS

- Accept turns in `collecting`, `awaiting_review`, `needs_human`, and `escalated`. Additional information can help clinician review; any previous red flag remains sticky. `approved` and `taken_over` reject turns with 409.
- The character cap uses JavaScript UTF-16 length, matching stored evidence offsets; the HTTP body limit counts UTF-8 bytes.
- A rejected field can reopen only with verified evidence referencing a patient turn added after rejection. Merely changing model wording against existing turns is insufficient.
- The demo runs in one persistent Node process. The existing session lock/store and background seed job are scoped to that process.
- Default hardware wording follows the requested label for every mode; provider/model still explicitly say mock where appropriate.

## RISKS

- **Known demo limitation: clinician authentication is absent.** `reviewerId` remains self-asserted, and CORS does not authenticate a clinician or block direct HTTP clients. The orchestrator/pitch must declare this; do not expose real patient data or describe role enforcement as production-ready. This task implements the requested origin policy and demo-reset token, not a new clinician login system.
- The AMD background seed job is in memory and depends on a persistent process; a restart loses job progress. Serverless suspension/multiple replicas are unsupported. Poll until done and inspect mismatches; 202 is not a claim that seeding succeeded.
- Gateway fallback and pacing were checked with synthetic transports, not the live Token Factory. Extraction/screen requests retain their deadlines and still abstain on failures.
- Strict matching for safety fields is intentionally more conservative. The mock eval's capture recall and holdout misses above remain unresolved outside this engine-fix scope.
- Name redaction remains heuristic. Thai capture is deliberately one token/20 characters and Latin introductions use limited clinical stopwords; this is not a general PII guarantee. Only synthetic data is authorized.
- Reject/conflict review markers are backend-added optional JSON properties pending shared-contract/UI adoption. Audit notes provide the durable review-change record; current UI does not yet render these new flags explicitly.
- Demo reset deliberately destroys synthetic session/audit state only behind the explicit POST/token guard. Existing browser reset links using GET must be updated by their owner.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

1. Orchestrator: publish optional `ExtractedField.reviewMemory` in the shared contract (currently represented locally as a backend intersection): `{ rejectedTurnIds?: string[]; flags?: ('new evidence' | 'conflict')[] }`. IDs are storage markers, not patient text. Clinician owner should display `new evidence`/`conflict` distinctly and keep explicit clinician review actions.
2. Orchestrator: update reset callers to POST with the demo token through an appropriate demo operator flow; do not keep the destructive GET link. Configure `DEMO_SEED=1` and a secret `DEMO_TOKEN` explicitly for an operator-controlled demo. Guarded seed progress is `GET /api/dev/seed` with the same header.
3. Deployment owner: pass `ALLOWED_ORIGINS` and any confirmed `AMD_HARDWARE_LABEL` into the application environment if needed. Compose edits here were limited to item 8, so these unrelated environment passthroughs were not added to compose.
4. Clinician auth, evaluator capture/holdout gaps, and live Gemma validation need owner follow-up; no clinical/shared-rule edits were made in this task.

## NEXT ACTION

Orchestrator can review the uncommitted diff and configure the guarded operator seed/reset. New curl (requires the server/container to have the same configured nonempty token and `DEMO_SEED=1`; no token value is included in this report):

```sh
curl -i -X POST http://localhost:3000/api/demo/reset \
  -H "x-demo-token: ${DEMO_TOKEN}"

# AMD: 202 includes job ID and progressUrl; poll with the same guard.
curl -i http://localhost:3000/api/dev/seed \
  -H "x-demo-token: ${DEMO_TOKEN}"

# Optional idempotent seed without reset, under the same guard.
curl -i -X POST http://localhost:3000/api/dev/seed \
  -H "x-demo-token: ${DEMO_TOKEN}"
```

No permission or deployment action is pending from this task. All requested source changes, regression tests, probes, validation, and this report are complete; the changes remain uncommitted.
