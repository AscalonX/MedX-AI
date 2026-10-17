# w3 · Doctor report: pharmacist view (medication reconciliation)

## STATUS
done (nothing committed)

## SUMMARY
- `docs/clinical/PHARMACY-SPEC.md`: the pharmacist's job at intake, the one-screen layout, the alert severity policy, the decision-support vs pharmacist split, the exact matching/alert semantics the engine must implement (§5), limits, and contract change requests.
- `packages/shared/src/medrules.json` v1.0 (matches `MedRuleFile`): **59 drug entries** with TH/IT/EN brand and lay names. They include combination OTC products that hide paracetamol (Decolgen, Tiffy, Norgesic, Tachidol) and lay "(unspecified)" entries (blood-pressure pill, cholesterol pill, blood thinner). Also **13 allergen classes** (8 drug classes, plus contrast, latex and 3 food classes kept separate and non-blocking), **11 allergy-conflict rules**, **18 interactions** with sources, and messages/actions for all 6 alert kinds in th/it/en.
- `docs/clinical/MEDRULES-TESTS.md` + `docs/clinical/check-medrules.mjs` (reference matcher and alert engine): **194 passed, 0 failed**.

## FILES CHANGED
- `packages/shared/src/medrules.json` (new)
- `docs/clinical/PHARMACY-SPEC.md` (new)
- `docs/clinical/MEDRULES-TESTS.md` (new)
- `docs/clinical/check-medrules.mjs` (new)
- `docs/reports/w3-doctor.md` (this file)

## TESTS RUN + RESULTS
- `node -e "JSON.parse(...medrules.json)"` → OK.
- Schema check: every message/action and interaction message present in th/it/en; rule IDs unique; every `drugClasses` / interaction `a`/`b` token exists in the dictionary → OK.
- `tsc --strict` cast of `medrules.json` to `MedRuleFile` and `redflags.json` to `RedFlagRuleFile` → OK.
- `node docs/clinical/check-medrules.mjs` → **194 passed, 0 failed**:
  - 34 drug-lookup rows;
  - 12 allergen-lookup rows;
  - 148 alert rows (each rule has ≥ 1 positive per language plus ≥ 1 tricky negative).
- Negative control: two deliberately wrong rows appended → the checker reported 2 FAIL; file restored.
- Red-flag check unaffected: 175/175.

## EVIDENCE
Sources verified via PubMed (metadata fetched):
- Battistella 2005 Arch Intern Med, doi:10.1001/archinte.165.2.189 (warfarin + NSAID/COX-2)
- Fischer 2010 Arch Intern Med, doi:10.1001/archinternmed.2010.37 (warfarin + co-trimoxazole)
- Boyer & Shannon 2005 NEJM, doi:10.1056/NEJMra041867 (serotonin syndrome)
- Juurlink 2009 CMAJ, doi:10.1503/cmaj.082001 (clopidogrel + PPI)
- Patel 2013 Ann Intern Med, doi:10.7326/0003-4819-158-12-201306180-00004 (statin + clarithromycin)
- Juurlink 2004 NEJM, doi:10.1056/NEJMoa040135 (ACEi + spironolactone hyperkalaemia)
- ONTARGET 2008 NEJM, doi:10.1056/NEJMoa0801317 (ACEi + ARB)
- Lapi 2013 BMJ, doi:10.1136/bmj.e8525 (ACEi/ARB + NSAID kidney injury)

Two of my recalled PMIDs were wrong and were **caught by the check and not used** (they pointed to unrelated papers). BNF, Stockley's and the FDA labels (Viagra/Cialis, Zocor, Plavix, methotrexate; the 2006 ibuprofen–aspirin notice) are cited **by name only** and were not re-verified online.

## ASSUMPTIONS
- The extractor produces one `MedicationEntry` per medicine and one `AllergyEntry` per allergen. Matching runs only on those fields, never on the whole transcript.
- The engine implements PHARMACY-SPEC §5 exactly: names padded and never trimmed, longest match, class+ingredient tokens, one interaction per pair, insulin excluded from duplicates.
- Combination products use the `generic` convention `"a+b"` (CR-8 proposes an explicit field).
- `pregnancy_status` "possible" is derivable from extraction (CR-9).

## RISKS
- **"No alert" can be misread as "safe".** The UI must show "No alerts from MedX rules v1.0 · pharmacist check required", never a green all-clear. This is the main clinical risk of this feature.
- **The engine may repeat the red-flag cue-trim bug.** Short brands (" sara ", " oki ", " moment ", " cpm ") depend on padded, untrimmed matching. If the engineer trims names, "Oki" matches "smoking" and "Moment" matches "at the moment". There are regression rows for this.
- Dictionary coverage is small (59 entries). Thai spelling variants of transliterated generics are many; misses become `unknown_medication`, which fails safe.
- Lay terms are deliberately unknown. Thai "ยาแก้อักเสบ" means antibiotic in everyday Thai, so mapping it to NSAID would be a real error.
- Pregnancy flags have no trimester logic, and there is no dose arithmetic beyond multi-product paracetamol.
- Rules are not validated against a commercial interaction checker. This is decision support for a pharmacist, not a substitute.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- CR-7: `ruleId` / `severity` / `source` per alert kind in `messages`. MedAlert needs a source for DUP / PREG / MAXDOSE / UNKNOWN; until then use the constants in PHARMACY-SPEC §3.
- CR-8: explicit `ingredients[]` on drug entries.
- CR-9: extraction value "possible" for `pregnancy_status`.
- Open from w2, still unresolved: the engine's red-flag cue-trim and curly-quote bug (`apps/web/lib/pipeline/redflags.ts`). The same risk applies to the medication engine.

## NEXT ACTION
- AI engineer: implement the medication engine from PHARMACY-SPEC §5, port the MEDRULES-TESTS rows as unit tests, and fix the red-flag matcher (w2 blocker).
- Clinician web builder: the pharmacist screen per PHARMACY-SPEC §2, including the "not a complete check" footer and no green all-clear.
- Medical researcher: add 3–5 synthetic cases with medication lists (Decolgen + Tylenol, warfarin + ibuprofen, pregnant + Roaccutane, a lay "ยาแก้อักเสบ") for the eval.
- Doctor: clinical sign-off on the pharmacist-view demo flow.
