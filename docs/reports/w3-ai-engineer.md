# Wave 3 — AI engineer

## STATUS

done — implementation, all tests, full web typecheck, lint and mock evaluation pass.

## SUMMARY

Implemented DESIGN §8's add-only model red-flag screen. After redaction and the deterministic rules, `Promise.all` runs extraction and the screen over the complete redacted transcript. Any existing rule/model flag or escalated session still stops before any model call. Accepted flags use `MODEL-<category>`, `source: "model"`, and the exact severity/label/action/patientMessage copied from the category's v1.1 clinical rule. Hits preserve verified extracted fields, escalate, suppress follow-ups and remain sticky across later turns.

The screen uses the specified system/user prompts, strict JSON schema, temperature 0, 400 output tokens and a 12-second timeout. It has no provider retry; a malformed top-level response gets one repair only with at least four seconds of turn budget remaining. Unknown/malformed items, low certainty and unverified quotes are discarded and audited. Discard reasons are recorded on the corresponding model call without storing invented quotes in audit. Screen failures record `step: "red_flags", ok: false` and do not themselves cause abstention. Mock screens return `{ "flags": [] }`.

The quote verifier now checks the start and end of exact, normalized and tolerant spans against word/segment boundaries, and searches later occurrences when the first is embedded in another word. It preserves original evidence offsets. ICU on this runtime segments `ไอบูโพรเฟน` into pieces starting with `ไอ`, so the verifier additionally treats the two covered ibuprofen transliterations as complete compounds. The actual TH-02 fixture now rejects cough evidence from the medication name. The DESIGN §5 short-evidence multiplier remains 0.85, applied exactly once in field confidence: high-certainty short quotes score 0.77, while exact-match `matchFactor` stays 1.0.

CR-D3 now includes `components/**/*.test.ts` and `app/**/*.test.ts` in Vitest. Existing extraction fault tests were updated to distinguish extraction calls from the new parallel screen call.

## FILES CHANGED

- `apps/web/lib/pipeline/redFlagScreen.ts` — new screen and category-to-rule mapping.
- `apps/web/lib/pipeline/pipeline.ts` — concurrent extraction/screen and additive escalation.
- `apps/web/lib/pipeline/prompts.ts` — exact §8 prompts and escaped transcript.
- `apps/web/lib/pipeline/schema.ts` — screen schema and item validation.
- `apps/web/lib/pipeline/llm.ts` — screen-specific schema and token budget.
- `apps/web/lib/pipeline/mock.ts` — default empty screen.
- `apps/web/lib/pipeline/verify.ts` — boundary verification and Thai compound protection.
- `apps/web/lib/pipeline/extract.ts` — clarifying comment on existing short-evidence confidence calculation.
- `apps/web/lib/pipeline/__tests__/wave3.test.ts` — 38 new regression tests.
- `apps/web/lib/pipeline/__tests__/pipeline.test.ts`, `wave2.test.ts`, `llm-api.test.ts` — step-aware assertions and test clients.
- `apps/web/vitest.config.ts` — CR-D3 test discovery.
- `docs/reports/w3-ai-engineer.md` — this report.

The required harness command also generated `eval/REPORT.md` and `eval/runs/2026-10-17T07-37-25-632Z/`. No harness source was edited. Shared contracts, concurrent UI/mobile files and the running dev server were left to their owners. No commit, package installation or additional server was started.

## TESTS RUN + RESULTS

Commands executed from `apps/web` on 17 Oct 2026:

| Command | Result |
|---|---|
| `npx vitest run` | Exit 0: 8 files, 373 tests passed, 0 failed; 32.49 s |
| `npx tsc --noEmit` | Final retry exit 0, no diagnostics |
| `MODEL_PROVIDER=mock npx vite-node ../../eval/run.ts -- --split all` | Exit 0: 40 cases plus 18 holdout cases |
| `npx eslint lib/pipeline app/api --max-warnings=0` | Exit 0, no diagnostics |
| `git diff --check` (repo root) | Passed, no whitespace diagnostics |

Initial runs exposed stale pre-screen call-count assumptions and extraction-only timeout fixtures; those were corrected. Two full-suite command wrappers expired during concurrent activity; their orphaned test workers were stopped, and the complete final run above passed. Transient clinician/ops/pharmacy missing imports resolved in their owners' concurrent work; no fixes to those files were made here.

## EVIDENCE

- Final test breakdown: clinical red flags 180; safety 45; pipeline 21; AMD/API 39; wave 2 37; wave 3 38; ops data 9; UI components 4. Total 373.
- The 38 Wave 3 tests cover escalation/sticky flags, actual concurrency, discarded unverified/low-certainty/malformed suggestions, safe audit metadata, corrected patient-turn IDs, assistant exclusion, all 14 clinical category mappings, deduplication, rule-first skipping, provider failure/re-screening, schema repair/budget, timeout, exact system prompt, transcript escaping, transport schema/token budget, Thai/Latin boundaries, exact TH-02 fixture and short-quote confidence in EN/TH.
- Final mock evaluation artifacts: `eval/runs/2026-10-17T07-37-25-632Z/`; generated summary: `eval/REPORT.md`.
- Mock holdout rule recall was 7/10; rules plus empty mock screen also 7/10. These are harness smoke-test results, not Gemma/AMD performance evidence.
- No screenshots are applicable to this backend-only change.

## ASSUMPTIONS

- DESIGN §8's schema-repair exception permits a second screen invocation for malformed top-level output; ordinary successful turns use one screen call.
- Invalid individual items are dropped without a whole-response repair, as specified.
- A successful screen remains available when individual suggestions are discarded; `ModelCall.error` carries safe discard reason codes while `ok` remains true.
- The existing DESIGN §5 short-quote multiplier is the required confidence reduction; it must not be multiplied twice.

## RISKS

- No live Gemma/AMD credentials or model behavior were exercised. Model semantic accuracy still requires the AI researcher's live evaluation and clinician confirmation.
- Word boundaries establish quote provenance, not clinical truth. Thai ICU segmentation is imperfect; compound protection covers the specified ibuprofen case and its covered spelling variant, rather than a complete medication dictionary.
- Full-repo typechecking can change while other builders write files; the final check passed against the files present at handoff.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

None. No shared contract change is required; the concurrent pharmacy import resolved before the final successful typecheck.

## NEXT ACTION

Hand off for the AI researcher's live Gemma/AMD evaluation and clinician review of the model-suggested flag flow.
