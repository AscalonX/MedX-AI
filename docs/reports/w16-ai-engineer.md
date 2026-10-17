# W16 — AI engineer QA fixes

## STATUS

done — P1-1 through P1-3 and P2-1 through P2-6 implemented within the authorized paths. Cancellation audit type remains the explicitly requested compatibility fallback pending a shared-contract change. No commit, installation, server restart, or `qa/` edit was performed.

## SUMMARY

| Finding | Result | Regression coverage |
|---|---|---|
| P1-1 | Honorifics with 1–3 capitalized Latin or 1–2 Thai name tokens, capitalized introductions, Thai introductions, greeting/name QA examples, and hospital/medical record numbers are redacted. HN/MRN use `[ID_n]`. Clinical prose and redaction source offsets are preserved. | W16 honorific matrix, QA strings, record identifiers, symptom negatives, ambient persistence and deterministic escalation. |
| P1-2 | Nurse signing returns HTTP 403 with an `ApiError`; doctor mode is required. | HTTP response, unchanged draft and audit. |
| P1-3 | Signing returns 409 for unresolved unsupported lines. Every nonempty doctor edit, including `Not assessed`, can resolve a line. Only `missing:fields` in `open_questions` is informational and exempt. | Rejection without mutation, explicit resolutions, informational-summary signing. |
| P2-1 | Question matching removes stop-words, requires at least one content token, and retains the 0.5 overlap threshold over unique content tokens. `old`/`age` share an age token. | Small-talk negatives, age/allergy positives, exact half-token boundary. |
| P2-2 | Asked suggestions become answered only from subsequent verified patient field evidence or a matched rule-question answer. Transitions are audited once and persist across reload. | Age answer, clinician/prior/unsupported evidence negatives, dismissed status, rule answer, trigger-only negative, reload and audit. |
| P2-3 | Retry IDs live in a server-only persisted map, outside session turns. Existing disk/HMR turn IDs migrate into that map. | Both speaker roles, concurrent and cross-route retries, reload, legacy migration with/without an existing private map, session/list privacy. |
| P2-4 | Investigation provenance must match an existing suggestion in that session; otherwise HTTP 400 without mutation. | Unknown/other-session rejection, valid provenance, manual order. |
| P2-5 | Verified orders cannot be cancelled: HTTP 409 with unchanged order/audit. Earlier statuses remain cancellable with the existing audit type and explicit `action: "cancel"`. | Verified rejection; draft/submitted/returned cancellation and audit payload. |
| P2-6 | Clinical markdown now uses `MR-DOSE-RANGE` and `MR-DOSE-UNCHECKED`, with one combined exceeded-range alert per order and accurate unchecked wording. | Three markdown stale-ID checks and all 10 current dose table rows against the prescribing engine. |

Signing validates all edits and unsupported-line resolutions on a cloned draft before saving. The exemption applies only to the missing-fields summary, not every line in the `open_questions` section. Unsupported claims cannot become signed facts through this exemption. Considerations still require explicit doctor edits to remain in a signed note.

Question-answer matching remains deterministic: field evidence must reference a patient turn after the question was asked; rule answers must contain a question content token distinct from the rule's symptom trigger and have verified patient text. Repeating `Headache` alone does not answer `sudden or gradual?`. Answered questions are omitted from the draft's open-question lines. Red-flag suggestions are never automatically cleared or answered by this matcher.

Final verification also exposed a reproducible pre-existing identity bug: redacting an opaque alert hash containing a phone-like digit run changed a valid override ID and returned 400. Order, alert and suggestion references now retain exact identity, undergo bounded-string validation, and must match server-owned records before persistence. A deterministic regression uses `MR-DOSE-RANGE-be2edff3542677053a8b21e8`: submission failed before the fix and passes after it. User prose/reasons still go through redaction; unknown references are rejected.

## FILES CHANGED

- `apps/web/lib/pipeline/redact.ts`
- `apps/web/lib/pipeline/consult.ts`
- `apps/web/lib/pipeline/pipeline.ts`
- `apps/web/lib/pipeline/store.ts`
- `apps/web/lib/pipeline/orders.ts`
- `apps/web/lib/pipeline/__tests__/wave16.test.ts` — 87 regressions, including current clinical markdown cases.
- `apps/web/lib/pipeline/__tests__/wave10.test.ts` and `wave11.test.ts` — persistent retry assertions now check the private map and absence from turns.
- `apps/web/lib/pipeline/__tests__/wave12.test.ts` — positive provenance uses an actual session suggestion; verified-cancellation expectation is 409.
- `docs/clinical/CONSULT-SPEC.md`, `MEDRULES-TESTS.md`, `PHARMACY-SPEC.md` — stale dose-ID references and directly related explanations only.
- `docs/reports/w16-ai-engineer.md`

## TESTS RUN + RESULTS

Final application checks ran from `apps/web`, using existing local binaries without installs:

| Command | Result |
|---|---|
| `./node_modules/.bin/vitest run` | **1,807/1,807 passed; 21/21 files; 72.58 seconds; exit 0.** |
| `./node_modules/.bin/tsc --noEmit` | Clean; exit 0. |
| `./node_modules/.bin/eslint` | Clean; exit 0. |
| `node docs/clinical/check-redflags.mjs` (repo root) | **175 passed, 0 failed; 18 rules.** |
| `node docs/clinical/check-medrules.mjs` | **194 passed, 0 failed; 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions.** |
| `node docs/clinical/check-vitalrules.mjs` | **13 cases + band coverage: all passed.** |
| `node docs/clinical/check-consultrules.mjs` | **50 passed, 0 failed; 12 rules.** |
| `git diff --check` | Clean. |

All four `check-*` scripts report 100% pass. **Coverage caveat:** Doctor-owned `check-medrules.mjs` still parses/emits the old dose IDs and silently skips the 10 corrected dose rows. Its 194 passes must not be represented as dose coverage. W16 Vitest independently parses and checks all 10 updated rows against the actual prescribing engine, and asserts that exactly 10 were found. The checker was not edited because authorization covers only `docs/clinical/*.md`.

### Live QA rerun

Final rerun against the existing `http://localhost:3000` server, after the opaque-reference fix; no server restart:

| Command (repo root) | Pasted summary | Exit | Remaining assertion |
|---|---|---|---|
| `BASE=http://localhost:3000 node qa/20-consult.mjs` | `SUMMARY 104/105 passed, 1 failed` | 1 | N07 — stale informational-summary expectation. |
| `BASE=http://localhost:3000 node qa/21-vitals-triage.mjs` | `SUMMARY 160/161 passed, 1 failed` | 1 | V26 — existing clinical policy question; outside W16. |
| `BASE=http://localhost:3000 node qa/22-orders.mjs` | `SUMMARY 105/106 passed, 1 failed` | 1 | O03 — stale invented-provenance positive fixture. |
| `BASE=http://localhost:3000 node qa/23-cross-cutting.mjs` | `SUMMARY 78/78 passed, 0 failed` | 0 | None. |

Total: **447/450 passed**. These are the actual unchanged QA results, not a claim of an all-green live QA suite. All requested W16 fixes have direct passing regression coverage.

### Stale QA assertions / owner follow-up

- **`qa/20-consult.mjs`, N07:** the script printed `unsupported lines in draft: [ 'missing:fields' ]`. It expects 409 for this informational summary alone. W16 explicitly exempts that line, so 200 is correct. Update the assertion to exclude `missing:fields`; add a real unsupported-claim fixture for its negative case. W16 regression covers both cases.
- **`qa/22-orders.mjs`, O03:** expects 200 and storage of `consider:CR-X:y`, although that suggestion does not exist in the session. W16 requires 400 for this input. Use an actual suggestion obtained for the same session for the positive case. O03b's nonexistent-ID rejection now passes.
- **`qa/21-vitals-triage.mjs`, V26:** expects 400/409 when a clinician confirms level 4 with a note and no vitals. The existing implementation permits a clinician confirmation with a note; W14 classified this as a design question. It is unchanged and requires Doctor/product policy resolution, not an assertion change assumed by the AI engineer.
- `qa/23-cross-cutting.mjs` still passes all assertions. Its setup supplies a dirty arbitrary `fromSuggestionId`, which is now correctly rejected; future positive provenance coverage should supply an existing suggestion rather than rely on accepting that setup input.

No QA scripts were changed. The stale unit-test expectations under the owned `lib/pipeline/__tests__/` folder were updated separately.

## EVIDENCE

- New W16 regression file: 87 tests; full suite: 1,807 tests.
- Raw deterministic red-flag check remains before redaction in `pipeline.ts`: `rawHits = checkRedFlags(...)` precedes `redacted = redact(raw)`. Regression verifies escalation without a model call, retained Thai symptom text, and valid evidence offsets.
- Ambient synthetic patient and clinician names/HN are absent from the persisted session/summary/consult/audit data exercised by the regression.
- Opaque-reference regression reproduces the previous 400 deterministically and verifies successful submission/provenance after the fix.
- `qa/` files changed: **0**. Shared contracts and Doctor-owned JavaScript checkers changed: **0**.
- No screenshots: this task changes pipeline behavior and documentation, verified through unit and HTTP tests.

## ASSUMPTIONS

- The informational open-question summary means exactly note line `missing:fields` in section `open_questions`.
- A doctor's nonempty edited text is an explicit resolution; the pipeline does not judge whether `Not assessed` is a clinical conclusion.
- The 0.5 asked-match threshold applies after stop-word removal. For the current three-content-token allergy question, `Any allergies?` alone remains below threshold; asking about allergies to medicines/foods meets it.
- A matched rule answer tracks question completion only. It does not diagnose, decide urgency, or dismiss a deterministic red flag. Ambiguous bare yes/no answers without a matched answer term remain asked.
- All test and live QA inputs are synthetic.

## RISKS

- Cancellation continues to use legacy `order_drafted` with `payload.action: "cancel"` until the orchestrator extends the shared audit union. Consumers must inspect the action rather than interpret it as a fresh draft.
- The clinical medication checker has the dose-row coverage gap described above. Runtime dose cases are covered by Vitest, but the Doctor's standalone checker still needs updating.
- Redaction is deterministic and pattern-based; these tests cover the requested introduction/honorific/record-number patterns and QA examples, not arbitrary unidentified names in free prose. No historical transcript rewrite was performed.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

1. **Add `"order_cancelled"` to the shared `AuditType` contract.** Intended event: actor `clinician`, doctor `actorId`, payload `{ orderId, action: "cancel", reason? }`. After that contract lands, switch successful pre-verification cancellation from `order_drafted` to `order_cancelled`; verified cancellation stays forbidden. No shared files were changed in W16.
2. Doctor: update `docs/clinical/check-medrules.mjs` to parse/assert `MR-DOSE-RANGE` and `MR-DOSE-UNCHECKED` and count the 10 dose rows. It currently reports success while skipping them.
3. QA: update N07 and O03 as listed with the live rerun above; keep V26's no-vitals confirmation policy question with the clinical owner.

## NEXT ACTION

QA/Doctor/orchestrator can update their owned expectations/checker/audit contract from this report. The W16 implementation and regression changes are left uncommitted for review.
