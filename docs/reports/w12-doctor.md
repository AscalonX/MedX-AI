# w12 · Doctor report: vitals/triage, investigations, consider links, dose ranges

## STATUS
done (nothing committed)

## SUMMARY
- `packages/shared/src/vitalrules.json` v1.0 (`VitalRuleFile`):
  - NEWS2 (RCP 2017, SpO2 scale 1) as 29 bands, covering RR, SpO2, air/oxygen, SBP, HR, ACVPU including new confusion, and temperature;
  - high alerts on 3-point bands, moderate alerts on 2-point bands, all th/it/en;
  - 7 level rules: emergency RF → 1; urgent RF / NEWS2 ≥7 / 5–6 / single 3 → 2; 1–4 → 3; else 4. No level 5.
  - The source string says: suggestion for nurse confirmation, adults only, not for pregnancy or scale 2.
- `packages/shared/src/investigations.json` v1.0 (`InvestigationCatalog`): 34 items (lab / imaging / ecg / other), th/it/en labels.
- `packages/shared/src/consultrules.json` → v1.1. Every one of the 39 considerations has `workup` (catalog ids), except the airway consideration (airway first, no workup). 31 have a `guideline` {title, url}; 8 are omitted because no verifiable public page was found: dissection, airway-exacerbation, GCA, appendicitis, obstruction ×2, STI, agranulocytosis. No treatment text.
- `packages/shared/src/medrules.json` → v1.1:
  - `doseRange` {maxSingleMg, maxDailyMg} on 31 common oral drugs;
  - `messages.dose_range` (th/it/en, "Dose is outside the usual adult range — check." + check-only action);
  - a top-level `doseRangeSource` note.
- Docs: CONSULT-SPEC §9–11 (triage semantics, catalog shape, orders and prescribing checks); PHARMACY-SPEC §8.

## FILES CHANGED
- New: `packages/shared/src/vitalrules.json`, `packages/shared/src/investigations.json`, `docs/clinical/check-vitalrules.mjs`
- Updated: `packages/shared/src/consultrules.json`, `packages/shared/src/medrules.json`, `docs/clinical/check-medrules.mjs`, `docs/clinical/check-consultrules.mjs`, `docs/clinical/MEDRULES-TESTS.md`, `docs/clinical/CONSULT-SPEC.md`, `docs/clinical/PHARMACY-SPEC.md`
- This report

## TESTS / EVIDENCE
- `check-redflags` **175/175** · `check-medrules` **204/204** (+10 dose rows) · `check-consultrules` **50/50**. That checker now also enforces valid workup ids, https guideline URLs, and no dose/give/start/prescribe wording.
- `check-vitalrules`: **13 NEWS2 cases** (normal = 0 → 4; score 6 → 2; new confusion alone → 2; score 19 → 2; RF overrides; incomplete vitals → 3, never 4) plus a gap-free band-coverage sweep for every numeric parameter → all pass.
- `tsc --strict`: all 6 JSON files cast to their types (`VitalRuleFile`, `InvestigationCatalog`, `ConsultRuleFile`, `MedRuleFile` incl. the `dose_range` message, `RedFlagRuleFile`) → OK.
- Guideline URLs: every NICE `guidance/<code>` URL returned HTTP 200 and its page title was read to confirm the guideline name. The WHO dengue fact sheet and the RCP NEWS2 page returned 200. NICE CKS pages and the OUP DOI returned 403 (bot-blocked), so they are not used. The SJS/TEN link is the PubMed record (PMID verified via the PubMed tool earlier).

## SHAPE NOTES FOR THE ORCHESTRATOR (types)
- `MedRuleFile.drugs[].doseRange` is used exactly as typed. The extra top-level `doseRangeSource: string` is **not in the type** (CR-13: add `doseRangeSource?: string`, or ignore it).
- `InvestigationCatalog` already matches. No change needed.
- `VitalRuleFile.bands[].vital` is a string with numeric min/max. Booleans and categories use encodings (onOxygen 1/0; consciousness ordinal 0–4), documented in CONSULT-SPEC §9.
  - CR-12: add `equals?: string | boolean` to bands for categorical vitals.
  - CR-12: add `incomplete?: { level; reason }`, so that "incomplete vitals → level 3" moves from engine constant to data.

## ASSUMPTIONS
- Dose ceilings are usual adult maxima from BNF dose sections, recalled and not re-fetched this wave. Metformin 2550 mg/day and naproxen 1250 mg/day are from the FDA labels. Several are conservative (e.g. fluoxetine 60, omeprazole 80/day).
- Combination products (amoxicillin-clavulanate, co-trimoxazole, Decolgen, Tachidol), prednisolone, warfarin and levothyroxine deliberately have no `doseRange`: their mg values are ambiguous or individually titrated.

## RISKS
- **A triage suggestion can be read as a decision.** The UI must show "Suggested level — nurse confirms", and nothing downstream may use `suggestedLevel` in place of `confirmed`.
- NEWS2 is not validated for pregnancy, under-16s, or chronic hypoxia (scale 2); the engine has no way to know scale 2.
- Dose ranges catch over-ceiling orders only: no under-dosing, no renal/hepatic/weight checks, no IV routes. "No dose alert" ≠ correct dose.
- Workup lists are prompts, not order sets. The doctor must choose, and the UI must not offer "order all".

## NEXT ACTION
- AI engineer:
  - triage engine per CONSULT-SPEC §9, porting `check-vitalrules.mjs` cases;
  - dose checks per §11 / MEDRULES-TESTS "Dose range";
  - render `workup` + `guideline` on doctor-mode consider items only.
- Orchestrator: CR-12 and CR-13.

---

## Addendum: consultrules v1.2 (UX audit w16 P1-5: considerations over-fire)

**STATUS:** done (nothing committed).

**Problem:** for a 34-year-old with a one-day sore throat, the words "fever", "cough" and "rash" fired 12 considerations (lung cancer, TB, SJS/TEN …), and Orders then listed lumbar puncture.

**Fix (contract unchanged; the engine already emits every consideration of a fired rule):**
- The 12 **base rules** keep their questions. Their first match group is the presenting complaint. Only CR-CHEST-01 keeps a consideration (ACS on chest pain).
- Every other consideration (38) moved to its own **feature rule** (`questions: []`). Its first group is the same presenting complaint, plus AND-groups for the specific features:
  - TB: ≥2–3 weeks, weight loss, night sweats, haemoptysis or TB contact;
  - lung cancer: chronic **and** smoking, weight loss or haemoptysis;
  - SJS/TEN: blisters, mucosal involvement or a new drug;
  - meningitis: neck stiffness, photophobia, non-blanching rash or confusion;
  - meningococcal (rash rule): fever **and** non-blanching rash;
  - SAH: sudden or worst;
  - PE: haemoptysis, leg swelling, travel or surgery, pleuritic pain;
  - ectopic: pregnancy, late period or bleeding;
  - AAA: pain to the back, pulsing or known aneurysm;
  - sepsis: confusion, fast breathing, low urine or mottled skin;
  - epiglottitis: stridor, drooling or muffled voice;
  - quinsy: one-sided pain, trismus or drooling (doctor-only, with workup).
- Workup lists and guideline links moved with their considerations.
- File: 50 rules (12 base + 38 feature), 39 considerations, version `1.2`. CONSULT-SPEC §12 documents it.

**Checker hardening (found while doing this):**
- MEDRULES-TESTS dose rows had been renamed to the engine's `MR-DOSE-RANGE` / `MR-DOSE-UNCHECKED`. My checker regex only knew `MR-DOSE-0[12]`, so it **silently skipped** them (204 → 194). The checker now uses the engine's ids and semantics (`MR-DOSE-RANGE` high = single or daily over the ceiling; `MR-DOSE-UNCHECKED` moderate = unknown drug, no range, or unparsed).
- All three table checkers (red flags, meds, consult) now **fail on any test-looking row they cannot parse**.
- The consult checker also fails if any rule other than CR-CHEST-01 carries considerations with fewer than 2 match groups.

**Tests:**
- `check-consultrules` **80/80**:
  - 3 `NO-CONSIDER` rows (en/it/th): the audit case fires no consideration;
  - feature positives (TB, lung cancer, SJS, meningitis ×2, SAH, PE, ectopic, AAA, sepsis, epiglottitis, quinsy);
  - negatives such as "cough since yesterday" ≠ TB and "rash from penicillin" ≠ SJS.
- `check-redflags` 175/175 · `check-medrules` 204/204 · `check-vitalrules` all pass · `tsc --strict` on all rule files OK.
- Engine suite `apps/web/lib/pipeline/__tests__/wave11.test.ts` (it reads the CONSULT-SPEC table): 130/130 on three runs. One earlier run showed 1 failure in a sign/edit test that uses the synthetic fixture, not my rules. It did not reproduce, so it is flaky; an engineer should look.

**Risks:**
- Feature-gated considerations will now **miss** atypical presentations that lack the listed words (e.g. a PE described only as "breathless"). That is the trade-off for less noise. The `rule_out` questions still prompt the clinician to ask for those features.
- This is a tightening made after seeing an audit case, not independent evidence of specificity.
