# MedX: pharmacist view spec (Doctor, medrules v1.0, Sat 17 Oct 2026)

Medication reconciliation at intake. Contracts: `MedicationEntry`, `AllergyEntry`, `MedAlert`, `MedReviewAction`, `MedAlertReviewAction`, `MedRuleFile` (`packages/shared/src/types.ts`), `PharmacyReviewReq` (`api.ts`). Rules: `packages/shared/src/medrules.json`. Tests: `docs/clinical/MEDRULES-TESTS.md` (`node docs/clinical/check-medrules.mjs`).

## 1. The pharmacist's job at this point

| Task | What it means at a walk-in intake |
|---|---|
| **Reconcile** | Turn "what the patient says they take" into a list of what they **actually** take now: generic, strength, dose, frequency, last dose. Patients name brands, lay terms ("ยาความดัน", "la pastiglia per la pressione", "my blood thinner") or nothing at all. |
| **Identify across languages** | Map Thai, Italian and international brands and lay names to one generic: Tachipirina = Tylenol = ซาร่า = paracetamol; Moment = Brufen = ไอบูโพรเฟน = ibuprofen; Cardioaspirina = aspirin. |
| **Allergy conflicts** | Check each medicine against stated allergies, including class cross-reactivity (penicillin → cephalosporin). Separate drug allergies from food and latex allergies, and from side effects. |
| **Duplicates** | Same ingredient from two products, especially **paracetamol in combination cold remedies** (Decolgen, Tiffy, Norgesic, Tachidol), and two NSAIDs. |
| **Pregnancy** | Flag medicines to avoid or use with caution when pregnancy is confirmed or possible. |
| **High-risk interactions** | A short, well-evidenced list (bleeding, serotonin syndrome, nitrate + PDE5, hyperkalaemia, statin myopathy, methotrexate toxicity). |
| **Unknowns** | Anything that cannot be identified is shown as unknown, and the pharmacist asks to see the pack. It is never guessed. |

## 2. One screen, top to bottom

1. **Header:** session code · patient language · age · sex · **pregnancy status** · weight if stated · red-flag banner if the session is escalated (the pharmacist must see that the patient is being escalated).
2. **Alert bar:** all `MedAlert`s sorted high → moderate. Each shows kind, message (clinician language), action, the meds/allergies involved, the patient quote, and the source. Buttons: acknowledge · resolved · false alarm (+ note).
3. **Allergies:** each `AllergyEntry`: patient's words → class → reaction, status. Drug allergies first; then food/latex/contrast (`food_*`, `nondrug_*`), shown greyed and **never** used to block a drug. "No known allergies" only if the patient said so (quote); otherwise **"Allergies: not stated"** in red.
4. **Medication list:** one row per `MedicationEntry`: patient's words (original language) → generic + class → dose · frequency · timing → status (`supported` ink, `unsupported` pencil, `unmatched` amber). Per row: verify · edit (generic/dose/frequency) · discontinue.
5. **Unknown / to identify:** `unmatched` entries and lay "(unspecified)" entries (blood-pressure pill, cholesterol pill, blood thinner) with the quote. Prompt: "ask to see the pack / photo".
6. **Transcript drawer:** highlighter links from each med/allergy to the patient sentence.
7. **Sign-off:** "List reconciled" (`complete: true`). Disabled while any **high** alert is unreviewed or any medicine is `unmatched`/`unsupported` without an action.
8. **Footer:** medrules version · "Decision support. Not a complete interaction check. Pharmacist decides."

## 3. Alert severity policy

| Kind | Rule IDs | Severity | Trigger (deterministic, §5) |
|---|---|---|---|
| allergy_conflict | MR-ALLERGY-PEN, -CEPH, -SULFA, -NSAID, -PARA, -OPIOID, -MACROLIDE, -FQ | **high** | Med class/ingredient is in the stated allergy class |
| allergy_conflict | MR-ALLERGY-PEN-CEPH, -CEPH-PEN, -NSAID-COX2 | moderate | Known partial cross-reactivity |
| interaction | MR-INT-01…09 | **high** | Bleeding with anticoagulant (NSAID, COX-2, aspirin, co-trimoxazole, metronidazole), SSRI + tramadol, nitrate + PDE5, methotrexate + NSAID, simvastatin + clarithromycin |
| interaction | MR-INT-10…18 | moderate | Statin + clarithromycin, ACEi/ARB + spironolactone, ACEi + ARB, ACEi/ARB + NSAID, clopidogrel + omeprazole, aspirin + NSAID, SSRI + NSAID |
| max_dose_risk | MR-MAXDOSE-01 | **high** | ≥ 2 current products contain paracetamol (the only `maxDailyMg` ingredient, 4000 mg) |
| duplicate_therapy | MR-DUP-01 | **high** | Same ingredient or class, where the shared class is nsaid / anticoagulant / opioid / ssri |
| duplicate_therapy | MR-DUP-02 | moderate | Same ingredient or class, any other class (insulin excluded: basal + bolus is normal) |
| pregnancy_caution | MR-PREG-01 | **high** | `pregnancy: "avoid"` and pregnancy is pregnant/possible |
| pregnancy_caution | MR-PREG-02 | moderate | `pregnancy: "caution"` and pregnancy is pregnant/possible |
| unknown_medication | MR-UNKNOWN-01 | moderate | Med not in the dictionary, or matched to a lay "(unspecified)" entry |

Engine `source` strings for the kinds that have no per-rule source in `MedRuleFile` (see CR-7): DUP → "BNF: Medicines, duplication of therapy"; PREG → "BNF: Pregnancy sections of the named drug"; MAXDOSE → "BNF: Paracetamol, adult maximum 4 g in 24 hours"; UNKNOWN → "MedX pharmacy spec §3 (unidentified medicine)".

Severity ≠ urgency. A med alert never changes the triage queue. Only red-flag rules do that.

## 4. Decision support vs the pharmacist's decision

| The system does (deterministic, auditable) | The pharmacist decides |
|---|---|
| Lists what the patient **said**, each with its quote | Whether the patient actually takes it, at what dose |
| Maps names to a generic from a fixed dictionary | Whether the mapping is right (`edit`) |
| Raises alerts from fixed rules; the model cannot clear them | Whether an alert matters for this patient (acknowledge / resolved / false alarm + note) |
| Marks unknowns and unsupported items | Identifying them (pack, photo, calling the prescriber) |
| Records every action in the audit log (`pharmacy_review`) | Sign-off of the reconciled list |

The system never recommends a new drug, a dose, a substitution, or stopping a drug.

## 5. Matching and alert semantics (the engine must implement exactly; reference: `check-medrules.mjs`)

1. **Inputs are the split entries, never the whole transcript:** `MedicationEntry.nameOriginal` for drugs, `AllergyEntry.allergenOriginal` for allergens. ("Allergic to ibuprofen" must not become "takes ibuprofen".)
2. Normalise: NFC → lower-case → `’ ‘` → `'` → collapse whitespace → **pad one space on both sides**. Names are matched as substrings **with their spaces as written** (`" sara "`, `" oki "`, `" moment "`, `" cpm "`, `" fans "`, `"cipro "` are whole-word on purpose). Never trim names.
3. **Longest matching name wins** (ties: first in file). So "amoxiclav" → amoxicillin+clavulanic acid, not amoxicillin; "atorvastatin" → atorvastatin, not statin (unspecified).
4. Each med has **tokens** = `drugClass` ∪ ingredients (`generic` split on `+`). Allergy conflicts and interactions match on tokens (class or generic), so a combination like Tachidol (`paracetamol+codeine`, class opioid) hits both a paracetamol and an opioid allergy.
5. **allergy_conflict:** stated allergy class = `allergenClass` and the med has a token in `drugClasses`. `food_*` / `nondrug_*` classes have no conflicts.
6. **interaction:** one alert per med pair: the highest-severity matching rule (so simvastatin + clarithromycin raises MR-INT-09 only, not also MR-INT-10).
7. **max_dose_risk:** two meds share an ingredient that has `maxDailyMg` (paracetamol). This replaces the duplicate alert for that ingredient. Optional: also raise it when one product's parsed dose × frequency exceeds `maxDailyMg`.
8. **duplicate_therapy:** two meds share any other token (insulin excluded); MR-DUP-01 if the shared token is nsaid/anticoagulant/opioid/ssri, else MR-DUP-02.
9. **pregnancy_caution:** `pregnancy_status` is pregnant or possible (possible = not excluded in a woman of childbearing age who said "maybe", "late period", etc.). Unknown status does **not** fire (the intake asks the question instead, SPEC §2).
10. **unknown_medication:** `generic` null, or generic ends with "(unspecified)".
11. Alerts are computed over all meds except those the pharmacist marked `discontinued`. Patient-stated "stopped" (`timing`) is shown but still checked (fail-safe). Recompute after every `MedReviewAction`. A review records the decision; it never deletes the alert.

## 6. Limits (say these out loud in the demo and the README)

- **Not a complete interaction database.** 18 interaction rules, 59 dictionary entries, a fixed allergy-class map. "No alert" means "none of *these* rules fired", **never** "safe". The UI must not show a green "no interactions" state; show "No alerts from MedX rules v1.0 · pharmacist check required".
- **Not prescribing**, dosing, or substitution advice. No renal/hepatic dose adjustment, no weight-based dosing, no paediatric dosing.
- Dictionary coverage is limited to common Thai, Italian and international outpatient/OTC products. Generics and brands outside it become `unknown_medication`.
- Lay terms are ambiguous by design and are flagged unknown: Thai **"ยาแก้อักเสบ"** usually means an *antibiotic*, not an anti-inflammatory; "ยาความดัน" and "pastiglia per la pressione" could be any antihypertensive.
- Sulfa-antibiotic allergy is **not** mapped to sulfonylureas, thiazides or furosemide (no clinically meaningful cross-reactivity). Shellfish allergy is **not** a contrast-iodine allergy. Both are greyed, not blocking.
- Pregnancy flags are coarse (avoid / caution), with no trimester logic (e.g. NSAIDs are avoided from 20 weeks; that shows as "caution").
- Synthetic data only. Rules are written by the team's clinician from BNF / FDA labels / the cited studies. They are not validated against a commercial interaction checker.

## 7. Contract change requests

| ID | Request | Why |
|---|---|---|
| CR-7 | Add `ruleId`, `severity` and `source` to each `messages[kind]` entry (or a `kindRules` table) | MAXDOSE / DUP / PREG / UNKNOWN alerts currently need engine-side constants (§3) for `MedAlert.source` |
| CR-8 | Optional `ingredients: string[]` on drug entries instead of the `+`-joined `generic` convention | Makes combinations explicit; today the engine must split `generic` on `+` |
| CR-9 | `pregnancy_status` needs a "possible" value from extraction (late period, "maybe") | Pregnancy caution should fire on possible pregnancy, not only confirmed |

## 8. v1.1 addition: dose range on doctor orders

`drugs[].doseRange { maxSingleMg, maxDailyMg }` is set for 31 common oral drugs. These are adult usual maxima (BNF; metformin and naproxen daily max from the FDA labels), recorded in `doseRangeSource`. MR-DOSE-RANGE combines exceeded single and/or daily limits into one alert per order, kind `dose_range`, severity high, "Dose is outside the usual adult range — check". MR-DOSE-UNCHECKED is moderate when the drug/range is unknown or dose/frequency cannot be parsed: "Dose not checked — verify against a full reference". These are not dosing advice. They do not adjust for kidney or liver function, weight or children, and some indications legitimately exceed them (the doctor documents the reason). Tests: MEDRULES-TESTS "Dose range".

