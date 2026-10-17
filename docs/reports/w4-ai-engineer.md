# Wave 4 — AI engineer: pharmacist backend

## STATUS

**done** — requested backend implementation, automated pharmacy tests, live demo seeding and mock evaluation are complete. Full-workspace TypeScript passes after concurrent UI owners resolved their transient errors. UI files were left alone. No commits, installs or dev servers were started.

## SUMMARY

- Extended the existing extraction call with medication/allergy lists and explicit no-known-allergies evidence. Extraction and the safety screen still run in the existing `Promise.all`; no extra model request was added. This avoids another request/queue overhead and duplicate transcript processing. Actual Gemma latency was not measured. Extraction output budget is now 3000 tokens (previously 1500), allowing the additional lists; existing timeouts, repair and abstention remain.
- Every pharmacy quote goes through the existing boundary-aware verifier. Names and non-null dose/frequency/timing/reaction must also occur verbatim in the verified span; unsupported entries retain pencil status. Model-proposed strings are redacted before persistence. Lists and no-known-allergies are required by transport schema and runtime validation.
- Ported Doctor reference normalization, longest-match lookup, ingredient/class tokens, interaction precedence, insulin exclusion and paracetamol max-dose replacement exactly. Messages/actions come from `medrules.json`; sources and severity follow PHARMACY-SPEC §3. No model can remove an alert. Patient-reported stopped medicines remain checked; pharmacist-discontinued medicines are excluded from new computations.
- Medicine/allergy identities are stable by normalized original product/allergen name. Alert identities derive from rule ID plus sorted medicine IDs. Re-extraction retains historical entries, pharmacist corrections, original `review.previous` values and alert decisions. Historical alerts remain visible after edits/discontinuation; rules recompute after review.
- Added atomic pharmacy review with CORS and append-only `pharmacy_review` audit. Payload contains `medActions`, `alertActions`, and only the optional fields actually received, matching the shared API audit contract; reviewer ID is the audit actor ID. PII-bearing review strings are rejected rather than rewritten, so accepted action payloads are preserved exactly.
- Pharmacy status becomes pending when entries exist, in_review after action (or new information after reconciliation), and reconciled on accepted sign-off. Sign-off returns 409 with an explanatory ApiError when high alerts or unmatched/unsupported medicines remain unreviewed. Rejected batches change neither session nor audit.
- Added MED-01, MED-05 and MED-03 to idempotent demo replay. Escalated turns still make zero model calls; a dictionary-only pass provides pharmacy candidates on that path. Ops metrics code was not changed.

## FILES CHANGED

New:

- `apps/web/lib/pipeline/medrules.ts`
- `apps/web/lib/pipeline/pharmacyExtraction.ts`
- `apps/web/lib/pipeline/pharmacyReview.ts`
- `apps/web/lib/pipeline/__tests__/wave4.test.ts`
- `apps/web/app/api/sessions/[id]/pharmacy-review/route.ts`
- `docs/reports/w4-ai-engineer.md`

Updated:

- `apps/web/lib/pipeline/extract.ts`
- `apps/web/lib/pipeline/schema.ts`
- `apps/web/lib/pipeline/prompts.ts`
- `apps/web/lib/pipeline/mock.ts`
- `apps/web/lib/pipeline/pipeline.ts`
- `apps/web/lib/pipeline/llm.ts`
- `apps/web/lib/pipeline/seed.ts`
- `apps/web/app/api/_http.ts`
- `apps/web/lib/pipeline/__tests__/pipeline.test.ts` (valid injected extraction fixtures now include pharmacy schema keys)
- `apps/web/lib/pipeline/__tests__/llm-api.test.ts` (same fixture update and token budget assertion)
- `apps/web/lib/pipeline/__tests__/wave2.test.ts` (eleven-session seed expectations)

The evaluation command generated ignored evidence under `eval/runs/`; its automatic tracked `eval/REPORT.md` changes were restored to the pre-task contents. No shared contracts, dictionaries, UI or mobile files were edited by this task.

## TESTS RUN + RESULTS

| Check | Result |
|---|---|
| `cd apps/web && npx vitest run` | **605/605 passed**, 9 test files |
| Wave 4 tests | **231/231 passed**: 194 Doctor rows, 12 MED replays, 25 extraction/review/seed checks |
| Doctor table coverage | **194/194, 100%**: 34 drug lookups + 12 allergen lookups + 148 alert assertions |
| `node docs/clinical/check-medrules.mjs` | Exit 0: **194 passed, 0 failed**; 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions |
| `cd apps/web && npx tsc --noEmit` | **Exit 0**, full workspace; transient concurrent UI errors resolved by their owners |
| `MODEL_PROVIDER=mock npx vite-node ../../eval/run.ts -- --split all` | **Exit 0**, 40 regular cases + 18 holdout cases; artifacts `eval/runs/2026-10-17T07-50-36-435Z/` |
| Evaluation fault-injection reasons | 15/18 match the old reason expectation; **18/18 abstain with zero supported fields**. Three old absent-quotes fixtures omit the newly required pharmacy keys and now correctly fail as schema_error rather than low_confidence. The equivalent valid-schema absent-quote vitest fixtures were updated and pass. |
| `git diff --check` | Exit 0 |
| Live `GET /api/health` | HTTP 200, provider mock, model deterministic-mock |
| Live `POST /api/dev/seed` | HTTP 200; created 3 pharmacy sessions, reused 8 existing sessions |

Coverage includes malformed/missing pharmacy schema, quote/name/attribute fabrication, PII rejection, unknown IDs, all review action types, 409 blockers (high alert, unmatched, unsupported), unchanged audit on failed batches, exact optional payload shape, review/previous-value preservation across turns, rule recomputation after edits/discontinuation, reconciliation reopening, and seed idempotence. All 12 MED medication lists had zero unsupported medicine entries after verification fixes.

## MED AGREEMENT TABLE

Comparison is the **set of alert kinds per case**, using synthetic patient turns through the mock provider and production pipeline. Tests assert Doctor-rule behavior separately from gold; discrepancies are not relabeled as successes.

| Case | Gold kinds | Actual kinds | Exact agreement | Explanation |
|---|---|---|---|---|
| MED-01 | allergy_conflict | allergy_conflict | yes | Augmentin / stated penicillin allergy |
| MED-02 | duplicate_therapy | max_dose_risk | no | Reference replaces shared paracetamol duplication with MR-MAXDOSE-01 |
| MED-03 | interaction | interaction | yes | Warfarin + ibuprofen |
| MED-04 | unknown_medication | unknown_medication | yes | Unidentified remedies / unspecified blood-pressure medicine |
| MED-05 | duplicate_therapy, max_dose_risk | max_dose_risk | no | Same reference max-dose replacement rule; no duplicate alert for paracetamol alone |
| MED-06 | pregnancy_caution | pregnancy_caution | yes | Moment / explicit pregnancy |
| MED-07 | none | none | yes | Ramipril remains checked despite patient-stated stopping; shellfish does not block a drug |
| MED-08 | interaction | unknown_medication | no | St John's wort is absent from Doctor dictionary and interaction rules; kept as an unidentified remedy |
| MED-09 | interaction | interaction | yes | Sertraline + tramadol; latex is a nondrug allergy |
| MED-10 | none | unknown_medication | no | Muscoril / thiocolchicoside is absent from Doctor dictionary |
| MED-11 | unknown_medication | unknown_medication | yes | Both unnamed pills retained for identification |
| MED-12 | none | none | yes | Metformin + atorvastatin |

**8/12 exact kind-set agreement (66.7%).** These are deterministic mock results, not evidence of Gemma performance or clinical validity. Gold generic/allergen labels also predate dictionary normalization (e.g. amoxicillin-clavulanate vs amoxicillin+clavulanic acid, shellfish vs food_shellfish, latex vs nondrug_latex, sulfonamide vs sulfa). Shared dictionary was left unchanged.

## EVIDENCE

Live seed data is available through the existing server on port 3000:

| Fixture | Code | Session ID | Pharmacy status | Alert kind |
|---|---|---|---|---|
| MED-01 | B-016 | 9812ad64-f800-4f2d-9cc8-a24a769354b9 | pending | allergy_conflict |
| MED-05 | B-017 | 5483fee7-ba5e-4de1-8ab0-a50f31ef0c58 | pending | max_dose_risk |
| MED-03 | B-018 | 6de8937a-b27f-4ece-be16-059ac1cb8b9c | pending | interaction |

All seeded pharmacy medicines were supported. MED-03's overall intake status remains needs_human because the pre-existing narrow clinical mock cannot reliably extract its complaint; pharmacy alerts are still available. Fresh-store automated seed tests have zero status mismatches. Live seed reported two existing state differences (IT-01 already approved; EN-04 already taken_over); these clinician decisions were preserved. No UI screenshot was taken.

## ASSUMPTIONS

- Doctor reference semantics take precedence over older MED gold labels. The optional single-product parsed dose × frequency max-dose extension was not added.
- Repeated mentions of the same named product are one entry; distinct brand names are separate products. Stable identities are session-scoped by their containing session, even when hash values coincide across sessions.
- Unknown or unsupported medicine verification is an explicit pharmacist decision and satisfies the sign-off gate, as specified. Moderate alerts do not independently block sign-off.
- The no-model-call escalation invariant remains in force. Escalated-turn dictionary extraction is deliberately narrower than model extraction and can miss unknown names.

## RISKS

- Concurrent UI edits briefly caused full-workspace TypeScript errors; the final full-workspace run passes. No UI fixes were made by this task.
- St John's wort and thiocolchicoside are not checked for their specific interactions until Doctor updates the dictionary/rules. Unknown alerts ask for human identification; this is not a complete safety check.
- Mock extraction is intentionally narrow, dictionary/context based and deterministic. It cannot establish clinical meaning, verify translations or infer unspoken dose/frequency. Gemma extraction and latency were not tested against the live AMD provider.
- Schema now rejects legacy extraction responses without pharmacy keys. AI researcher evaluation fault fixtures need the same schema update as the vitest fixtures to restore precise reason-label agreement.
- Historical alerts remain visible after pharmacist edits/discontinuation and may still require an explicit decision before sign-off. This implements the no-delete audit boundary.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- Doctor / medical researcher: reconcile MED-02 and MED-05 gold with the reference max-dose replacement rule; decide whether to add St John's wort/SSRI interaction coverage and thiocolchicoside to `medrules.json`; align old gold generic/allergen labels with dictionary canonical names.
- AI researcher: add `medications: []`, `allergies: []`, `noKnownAllergies: null` to the three legacy absent-quotes fault responses in `eval/run.ts`, and record the pharmacy extraction/prompt addition plus 3000-token budget in `docs/ai/DESIGN.md`.
- No shared TypeScript contract changes are required by the backend implementation.

## NEXT ACTION

Review the live pharmacy sessions B-016/B-017/B-018, reconcile the documented Doctor/gold differences, and update the AI researcher's legacy evaluation fault fixtures. Keep the implementation uncommitted as requested.
