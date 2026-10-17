# Wave 12 — AI engineer

## STATUS

done

## SUMMARY

Implemented seven POST routes returning the updated `IntakeSession`, deterministic NEWS2/triage, doctor investigations and medication orders, prescribing checks and pharmacist review, plus the four consult fixes. No installs, server restarts, or commits performed by this task. Other collaborators changed/committed their own work during this run; those changes were preserved.

Vitals use the same physiological limits as the orders UI. Invalid types, ranges, pain scores, consciousness values and inverted blood pressure return 400 without writes. NEWS2 uses the Doctor's bands (including categorical `equals`), recorded-resolution rounding and first-match levels, supports `incompleteVitals`, and applies CR-12's level-3 guard when incomplete vitals reach a reassuring default. Incomplete scores stay absent. Confirmations never happen automatically and survive later suggestions; less urgent confirmations require a note. New patient turns also recompute an existing triage suggestion after red-flag evaluation.

Medication drafts match the existing dictionary and conservatively parse explicit mg/g/mcg doses and common daily/hourly frequencies. Checks reuse the deterministic medication engine over current patient medicines (excluding pharmacist-discontinued entries), allergies, pregnancy, other non-cancelled orders and the target order. Dose-range alerts are high severity. Submission and pharmacy verification recheck current context and block without all high-alert overrides. Returns require a note; editing returned orders clears obsolete overrides/pharmacist state, rechecks and returns to draft. Investigation codes must exist in the catalog. Every successful action appends an audit event. Free text is redacted before persistence.

Chest-pain considerations already matched the bank: the eight-open-item response cap starved them behind rule-out and missing-field prompts. Doctor responses now reserve up to three slots for considerations while retaining the eight-open-item cap; suggestions include catalog workups and guideline links. Draft notes retain each redacted patient report with exact evidence, including new complaints after escalation skips extraction. Field labels are human-readable and missing fields collapse into one unsupported `Not yet asked: …` line. Escalation cards merge evidence by red-flag ID and use a review rationale instead of repeating the banner action.

## FILES CHANGED

16 task paths (some route files were concurrently included in another collaborator's commits):

- `apps/web/lib/pipeline/clinicalWrites.ts` — shared validation, redaction and audited writes.
- `apps/web/lib/pipeline/triage.ts` — pure deterministic assessment.
- `apps/web/lib/pipeline/vitals.ts` — vital recording and explicit confirmation.
- `apps/web/lib/pipeline/orders.ts` — investigations, medication drafts/checks and transitions.
- `apps/web/lib/pipeline/consult.ts` — consideration visibility/metadata, evidenced notes and merged escalation cards.
- `apps/web/lib/pipeline/pipeline.ts` — refresh existing triage after patient turns.
- `apps/web/app/api/sessions/[id]/vitals/route.ts`.
- `apps/web/app/api/sessions/[id]/triage/confirm/route.ts`.
- `apps/web/app/api/sessions/[id]/orders/investigations/route.ts`.
- `apps/web/app/api/sessions/[id]/orders/medications/route.ts`.
- `apps/web/app/api/sessions/[id]/orders/medications/[orderId]/submit/route.ts`.
- `apps/web/app/api/sessions/[id]/orders/medications/[orderId]/cancel/route.ts`.
- `apps/web/app/api/sessions/[id]/orders/medications/[orderId]/pharmacy/route.ts`.
- `apps/web/lib/pipeline/__tests__/wave12.test.ts` — 117 Wave 12 tests.
- `apps/web/lib/pipeline/__tests__/wave12-smoke.mjs` — reproducible synthetic curl smoke.
- `docs/reports/w12-ai-engineer.md` — this report.

## TESTS RUN + RESULTS

From `apps/web`:

- `./node_modules/.bin/vitest run --pool=threads --maxWorkers=1 --minWorkers=1` — **17/17 files, 1,342/1,342 tests passed**, 55.59 seconds.
- Wave 12 targeted run — **117/117 passed**, including all 29 NEWS2 bands, all 31 dose-range drugs, all seven routes, validation/404/409 behavior, audit preservation, returned-order edits/resubmission, stale-check verification, and consult regressions.
- Earlier Wave 11 + Wave 12 targeted run — 189/189 passed before adding the 31 dose matrix cases.
- `./node_modules/.bin/tsc --noEmit` — pass after final changes.
- `./node_modules/.bin/eslint .` — pass after final changes.

From repository root:

- `node docs/clinical/check-redflags.mjs` — **175 passed, 0 failed**, 18 rules.
- `node docs/clinical/check-medrules.mjs` — **204 passed, 0 failed**, 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions.
- `node docs/clinical/check-consultrules.mjs` — **50 passed, 0 failed**, 12 rules.
- `node docs/clinical/check-vitalrules.mjs` — **13/13 cases plus band coverage passed**.
- `node apps/web/lib/pipeline/__tests__/wave12-smoke.mjs` — **22/22 live curl requests and all assertions passed** on the existing `localhost:3000` server.

Runner caveat: the first complete run hit the command's 60-second limit. A subsequent default fork-pool run ended with `[vitest-worker]: Timeout calling "onTaskUpdate"` (181 assertions passed, no assertion failures reported). The complete single-thread-pool run above is green; no Vitest configuration or dependencies were changed. An initial new test also incorrectly expected isolated chest pain to be emergency rather than urgent; the test was corrected to include sweating and passes.

## EVIDENCE

- All four `check-*` scripts: **100%**.
- Live synthetic session: `98e02bdd-6b0f-4b46-99ba-d12de991d06e`.
- Live medication order: `887e7136-5fc5-4365-b55a-7c5c7c6884e7` (cancelled after smoke).
- Live responses: 16 × 200, 1 × 201, 4 × 400, 1 × 409 = 22. Covered health/session setup, each of the seven new routes, consult turn/GET/note and persisted audit retrieval.
- Live checks included incomplete vitals → suggested 3; less urgent confirmation without note → 400; later SpO2 88 → suggested 2 while prior confirmed 4 remained; invalid investigation → 400; paracetamol 1500 mg every six hours → both high dose alerts; submit without overrides → 409; documented overrides → submission; return without note → 400; return/edit/resubmit/verify/cancel → 200; doctor chest-pain considerations with workups/guideline → present; one missing-field note line; zero consult model calls on escalation.
- No screenshots: backend task verified through HTTP payloads and tests.

## ASSUMPTIONS

- Clinical applicability remains the Doctor's documented adult NEWS2 scale-1 scope. The system offers suggestions for review; clinicians own confirmation and orders.
- Only explicit doses/frequencies are parsed; unparseable text stays unparsed and never generates an inferred dose. Unknown medicines receive the existing unknown-medication alert.
- Non-cancelled doctor orders participate in prescribing checks, including drafts and returned orders. Target-order checks exclude unrelated alerts concerning only other medicines.
- Presenting history retains all redacted patient utterances as evidence-backed patient reports, in their original language. It does not invent translations or select a diagnosis; this deliberately includes short history answers alongside complaint reports.
- Investigation placement is an explicit doctor action and creates a submitted order; no suggestion automatically places an order.

## RISKS

- Default Vitest fork-pool RPC timeout can recur under load; use the validated single-thread-pool command above for a complete run.
- Dose checks cover the curated 31-drug adult range subset and parseable entries, not renal/hepatic adjustment, weight-based dosing or a complete formulary.
- Storage/locking retains the existing single-process prototype semantics; no new infrastructure was introduced.
- The synthetic smoke session remains in the running demo store, with its medication cancelled and audit intact; no store reset was performed.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- Shared `AuditType` has `order_drafted`, `order_submitted`, and `order_pharmacy_action`, but no cancellation type. Cancellation is therefore audited as `order_drafted` with explicit `{ action: "cancel", orderId, reason? }`. Request orchestrator consideration of `order_cancelled` for a future contract revision. No shared contracts were edited.
- No blocking questions.

## NEXT ACTION

Orchestrator can exercise the existing vitals/orders/pharmacy UI against the live backend and review the working changes. Reproduce backend smoke with the script above; use the documented single-thread Vitest command for the full suite. No commit was created by this task.

---

# Wave 13 — AI engineer — partial NEWS2 safety fix

## STATUS

done

## SUMMARY

Omitted `onOxygen` now defaults to `false` (room air) for scoring only. A localized reason discloses this assumption; the original recorded vitals remain unchanged. All available NEWS2 bands contribute to `warningScore`, including incomplete sets. Incomplete assessments include localized “partial score from N of 7 parameters” text in English, Thai and Italian; no `scoreComplete` field was added. N includes the defaulted room-air parameter.

Level selection evaluates every matching red-flag, score, single-band and incomplete-vitals rule and takes the lowest (most urgent) level. An incomplete set additionally has a level-3 floor, which cannot suppress a more urgent suggestion. Clinician confirmation and append-only audit behavior remain intact.

## FILES CHANGED

- `apps/web/lib/pipeline/triage.ts` — partial scoring, explicit room-air assumption, localized completeness reasons and most-urgent rule selection.
- `apps/web/lib/pipeline/__tests__/wave12.test.ts` — update two obsolete undefined-score expectations and the precedence test title.
- `apps/web/lib/pipeline/__tests__/wave13.test.ts` — 26 regressions covering the reported POST, normal/incomplete sets, each missing required parameter, all three-point bands, reordered rules, red flags, audit and confirmation preservation.
- `apps/web/lib/pipeline/__tests__/wave13-smoke.mjs` — reproducible synthetic live curl verification against the existing server.
- `docs/reports/w12-ai-engineer.md` — append this Wave 13 report.

## TESTS RUN + RESULTS

From `apps/web`:

- `./node_modules/.bin/vitest run --pool=threads --maxWorkers=1 --minWorkers=1` — **18/18 files, 1,368/1,368 tests passed**, 55.01 seconds.
- Targeted Wave 12 + Wave 13 Vitest run — **143/143 tests passed**.
- `./node_modules/.bin/tsc --noEmit` — **passed**.
- `./node_modules/.bin/eslint .` — **passed**.

From repository root:

- `node apps/web/lib/pipeline/__tests__/wave13-smoke.mjs` — **8/8 live curl requests and all assertions passed**, existing `localhost:3000` server, synthetic session `cd87d034-6463-4b6e-b569-0528f3a902a3`.
- `git diff --check` — **passed**.

Runner notes: the initial full-suite batch exceeded its 55-second budget, skipping the subsequent TypeScript/ESLint commands; those were then run separately and passed. A direct shell Vitest attempt exited 139 before test output; the final context-mode run above completed successfully. The first curl smoke reached all five passing assessment assertions but used the wrong GET-session response nesting in its final storage assertion; corrected to `saved.session.vitals` and rerun successfully.

## EVIDENCE

Live curl results:

| Synthetic case | Suggested level | warningScore | Vital alerts |
|---|---:|---:|---:|
| Exact reported values, onOxygen omitted | 2 | 10 | 5 |
| Incomplete set with score seven and no three-point band | 2 | 7 | 3 |
| Incomplete normal, heartRate 70 only | 3 | 0 | 0 |
| Complete normal | 4 | 0 | 0 |
| Single three-point band, spo2 88 only | 2 | 3 | 1 |

The reported score is 2 each for respiratory rate, SpO2, systolic pressure, heart rate and temperature, plus 0 for alert consciousness and assumed room air. Partial live cases expose “partial score from 5 of 7 parameters” and “partial score from 2 of 7 parameters” respectively. All five writes have audit entries; none auto-confirms triage. Reproduction script: `apps/web/lib/pipeline/__tests__/wave13-smoke.mjs`.

## ASSUMPTIONS

- Per the Wave 13 request, omitted oxygen support means room air for score calculation. Explicit `true` still contributes its configured oxygen-support points.
- Diastolic pressure and pain score are recorded but are not among the seven NEWS2 parameters. No other omitted score parameter receives a default.
- All clinical thresholds and level mappings remain Doctor-owned `vitalrules.json` values. These are review suggestions requiring clinician confirmation.

## RISKS

- If oxygen support was omitted accidentally, its two points cannot contribute until the clinician records it. The assumption is disclosed in localized reasons.
- A partial zero score does not establish normal physiology; the localized completeness reason and level-3 floor remain active.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

No blocking questions or shape changes. Orchestrator follow-up: the `VitalRuleFile.levels` comment in shared `types.ts` still says “first match wins”; update that documentation to describe most-urgent matching level selection. Shared files were left untouched under ownership rules.

## NEXT ACTION

Orchestrator can repeat the synthetic curl script and review the changes. No commit, dependency install or server restart was performed. Pre-existing `.impeccable/` was left untouched.

---

# Wave 14 — AI engineer — prescribing evidence and dose alert consolidation

## STATUS

done

## SUMMARY

- Allergy-conflict alerts now carry the matched allergies' verified patient evidence alongside the conflicting patient medication's evidence. Repeated matches merge all allergy IDs and quotes without duplicating identical evidence spans.
- An allergy supplied only through a clinician edit adds no invented evidence and appends localized provenance, including “from clinician-edited allergy” in English. Provenance remains visible after a subsequent verification when the edit history is retained.
- Prescribing checks emit one high `dose_range` alert per order, under stable `MR-DOSE-RANGE` identity. The localized message lists every exceeded single/daily limit with actual and maximum values. One documented override covers that alert; submission without an override still fails.

## FILES CHANGED

- `apps/web/lib/pipeline/medrules.ts` — combine allergy/medication evidence and clinician-edit provenance, including merged matches.
- `apps/web/lib/pipeline/orders.ts` — consolidate dose checks and describe exceeded limits in all three languages.
- `apps/web/lib/pipeline/__tests__/wave14.test.ts` — 14 regressions for evidence propagation, exact patient spans, merged quotes, clinician-only edits, single/daily/both limits, stable identity, conservative parsing and audited override submission.
- `apps/web/lib/pipeline/__tests__/wave14-smoke.mjs` — reproducible live curl checks against the existing server.
- `apps/web/lib/pipeline/__tests__/wave12.test.ts` — update dose assertions, retaining the 31-drug boundary matrix.
- `apps/web/lib/pipeline/__tests__/wave12-smoke.mjs` — expect one consolidated dose alert.
- `docs/reports/w12-ai-engineer.md` — append this report.

## TESTS RUN + RESULTS

From `apps/web`:

- `./node_modules/.bin/vitest run --pool=threads --maxWorkers=1 --minWorkers=1` — **19/19 files, 1,382/1,382 tests passed**, 57.27 seconds; includes all 14 new Wave 14 regressions and 117 Wave 12 tests.
- `./node_modules/.bin/tsc --noEmit` — **passed**.
- `./node_modules/.bin/eslint .` — **passed**.

From repository root:

- `node apps/web/lib/pipeline/__tests__/wave14-smoke.mjs` — **13/13 live curl requests and all assertions passed** against the existing `localhost:3000` server.
- `git diff --check` — **passed** after the report append.

Runner notes: an initial targeted run passed 129/131 tests; two new fixtures incorrectly paired amoxicillin text with a paracetamol generic, then were corrected. The first full-suite attempt exceeded its 55-second process budget. The final full-suite run above used a 120-second budget and exited successfully. No package installation or server restart was needed.

## EVIDENCE

- Synthetic allergy session: `cf7be5d8-4fd7-4da9-a9bd-7eb3a0c7931d`. Its amoxicillin order check returned the verified patient quote `penicillin`, UTF-16 offsets **37–47**, turn `9f90ae1c-6ab3-40d6-8952-a0c1d8956609`. The matching existing-medication allergy alert retained **2 evidence spans** (medication and allergy).
- Synthetic dose session: `99c2c0ef-30c7-4ab0-8e78-294f293200ac`. One high alert, `MR-DOSE-RANGE-072b7c6440a94902358b79d6`, said: “Dose is outside the usual adult range — check. (single dose 1500 mg > 1000 mg; daily dose 6000 mg > 4000 mg)”.
- Live daily-only and single-only edits retained the same alert ID. Submission without an override returned **409**; exactly one documented override returned **200**, persisted one override and appended `order_submitted` audit evidence.
- The live check used newly created synthetic sessions reproducing the reported allergy scenario; it did not modify seeded B-014. Clinician-only allergy provenance is covered by unit regressions.

## ASSUMPTIONS

- Summary medication/allergy evidence has already passed the pipeline's patient-quote verification. Alert construction preserves those exact evidence objects and never manufactures quotes from order text or clinician edits.
- `ruleId` is an existing string contract; `MR-DOSE-RANGE` groups the Doctor-owned single/daily checks without changing clinical thresholds or shared files.

## RISKS

- Previously stored dose alerts have the old per-limit IDs until checks refresh. Submission and pharmacy verification recompute checks; callers must use the refreshed consolidated alert ID for a documented override. Old override IDs are not silently accepted.
- Live smoke verification created two synthetic sessions and a synthetic submitted order with a documented override. It did not reset the running store.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

None. No shared contract or threshold changes required.

## NEXT ACTION

UI builder can refresh/recheck B-014 and repeat `wave14-smoke.mjs`. No commit, install or server restart was performed. Concurrent changes outside pipeline ownership were left untouched.
