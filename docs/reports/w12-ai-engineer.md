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
