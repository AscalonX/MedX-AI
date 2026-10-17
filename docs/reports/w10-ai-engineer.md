# W10 AI engineer — requested Wave 9 safety fixes

## STATUS
done — all six requested changes implemented with regressions; Vitest, TypeScript, ESLint and both clinical reference checkers pass. QA before/after results and residual assertions are recorded below.

## SUMMARY
- Pharmacy completion returns HTTP 409 with all outstanding reasons: rule/model red flags, an abstained summary, unreviewed unsupported/unmatched allergies, unreviewed high medication alerts, and unreviewed unsupported/unmatched medicines. Failed completion saves neither corrections nor audit events. Recorded high alerts also require review when the same request discontinues a medicine.
- Field approve/edit returns 409 until all red flags have reviews. A request may review the outstanding flags and edit/approve atomically.
- Restored the recorded PHARMACY-SPEC fail-safe: patient-reported stopping never assigns `discontinued` or suppresses any medication rule. Timing retains the statement, including “yesterday”; relevant alerts append confirmation wording to both message and action in EN/IT/TH. Bare “stop” and negated stopping do not become stopped timing. A pharmacist's explicit discontinue action still excludes that medicine from recomputation.
- Address redaction requires an address shape. Abbreviated street suffixes require a house number plus capitalised street name. The two reported clinical sentences retain onset and dose.
- `clientTurnId` is validated and persisted on the internal patient turn, with duplicate detection inside the existing per-session lock. Concurrent retries return the current session without new turns or audit events, including after clinician takeover. Public shared types were not edited.
- Preserved the existing 40-second model-processing deadline and exported its constant for the turn route. Success/error responses include `x-medx-timeout-ms: 40000` and expose that header through CORS.

## FILES CHANGED
- `apps/web/lib/pipeline/pharmacyReview.ts`
- `apps/web/lib/pipeline/pipeline.ts`
- `apps/web/lib/pipeline/pharmacyContext.ts`
- `apps/web/lib/pipeline/pharmacyExtraction.ts`
- `apps/web/lib/pipeline/medrules.ts`
- `apps/web/lib/pipeline/redact.ts`
- `apps/web/app/api/sessions/[id]/turns/route.ts`
- `apps/web/lib/pipeline/__tests__/wave9.test.ts` — updated stopped-medicine expectations.
- `apps/web/lib/pipeline/__tests__/wave10.test.ts` — 52 new regression cases covering all six requested changes.
- `docs/reports/w10-ai-engineer.md`

`docs/clinical/MEDRULES-TESTS.md` was inspected and left unchanged: no row encoded the stopped-medicine exclusion. No other clinical/shared/QA file was edited. Pre-existing untracked `docs/reports/7-qa-bugs.md` was left untouched.

## TESTS RUN + RESULTS
Commands use the already-installed binaries in `apps/web/node_modules/.bin`; no installs, commits, builds, or server restarts.

- Final `vitest run --reporter=dot`: **1,093/1,093 passed across 14 files, exit 0, 50.14 seconds**, using the default test timeout. Earlier attempts: the first runner stopped at its 60-second execution limit and is not counted as a completed suite; a subsequent run reported 1,092 passed and one existing demo-reset test timeout plus a worker `onTaskUpdate` timeout. The demo-reset suite passed alone at 114/114, exit 0, 4.54 seconds, before the final successful full run. No test timeout setting was changed.
- `tsc --noEmit --incremental false`: exit 0, no diagnostics.
- `eslint .`: exit 0, no diagnostics.
- `node docs/clinical/check-redflags.mjs`: 175/175, 18 rules, exit 0 (100%).
- `node docs/clinical/check-medrules.mjs`: 194/194, 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, exit 0 (100%).
- `git diff --check`: exit 0.

### Live QA before/after

The existing server at `http://localhost:3000` was used with synthetic cases; it was never restarted. Counts below are unmodified script executions.

| Script | Before | After |
|---|---|---|
| `qa/12-allergy-negation.mjs` | 8/8, exit 0 | 8/8, exit 0 |
| `qa/13-med-negation.mjs` | 5/5, exit 0 | 4/5, exit 1 |
| `qa/14-meds-field.mjs` | 3/3, exit 0 | 3/3, exit 0 |
| `qa/07-repros.mjs` | 22/26, exit 1 | 22/26, exit 1 |

QA 13's sole changed assertion requires stopped warfarin to be excluded and its interaction to disappear, directly contradicting the last medication decision in `docs/DECISIONS.md`. The after response retains `warfarin` with timing `stopped taking warfarin last year` and high `MR-INT-01`, as required. Running the same script in memory with only that assertion aligned to the decision passes 5/5, exit 0; the repository QA script remains untouched because it is outside ownership. New owned regression tests cover the three clinical-review probes and fail-safe behavior.

QA 07 retains the same four baseline failures: Italian “all'altezza del petto” not escalated; English “my chest is killing me, cold sweat” not escalated; Thai “ไม่เจ็บหน้าอก แต่ปวดหัวตั้งแต่เมื่อวาน” produces `RF-CHEST-02`; and GET `/api/demo/reset` returns 405. These were not changed by this task.

## EVIDENCE
- 52 new regression cases; three safety-review probe sentences preserve high bleeding alerts (MR-INT-01 for ibuprofen/warfarin, MR-INT-03 for aspirin/warfarin).
- Regression assertions cover all five sign-off blocker categories independently, combined reason lists, failed-request rollback, both rule/model flag approval gates, all three alert languages, narrow provider evidence, retained onset/dose, concurrent retries, persisted retry IDs, takeover retries, session-scoped IDs, invalid IDs, success/error timeout headers, and a slow next-question client under the 40-second budget.
- Clinical reference checkers: 369/369 combined.
- QA totals: before 38/42; after 37/42 with the one intentional fail-safe expectation conflict described above. Decision-aligned in-memory QA 13: 5/5.
- No screenshots: these changes concern server behavior and are verified through API/regression assertions.

## ASSUMPTIONS
- A red-flag review supplied in the same valid atomic request satisfies the field approval prerequisite; any flag omitted from that request still blocks.
- Retry IDs are opaque strings of 1–200 characters, scoped to a session; calls without IDs retain legacy behavior.
- The 40-second budget remains the existing model-processing deadline; requests serialize on the existing process-local session lock.

## RISKS
- Existing QA 07 rule/negation failures remain. The frozen clinical dictionary/reference rules were not tuned in this task.
- The existing single-process store/lock architecture is unchanged.
- One earlier full run had a test/worker timeout under load; the final full run passed all 1,093 tests at the default timeout.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- QA owner: update only QA 13's stopped-medication assertion to require the retained medicine and high interaction alert, matching the recorded decision. Keep true medication denials excluded.
- Clinical/API owners: triage the four unchanged QA 07 failures separately.
- No shared-contract change requested: `AddTurnReq.clientTurnId` already exists.

## NEXT ACTION
Ready for orchestrator review. QA owner can align QA 13; the remaining QA 07 findings require separate triage. No commit was created.

---

## W10 follow-up — lowercase addresses and deterministic test runner

### STATUS
done — both requested follow-up fixes implemented; three consecutive full Vitest runs, TypeScript and ESLint exit 0.

### SUMMARY
- Read `docs/reports/w10-codex-verify.md`. Replaced the two English address expressions with one case-insensitive house-number + 1–3 street-name-token expression. Supported terminal suffixes include st/street, rd/road, ave/avenue, blvd/boulevard, lane/ln, dr/drive, way and ct/court; suffixes require a boundary and may consume a trailing period. Italian/Thai expressions remain supported.
- Excluded dose/time tokens (including mg, days, hours, weeks and ago) from street names. Both reported clinical sentences remain unchanged, including the existing short unit-word probes. Four name tokens and suffix substrings do not match.
- Configured Vitest 3's forks pool with `singleFork: true`, retained sequential files and default isolation, and raised test/hook timeouts to 30 seconds for seed/reset replays under load. Production request budgets remain unchanged.
- Fake-timer suites explicitly clear pending fake timers before restoring real timers. Seed success/failure and whole-turn deadline regressions assert zero pending fake timers before cleanup; the background seed test also waits for status `done` before teardown.
- Lifecycle inspection found a synchronous JSON-file store with no open store handle, and no servers or intervals in the owned pipeline/API paths. Existing invocation/transport deadline timers clear in `finally`; awaited retry/seed delays finish before their enclosing operations return. No production close API was necessary.

### FILES CHANGED
- `apps/web/lib/pipeline/redact.ts`
- `apps/web/vitest.config.ts`
- `apps/web/lib/pipeline/__tests__/wave10.test.ts`
- `apps/web/lib/pipeline/__tests__/wave2.test.ts`
- `apps/web/lib/pipeline/__tests__/wave3.test.ts`
- `apps/web/lib/pipeline/__tests__/wave7.test.ts`
- `apps/web/lib/pipeline/__tests__/llm-api.test.ts`
- `docs/reports/w10-ai-engineer.md` — appended this follow-up; earlier results above are historical.

### TESTS RUN + RESULTS
All commands used the existing `apps/web/node_modules/.bin` binaries from `apps/web`; no installs, commits or server restarts.

| Command | Result | Duration |
|---|---|---|
| `vitest run lib/pipeline/__tests__/wave10.test.ts --reporter=dot` | 76/76 passed, exit 0 | 2.04 s |
| Full `vitest run --reporter=dot`, consecutive run 1 | 1,119/1,119 passed, 14/14 files, exit 0 | 49.10 s |
| Full `vitest run --reporter=dot`, consecutive run 2 | 1,119/1,119 passed, 14/14 files, exit 0 | 48.90 s |
| Full `vitest run --reporter=dot`, consecutive run 3 | 1,119/1,119 passed, 14/14 files, exit 0 | 49.23 s |
| `tsc --noEmit --incremental false` | exit 0, no diagnostics | 1.60 s |
| `eslint .` | exit 0, no diagnostics | 1.81 s |
| `git diff --check` | exit 0 | — |

### EVIDENCE
- 26 additional address regression cases; full-suite count increased from the verification report's 1,093 to 1,119. Existing Italian/Thai address assertions and all four specifically requested sentences pass.
- Lowercase probes `I live at 12 main st` and `25 elm rd.` assert redaction directly, in the stored patient turn/JSON file, and in every injected model request, with extraction, safety screening and next-question calls all exercised.
- Each supported suffix is tested with 1, 2 and 3 mixed-case name tokens, uppercase variants, punctuation and end-of-input. Negative cases cover four name tokens, suffix substrings and clinical unit words.
- All three full runner processes terminated naturally with exit 0; no unhandled worker timeout was reported. Seed and deadline tests observed zero pending fake timers.
- No screenshots: server-side redaction and runner lifecycle were verified through automated assertions and process exit codes.

### ASSUMPTIONS
- A bounded English address shape is the requested tradeoff; clinical units between the number and suffix disqualify the candidate.
- Running the small 14-file suite in one fork is acceptable for this prototype; default test-file isolation remains enabled.

### RISKS
- Three clean runs demonstrate observed stability; the exact internal cause of the earlier Vitest worker RPC timeout was not independently established.
- Pattern-based redaction remains limited to recognized address shapes; this change does not establish complete PII detection.
- Findings outside this follow-up's ownership/scope in `w10-codex-verify.md` remain for their respective owners.

### OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
None for this follow-up; no shared contracts changed.

### NEXT ACTION
Orchestrator can review the lowercase-address fix and three clean runner exits. No commit created.
