# W2 report: AI researcher

## STATUS
**done** for this wave's scope: screen design, pre-declared metrics, harness, and one mock run. Not done: any Gemma-on-AMD number (still no endpoint), and arm (c), which waits for the engineer to implement the screen.

## SUMMARY
1. **Model red-flag screen (add-only), DESIGN.md §8.** One Gemma call per patient turn. It runs after the deterministic rules (none if a rule hits) and in parallel with extraction.
   - Output is `{"flags":[{category, turn, quote, certainty}]}`, capped at 3 flags. Categories are the 14 rule families.
   - Each flag is accepted only if it is not "low" certainty **and** its quote passes the same `verifyDetailed`. Unverified flags are discarded and logged.
   - Hits are `ruleId "MODEL-<CAT>"`, `source "model"`. Severity, label, action and patient message come from code (a table mapping each category to a v1.1 rule; CHEST and BREATH take emergency), never from the model.
   - A hit escalates like a rule hit; the clinician card reads "Model-suggested — confirm".
   - If the screen fails, the rules still stand and intake continues. The UI shows "model screen unavailable", derived from `modelCalls` (`step:"red_flags"`, `ok:false`), so **no contract change** is needed.
   - The exact system and user prompts and the JSON schema are written out. Disclosure: I read the text of HO-04 while building the harness. The criteria are generic; no holdout wording was used.
2. **METRICS.md, before any run.**
   - New **M11**: arms (a) rules v1.0, (b) v1.1, (c) v1.1 + model screen, each on the blind holdout (the **headline**, independent) and on the 40 cases (in-sample).
   - Holdout pass criteria for (c): recall ≥ 9/10, false alarms ≤ (b) + 1.
   - M4 is now also sliced by `rule_gap` and `known_fp`. All of this has dated changelog lines.
   - One later, dated clarification to the M1 auto-judge (plural fold, and "None" ≡ "no medicines" for negatives) after the **mock-only** smoke run, before any AMD run. Reason: gold writes negatives as "None" (14×) and "No drug allergy" (7×), so the original rule would have systematically marked correct answers wrong.
3. **Harness `eval/run.ts`.**
   - Loads `data/cases` (with the split from `index.json`) and `data/holdout`, and validates every file.
   - Drives `runTurn` directly with the configured provider, using `trace` for raw model JSON.
   - Computes M1–M11 with Wilson CIs, a paired bootstrap for M3 (seed 17), tag slices, 6×3 fault injection, and a manual-judgement CSV.
   - Writes `eval/runs/<ts>/{config.json, raw.jsonl, results.json, metrics.json, manual.csv}` and regenerates `eval/REPORT.md`. With mock it carries a **"MOCK PROVIDER — NOT EVIDENCE"** banner. `--rescore` recomputes without model calls.

## FILES CHANGED
- `docs/ai/DESIGN.md`: §0 diagram line, and the new §8 model red-flag screen.
- `docs/ai/METRICS.md`: M11, M4 slices, M1 rule 1b, 3 changelog lines.
- `eval/run.ts`: new harness.
- `eval/README.md`: real commands and status.
- `eval/REPORT.md`: generated, mock run.
- `eval/runs/2026-10-17T07-23-25-282Z/`: generated, git-ignored.
- `docs/reports/w2-ai-researcher.md`: this report.

Nothing outside `docs/ai/` and `eval/` was touched. No npm install, no commit.

## TESTS RUN + RESULTS
- `cd apps/web && MODEL_PROVIDER=mock npx vite-node ../../eval/run.ts -- --split all` → 40 cases + 18 holdout, 0 errors, 0 invalid files, about 10 s.
- `--rescore` of the same run after the M1 clarification → OK.
- `npx tsc --noEmit --strict … ../../eval/run.ts` → exit 0.
- `cd apps/web && npx vitest run` → 322/322 pass. These are other roles' tests; I ran them only to confirm nothing broke.

## EVIDENCE (mock run, **NOT evidence of model quality**)
- **Cross-check that the harness is correct:** holdout arms (a) and (b) give recall **7/10** and false alarms **3/8**, case by case identical to the independently recorded `eval/results/holdout-rules-only.md`. On the 40 cases: v1.0 9/11, v1.1 11/11 recall, 2/29 false alarms (IT-09, TH-09, the `known_fp` cases).
- **Arm (c)** = "not run: screen not implemented". It is reported that way, not as zero.
- Fault injection 18/18. No model call after escalation 13/13. Evidence mechanical validity 79/79.
- M5 shows abstain recall 0/6 on mock. Note that the gold marks **6** cases `shouldAbstain` (EN-04, EN-12, IT-04, IT-12, TH-03, TH-12), but CASE-PLAN.md says 3. The injection cases were apparently labelled shouldAbstain. Someone needs to check this.
- The full mock numbers are in `eval/REPORT.md`. They are labelled not-evidence and must not be quoted.

## ASSUMPTIONS
- Arm (c) will be exercised once the engineer adds the screen inside `runTurn` (model calls with `step "red_flags"` and hits with `source "model"`). The harness needs no change for that.
- `eval/runs/` stays git-ignored, as the orchestrator's `.gitignore` has it. `REPORT.md` names the run id.
- The M8 latency target includes the parallel screen call, so the per-turn budget is unchanged.

## RISKS
1. **Verifier false positive on short Thai quotes (real, found by this run).** The mock asserted "cough" from the quote `ไอ`, which matched inside `ไอบูโพรเฟน` (ibuprofen) in TH-02. Exact substring matching accepts a 2-character Thai quote inside a different word. A real model can produce short quotes too. `Intl.Segmenter` splits this loanword the same way (`ไอ|บู…`), so a word-boundary check would not catch this case. Suggestion for the engineer: for quotes with ≤ 2 word tokens, require Segmenter word-boundary alignment **and** apply a lower confidence. The residual risk is measured by M1/M2 and the clinician sees the highlighted context.
2. The screen will add false alarms. The holdout has only 8 negatives, so the CI is wide. Report the result regardless.
3. The holdout's independence holds only if nothing is tuned on it. Each frozen configuration gets one run.
4. The M1 auto-judge still misses synonyms ("stomach ache" vs "Abdominal pain"). The manual sample (40 pairs, κ) is there to measure exactly this.
5. No AMD endpoint yet, so every number so far is mock.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **AI engineer:** implement DESIGN §8 in `runTurn`:
   - `Promise.all([extract, screen])`, `step: "red_flags"`, the category → rule table, add-only de-duplication by ruleId.
   - Mock support for `step "red_flags"` that returns `{"flags": []}`, so mock never invents flags.
   - Optionally, the short-Thai-quote guard from Risk 1.
2. **UI / clinician web:** show "Model-suggested — confirm" when `source === "model"`, and the "model screen unavailable" banner using the rule in §8.2.
3. **Doctor:** confirm the category → severity table (§8.3), especially CHEST and BREATH → emergency.
4. **Medical researcher / doctor:** reconcile gold `shouldAbstain` (6 cases in data versus 3 in CASE-PLAN).
5. No contract changes requested.

## NEXT ACTION
When the AMD key and endpoint arrive:
1. Run `--split dev` for model selection.
2. Freeze the configuration (record the sha).
3. Run `--split test` once, including the holdout once with the screen.
4. Fill in the manual sheet and regenerate `REPORT.md`.
