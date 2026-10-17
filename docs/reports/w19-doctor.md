# w19 · Doctor report: medrules alternatives table, CRLF-safe checker, two-stage pharmacy spec

## STATUS
done (nothing committed; the orchestrator handles git)

## SUMMARY
- `packages/shared/src/medrules.json` → **v1.2**. Its one new top-level key is `alternatives` (5 entries, shape = `MedRuleFile.alternatives` in the w19 contract).
- No existing drug, allergen, conflict, interaction, message or rule id changed. A structural JSON diff against HEAD shows only the `version` change and the added key.
  - **ALT-NSAID-ALLERGY** (allergy_conflict; nsaid, cox2_inhibitor) → paracetamol.
  - **ALT-NSAID-INTERACTION** (interaction; nsaid, cox2_inhibitor) → paracetamol. Covers anticoagulant, aspirin/antiplatelet, SSRI, methotrexate and ACEi/ARB.
  - **ALT-NSAID-PREGNANCY** (pregnancy_caution; nsaid, cox2_inhibitor) → paracetamol.
  - **ALT-BETALACTAM-ALLERGY** (allergy_conflict; penicillin, cephalosporin) → clarithromycin, doxycycline. These are non-beta-lactams; no cephalosporin is ever suggested for a penicillin allergy.
  - **ALT-OPIOID-INTERACTION** (interaction; opioid) → paracetamol. Covers SSRI + tramadol.
  - Every note is in th/it/en and framed as "Option for the prescriber to review against the indication … and local guidance, not a prescription", plus the main caveat:
    - INR on warfarin;
    - a minority cross-react to paracetamol in NSAID hypersensitivity;
    - erythromycin is preferred in pregnancy (not in the dictionary);
    - doxycycline is avoided in pregnancy and under 12;
    - paracetamol may be insufficient for moderate–severe pain.
  - Sources: BNF, NICE NG84 / NG138 / CG183, the FDA Drug Safety Communication of 15 Oct 2020, Kowalski 2013 (EAACI), and Boyer & Shannon (NEJM 2005).
- `docs/clinical/check-medrules.mjs`:
  - **CRLF fix.** Before this wave the checker printed `0 passed, 204 failed` on this Windows checkout (autocrlf), because `\|$` never matched `\r`. It now splits on `\r?\n`, strips a BOM and trims line ends.
  - New reference `prescribingAlternatives()`. Same semantics as the engine's `alternativesFor`; the blockers include max_dose_risk.
  - New strict `validateAlternatives()`. It rejects:
    - unknown generic, unknown kind, or a kind that cannot carry alternatives;
    - empty/duplicate/over-5 `consider`;
    - missing or uncited source;
    - unknown drugClass;
    - a consider generic in its own drugClasses;
    - a consider generic that conflicts with a triggering allergy class (e.g. cefalexin for penicillin);
    - a pregnancy-flagged option on a pregnancy entry;
    - combination or "(unspecified)" options;
    - instruction wording, or missing claim-boundary framing in any language;
    - unknown properties, and duplicate ids or duplicate kind/class mappings.
  - Self-test: 1 valid fixture plus 17 broken fixtures, each of which must be caught.
  - New `| ALT |` row type.
- `docs/clinical/MEDRULES-TESTS.md` → v1.2. Adds the row-type list and an "Alternatives" section with **30 ALT rows** (en/it/th), including the filtering cases:
  - paracetamol allergy;
  - already on Tylenol (MR-MAXDOSE-01);
  - simvastatin or atorvastatin (MR-INT-09/10);
  - pregnancy (MR-PREG-01);
  - macrolide allergy;
  - cephalosporin allergy;
  - no-entry cases (aspirin, macrolide, sulfa, duplicate, paracetamol).
- `docs/clinical/PHARMACY-SPEC.md` → v1.2:
  - **§9** two-stage process:
    - pharmacist 1 verifies, or returns with a note and a report (`alertIds`, `suggestedGenerics`);
    - the prescriber re-reviews;
    - pharmacist 2 dispenses with the 6-item checklist (what each item means) and the two-person rule;
    - the patient is called, re-call is allowed, collected, and pickup is reset on a late order;
    - patient-view allowlist, suggested th/it/en pickup strings, UI rules (boxes start unticked, no select-all) and limits.
  - **§10** alternatives: shape, exact semantics, entries, what is deliberately not covered and why, limits, display wording ("Options for prescriber review — not a prescription" in en/th/it, no apply/switch button, neutral ink), and the validator rules.
  - §4 and §6 are reworded so they stay true with alternatives present.
  - New CR-14…CR-18.

## FILES CHANGED
- `packages/shared/src/medrules.json` (version 1.1 → 1.2, + `alternatives`)
- `docs/clinical/check-medrules.mjs`
- `docs/clinical/MEDRULES-TESTS.md`
- `docs/clinical/PHARMACY-SPEC.md`
- `docs/reports/w19-doctor.md` (this report)

## TESTS RUN + RESULTS
- `node docs/clinical/check-medrules.mjs`, final run: `253 passed, 0 failed · medrules 1.2 · 59 drugs, 13 allergen classes, 11 allergy rules, 18 interactions, 5 alternative entries`, exit 0. The 253 are:
  - 204 existing L/AL/A/D rows;
  - 1 real-table validation;
  - 1 valid fixture and 17 broken fixtures;
  - 30 ALT rows.
- Before the fix, on the same checkout: `0 passed, 204 failed` (every row "unparsed").
- Negative control, run on scratch copies outside the repo:
  - an LF-only markdown copy gave 253/0;
  - a copy with a wrong ALT expectation, `cefalexin` added to ALT-BETALACTAM-ALLERGY and an unknown generic gave `251 passed, 5 failed`, exit 1. The failures were: unknown generic; cefalexin in its own drugClasses; cefalexin conflicts with MR-ALLERGY-PEN-CEPH and with MR-ALLERGY-CEPH; the wrong ALT row.
- **Engine parity:** a scratch vitest file outside the repo fed all 30 ALT rows through the engine's real `prescribingChecks` (apps/web/lib/pipeline/orders.ts as it stands in the working tree) with the real table: **30/30 passed**.
  - A 31st case, ibuprofen + warfarin with allergies unrecorded, gives `[["MR-INT-01",null],["MR-ALLERGY-UNKNOWN",null]]`: no alternatives while allergy status is unknown, as PHARMACY-SPEC §10.2.4 says.
- vitest on the existing engine suites, run one file at a time (`--reporter=dot`):
  - wave4 **232/232**;
  - wave16 **87/87** (includes the doc-text checks on PHARMACY-SPEC / MEDRULES-TESTS);
  - wave19 **60/60**.
  - An earlier 8-file combined run hit a vitest worker RPC timeout (`Timeout calling "onTaskUpdate"`, machine under parallel load). It reported 338/338 passed with 1 file completed, so it is not counted.
- `tsc --noEmit -p .` (apps/web): 4 errors, **none mentioning medrules**. They are all from in-progress `dispensed` status work in other agents' files:
  - `app/(orders)/_bits.tsx` ×2;
  - `app/(pharmacy)/_orders.tsx`;
  - `lib/pipeline/__tests__/wave19.test.ts:157`.

## EVIDENCE
- `git diff --stat` for my files: MEDRULES-TESTS.md +51, PHARMACY-SPEC.md +186, check-medrules.mjs +212/-, medrules.json +101.
- Structural JSON diff vs `HEAD`: `added keys: [ 'alternatives' ] removed: []`, `changed: version "1.1" -> "1.2"`. Every `consider` generic exists in `drugs[]`.
- Citation checks this wave (NICE pages return 403 to the fetcher, so web search was used):
  - NG84: clarithromycin if not pregnant, erythromycin in pregnancy, for penicillin allergy.
  - NG138: clarithromycin, doxycycline, erythromycin in pregnancy.
  - FDA DSC 15 Oct 2020: avoid NSAIDs at ≥ 20 weeks.
  - Kowalski 2013: Allergy 68(10):1219-32, doi 10.1111/all.12260.
  - NG141 doxycycline was **not** confirmed, so NG141 is not cited.

## ASSUMPTIONS
- BNF section wording is recalled, not re-fetched this wave, as in w12. "NICE CKS: NSAIDs - prescribing issues" is cited by topic name (CKS is bot-blocked).
- Matching uses the **ordered** drug's class, per the contract. So ALT-NSAID-INTERACTION fires for any NSAID interaction, and its note covers the warfarin INR caveat.
- The checker's blocker set includes `max_dose_risk`, matching the engine's `ALTERNATIVE_BLOCKERS`. The contract text lists only four kinds; the engine and the reference both add max_dose_risk, which is the fail-safe choice.
- The version bump to 1.2 changes the `medrules 1.2: <ruleId>` source suffix on alerts. No test or UI asserts the old string (grep of apps/).

## RISKS
- **Options are filtered only by MedX's own rules.** Clarithromycin and doxycycline both raise INR on warfarin in reality, and MedX has no rule for it (CR-17), so they are not dropped. The UI must never present the list as "checked safe".
- Pregnant + penicillin allergy: clarithromycin is still listed, because the dictionary has no macrolide pregnancy flag. The note names erythromycin instead (CR-14).
- No age input: doxycycline under 12 is not filtered (stated in the note).
- Reviewer ids are self-declared, so the two-person check is procedural, not authenticated (§9.6).
- A verified order has no in-system stop path for pharmacist 2 (CR-15).

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **CR-14**: add `pregnancy: "caution"` to clarithromycin and azithromycin. This adds MR-PREG-02 on those orders in pregnancy, so it needs orchestrator sign-off. I did not do it, because it changes existing outputs.
- **CR-15**: allow an audited `return` (note required) from `verified` for pharmacist 2.
- **CR-16** (optional): `MedAlert.alternativesFrom?: string[]` (matched entry ids), so the UI can show each entry's note and source.
- **CR-17**: future interaction rules clopidogrel + NSAID and warfarin + clarithromycin. Deferred because they create new alerts.
- **CR-18**: add the §9.5 pickup strings and the §10.6 "Options for prescriber review — not a prescription" label to shared i18n.
- Wording: the walkthrough video says "diagnosis suggestion". Pitch and video copy should say "considerations for clinician review" (claim boundary).

## NEXT ACTION
- Pharmacist / clinician web builders:
  - render `alert.alternatives` per PHARMACY-SPEC §10.6, with the entry note and source, neutral ink and no apply button;
  - build the dispense checklist per §9.2 (unticked, no select-all);
  - show the report to the prescriber per §9.3.
- AI engineer: nothing required for the table. The engine already matches all 30 ALT rows.
- Orchestrator:
  - fix the 4 tsc errors (`dispensed` missing in two status maps, and the wave19 `it.each` typing);
  - decide CR-14 and CR-15.
