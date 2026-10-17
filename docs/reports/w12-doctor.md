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
