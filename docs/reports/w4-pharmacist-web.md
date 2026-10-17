# W4 Pharmacist web fix pass

STATUS: all 11 items fixed; tsc and eslint clean; verified in the browser on fixtures and on live engine data (B-016, B-018).

| # | Fix |
|---|---|
| 1 | NKA only from `summary.noKnownAllergiesEvidence` (non-empty). Otherwise empty `allergies[]` shows "Not stated, ask the patient" plus the allergy question. Old allergies-field inference removed (`hasNka` in `_lib.ts`). |
| 2 | Abstained or missing summary: "Needs human review" panel, no meds, allergies, alerts, NKA, questions or quotes marks; sign-off disabled with reason. Live B-018 (abstained but carries meds and an alert) renders none of them. |
| 3 | Red flags shown as a read-only band (severity, label, action, reviewed or not) with a link to /review/<id>. Unreviewed flags block sign-off (`blockers()`), pin the queue row and show a "N red flags" badge. Pharmacist cannot review flags here, by design. |
| 4 | `unsupported` med: quote, class, generic, dose, frequency, timing all pencil, plus margin note. |
| 5 | `unsupported` allergy: allergen, class and reaction in pencil. Allergies now have Verify and Edit (contract `allergyActions`), and unverified allergies block sign-off (client side, stricter than server). |
| 6 | Fixture alert actions reworded to review language ("Flag for the treating clinician ... the clinician confirms the medication plan"); no stop, advise or alternative-drug wording. |
| 7 | Queue complaint gated: abstained shows "Needs human review"; unsupported complaint in pencil; missing shows "No complaint yet". Abstained rows never show alert counts. |
| 8 | Shell: generation counter drops stale GETs; live submit awaits the POST, writes the returned session into state, and on error refetches before unlocking. Server errors (incl. 409 "Cannot reconcile: ...") show as "Server refused: <reason>". Checked the 409 text directly; UI shows `error` verbatim. |
| 9 | Edit sends only changed fields; a cleared dose/frequency/reaction is sent as "" and shown as blank with the old value struck (works on fixtures). See contract request below. |
| 10 | Safety and operational copy in th/it/en: sign-off and blockers, abstention, red-flag band, NKA, not stated, pencil, discontinue confirm, alert buttons and review lines, footer. Chrome labels (queue headings, transcript headings) remain English like the clinician screen. |
| 11 | Footer on every sheet: "Checked against MedX rule set v1.0 (59 drugs, 18 interactions). Not a complete interaction check." (localized). "No alerts" state reads "No alerts from this rule set. That does not mean it is safe." with no green or tick. |

Also: `previous` and reviewer now come from `MedicationEntry.review` / `AllergyEntry.review` (contract), no longer local state. `?fixtures=1` forces fixtures even when live data exists (demo/testing). Fixtures F-204 (abstained), F-205 (unreviewed red flag), F-203 (unsupported med and allergy) added.

## Contract request (blocking item 9 on live)
`POST /pharmacy-review` rejects empty strings (`shortString` requires non-empty), so clearing a dose live returns "Invalid medActions action". Accept "" for dose, frequency, reaction (and store it as cleared) or tell me another clear signal.

## Verification
- `npx tsc --noEmit`, `npx eslint 'app/(pharmacy)'`: clean.
- Live: queue shows 5 live sessions (B-016..B-020); B-018 abstained panel; B-016 Acknowledge via UI updated from the POST response, sign-off then enabled; direct POST complete=true on unhandled alert returned 409 "Cannot reconcile: high alert MR-ALLERGY-PEN requires review". B-016 was left acknowledged and in review (synthetic data).
- Fixtures: F-205 red-flag band and block, F-203 pencil entries and combined blocker text.
- Screens: docs/reports/screens/pharmacy-w4-*.png.

## Not verified
Th/it wording of new strings reviewed by me only (not a clinician or native speaker). Live sign-off completing was not exercised on B-016. Red-flag review state change is made on /review, not re-tested here.
