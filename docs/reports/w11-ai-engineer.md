# Wave 11 — AI engineer — Consult assistant backend

## STATUS

done — implementation and required automated checks pass; live smoke testing is limited by the existing dev server's generated build-state errors.

## SUMMARY

- Added four Node API routes for ambient patient/clinician speech, consult state, suggestion review, and draft/sign notes.
- Patient speech runs the identical locked intake turn implementation with `inputMode: "voice"`: raw red-flag pre-check, redaction, deterministic rules, extraction/verifier, and model safety screen. Existing escalation remains sticky.
- Clinician speech is redacted, persisted with role `clinician`, and excluded from extraction/safety model transcripts and all evidence. Matching open questions become `asked`.
- Deterministic suggestions reuse the actual red-flag matcher, including AND-of-ORs, cross-turn matching, NFKC/case/dash/zero-width normalization, Thai compaction, clause-bounded negation, and original quote offsets. Doctor-owned rules are statically bundled, validated, and refreshed by HMR; no rule ids are hardcoded.
- Stable suggestion ids and sticky asked/dismissed statuses persist to disk. Red-flag escalation items rank first, then rule questions, missing required fields in next-question priority, rule considerations, and model suggestions. Responses contain at most eight open suggestions per mode.
- One bounded Gemma completion per patient transcript revision supplies both modes. GET polling, mode switches, and clinician speech reuse the cache. No compatibility completion retry, fallback model, or repair call is made for consult suggestions. Escalated/abstained sessions use deterministic suggestions only.
- Model questions/doctor-only considerations require confidence >= 0.7 and an exact, verbatim, patient-only verifier quote. Unsafe wording in any translated text/rationale is rejected; unverified/low-confidence items are dropped. Provider/schema failure sets `needs_human`, records abstention, and returns deterministic suggestions.
- Draft notes are deterministic, localized, evidence-linked, and keep evidence-free lines `unsupported`. Explicit no-known-allergies evidence is retained. Signing applies redacted edits as `edited`, requires review of every red flag (409 otherwise), and audits `consult_note_signed`.
- Consult state/notes live in a separate persisted store collection, outside `IntakeSession`; existing patient session responses cannot serialize them. Demo reset clears consult state too; HMR upgrades the existing store without restarting.

## FILES CHANGED

- `apps/web/lib/pipeline/consult.ts` — engine, status matching/review, note drafting/signing.
- `apps/web/lib/pipeline/consultRules.ts` — typed clinical bank validation/loading.
- `apps/web/lib/pipeline/pipeline.ts` — shared lock-held turn implementation; unchanged intake safety behavior.
- `apps/web/lib/pipeline/store.ts` — persisted consult records, notes, cache, HMR compatibility/reset.
- `apps/web/lib/pipeline/prompts.ts` — consult prompt and patient-only model transcript boundary.
- `apps/web/lib/pipeline/schema.ts` — consult structured output schema.
- `apps/web/lib/pipeline/llm.ts` — consult schema, output budget, single-completion policy.
- `apps/web/lib/pipeline/mock.ts` — deterministic canned, quoted model question.
- `apps/web/lib/pipeline/__tests__/fixtures/consultRules.ts` — initial independent two-rule synthetic fixture.
- `apps/web/lib/pipeline/__tests__/wave11.test.ts` — new safety, contract, reference-case and persistence tests.
- `apps/web/app/api/sessions/[id]/consult/route.ts`
- `apps/web/app/api/sessions/[id]/consult/turns/route.ts`
- `apps/web/app/api/sessions/[id]/consult/suggestions/[suggestionId]/route.ts`
- `apps/web/app/api/sessions/[id]/consult/note/route.ts`
- `docs/reports/w11-ai-engineer.md`

No shared contracts, Doctor files, UI source, dependencies, or server processes were changed. No commits, installs, build, seed/reset, or server restart.

## TESTS RUN + RESULTS

- Initial full Vitest: **1,161/1,161 passed**, 15 files, including the first 42 Wave 11 tests.
- Extended Wave 11 run: **96/96 passed**, including all 50 Doctor reference cases through the production engine.
- Final full-suite run: **1,224/1,224 passed**, 16 files, including **103/103 Wave 11 tests**; exit 0, 63.36 seconds. The earlier expanded run also passed 1,223 tests before the final long-utterance case was added.
- `./node_modules/.bin/tsc --noEmit --incremental false`: exit 0.
- `./node_modules/.bin/eslint . --max-warnings 0`: exit 0, no warnings.
- `node docs/clinical/check-redflags.mjs`: **175 passed, 0 failed**, 18 rules.
- `node docs/clinical/check-medrules.mjs`: **204 passed, 0 failed**, 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions. The Doctor added 10 reference cases during this task; the earlier 194-case run also passed.
- `node docs/clinical/check-consultrules.mjs`: **50 passed, 0 failed**, 12 rules.
- `git diff --check`: passed.

## EVIDENCE

- All **429/429 final clinical reference checks pass (100%)**.
- Tests cover raw PII absence in persisted store, pre-model escalation, clinician evidence exclusion, both-speaker concurrent idempotency, all four accepting statuses, both closed statuses, ranking/cap, nurse/doctor separation, asked matching, sticky status disk reload, model quote rejection, prohibited wording, no compatibility completion retry, deterministic notes, and red-flag signing rollback/approval.
- Route handlers exercised directly with actual Request/Response objects; all four paths are covered without starting another server.
- Read-only live probes on the existing `:3000` server returned **500** for `/api/health` and `/api/sessions`. `/private/tmp/bridge-web.log` reports missing `.next/routes-manifest.json`, missing generated build-manifest directories, and an unavailable module factory. Creating the missing generated directory did not restore health. The existing server was not restarted, and no manifests were fabricated.
- No screenshot: backend task; route assertions, store reads and test counts are the evidence.

## ASSUMPTIONS

- The latest Wave 11 user brief takes precedence where the concurrently written Doctor spec differs.
- Asked matching is intentionally simple: NFKC/punctuation/Latin-diacritic/Thai normalization via `norm`, then ICU word tokens. For each localized question, remove clinician prompt prefixes; mark asked when at least 50% of its unique tokens occur in the clinician utterance. Consideration items are never auto-marked asked. This does not claim semantic entailment.
- Idempotency is session-scoped across both speech roles, matching existing intake semantics. A retry returns current cached state without duplicate turns, calls or audits.
- A clinician's recorded language uses the session language because `ConsultTurnReq` carries no clinician-language field.
- The suggestion-review request carries no mode. Its response uses nurse mode for shared questions and doctor mode for doctor-only items; callers can GET their chosen mode afterward.
- Signing requires an existing draft; signed notes are immutable. A new utterance invalidates unsigned drafts while preserving signed history.

## RISKS

- Live HTTP smoke verification is limited by the existing server's broken generated build state. Unit/route-handler verification passes; no claim that the live server served these routes successfully.
- Actual Gemma quality was not evaluated against a remote provider; the provider boundary is tested with mocks/fault injection. The mock emits one deterministic question when its quote passes verification.
- Token overlap can mark a similar-but-different question asked; it never becomes patient evidence and never clears escalation.
- With the eight-open cap, lower-ranked model/consideration items can remain queued behind rule questions/required fields until earlier items are marked. Notes include all eligible deterministic candidates, not just the response cap.
- The store and locks retain the existing single-process deployment assumption.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- Doctor `CONSULT-SPEC.md` §2 says clinician speech should trigger red flags; the user explicitly says it must not be red-flag input. Implemented the user requirement: patient speech only.
- Doctor §4 exempts the red-flag banner from the popup budget and has a separate consideration budget. The user explicitly requires red flags as top-ranked `rule_out` suggestions and at most eight open suggestions per mode. Implemented that response contract; the UI still has the existing session red-flag banner.
- Doctor §§5–6 request automatic answered-topic detection, asked/dismissed rule questions in notes, doctor-only signing, blocking unresolved unsupported lines, deletion/new clinician note lines, and per-consideration keep/drop. The user requests sticky asked/dismissed states, still-open questions, and signing with edits plus mandatory red-flag review. Implemented the user contract. Additional keep/delete/answer actions need an agreed API extension; unsupported lines retain their visible unsupported status even after signing.
- The current UI's sign-error fallback can display a local signed fixture after a server rejection (`_consult.tsx`, outside this task's ownership). The clinician builder should preserve server 409 rejection and never represent a failed sign as signed.

## NEXT ACTION

Clinician builder: preserve server sign rejection instead of falling back to a locally signed fixture. Server owner: restore the existing dev server's generated build state, then repeat live HTTP smoke tests. No backend implementation work remains under the current Wave 11 brief.

## EXACT ROUTES

- `POST /api/sessions/[id]/consult/turns`
- `GET /api/sessions/[id]/consult?mode=nurse|doctor`
- `POST /api/sessions/[id]/consult/suggestions/[suggestionId]`
- `POST /api/sessions/[id]/consult/note`
