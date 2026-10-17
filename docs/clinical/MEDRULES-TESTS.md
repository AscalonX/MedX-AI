# Medication-rule test cases (medrules v1.1)

For: AI engineer (unit tests for the pharmacist-view engine). Rules: `packages/shared/src/medrules.json`. Semantics: `docs/clinical/PHARMACY-SPEC.md` §5.
Run the reference check: `node docs/clinical/check-medrules.mjs` (exit 0 = all rows pass).

Row types:
- `| L | lang | medicine name as the patient said it | expected generic or (none) |`: drug dictionary lookup on `MedicationEntry.nameOriginal`.
- `| AL | lang | allergy as the patient said it | expected allergenClass or (none) |`: allergen lookup on `AllergyEntry.allergenOriginal`.
- `| A | lang | expect | medicines (; separated) | allergies (; separated, - = none) | pregnancy |`: alert engine. `expect` = `MR-…` (alert must be raised) or `!MR-…` (must NOT be raised). Pregnancy: `pregnant`, `possible`, `no`, `-` (unknown).

Medicines and allergies are given **already split** (one entry per medicine/allergen, as the extractor produces them). Matching never runs on the whole transcript: "allergic to ibuprofen" must not be read as "takes ibuprofen".

## Drug lookup

| L | lang | name | generic |
|---|---|---|---|
| L | en | Tylenol 500 mg | paracetamol |
| L | it | Tachipirina 1000 | paracetamol |
| L | th | ยาพารา 2 เม็ด | paracetamol |
| L | th | ซาร่า | paracetamol |
| L | en | Sara | paracetamol |
| L | en | Sarah's vitamins | (none) |
| L | th | ไอบูโพรเฟน 400 | ibuprofen |
| L | th | ยาแก้ไอ | (none) |
| L | it | Moment Act | ibuprofen |
| L | it | Oki bustine | ketoprofen |
| L | en | smoking cessation gum | (none) |
| L | it | aspirinetta | aspirin |
| L | it | Cardioaspirina | aspirin |
| L | en | Amoxiclav | amoxicillin+clavulanic acid |
| L | it | amoxicillina e acido clavulanico | amoxicillin+clavulanic acid |
| L | it | Zimox | amoxicillin |
| L | th | ออกเมนติน | amoxicillin+clavulanic acid |
| L | en | dicloxacillin | dicloxacillin |
| L | en | Voltaren gel | diclofenac |
| L | en | Claritin | loratadine |
| L | en | Klacid | clarithromycin |
| L | en | Cipro 500 | ciprofloxacin |
| L | th | ดีคอลเจน | paracetamol+chlorphenamine+phenylephrine |
| L | en | Norgesic | paracetamol+orphenadrine |
| L | it | Tachidol | paracetamol+codeine |
| L | th | ยาความดัน | blood pressure medicine (unspecified) |
| L | it | la pastiglia per il colesterolo | statin (unspecified) |
| L | en | atorvastatin 20 | atorvastatin |
| L | th | ยาละลายลิ่มเลือด | blood thinner (unspecified) |
| L | th | ยาแก้อักเสบ | (none) |
| L | en | Lantus | insulin |
| L | th | ยาอมใต้ลิ้น | nitrate |
| L | it | spironolattone | spironolactone |
| L | en | vitamin D | (none) |

## Allergen lookup

| AL | lang | allergy | class |
|---|---|---|---|
| AL | en | penicillin, rash | penicillin |
| AL | it | penicillina | penicillin |
| AL | th | แพ้ยาเพนิซิลลิน | penicillin |
| AL | it | FANS | nsaid |
| AL | th | แพ้ยาซัลฟา | sulfa |
| AL | th | แพ้ยางพารา | nondrug_latex |
| AL | it | lattice | nondrug_latex |
| AL | en | shellfish | food_shellfish |
| AL | th | แพ้อาหารทะเล | food_shellfish |
| AL | en | iodine contrast | nondrug_contrast_iodine |
| AL | th | แพ้ยาแก้อักเสบ | (none) |
| AL | en | cephalexin | cephalosporin |

## Alerts

| A | lang | expect | medicines | allergies | pregnancy |
|---|---|---|---|---|---|
| A | en | MR-ALLERGY-PEN | Augmentin 1 g twice a day | penicillin (rash) | - |
| A | it | MR-ALLERGY-PEN | Zimox 1 g | penicillina | - |
| A | th | MR-ALLERGY-PEN | ยาอะม็อกซีซิลลิน | แพ้ยาเพนิซิลลิน | - |
| A | en | !MR-ALLERGY-PEN | azithromycin | penicillin | - |
| A | en | !MR-ALLERGY-PEN | Augmentin | iodine contrast; shellfish | - |
| A | en | MR-ALLERGY-PEN-CEPH | Keflex 500 | amoxicillin | - |
| A | it | MR-ALLERGY-PEN-CEPH | cefalessina | penicillina | - |
| A | th | MR-ALLERGY-PEN-CEPH | เซฟาเล็กซิน | แพ้อะม็อกซี | - |
| A | en | !MR-ALLERGY-PEN-CEPH | ciprofloxacin | penicillin | - |
| A | en | MR-ALLERGY-CEPH | cephalexin | ceftriaxone | - |
| A | it | MR-ALLERGY-CEPH | Keflex | cefalosporine | - |
| A | th | MR-ALLERGY-CEPH | เซฟาเล็กซิน | เซฟาโลสปอริน | - |
| A | en | MR-ALLERGY-CEPH-PEN | Augmentin | cephalexin | - |
| A | en | !MR-ALLERGY-CEPH | amoxicillin | latex | - |
| A | en | MR-ALLERGY-SULFA | Bactrim | sulfa drugs | - |
| A | it | MR-ALLERGY-SULFA | Bactrim forte | sulfamidici | - |
| A | th | MR-ALLERGY-SULFA | แบคทริม | แพ้ยาซัลฟา | - |
| A | en | !MR-ALLERGY-SULFA | gliclazide | sulfa | - |
| A | en | MR-ALLERGY-NSAID | Nurofen | aspirin | - |
| A | it | MR-ALLERGY-NSAID | Moment | FANS | - |
| A | it | MR-ALLERGY-NSAID | Cardioaspirina | ibuprofene | - |
| A | th | MR-ALLERGY-NSAID | ไอบูโพรเฟน | แพ้ยาแอสไพริน | - |
| A | th | !MR-ALLERGY-NSAID | ยาพารา | แพ้ไอบูโพรเฟน | - |
| A | en | MR-ALLERGY-NSAID-COX2 | Celebrex | ibuprofen | - |
| A | it | MR-ALLERGY-NSAID-COX2 | celecoxib | antinfiammatori | - |
| A | th | MR-ALLERGY-NSAID-COX2 | เซเลบเร็กซ์ | แพ้ยาเอ็นเสด | - |
| A | en | !MR-ALLERGY-NSAID-COX2 | Tylenol | NSAIDs | - |
| A | en | MR-ALLERGY-PARA | Panadol | paracetamol | - |
| A | it | MR-ALLERGY-PARA | Tachidol | tachipirina | - |
| A | th | MR-ALLERGY-PARA | ซาร่า | แพ้พาราเซตามอล | - |
| A | th | !MR-ALLERGY-PARA | ซาร่า | แพ้ยางพารา | - |
| A | en | MR-ALLERGY-OPIOID | Tylenol with codeine | codeine | - |
| A | it | MR-ALLERGY-OPIOID | Contramal | morfina | - |
| A | th | MR-ALLERGY-OPIOID | ทรามาดอล | แพ้มอร์ฟีน | - |
| A | en | !MR-ALLERGY-OPIOID | paracetamol | codeine | - |
| A | en | MR-ALLERGY-MACROLIDE | Zithromax | erythromycin | - |
| A | it | MR-ALLERGY-MACROLIDE | Klacid | azitromicina | - |
| A | th | MR-ALLERGY-MACROLIDE | คลาริโธรมัยซิน | อีริโธรมัยซิน | - |
| A | en | !MR-ALLERGY-MACROLIDE | amoxicillin | erythromycin | - |
| A | en | MR-ALLERGY-FQ | Cipro | levofloxacin | - |
| A | it | MR-ALLERGY-FQ | Ciproxin | chinoloni | - |
| A | th | MR-ALLERGY-FQ | ไซโปรฟลอกซาซิน | แพ้ยาไซโปรฟลอกซาซิน | - |
| A | en | !MR-ALLERGY-FQ | doxycycline | quinolones | - |
| A | en | MR-INT-01 | warfarin 3 mg; ibuprofen | - | - |
| A | en | MR-INT-01 | blood thinner; Voltaren | - | - |
| A | it | MR-INT-01 | Coumadin; Brufen | - | - |
| A | th | MR-INT-01 | วาร์ฟาริน; ไอบูโพรเฟน | - | - |
| A | en | !MR-INT-01 | warfarin; paracetamol | - | - |
| A | en | MR-INT-02 | Xarelto; Celebrex | - | - |
| A | it | MR-INT-02 | Eliquis; celecoxib | - | - |
| A | th | MR-INT-02 | ยาละลายลิ่มเลือด; เซเลบเร็กซ์ | - | - |
| A | en | !MR-INT-02 | Xarelto; Tylenol | - | - |
| A | en | MR-INT-03 | Eliquis; aspirin 81 | - | - |
| A | it | MR-INT-03 | Coumadin; Cardioaspirina | - | - |
| A | th | MR-INT-03 | วาร์ฟาริน; แอสไพริน | - | - |
| A | en | !MR-INT-03 | clopidogrel; aspirin | - | - |
| A | en | MR-INT-04 | Coumadin; Bactrim | - | - |
| A | it | MR-INT-04 | warfarin; Bactrim | - | - |
| A | th | MR-INT-04 | วาร์ฟาริน; แบคทริม | - | - |
| A | en | !MR-INT-04 | Xarelto; Bactrim | - | - |
| A | en | MR-INT-05 | warfarin; Flagyl | - | - |
| A | it | MR-INT-05 | Coumadin; metronidazolo | - | - |
| A | th | MR-INT-05 | วาร์ฟาริน; เมโทรนิดาโซล | - | - |
| A | en | !MR-INT-05 | warfarin; amoxicillin | - | - |
| A | en | MR-INT-06 | Zoloft; tramadol | - | - |
| A | it | MR-INT-06 | Prozac; Contramal | - | - |
| A | th | MR-INT-06 | เซอร์ทราลีน; ทรามาดอล | - | - |
| A | en | !MR-INT-06 | sertraline; codeine | - | - |
| A | en | MR-INT-07 | Isordil; Viagra | - | - |
| A | it | MR-INT-07 | Trinitrina; Cialis | - | - |
| A | th | MR-INT-07 | ยาอมใต้ลิ้น; ไวอากร้า | - | - |
| A | en | !MR-INT-07 | amlodipine; Viagra | - | - |
| A | en | MR-INT-08 | methotrexate weekly; Nurofen | - | - |
| A | it | MR-INT-08 | metotrexato; Brufen | - | - |
| A | th | MR-INT-08 | เมโธเทร็กเซต; ไอบูโพรเฟน | - | - |
| A | en | !MR-INT-08 | methotrexate; paracetamol | - | - |
| A | en | MR-INT-09 | Zocor; clarithromycin | - | - |
| A | en | !MR-INT-10 | Zocor; clarithromycin | - | - |
| A | it | MR-INT-09 | simvastatina; Klacid | - | - |
| A | th | MR-INT-09 | ซิมวาสแตติน; คลาริโธรมัยซิน | - | - |
| A | en | !MR-INT-09 | simvastatin; azithromycin | - | - |
| A | en | MR-INT-10 | Lipitor; Klacid | - | - |
| A | it | MR-INT-10 | pastiglia per il colesterolo; claritromicina | - | - |
| A | th | MR-INT-10 | ยาลดไขมัน; คลาริโธรมัยซิน | - | - |
| A | en | !MR-INT-10 | atorvastatin; azithromycin | - | - |
| A | en | MR-INT-11 | enalapril; Aldactone | - | - |
| A | it | MR-INT-11 | Triatec; spironolattone | - | - |
| A | th | MR-INT-11 | อีนาลาพริล; สไปโรโนแลคโตน | - | - |
| A | en | !MR-INT-11 | amlodipine; spironolactone | - | - |
| A | en | MR-INT-12 | Cozaar; spironolactone | - | - |
| A | it | MR-INT-12 | losartan; Aldactone | - | - |
| A | th | MR-INT-12 | โลซาร์แทน; สไปโรโนแลคโตน | - | - |
| A | en | !MR-INT-12 | losartan; amlodipine | - | - |
| A | en | MR-INT-13 | ramipril; losartan | - | - |
| A | it | MR-INT-13 | Enapren; Lortaan | - | - |
| A | th | MR-INT-13 | อีนาลาพริล; โลซาร์แทน | - | - |
| A | en | !MR-INT-13 | enalapril; amlodipine | - | - |
| A | en | MR-INT-14 | enalapril; Nurofen | - | - |
| A | it | MR-INT-14 | Triatec; Moment | - | - |
| A | th | MR-INT-14 | อีนาลาพริล; ไดโคลฟีแนค | - | - |
| A | en | !MR-INT-14 | enalapril; paracetamol | - | - |
| A | en | MR-INT-15 | losartan; naproxen | - | - |
| A | it | MR-INT-15 | Lortaan; Voltaren | - | - |
| A | th | MR-INT-15 | โลซาร์แทน; พอนสแตน | - | - |
| A | en | !MR-INT-15 | losartan; Tylenol | - | - |
| A | en | MR-INT-16 | Plavix; Losec | - | - |
| A | it | MR-INT-16 | clopidogrel; omeprazolo | - | - |
| A | th | MR-INT-16 | โคลพิโดเกรล; โอเมพราโซล | - | - |
| A | en | !MR-INT-16 | Plavix; pantoprazole | - | - |
| A | en | MR-INT-17 | aspirin; ibuprofen | - | - |
| A | it | MR-INT-17 | Cardioaspirina; Oki | - | - |
| A | th | MR-INT-17 | แอสไพริน; พอนสแตน | - | - |
| A | en | !MR-INT-17 | aspirin; paracetamol | - | - |
| A | en | MR-INT-18 | Prozac; naproxen | - | - |
| A | it | MR-INT-18 | sertralina; Brufen | - | - |
| A | th | MR-INT-18 | ฟลูออกซิทีน; ไอบูโพรเฟน | - | - |
| A | en | !MR-INT-18 | fluoxetine; paracetamol | - | - |
| A | en | MR-DUP-01 | Nurofen; Voltaren | - | - |
| A | en | MR-DUP-01 | codeine; tramadol | - | - |
| A | it | MR-DUP-01 | Brufen; Moment | - | - |
| A | th | MR-DUP-01 | ไอบูโพรเฟน; พอนสแตน | - | - |
| A | en | !MR-DUP-01 | Lantus; Novorapid | - | - |
| A | en | !MR-DUP-02 | Lantus; Novorapid | - | - |
| A | en | MR-DUP-02 | Zyrtec; Claritin | - | - |
| A | it | MR-DUP-02 | Zirtec; clorfenamina | - | - |
| A | th | MR-DUP-02 | ดีคอลเจน; ซีพีเอ็ม | - | - |
| A | en | !MR-DUP-02 | amlodipine; losartan | - | - |
| A | en | !MR-DUP-02 | Tylenol; Panadol | - | - |
| A | en | MR-PREG-01 | Roaccutane | - | pregnant |
| A | it | MR-PREG-01 | Coumadin | - | possible |
| A | th | MR-PREG-01 | ยาลดไขมัน | - | pregnant |
| A | en | !MR-PREG-01 | Roaccutane | - | no |
| A | en | !MR-PREG-01 | Roaccutane | - | - |
| A | en | MR-PREG-02 | ibuprofen | - | pregnant |
| A | it | MR-PREG-02 | Tachidol | - | pregnant |
| A | th | MR-PREG-02 | ไอบูโพรเฟน | - | possible |
| A | en | !MR-PREG-02 | paracetamol | - | pregnant |
| A | en | MR-MAXDOSE-01 | Tylenol; Decolgen | - | - |
| A | en | MR-MAXDOSE-01 | Tylenol; Panadol | - | - |
| A | it | MR-MAXDOSE-01 | Tachipirina; Tachidol | - | - |
| A | th | MR-MAXDOSE-01 | ยาพารา; ทิฟฟี่ | - | - |
| A | th | MR-MAXDOSE-01 | ซาร่า; นอร์เจสิก | - | - |
| A | en | !MR-MAXDOSE-01 | Tylenol 500; ibuprofen | - | - |
| A | en | MR-UNKNOWN-01 | blood pressure pill | - | - |
| A | it | MR-UNKNOWN-01 | pastiglia per la pressione | - | - |
| A | th | MR-UNKNOWN-01 | ยาแก้อักเสบ | - | - |
| A | th | MR-UNKNOWN-01 | ยาแก้ไอ | - | - |
| A | it | !MR-UNKNOWN-01 | Tachipirina | - | - |

## Dose range (doctor medication orders, v1.1)

`| D | lang | expect | drug as typed | dose mg | times per day |`. MR-DOSE-01 = single dose above `doseRange.maxSingleMg`; MR-DOSE-02 = dose × times/day above `doseRange.maxDailyMg`. Severity high (doctor documents an override reason; pharmacist verifies or returns). Wording is "outside the usual adult range — check", never an instruction.

| D | lang | expect | drug | mg | per day |
|---|---|---|---|---|---|
| D | en | !MR-DOSE-01 | Paracetamol | 1000 | 4 |
| D | en | !MR-DOSE-02 | Paracetamol | 1000 | 4 |
| D | en | MR-DOSE-02 | Tylenol | 1000 | 6 |
| D | it | MR-DOSE-01 | Tachipirina | 2000 | 1 |
| D | th | MR-DOSE-02 | ไอบูโพรเฟน | 800 | 4 |
| D | it | !MR-DOSE-02 | Brufen | 400 | 3 |
| D | en | MR-DOSE-01 | amlodipine | 20 | 1 |
| D | en | MR-DOSE-02 | tramadol | 100 | 6 |
| D | th | !MR-DOSE-01 | วาร์ฟาริน | 5 | 1 |
| D | en | !MR-DOSE-01 | vitamin D | 5000 | 1 |
