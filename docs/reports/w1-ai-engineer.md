# Wave 1 — AI engineer

STATUS: done

## SUMMARY

Implemented the Next.js backend engine, all contracted API routes, health metadata, and the evaluation entry point. Deterministic red flags run before extraction and remain sticky. Patient text is redacted before storage, prompting, or audit. Evidence is verified against patient turns with exact, normalised offset-mapped, and Intl.Segmenter tolerant matching. Unsupported values remain pencil; abstention removes every model-supported assertion. Clinician edits/approvals survive re-extraction.

Read CLAUDE.md, docs/PLAN.md, shared types/API/rule contracts, docs/ai/DESIGN.md, docs/ai/METRICS.md, and the clinical spec. Implemented the AI design's exact prompt wording/templates, categorical confidence formula, 0.50 field threshold, 0.55 required-supported mean threshold, ≥50% failed-verification threshold, unsupported-language check, missing-chief-complaint handover after three patient turns, one provider retry/fallback model, one schema repair, and 25s extraction / 8s question / 40s whole-turn caps. LLM_TIMEOUT_MS optionally overrides individual call limits; the whole-turn cap still applies. Every HTTP compatibility attempt is recorded too.

AMD transport discovers json_output capability via /models (cached for five minutes, discovery bounded to 1.5s); otherwise uses json_object. Rejected formats retry without response_format, and rejected system roles fold instructions into the user message. AMD_JSON_SCHEMA=true|false optionally overrides discovery for gateways whose model catalog is inaccessible. Mock mode is explicit via MODEL_PROVIDER=mock; AMD failures never silently select mock.

## FILES CHANGED

- apps/web/lib/pipeline/config.ts — keys, required fields, provider metadata.
- apps/web/lib/pipeline/llm.ts — AMD transport, compatibility, timeout, safe error metadata, ModelClient types.
- apps/web/lib/pipeline/mock.ts — deterministic, input-derived TH/IT/EN demo extraction.
- apps/web/lib/pipeline/redact.ts — regex PII redaction and replacement counts.
- apps/web/lib/pipeline/redflags.ts — rule-file AND/OR semantics, negation, patient-only/cross-turn matching, original offsets.
- apps/web/lib/pipeline/verify.ts — normalisation map, segmentation, multiset overlap, corrected turn IDs.
- apps/web/lib/pipeline/prompts.ts — extraction, repair integration, and question prompt templates; escaped transcript aliases.
- apps/web/lib/pipeline/schema.ts — hand validation and strict JSON schemas.
- apps/web/lib/pipeline/extract.ts — retries/repair, verification, confidence, raw-output tracing.
- apps/web/lib/pipeline/nextQuestion.ts and templates.ts — priority gap selection and TH/IT/EN fallbacks.
- apps/web/lib/pipeline/store.ts — persistent Map, atomic snapshot replacement, append-only audit API, defensive read snapshots, per-session write serialisation.
- apps/web/lib/pipeline/pipeline.ts — session creation, addTurn/runTurn, review, takeover, queue and OpsMetrics.
- apps/web/lib/pipeline/__tests__/safety.test.ts, pipeline.test.ts, llm-api.test.ts — safety, transport, pipeline, fault injection and route tests.
- apps/web/app/api/_http.ts — CORS, request validation, consistent ApiError responses.
- apps/web/app/api/sessions/route.ts and sessions/[id]/route.ts.
- apps/web/app/api/sessions/[id]/turns/route.ts, review/route.ts, takeover/route.ts.
- apps/web/app/api/metrics/route.ts and health/route.ts.
- apps/web/vitest.config.ts — Node environment, scoped test discovery.
- apps/web/Dockerfile — Node 22 Alpine, explicit source copies, Next standalone, non-root runner.
- apps/web/.dockerignore — app-context exclusions.
- docs/reports/w1-ai-engineer.md — this report.

No shared contracts or other agents' source files were edited. No git commit and no npm install were run. Next typegen and tsc generated their normal ignored build/type artifacts.

## TESTS RUN + RESULTS

Final run, 17 Oct 2026, mock/synthetic data and stubbed transport only except the specified refused localhost endpoint:

```text
cd apps/web
npx vitest run --reporter=dot
 Test Files  3 passed (3)
      Tests  105 passed (105)
   Duration  6.97s

npx tsc --noEmit
exit 0; no diagnostics

npx eslint lib/pipeline app/api vitest.config.ts --max-warnings=0
exit 0; no warnings or errors
```

The required `npx vitest run` command was also run directly during development. Initial result: 60 passed / 3 failed (63 total). It caught a missed 081-xxx-xxxx phone format (including a persistence assertion) and an overly specific test expectation for tied tolerant-match windows. Fixed the regex and made the window test check the required overlap/offset guarantee. Subsequent runs: 63/63, 101/101, 102/102, and final 105/105 as coverage grew. One initial test TypeScript annotation was corrected.

Concurrent design work removed a preview route referenced by stale .next/types/validator.ts. `npx next typegen` regenerated route types successfully; the final normal TypeScript command passes. Scoped lint initially identified one unused test parameter; corrected before the final zero-warning run.

## EVIDENCE

- Escalated turns: zero model calls, including later turns in an already escalated session.
- Complete mock intake: TH, IT, EN all reach awaiting_review with all eight requested required fields supported; review of required fields reaches approved.
- Fault injection: six scenarios × three languages = 18/18 pass: 401, timeout, 500, malformed JSON twice, wrong shape twice, absent quotes. Each abstains with the expected reason and zero supported assertions.
- Injected client ignoring AbortSignal is stopped by the 40-second whole-turn deadline (fake-clock test).
- Real refused endpoint http://127.0.0.1:9: two failed extraction attempts, provider_error, needs_human.
- Synthetic raw phone excluded from persisted JSON, model input and audit; replacing the returned audit/session snapshots cannot mutate storage.
- Verified evidence spans are re-sliced from original patient turns; tests cover Thai segmentation, accent/width/punctuation/zero-width normalisation, wrong-turn correction, cross-turn rejection for quotes, and assistant exclusion.
- HTTP handler tests exercise every contracted route, invalid input, not_found responses, health secrecy and CORS.
- No screenshots: backend task. No clinical evaluation metrics or live AMD performance claims are made.

## ASSUMPTIONS

- Per the explicit task, REQUIRED_FIELDS remains chief_complaint, onset, severity, associated_symptoms, medications, allergies, pregnancy_status, age. The clinical spec's different requirements need an orchestrator decision (below).
- ModelClient is an async function `(request: ChatRequest) => Promise<ChatResult>`, exported from llm.ts and re-exported as a type from pipeline.ts. Injected clients may ignore transport callbacks: the engine still records their returned attempt.
- `runTurn(session, text, { client, trace, now })` returns a cloned session and does not persist by itself. `trace({step, raw})` receives parsed raw model JSON (or invalid response text) before verification, on every attempt. `now` returns an ISO string. Optional audit sink is available. `createSession(lang, {persist:false})` supports isolated evaluation.
- `addTurn` uses the persistent store and serialises operations with clinician review/takeover on the same session. MEDX_STORE_PATH redirects storage for eval/tests or a mounted container volume. Default path is apps/web/.data/store.json.
- No verified model evidence means unsupported; an unsupported/missing field must be edited before clinician approval. Clinician text is redacted and copied into all three language values, as requested.
- Ops sessionsToday uses UTC calendar dates; other counters cover all stored sessions. Model-call latency includes failed attempts. Auto-capture uses the latest extraction before the first clinician review; review latency measures first summary to first review.

## RISKS

- Single-process JSON storage is suitable for the hackathon prototype. A durable mounted volume is needed in Docker; independent replicas/serverless ephemeral filesystems do not share this store. Atomic file replacement prevents partial JSON snapshots, but session and audit writes are separate persistence operations; a process crash between them can leave an unaudited write. Corrupt store reads fail closed.
- Regex redaction is bounded pattern matching, not complete PII detection. Names introduced by the requested phrases can over-redact clinical words; Thai names without delimiters remain ambiguous. Synthetic data only.
- Evidence matching proves a quote exists, not that the extracted value follows from it or translations are faithful. Clinician approval remains essential. Tolerant overlap deliberately follows the design and may match reordered words.
- Mock translation/extraction is deliberately narrow and deterministic. It is for offline demo/tests, not a substitute for AMD model evaluation.
- Live AMD integration and Docker image build were not run: no external network/package installation was performed. Provider model selection, credentials, real translation quality, and latency remain unverified. Dockerfile uses the actual app-level package-lock.json; there is no root package manifest.
- Permissive CORS and unauthenticated endpoints match this synthetic prototype's specified contract; no production readiness claim.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

1. Orchestrator: add `.data/` to apps/web/.gitignore. That file is outside the edit allowlist and was not changed.
2. Orchestrator: add a root .dockerignore (or apps/web/Dockerfile.dockerignore) for repo-root builds. The requested apps/web/.dockerignore does not filter `docker build -f apps/web/Dockerfile .`; explicit Docker source COPY paths exclude .env, local .data, .next and node_modules from the image.
3. Doctor/orchestrator: reconcile clinical SPEC with the explicit required list. Clinical SPEC makes associated_symptoms optional, pregnancy_status conditional, orders pregnancy/allergies before medications, and caps follow-ups at three. Current implementation follows the user's fixed eight required fields, their listed priority, and the AI design's three-turn chief-complaint abstention. No new abstainReason was invented for a general follow-up cap.
4. Doctor/native reviewers: review the Thai/Italian static question wording. Move approved templates into shared i18n when authorised; current templates stay inside the owned pipeline folder.
5. Eval owner: use the exported ModelClient/ChatRequest/ChatResult types, trace hook, isolated createSession option, and runTurn return value. No harness files were changed.

## NEXT ACTION

Configure AMD_BASE_URL, AMD_API_KEY, AMD_MODEL and optional AMD_MODEL_FALLBACK in the server environment; run the declared dev-only model selection/evaluation protocol with the eval owner. Build from repo root using `docker build -f apps/web/Dockerfile .` when network access is available, and mount /app/apps/web/.data for persistence. Resolve the clinical required-field decision and ignore-file requests before integration/demo packaging.
