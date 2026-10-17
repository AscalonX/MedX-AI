# MedX: pharmacist view spec (Doctor, medrules v1.2, Sat 17 Oct 2026)

Medication reconciliation at intake (§1–6), dose range on doctor orders (§8), the two-stage pharmacy check and patient pickup (§9), and the alternatives table (§10). Contracts: `MedicationEntry`, `AllergyEntry`, `MedAlert`, `MedReviewAction`, `MedAlertReviewAction`, `MedRuleFile`, `MedicationOrder`, `PharmacistReport`, `DispenseChecklist`, `PickupState` (`packages/shared/src/types.ts`), `PharmacyReviewReq`, `PharmacyOrderActionReq`, `DispenseOrderReq`, `PickupReq` (`api.ts`). Rules: `packages/shared/src/medrules.json`. Tests: `docs/clinical/MEDRULES-TESTS.md` (`node docs/clinical/check-medrules.mjs`).

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

The system never prescribes, doses, substitutes or stops a drug. On a prescribing alert it may list other dictionary generics, taken from a fixed, cited table, that also pass this patient's MedX checks (§10). These are options for the prescriber to review. They are never applied automatically, and they never clear, downgrade or override an alert.

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

- **Not a complete interaction database.** 18 interaction rules, 59 dictionary entries, a fixed allergy-class map. "No alert" means "none of *these* rules fired", **never** "safe". The UI must not show a green "no interactions" state; show "No alerts from MedX rules v{medrules version} · pharmacist check required".
- **Not prescribing**, dosing, or substitution advice. No renal/hepatic dose adjustment, no weight-based dosing, no paediatric dosing. The alternatives list (§10) is a short set of options for prescriber review from a fixed table. It is filtered by MedX rules only, so "listed" never means "checked safe".
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
| CR-14 (w19) | Add `pregnancy: "caution"` to clarithromycin and azithromycin in `drugs[]` (BNF: manufacturers advise avoiding unless the benefit outweighs the risk; NICE NG84 names erythromycin, not clarithromycin, in pregnancy) | Today a pregnant patient with penicillin allergy gets clarithromycin listed as an option (§10.5). The change adds new MR-PREG-02 alerts on macrolide orders in pregnancy, so it changes existing outputs and needs orchestrator sign-off. |
| CR-15 (w19) | Give pharmacist 2 an audited way to stop a `verified` order, e.g. `return` allowed from `verified` with a required note, back to the prescriber | A verified order can be neither returned nor cancelled. A discrepancy found at the final check (wrong stock, new allergy at the counter) has no in-system path. |
| CR-16 (w19) | Optional `MedAlert.alternativesFrom?: string[]` (ids of the matched `alternatives` entries) | Lets the UI show each entry's note and source without re-deriving the match. The derivation is deterministic, so this is optional. |
| CR-17 (w19) | New interaction rules for a later wave: clopidogrel (antiplatelet) + NSAID (bleeding, BNF); warfarin + clarithromycin (INR rise, BNF) | Clopidogrel + NSAID raises no alert today. Neither does warfarin + clarithromycin, so clarithromycin is not dropped as an option for a patient on warfarin. Adding them creates new alerts, so it is deferred. |
| CR-18 (w19) | Add the §9.5 patient pickup strings and the §10.6 "Options for prescriber review" label to `packages/shared` i18n | i18n is orchestrator-owned. |

## 8. v1.1 addition: dose range on doctor orders

`drugs[].doseRange { maxSingleMg, maxDailyMg }` is set for 31 common oral drugs. These are adult usual maxima (BNF; metformin and naproxen daily max from the FDA labels), recorded in `doseRangeSource`. MR-DOSE-RANGE combines exceeded single and/or daily limits into one alert per order, kind `dose_range`, severity high, "Dose is outside the usual adult range — check". MR-DOSE-UNCHECKED is moderate when the drug/range is unknown or dose/frequency cannot be parsed: "Dose not checked — verify against a full reference". These are not dosing advice. They do not adjust for kidney or liver function, weight or children, and some indications legitimately exceed them (the doctor documents the reason). Tests: MEDRULES-TESTS "Dose range".

## 9. v1.2: two-stage pharmacy check and patient pickup

This mirrors a real outpatient pharmacy. **Pharmacist 1** does the clinical check of the prescription. **Pharmacist 2**, a different person, picks the medicine, does the final independent check and hands it over. Every step is a person's decision, recorded in the append-only audit log. Rules and alternatives are decision support only.

### 9.1 Flow

| # | Who | What they decide | What the system enforces | Status · audit |
|---|---|---|---|---|
| 0 | Doctor (prescriber) | Writes the order; gives an override reason for every **high** alert | Recomputes the checks (§5, §8) and alternatives (§10) on every draft and edit | `draft` → `submitted` · `order_submitted` |
| 1a | **Pharmacist 1**: verify | The order is appropriate for this patient: allergy, interaction, duplicate, pregnancy, dose, and the prescriber's override reasons | `verify` is refused while any high alert lacks an override reason | `submitted` → `verified` · `order_pharmacy_action` |
| 1b | **Pharmacist 1**: return with report | The order is not safe or not clear as written | `note` required. Optional `report`: `alertIds` must be ids of **this order's** checks; `suggestedGenerics` must be dictionary generics, max 5, deduped, not the ordered generic. Nothing is changed on the order. | `submitted` → `returned` · `order_pharmacy_action` (with report) |
| 1c | Doctor: re-review | Reads the note and report, then edits the order (a different drug or dose), keeps it and documents why, or cancels it | An edit re-runs every check. A suggested generic is never written into the order by the system. | `returned` → `draft` / `submitted` / `cancelled` |
| 2 | **Pharmacist 2**: dispense | Picks onto the tray and completes the 6-item final check (§9.2) | 409 unless `verified`. 409 when `reviewerId` = `pharmacist.by` (two-person check). 400 unless all six items are `true`. | `verified` → `dispensed` · `order_dispensed` |
| 3 | Pharmacist: call patient | Everything for this visit is ready | 409 unless there is ≥ 1 non-cancelled medication order and all of them are `dispensed`. A re-call is allowed (and audited) while `ready`, never after `collected`. | `pickup.status = ready` (+ counter) · `pickup_called` |
| 4 | Pharmacist: hand over | Confirms identity at the counter and counsels | 409 unless `pickup.status = ready` | `collected` · `pickup_collected` |

- **Late order:** if a medication order is submitted while pickup is `ready`, pickup is removed. The patient goes back to "preparing", and the `order_submitted` audit payload carries `pickupReset: true`.
- **Cancel:** `verified` and `dispensed` orders cannot be cancelled. CR-15 asks for a path for pharmacist 2 to stop a verified order.
- **Ops metrics:** `OpsMetrics.pharmacy` = `toVerify` (submitted) · `toDispense` (verified) · `readyForPickup` · `collectedToday`.

### 9.2 Final check (pharmacist 2): six items, all required

Check each item against the **verified order and the label in hand**, not from memory. An independent double check means the second person checks for themselves. They are not handed the expected answer and asked to agree (ISMP Medication Safety Alert!, independent double checks, 2019; WHO Medication Without Harm, Global Patient Safety Challenge, 2017).

| Item (`DispenseChecklist`) | Pharmacist 2 confirms |
|---|---|
| `rightPatient` | Two identifiers (name + date of birth or hospital number / session code) match the order and the label |
| `rightDrug` | The product picked is the verified generic and strength. Look-alike / sound-alike products are excluded. |
| `rightDose` | Strength × units per dose = the verified dose. The quantity matches the frequency and duration. |
| `rightRoute` | The formulation fits the route (oral tablet, topical, inhaled, …) |
| `allergyRechecked` | The recorded allergies are re-read against **every ingredient**, including combination products such as Tachidol or Augmentin. A new or unclear allergy means **stop**: do not dispense, go back to pharmacist 1 or the prescriber. |
| `labelled` | The label shows patient name, generic, strength, dose, frequency, duration and key warnings, in the patient's language |

UI rules:
- Every box starts **unticked**.
- There is no "select all".
- Each item has its own label.
- The screen shows who verified the order (`pharmacist.by`), and the server refuses that same id.
- A failed check is never "ticked anyway". The pharmacist stops.

### 9.3 Pharmacist 1's report back to the prescriber

The report is a message, not an action. Pharmacist 1 picks:
- which of the order's alerts are the problem (`alertIds`);
- optionally, up to 5 dictionary generics the prescriber may consider (`suggestedGenerics`). These are usually taken from the alert's `alternatives` (§10), but the pharmacist may name others in the dictionary.

The prescriber sees the note, the flagged alerts and the suggestions, labelled "Pharmacist report: options for prescriber review — not a prescription". The prescriber decides, and an edited order is checked again from scratch.

### 9.4 What the patient sees

The patient view (`patientView.ts`, explicit allowlist) adds only `pickup: { status: "preparing" | "ready" | "collected"; counter? } | null`:
- `session.pickup` when it is present;
- otherwise "preparing" when any medication order is submitted, verified or dispensed;
- otherwise `null`.

It **never** shows drug names, alerts, alternatives, pharmacist ids or notes. The doctor and pharmacist explain the medicines in person.

### 9.5 Suggested patient strings (CR-18)

| State | en | th | it |
|---|---|---|---|
| preparing | Your medicines are being prepared. Please wait to be called. | กำลังจัดเตรียมยาของคุณ กรุณารอเรียก | Stiamo preparando i suoi farmaci. Attenda di essere chiamato. |
| ready (counter) | Your medicines are ready. Please go to counter {counter}. | ยาของคุณพร้อมแล้ว กรุณาไปรับยาที่ช่อง {counter} | I suoi farmaci sono pronti. Si rechi allo sportello {counter}. |
| ready (no counter) | Your medicines are ready. Please go to the pharmacy counter. | ยาของคุณพร้อมแล้ว กรุณาไปรับยาที่ห้องยา | I suoi farmaci sono pronti. Si rechi allo sportello della farmacia. |
| collected | Medicines collected. | รับยาเรียบร้อยแล้ว | Farmaci ritirati. |

### 9.6 Limits

- Reviewer ids are self-declared in this prototype (no authentication). The two-person rule is therefore a procedural check, not an authenticated one.
- The checklist records what pharmacist 2 attests. The system cannot see the tray: there is no barcode scan and no stock check.
- Counselling content is not recorded.
- The pickup call is a status the patient app reads. It does not guarantee the patient was notified.

## 10. v1.2: alternatives on prescribing alerts (`medrules.alternatives`)

### 10.1 Shape

```
alternatives: { id: string; kinds: MedAlertKind[]; drugClasses: string[]; consider: string[]; note: Localized; source: string }[]
```

An entry matches an alert when:
- `alert.kind` is in `kinds`, and
- the **ordered** drug's `drugClass` is in `drugClasses`.

`consider` lists dictionary generics a prescriber may review.

### 10.2 Semantics (the engine must implement exactly; reference: `check-medrules.mjs` `prescribingAlternatives`)

1. Only alerts on the ordered drug are considered (`MedicationOrder.checks`), in the same context as §8: current medicines, other non-cancelled orders, allergies and pregnancy.
2. Candidates = the union of `consider` over the matching entries, in table order, minus:
   - the ordered generic;
   - unknown or "(unspecified)" entries.
3. Each candidate **replaces** the ordered drug in a hypothetical order. All the deterministic checks are run again. The candidate is dropped if it would itself raise `allergy_conflict`, `interaction`, `duplicate_therapy`, `pregnancy_caution` or `max_dose_risk`. `max_dose_risk` is the paracetamol form of duplication: a patient already taking Tylenol is not offered paracetamol again.
4. Allergy status not recorded: MR-ALLERGY-UNKNOWN (kind `allergy_conflict`) fires on every hypothetical too. So no option is listed until allergies are recorded. This is deliberate (fail-safe): an option cannot be called allergy-checked when the allergies are unknown.
5. `alert.alternatives` is set only when the list is non-empty. It is deterministic: no model is involved.
6. It is never written into the order. It never changes severity, never reviews or clears an alert, and never counts as an override reason.

### 10.3 Entries (v1.2)

| id | kinds | ordered class | consider | Covers (rule ids) |
|---|---|---|---|---|
| ALT-NSAID-ALLERGY | allergy_conflict | nsaid, cox2_inhibitor | paracetamol | MR-ALLERGY-NSAID, MR-ALLERGY-NSAID-COX2 |
| ALT-NSAID-INTERACTION | interaction | nsaid, cox2_inhibitor | paracetamol | MR-INT-01/02 (anticoagulant), MR-INT-17 (aspirin, antiplatelet), MR-INT-18 (SSRI), MR-INT-08 (methotrexate), MR-INT-14/15 (ACEi/ARB) |
| ALT-NSAID-PREGNANCY | pregnancy_caution | nsaid, cox2_inhibitor | paracetamol | MR-PREG-02 on NSAIDs and celecoxib |
| ALT-BETALACTAM-ALLERGY | allergy_conflict | penicillin, cephalosporin | clarithromycin, doxycycline | MR-ALLERGY-PEN, -PEN-CEPH, -CEPH, -CEPH-PEN |
| ALT-OPIOID-INTERACTION | interaction | opioid | paracetamol | MR-INT-06 (SSRI + tramadol) |

**Penicillin allergy never gets a cephalosporin** (cross-sensitivity, MR-ALLERGY-PEN-CEPH). The checker rejects any `consider` generic that conflicts with an allergy class able to trigger the entry. It also rejects a generic that belongs to one of the entry's own `drugClasses`.

Each entry's `note` (th/it/en) opens with "Option(s) for the prescriber to review against the indication … and local guidance, not a prescription" and states the main caveat:
- paracetamol may still cross-react in NSAID hypersensitivity;
- regular paracetamol can raise the INR on warfarin;
- the right antibiotic depends on the infection;
- NICE names erythromycin in pregnancy (not in the dictionary);
- doxycycline is avoided in pregnancy and under 12;
- paracetamol may not be enough for moderate to severe pain.

Sources are cited per entry: BNF, NICE NG84 / NG138 / CG183, the FDA Drug Safety Communication of 15 Oct 2020 (NSAIDs from 20 weeks), the EAACI NSAID-hypersensitivity position paper (Allergy 2013), and Boyer & Shannon (NEJM 2005).

### 10.4 Deliberately not covered

| Situation | Why there is no entry |
|---|---|
| Aspirin orders (any alert) | Low-dose aspirin is usually an antiplatelet. An analgesic swap would be wrong for that indication. |
| Clarithromycin + statin (MR-INT-09/10) | The usual decision is to withhold the statin during the course or pick an antibiotic for the infection. That is a prescriber decision, not a class swap. |
| Warfarin + co-trimoxazole / metronidazole | The antibiotic choice depends on the infection. Most alternatives also need INR monitoring. |
| Sulfa or macrolide allergy | The choice depends on the infection. Nothing in the dictionary is a safe default. |
| ACEi/ARB, statin, warfarin, isotretinoin in pregnancy | They need a specialist choice (e.g. labetalol, nifedipine, LMWH), and none of those is in the dictionary. |
| Clopidogrel + omeprazole | The preferred PPI (pantoprazole) is not in the dictionary. The interaction message already names it. |
| Duplicate therapy, max dose, dose range, unknown medicine | The fix is to stop one product, change the dose or identify the product. It is never "another drug". The checker refuses these kinds. |

### 10.5 Limits

- An option is filtered by **MedX's own 18 interaction rules and allergy map only**. For example, clarithromycin and doxycycline can raise the INR on warfarin, and MedX has no rule for that (CR-17), so they are not dropped. "Listed" never means "safe".
- There is no indication, age, renal, hepatic, weight or breastfeeding input. Doxycycline under 12 is not filtered, and the note says so.
- Clarithromycin has no pregnancy flag, so a pregnant, penicillin-allergic patient sees clarithromycin, with a note naming erythromycin (CR-14).
- No dose is ever suggested.

### 10.6 Display and wording

- Show options under the alert, labelled:
  - en: **"Options for prescriber review — not a prescription"**
  - th: **"ทางเลือกให้แพทย์ผู้สั่งยาพิจารณา — ไม่ใช่คำสั่งใช้ยา"**
  - it: **"Opzioni da valutare dal prescrittore — non è una prescrizione"**
- Show the entry's `note` and `source` with them. The UI finds the entry from kinds ∋ alert.kind and drugClasses ∋ order.drugClass, or uses CR-16.
- There is no "apply", "switch" or "replace" button. The prescriber edits the order themselves, which re-runs every check.
- Never use "recommended", "prescribe", "switch to" or "diagnosis" in this UI.
- Neutral ink, never red or green: red is reserved for the alert severity.

### 10.7 Validation (`node docs/clinical/check-medrules.mjs`)

The checker fails, with exit 1, when any of these holds:
- the table is missing or empty;
- there is an unknown property;
- an id is malformed or duplicated;
- an unknown kind is used, or a kind that cannot carry alternatives (dose_range, max_dose_risk, unknown_medication);
- a drugClass is not in the dictionary;
- the same kind/class pair is mapped twice;
- `consider` is empty, duplicated, or has more than 5 generics;
- a `consider` generic:
  - is not in `drugs[]`;
  - is a combination or "(unspecified)" entry;
  - belongs to one of the entry's own `drugClasses`;
  - conflicts with a triggering allergy class;
  - is pregnancy-flagged on a pregnancy entry;
- a note language is missing, has no claim-boundary framing, or uses instruction wording ("switch to", "give", "prescribe", …);
- `source` is missing, too short, or does not cite BNF / NICE / WHO / FDA / MHRA.

It also self-tests the validator: one valid fixture plus 17 broken fixtures, each of which must be caught. It runs the 30 `ALT` rows in MEDRULES-TESTS. It reads the markdown with CRLF or LF line endings.

