# Report: w3 Medical researcher (pharmacist view evidence + 12 MED cases)

**STATUS:** done. Nothing committed. I did not read `packages/shared/src/medrules.json`; gold is from clinical knowledge. I read only the type definitions in `types.ts`.

## Files
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/docs/research/PHARMACY-PROBLEM.md` (11 cited sources, PMID/DOI/URL; 2 slide statements)
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/data/cases/MED-01.json` ... `MED-12.json`
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/data/cases/index.json` (12 entries added, tag `medication`; total 52 cases)

## Evidence headline
Unintended discrepancies in admission medication lists: 42.4% (PMID 30367379), 48.3% (29248986), 29.4% (28877049), 13.0% with a pre-admission pharmacist history (32791965). Omission is the commonest error type. Allergy records: 36% (52/145) of a maternity cohort needed amending (38721775). Limited-English-proficiency and low health literacy are linked to medication discrepancies (systematic review, 40180697). Traveller brand-name confusion rests on one case-level newsletter (ISMP Canada 2014); no prevalence figure exists in what I could find, and none is claimed.

## Cases (th 4, it 4, en 4)
| id | lang | scenario | gold medAlerts |
|---|---|---|---|
| MED-01 | th | penicillin allergy, takes ออกเมนติน (Augmentin) | allergy_conflict |
| MED-02 | th | ซาร่า + ทิฟฟี่ same day | duplicate_therapy |
| MED-03 | th | warfarin + self-bought ibuprofen | interaction |
| MED-04 | th | ยาหม่อง, unknown herbal decoction, unnamed BP pill | unknown_medication x2 |
| MED-05 | it | Tachipirina 1000 x3 + Efferalgan 1000 x2 (5 g/day) | duplicate_therapy, max_dose_risk |
| MED-06 | it | 10 weeks pregnant, Moment 200 (ibuprofen) | pregnancy_caution |
| MED-07 | it | stopped Triatec (ramipril) a week ago, now Tachipirina 500, shrimp allergy | none |
| MED-08 | it | sertraline + St John's wort tisana, agitated | interaction |
| MED-09 | en | sertraline + friend's tramadol | interaction |
| MED-10 | en | Italian tourist: Aulin, Muscoril, Eutirox (local brands) | none |
| MED-11 | en | "white pill for blood pressure", "little yellow one", sulfa allergy | unknown_medication x2 |
| MED-12 | en | metformin + atorvastatin with doses, "no allergies at all" | none |

Format additions (additive): `gold.meds[]` {nameOriginal, generic, evidence, plus optional dose, frequency, timing, status}, `gold.allergies[]` {allergenOriginal, allergenClass, reaction, evidence}, `gold.medAlerts[]` {kind, drugs[] (generic names; original wording when generic is null), allergenClass for allergy_conflict}. `gold.fields` is filled as in the earlier cases (medications and allergies fields too). Tags besides `medication`: allergy_conflict, duplicate_therapy, max_dose_risk, interaction, pregnancy_caution, unknown_medication, stopped_medication, herbal, local_brand, clean_list, negated_allergy, dose_frequency, tourist.

## Checks
- Substring check: **475 of 475 quotes (all 52 case files: fields, meds, allergies) are exact substrings of a patient turn**; the MED set alone is 153 of 153 (generator) and was re-verified by a separate Python pass.
- Red-flag matcher (copy of the Doctor's reference logic, run on the MED texts): no red flag fires, so `gold.redFlags = []` for all 12. I did not tune text to the rules.

## Decisions and risks
- **Split:** I did not re-run the every-4th rule over all 52 ids, because that would shift existing TH cases between dev and test after dev tuning may have started. The rule is applied inside MED only: dev = MED-01, MED-05, MED-09; test = the other 9. Noted in `index.json`. Tell me if you want a global re-split instead.
- Gold generics and classes are my clinical knowledge: Sara = paracetamol; Tiffy = paracetamol with chlorpheniramine and phenylephrine; Moment = ibuprofen; Triatec = ramipril; Aulin = nimesulide; Muscoril = thiocolchicoside; Eutirox = levothyroxine. A pharmacist should confirm, especially Tiffy's formulation and the Italian brand strengths.
- MED-05 total of 5 g/day exceeds the usual 4 g adult maximum; keep as designed.
- MED-08 and MED-09 describe agitation and sweating after serotonergic combinations; no red-flag rule is expected to fire and none does. The pharmacist alert is the only safety net there, which is worth saying in the demo, not claiming as triage.
- `local_brand` cases (MED-01, 02, 04, 07, 10) are intended to measure dictionary coverage; I expect the dictionary may miss some, and that is information, not an error in the gold. Report them as a slice.
- n=12; text written by an LLM, needs native proofreading; pharmacist/Doctor review of gold not done yet.

## Next
Doctor or a pharmacist reviews MED-01..12 gold generics and alerts; AI engineer/researcher adds meds/allergies/alerts scoring (per-item precision/recall, alert recall on the 8 cases with alerts, false alerts on MED-07/10/12) in `eval/`.
