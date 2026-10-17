# w19 · QA engineer · cross-platform test robustness (CRLF)

## STATUS
done. One open item is outside my scope: a vitest worker RPC timeout under load, described in RISKS.

## SUMMARY
This Windows checkout has `core.autocrlf=true` and the repo had no `.gitattributes`. Every markdown file in the working tree was CRLF; the index is LF.
Data-driven tests and the Doctor checkers use `$`-anchored row regexes on `split('\n')`, so every row still ended in `\r` and nothing matched.

- 3 tests failed: the clinical red-flag table (0 rows), the wave16 dose rows (0 of 10) and the wave3 exact system-prompt comparison.
- 1 table produced 0 rows without failing: wave11 reads CONSULT-SPEC.md, and its 77 Doctor reference rows registered no tests at all.
- The red-flag and consult-rule checkers both exited 1, with 175 and 80 "unparsed test row" failures respectively.

Fix:
1. Added `.gitattributes`: `* text=auto eol=lf`, plus binary rules for images, fonts, documents, video/audio and archives. I made no git write and did no renormalize.
2. Added a test helper `readText` / `readLines`. It strips a leading BOM and turns CRLF or lone CR into LF. The 5 markdown-reading test files now use it.
3. The two markdown-reading checkers got the same normalising reader, plus a new "0 test rows found" failure, so a missing table can no longer exit 0.
4. Added explicit 0-row guards where they were missing (wave11, wave4). No assertion was removed or relaxed. wave11's guard is stricter than "rows > 0": the parsed count must equal the number of `| CR-` lines, so a malformed row fails instead of being skipped.

Result: the suite went from 1610 tests (3 failed) to 1874 tests (0 failed) on the same tree. That is 1610 + 262 recovered rows + 2 new guard tests. The 262 rows are 175 RF + 77 CR + 10 dose. README's 1,872 equals the recovered total before my 2 guards.

## FILES CHANGED
- `.gitattributes` (new, repo root)
- `apps/web/lib/pipeline/__tests__/fixtures/text.ts` (new helper: `readText`, `readLines`)
- `apps/web/lib/pipeline/__tests__/clinical-redflags.test.ts`: reader only; it already had the rows > 0 and row-count guards
- `apps/web/lib/pipeline/__tests__/wave16.test.ts`: reader only; it already had `toHaveLength(10)`
- `apps/web/lib/pipeline/__tests__/wave3.test.ts`: DESIGN.md reader only; the comparison is still exact `toBe`
- `apps/web/lib/pipeline/__tests__/wave11.test.ts`: reader, plus a new guard test "parses every Doctor reference row in CONSULT-SPEC.md"
- `apps/web/lib/pipeline/__tests__/wave4.test.ts`: reader, plus a new guard test "parses the Doctor medrules table". This table already parsed under CRLF, because its regex has no `$` anchor and `slice(1,-1)` drops the trailing `\r`.
- `docs/clinical/check-redflags.mjs`: normalising reader (md and JSON) and a 0-row failure
- `docs/clinical/check-consultrules.mjs`: normalising reader (md and 3 JSON files) and a 0-row failure
- Not changed: `check-vitalrules.mjs` (reads JSON only, its cases are inline, it already passed) and `check-medrules.mjs` (excluded from my scope)

## TESTS RUN + RESULTS
All commands ran from `apps/web` unless noted.

| Run | Result |
|---|---|
| Baseline `vitest run` (before any change) | 3 failed, 1607 passed (1610), 23 files |
| `vitest run` after the fix, before wave19.test.ts existed | **1874 passed (1874), 23 files, exit 0** |
| 5 touched test files together | 668 passed (668), exit 0, run twice |
| Every test file in its own process, 24 files (wave19.test.ts was added meanwhile by the engine agent) | **1934 passed, 0 failed**, every file exit 0. 1934 = 1874 + 60 from wave19. |
| Full `vitest run`, 3 attempts after other agents' w19 edits landed | exit 1 each time. wave8 passed (181), then `[vitest-worker]: Timeout calling "onTaskUpdate"` aborted the run; 0 assertion failures. See RISKS. |
| `node docs/clinical/check-redflags.mjs` (repo root) | before: exit 1, 0 passed / 175 failed. After: **exit 0, 175 passed, 0 failed, 18 rules** |
| `node docs/clinical/check-consultrules.mjs` | before: exit 1, 0 passed / 80 failed. After: **exit 0, 80 passed, 0 failed, 50 rules** |
| `node docs/clinical/check-vitalrules.mjs` (unchanged) | exit 0, "13 cases + band coverage: all passed" |
| Both checkers on scratch copies of the md + JSON: LF-only / CRLF + BOM (md and JSON) / table removed | LF: exit 0 (175/0, 80/0). CRLF+BOM: exit 0 (175/0, 80/0). Table removed: **exit 1** with "FAIL 0 test rows found in ...". |
| Helper on 5 synthetic files: LF, CRLF, BOM+CRLF, BOM+LF, lone CR (`node --experimental-strip-types`) | all 5 produce identical LF text and 2/2 rows, exit 0 |
| `eslint` on the 6 touched TS files | exit 0 |
| `tsc --noEmit -p .` | exit 1 with 3 errors, all in `app/(orders)/_bits.tsx` and `app/(pharmacy)/_orders.tsx` (the new `dispensed` OrderStatus is missing from their status maps). None are in files I touched. |
| `node --check` on both edited checkers | ok |
| `git check-attr text eol` | md: text=auto, eol=lf. ico/otf/jpg/mkv: text unset (binary). |
| `git ls-files --eol` | 448 i/lf, 221 i/-text (png/jpg/otf/ico/pdf), 0 i/crlf or i/mixed, so the new attributes cause no whole-file diffs |

## EVIDENCE
- Row arithmetic (normalised, counted with node): REDFLAG-TESTS 175 RF rows, CONSULT-SPEC 77 CR rows, MEDRULES-TESTS 10 D rows. CONSULT-SPEC read raw under CRLF gives 0 rows.
- Per-file counts in the 24-file run: clinical-redflags 180, wave11 131, wave16 87, wave3 38, wave4 232, wave15 338 (50.9 s), wave8 181 (55.4 s), wave19 60.
- `git diff --stat` on my files shows only the real line changes (for example clinical-redflags.test.ts 5 +-, wave11 9 +-), with no EOL churn.
- Scratch logs: `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\perfile.txt` (per-file run), `...\scratchpad\vitest-full.out` (1874 run), `...\scratchpad\vitest-final3.out` (RPC timeout run).

## ASSUMPTIONS
- I read "any test helper under `__tests__/` that reads markdown" as covering the other test files there that read markdown tables (wave11, wave4), not only the three that failed. wave11 was the larger silent 0-row case (77 rows). The edits are minimal: one import, the reader, and one guard test each.
- Lone CR is also converted to LF. No current file relies on a raw CR inside a cell.
- In the checkers, normalising the JSON files only changes whitespace, because JSON strings cannot hold a raw CR or LF. Stripping a BOM there also prevents a `JSON.parse` SyntaxError if an editor adds one.

## RISKS
- **Flaky full-suite run under load (not caused by this change, not in my scope).** After other agents' w19 edits, `vitest run` aborted three times with `Timeout calling "onTaskUpdate"` right after wave8.
  - wave8 (55.4 s) and wave15 (50.9 to 64.6 s) each run close to the 60 s vitest worker RPC timeout. wave15 alone failed once at 64.6 s and passed at 57.4 s, with 7 node processes running from parallel agents.
  - Every file passes in its own process, so this is an infrastructure timeout, not a test failure.
- The existing CRLF working tree stays CRLF until files are checked out again, which I was told not to do. The readers handle it either way. Fresh clones on any OS will get LF.
- Any new data-driven test that reads markdown with raw `readFileSync(...).split('\n')` and a `$` anchor would reintroduce the bug. It should use `fixtures/text.ts`.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Orchestrator / owner of wave8 and wave15:** split or speed up wave8.test.ts and wave15.test.ts, which take about 51–64 s each, or yield to the event loop in long loops, so a single file stays well under vitest's 60 s RPC window. Until then, a full run on a loaded machine can abort with "Timeout calling onTaskUpdate".
- **README owner:** the README states 1,872 tests in 23 files. Measured now: 1874 in 23 files before wave19, and 1934 in 24 files with wave19.
- **wave16 / Doctor:** wave16 pins exactly 10 dose rows (`toHaveLength(10)`). MEDRULES-TESTS.md is being edited this wave, so adding D rows will need that number updated.
- **Pharmacy or orders UI owner:** 3 tsc errors from the missing `dispensed` key in the status maps in `app/(orders)/_bits.tsx` and `app/(pharmacy)/_orders.tsx`.
- **Doctor (check-medrules.mjs, excluded from my scope), FYI only:** at my baseline it exited 1 with 204 "unparsed test row" failures under CRLF. After the Doctor's w19 edit it exits 0 ("253 passed, 0 failed · medrules 1.2"), so nothing is needed from me.

## NEXT ACTION
Orchestrator: commit `.gitattributes` together with the reader changes. Optionally run `git add --renormalize .` once on a quiet tree; the index is already LF, so it should be a no-op. Then fix the wave8/wave15 duration and update the README count.
