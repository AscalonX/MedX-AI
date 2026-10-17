# w19 · Integration gates

## Gate 1 · round 1

### STATUS
done. All gate commands pass on the current working tree (nothing committed).

### SUMMARY
The engine contract change (`OrderStatus` gained `"dispensed"`) broke tsc in two UI files, because their exhaustive `Record<OrderStatus, …>` maps had no `dispensed` key. Root-cause fix: add the missing status to each map, with th/it/en labels and an existing Badge tone. No test, rule or safety check was touched. After the fix, vitest, tsc, eslint and all four clinical checkers pass. This time the whole vitest suite ran in a single invocation without the `onTaskUpdate` timeout that the engine agent saw under load.

### FILES CHANGED
- `apps/web/app/(orders)/_bits.tsx`: `ORDER_TONE` gains `dispensed: "teal"`, and `ORDER_KEY` gains `dispensed: "stDispensed"`.
- `apps/web/app/(orders)/_lib.ts`: new string `stDispensed` = en "Dispensed, second pharmacist checked" / th "จ่ายยาแล้ว เภสัชกรคนที่สองตรวจซ้ำ" / it "Dispensato, controllato dal secondo farmacista".
- `apps/web/app/(pharmacy)/_orders.tsx`: `ST_TONE` gains `dispensed: "teal"`, and `OL.status` gains `dispensed` = th "จ่ายยาแล้ว" / it "Dispensato" / en "Dispensed".
- `docs/reports/w19-gates.md` (this file).

The tone is teal, the existing Badge tone for "approved, edited, done". No new colour was added and red is not used. The label text tells verified and dispensed apart. The edited files were CRLF in this working tree, and I kept CRLF; `.gitattributes` (`eol=lf`) normalises them on `git add`.

### TESTS RUN + RESULTS (final run, all from `apps/web` unless noted)
| Command | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` (before fix) | exit 2: TS2741 `_bits.tsx(32,7)`, TS7053 `_bits.tsx(33,105)`, TS2741 `(pharmacy)/_orders.tsx(10,7)`, all for the missing `dispensed` |
| `./node_modules/.bin/tsc --noEmit -p .` (after fix) | exit 0, no output |
| `./node_modules/.bin/eslint .` | exit 0, no output |
| `./node_modules/.bin/vitest run` (single whole-suite run) | exit 0: `Test Files 24 passed (24)`, `Tests 1934 passed (1934)`, duration 181.33s. Log scanned: no `onTaskUpdate`, `Unhandled` or `FAIL` lines |
| `node docs/clinical/check-consultrules.mjs` (repo root) | `80 passed, 0 failed, 50 rules`, exit 0 |
| `node docs/clinical/check-medrules.mjs` | `253 passed, 0 failed · medrules 1.2 · 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries`, exit 0 |
| `node docs/clinical/check-redflags.mjs` | `175 passed, 0 failed, 18 rules`, exit 0 |
| `node docs/clinical/check-vitalrules.mjs` | `13 cases + band coverage: all passed`, exit 0 |

### EVIDENCE
- Per-file vitest counts from the whole-suite run include wave19 60 tests, wave15 338, wave8 181 (46.7s), and clinical-redflags 180.
- 1934 = the 1874 reported by w19-qa-crlf + 60 new wave19 tests.
- `next build` was not run, as the gate instructions say.

### ASSUMPTIONS
- "Dispensed" is a done state, so it reuses the teal "done" tone. If the design lead wants verified and dispensed to look different, that is a design-token decision.
- th/it strings need native-speaker review, the same as the other strings in these files.

### RISKS
- The whole-suite run passed here, but the engine agent saw `Timeout calling onTaskUpdate` under heavier machine load. The config already uses `singleFork` and `fileParallelism: false`, so CI on a loaded runner may still need retries or a split run.

### OPEN QUESTIONS / CONTRACT CHANGE REQUESTS (not integration breakage; need a feature wave or a human decision)
1. The UI is not wired to the new pharmacy engine features. No file under `apps/web/app/(pharmacy)`, `(clinician)`, `(orders)` or `apps/mobile` calls `POST …/dispense` or `POST /api/sessions/:id/pickup`, or uses `alertIds`/`suggestedGenerics` on the pharmacy action, `alert.alternatives` or `patientView.pickup`. Only the two route files mention them. Pharmacist 2 (dispense checklist), "call patient", the report-to-prescriber view and the patient "ready to collect" screen exist only as API routes. The copy for alternatives must say "options for prescriber review".
2. The engine agent's question is still open: after `collected`, a newly submitted order can never be called (`call` returns 409). Should `collected` reset the way `ready` does?
3. The engine agent's question is still open: a verified order cannot be pulled back when a new high alert appears after verification.

### NEXT ACTION
Orchestrator: commit the w19 tree (the gate is green). Then run a UI wave to wire item 1, and get a product decision on items 2 and 3.

## Gate 2 · round 1

### STATUS
done. On the current working tree (nothing committed), every gate command passes in the final run: vitest, tsc, eslint, `next build` with `MODEL_PROVIDER=mock`, and all four `docs/clinical/check-*.mjs` scripts.

### SUMMARY
The first whole-suite vitest run aborted with `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`. Only 1 of 29 files had run (181 tests passed, 0 failed), in a 64.17 s run. The pharmacist-web agent saw the same abort. The cause was CPU, not a flaky test:
- wave8 (181 tests) keeps the worker's event loop busy with microtasks only. Once that passed vitest's 60 s RPC window, the RPC timer fired before the reply could be read. In Gate 1 the file took 46.7 s, which was already close to the limit.
- A CPU profile of 20 mock `runTurn` calls found that 3010 of 3277 ms (92%) was in `normalise()` in `apps/web/lib/pipeline/redflags.ts`.
- `checkRedFlags` re-normalised all 769 rule terms for each of the 2 x (patient turns + 1) text domains, and a turn calls it 3 times. Every `normalise()` call also built a new `Intl.Segmenter`.

The fix in `redflags.ts` does not change behaviour:
1. One module-level grapheme `Intl.Segmenter` is reused. Segmenters keep no state between `segment()` calls.
2. Each rule term's normalised needle is memoised, keyed by `(compactThai, term)`. A needle is a pure function of those two inputs, and terms come only from rule files, never from patient text. The map is cleared if it ever reaches 20,000 entries.

Matching, negation, evidence offsets and rule order are unchanged. Red-flag rules still run as deterministic code before any model call (invariant 1). Results:
- wave8 now takes 3.4 s, down from 46.7 to 64 s.
- The whole suite takes 37.4 s, down from 181 s in Gate 1.
- No test, rule, threshold or safety check was edited, skipped or weakened.

### FILES CHANGED
- `apps/web/lib/pipeline/redflags.ts`: reuse one `Intl.Segmenter`, and memoise rule-term needles in `needleFor()` (+16/-2 lines). The file stays CRLF like the rest of the tree; `.gitattributes` `eol=lf` normalises it on `git add`.
- `docs/reports/w19-gates.md`: this section.

### TESTS RUN + RESULTS (web commands from `apps/web`, clinical scripts from the repo root)
| Command | Result |
|---|---|
| `./node_modules/.bin/vitest run` (before fix) | aborted: `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, `Test Files 1 passed (29)`, `Tests 181 passed (181)`, `Errors 1 error`, duration 64.17s |
| `./node_modules/.bin/vitest run lib/pipeline/__tests__/wave8.test.ts lib/pipeline/__tests__/clinical-redflags.test.ts lib/pipeline/__tests__/safety.test.ts` (after fix) | `Test Files 3 passed (3)`, `Tests 405 passed (405)`, duration 3.66s |
| `./node_modules/.bin/vitest run` (after fix, final) | exit 0: `Test Files 29 passed (29)`, `Tests 1959 passed (1959)`, duration 37.38s. Log scanned: no `Unhandled`, `FAIL` or `onTaskUpdate` lines. The only "error" text is the test name `chips cannot override provider_error abstention` |
| `./node_modules/.bin/tsc --noEmit -p .` (final, after fix) | exit 0, no output |
| `./node_modules/.bin/eslint .` (after fix) | exit 0, no output |
| `MODEL_PROVIDER=mock ./node_modules/.bin/next build` | exit 0: `Compiled successfully in 25.3s`, `Generating static pages (11/11)`. It lists every route, including `/api/sessions/[id]/orders/medications/[orderId]/dispense`, `/api/sessions/[id]/pickup`, `/pharmacy`, `/pharmacy/[id]`, `/review/[id]/orders` and `/review/[id]/trace` |
| `node docs/clinical/check-consultrules.mjs` | `80 passed, 0 failed, 50 rules`, exit 0 |
| `node docs/clinical/check-medrules.mjs` | `253 passed, 0 failed · medrules 1.2 · 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries`, exit 0 |
| `node docs/clinical/check-redflags.mjs` | `175 passed, 0 failed, 18 rules`, exit 0 |
| `node docs/clinical/check-vitalrules.mjs` | `13 cases + band coverage: all passed`, exit 0 |
| extra: `apps/mobile`: `./node_modules/.bin/tsc --noEmit -p .` | exit 0, no output |

### EVIDENCE
- Profile: 20 mock `runTurn` calls took 3277 ms of CPU, of which 3010 ms was self time in `normalise` (`redflags.ts:7`).
- Per-file times in the final run: wave15 338 tests 8335ms, llm-api 39 tests 4894ms, wave19 60 tests 3590ms, wave8 181 tests 3427ms, clinical-redflags 180 tests 277ms, pharmacy-live 1 test 79ms, pharmacy-lib 9 tests, orders-lib 4 tests, ops-data 16 tests, trace 7 tests, _graph 4 tests.
- 1959 = Gate 1's 1934 + 25. Of these, 23 are in the five new UI test files since Gate 1: `(clinician)/review/_stage` 5, `(orders)/orders-lib` 4, `(pharmacy)/pharmacy-lib` 9, `(pharmacy)/pharmacy-live` 1 and `(trace)/_graph` 4. These take the suite from 24 to 29 files. The other 2 come from existing test files edited after Gate 1, such as `(ops)/ops-data.test.ts`.
- `next build` was run in this tree, where `apps/web/.next` did not exist before the build. The dev server on :3000 belongs to the separate checkout `C:\Users\User\medx-run`, so nothing collided. `.next/` and `.env.local` are git-ignored (`apps/web/.gitignore` lines 17 and 43).

### ASSUMPTIONS
- Rule terms are static rule-file data, so a process-wide memo is safe. If a future feature built rule terms from patient text, that text would go through this cache, and the cache should then be removed.

### RISKS
- No live browser click-through of the new pharmacist 1 and 2 stages, pickup card, prescriber report panel or patient "ready to collect" screen in this tree. The gate was not allowed to run `next dev`, and the :3000 server runs an older checkout. A manual pass is still needed before the demo.
- The `onTaskUpdate` RPC window is still 60 s per long, microtask-only file. wave15 (8.3 s) is now the slowest file, so the headroom is about 7x.

### OPEN QUESTIONS / CONTRACT CHANGE REQUESTS (forwarded; not integration breakage)
1. Engine: after `pickup.status === "collected"`, a newly submitted order can never be called (409 `Medicines already collected`). The contract says "not allowed after collected". Should a new pickup cycle start? This needs a product decision.
2. Engine: unsent `draft` orders count as non-cancelled for the call rule, so a doctor's draft blocks "Call patient". This follows the contract wording. Should drafts be excluded? Product decision.
3. Still open from Gate 1: a verified order cannot be pulled back when a new high alert appears after verification.
4. CR-18 (pharmacist-web): move the pickup and "Options for prescriber review" strings from `(pharmacy)/_orders.tsx` into `packages/shared` i18n (orchestrator-owned).
5. Thai and Italian wording of all w19 strings needs native-speaker review.

### NEXT ACTION
Orchestrator: the gate is green, so commit the w19 tree, including `apps/web/lib/pipeline/redflags.ts`. Then do one manual browser pass of doctor, pharmacist 1, pharmacist 2, pickup and the patient screen on this tree, and get product decisions on open questions 1 to 3.
