# MedX Bridge pharmacist view: the problem, with evidence

Research prototype, synthetic data only. Numbers were read from the cited PubMed abstracts or pages on 17 Oct 2026. Study settings differ a lot, so ranges are shown, not one headline average.

## 1. The medication history is often wrong at the start of care

"Unintended medication discrepancy" (UMD) = a difference between what the patient really takes and what is recorded, not explained by a clinical decision. Pharmacist-built "best possible medication history" (BPMH) is the usual gold standard.

| Setting | Finding | Source |
|---|---|---|
| 375 older adults, internal medicine, Saudi Arabia | 42.4% (151 patients) had at least one unintended discrepancy; omission was the commonest type (37%); about three-fifths of the discrepancies could cause temporary harm | [M1] |
| Tertiary hospital, pharmacist-led reconciliation at admission | 48.3% of patients had at least one unintended discrepancy in the physician-recorded list; omissions were 77% of discrepancies; 52% could cause moderate to severe discomfort | [M2] |
| 904 adults, endocrinology ward, Montpellier, France | 29.4% had at least one UMD at admission or discharge; 98.2% of UMDs were treated as medication errors; 36% of patients had serious or very serious errors | [M3] |
| Single-centre retrospective study, 7 wards (country not stated in abstract) | 449 UMDs in 215 patients; 45.9% occurred at admission; 31.6% rated severe; patients on 10 or more drugs had 4 times the odds of an admission UMD (OR 4.0) | [M4] |
| Elective orthopaedic surgery with pre-admission pharmacist history | Only 13.0% of patients still had an admission UMD (of 360) | [M5] |
| Emergency department, Ethiopia, pre-post | Patients with at least one UMD fell from 59% to 10.5% with a pharmacist (small sample, n=123) | [M6] |

Reading: depending on population and method, roughly 13% to 59% of patients have at least one unintended discrepancy in their admission medication list, most often an omitted medicine; rates are higher with more drugs and with physician-only histories, and lower after a pharmacist builds the history.

## 2. Language barriers and medication errors

- A 2025 systematic review (13 studies) found patients with low health literacy and limited English proficiency were significantly more likely to experience comprehension errors and medication discrepancies. [L1]
- A 2026 co-creation study with foreign-born persons with language difficulties, relatives, healthcare and pharmacy staff named "support for language understanding" as one of seven support needs for safe medication use at home. [L2] (qualitative; no error rate)
- We found no verified study giving a per-patient error rate specifically for Thai or Italian settings; the claim is "evidence from other countries" and must be labelled that way.

## 3. Brand names and over-the-counter products for travellers

- ISMP Canada's safe-medication newsletter (Aug 2014) describes a cruise passenger who took a 1000 mg paracetamol cold product without knowing that paracetamol is another name for acetaminophen (Tylenol), risking an unnoticed overdose and liver damage. It also states that brand names abroad may refer to different medicines or strengths, with an example of a Reactine bought in Italy that also contained pseudoephedrine. [T1] (case-level report, not a prevalence study.)
- No PubMed study quantifying brand-name confusion among travellers was found; we do not give a rate.
- Design implication: the same ingredient appears under different brands per country (Tachipirina, Efferalgan, Sara, Tiffy, Tylenol), which is why MedX Bridge maps names to generics and flags duplicate paracetamol.

## 4. Allergy records are often inaccurate

- In 145 maternity patients with a beta-lactam allergy in the record (Australia, 2021), the documentation needed amending in 52 patients (36%), and 56% of the allergies were judged low risk and potentially suitable for de-labelling. [A1]
- In a Hong Kong cohort of 141 adults referred for suspected penicillin allergy, 83% (117) were delabelled after structured testing; among 88 delabelled patients followed for 12 months, 17% (15) were incorrectly relabelled, despite a territory-wide shared electronic record. [A2]
- Meaning for MedX Bridge: the pharmacist sees the allergy the patient states, quoted in their own words, with the reaction if given, and nothing is marked "verified" until the pharmacist confirms. We do not claim to remove false allergy labels.

## 5. Slide-ready statements

1. In pharmacist-checked studies, between about 1 in 8 and more than 1 in 2 patients had at least one unintended error in their admission medication list, most often an omitted medicine. [M1-M6]
2. More than a third of allergy records checked in one maternity cohort needed correcting (52 of 145, 36%), and a lay allergy label is only as good as the sentence behind it. [A1]

## Sources

- [M1] *Prevention of medication errors at hospital admission: a single-centre experience in elderly admitted to internal medicine.* Int J Clin Pharm 2018. PMID 30367379. doi:10.1007/s11096-018-0737-2
- [M2] *The impact of pharmacist-led medication reconciliation during admission at tertiary care hospital.* Int J Clin Pharm 2017. PMID 29248986. doi:10.1007/s11096-017-0568-6
- [M3] *Medication Errors at Hospital Admission and Discharge: Risk Factors and Impact of Medication Reconciliation Process to Improve Healthcare.* J Patient Saf 2021. PMID 28877049. doi:10.1097/PTS.0000000000000420
- [M4] *Unintended medication discrepancies across key stages of the in-hospital medication process: a retrospective real-world study in hospitalized patients.* BMC Health Serv Res 2026. PMID 42001177. doi:10.1186/s12913-026-14581-4
- [M5] *Impact of a preoperative pharmaceutical consultation in scheduled orthopedic surgery on admission: a prospective observational study.* BMC Health Serv Res 2020. PMID 32791965. doi:10.1186/s12913-020-05623-6
- [M6] *Evaluation of the impact of pharmacist-led medication reconciliation intervention: a single centre pre-post study from Ethiopia.* Int J Clin Pharm 2018. PMID 30155773. doi:10.1007/s11096-018-0722-9
- [L1] *Association Between Patient Race/Ethnicity, Health Literacy, Socio-Economic Status, and Incidence of Medication Errors: A Systematic Review.* J Racial Ethn Health Disparities 2025. PMID 40180697. doi:10.1007/s40615-025-02407-8
- [L2] *Developing a model to support safe medication use in the home for foreign-born-persons with language difficulties: a co-creation participatory action research study.* BMC Health Serv Res 2026. PMID 42711692. doi:10.1186/s12913-026-15510-1
- [T1] ISMP Canada, *Travellers: Many Medicines Have Different Names in Foreign Countries*, Safe Medication Use newsletter 5(5), 18 Aug 2014: https://www.safemedicationuse.ca/newsletter/newsletter_Travelling.html
- [A1] *Beta-lactam allergy risk stratification in a maternity population in Australia: Scope for allergy de-labelling.* Aust N Z J Obstet Gynaecol 2024. PMID 38721775. doi:10.1111/ajo.13819
- [A2] *Prospective outcomes of penicillin allergy evaluation: Quality of life and relabeling rates.* Ann Allergy Asthma Immunol 2026. PMID 41763604. doi:10.1016/j.anai.2026.02.005

## Left out on purpose

A pooled "x% of admissions" meta-analysis figure (the search tool did not return the classic systematic reviews, and we do not quote papers we could not open); any Thai or Italian UMD rate; any traveller brand-confusion rate; a Serbian diltiazem/digoxin brand mix-up story seen only in a search snippet.
