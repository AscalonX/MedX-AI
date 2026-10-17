# MedX Bridge: the problem, with evidence

Research prototype, synthetic data only. Every number below was read from the cited abstract or page on 17 Oct 2026. Items we could not verify are listed at the end and are NOT used.

## 1. A language barrier is a patient-safety problem

- **More harm, more communication errors.** In six US Joint Commission hospitals (7 months, 2005), adverse events in patients with limited English proficiency (LEP) involved physical harm in 49.1% of cases vs 29.5% for English speakers. Among harmful events, 46.8% (LEP) vs 24.4% reached moderate temporary harm up to death. 52.4% of LEP events were due to communication errors vs 35.9%. [D1]
- **Twice the odds of an adverse event.** In a 7-hospital prospective cohort of 1,666 parents of hospitalised children, children of parents with limited comfort in English had 17.7% vs 9.6% adverse events (adjusted OR 2.1, 95% CI 1.2-3.7) and higher odds of preventable events (aOR 2.3, 1.2-4.2). [D2]
- **Delay and under-assessment.** A scoping review of 33 pediatric-surgery studies found LEP patients received fewer pain assessments, waited longer for analgesia, and had longer time to treatment. [D3] A 2026 review of paediatric emergency care lists under-triage, longer stays, more revisits and more adverse events among documented disparities for non-English-speaking families. [D4]
- **What helps.** A systematic review (28 studies) found professional interpreters are associated with better communication, utilisation, outcomes and satisfaction than ad hoc interpreters, bringing care for LEP patients close to that of patients without a language barrier. [D5]
- **Honest caveat.** Length-of-stay effects are inconsistent: a 2025 scoping review of 11 studies found some showing shorter stays or fewer readmissions with interpreters, others longer stays or no effect, and often without adjusting for illness severity. [D6] We therefore do not claim "language barriers lengthen stays" as a headline number.

## 2. Time pressure and documentation load

- Physicians in 4 US specialties (57 doctors, 430 h observed) spent 27.0% of the office day on direct face time and 49.2% on EHR and desk work; per hour of face time, nearly 2 more hours went to EHR and desk work. [T1]
- Ward nurses in a Western Australian hospital (120 h observed) spent 28.1% (morning), 22.7% (afternoon) and 20.9% (night) of their time on documentation. Nurses themselves estimated 50.4%, 40.7% and 37.9%, so perceived burden is higher than measured burden, but the measured share is still large. [T2]
- Limit: these are ward and clinic data, not triage desks. We found no verified triage-specific timing figure, so we use the demo scenario ("2 to 3 minutes per intake") only as a design assumption, not a cited fact.

## 3. Context

**Italy**
- About 5.37 million foreign residents, 9.1% of residents, at 1 Jan 2025 (ISMU 31st Report built on ISTAT data; ISTAT's first release gave 5.42 million, 9.2%). [I1] *Secondary source: check against ISTAT before putting on a slide.*
- Across Europe, 492 primary-care paediatricians (Italian coordinators included) named cultural or linguistic factors as the most frequent barrier to care (90%), yet only 37% had access to professional interpreters and cultural mediators. [I2] *European, not Italy-only.*
- A 2026 structured review (Italian-led, 49 publications) lists "communication, language, and cultural mediation" as one of six domains shaping migrant screening and care in Europe. [I3]

**Thailand**
- 32,974,321 foreign tourist arrivals in 2025 (Ministry of Tourism and Sports, as reported 6 Jan 2026). [H1] Every one of them can end up at a Thai clinic or hospital in a language the staff may not share.
- Migrant workers: officials estimated about 338,000 unregistered workers from Cambodia, Laos, Myanmar and Vietnam in Oct 2025 (Department of Employment estimate). [H2] In a survey of 987 migrant workers in Thailand, language barrier (via acculturative stress) was linked to poorer access to antenatal and postpartum care. [H3] A systems analysis found only a fraction of cross-border migrant workers hold public health insurance. [H4]
- Along the Thai-Myanmar border, communication barriers were a main factor in satisfaction with the migrant child immunisation service. [H5]

## 4. LLM summaries need evidence and verification

- In a framework study of LLM clinical note generation (18 configurations, 12,999 clinician-annotated sentences), the hallucination rate was 1.47% and the omission rate 3.45%; prompt and workflow refinement reduced major errors. [L1]
- GPT-4o summaries of 30 synthetic Dutch discharge letters, rated by 31 clinicians: content judged correct 78% of the time; the medication section had the highest hallucination rate; missing information was the most common error. The authors conclude human oversight and targeted automated checks for omissions and hallucinations are essential. [L2]
- In a prospective pilot of LLM hospital-course summaries, among 100 summaries with feedback, 25% had omissions, 20% inaccuracies, 2% hallucinations; physicians rated 88% of unedited summaries as no harm potential and one as likely moderate harm. [L3]
- Why this matters for MedX Bridge: even low per-sentence error rates are unacceptable when a nurse may trust a field at a glance. Our design answers this directly: every field must carry a verified patient quote, otherwise it is shown as unsupported; red flags are deterministic and cannot be cleared by the model; a clinician approves everything.

## 5. Three one-sentence problem statements (slide-ready)

1. Patients with limited English proficiency in US hospitals had harmful adverse events about 1.7 times as often as English speakers (49.1% vs 29.5% with physical harm), and communication errors caused over half of them. [D1]
2. For every hour of face time, doctors spend nearly two more hours on EHR and desk work, and ward nurses spend roughly a fifth to a quarter of their shift documenting. [T1, T2]
3. Even good clinical LLMs omit or invent content (about 3.5% omissions and 1.5% hallucinations per sentence in one large audit), so a summary is only safe if each claim points to the patient's own words. [L1]

(Statement 1 ratio: 49.1 / 29.5 = 1.66, rounded to "about 1.7 times"; statement 2 "fifth to a quarter" = 20.9% to 28.1%.)

## Sources

- [D1] Divi C, Koss RG, Schmaltz SP, Loeb JM. *Language proficiency and adverse events in US hospitals: a pilot study.* Int J Qual Health Care 2007;19(2):60-67. PMID 17277013. doi:10.1093/intqhc/mzl069
- [D2] *Association Between Parent Comfort With English and Adverse Events Among Hospitalized Children.* JAMA Pediatrics, Dec 2020. PMID 33074313. doi:10.1001/jamapediatrics.2020.3215
- [D3] Liu O et al. *A Scoping Review of Limited English Proficiency and Immigration in Pediatric Surgery.* J Surg Res 2024;302:540-554. PMID 39178570. doi:10.1016/j.jss.2024.07.097
- [D4] *Language Equity for Pediatric Patients in the Emergency Department.* Pediatr Emerg Care, Apr 2026. PMID 41919476. doi:10.1097/PEC.0000000000003509 (narrative review)
- [D5] Karliner LS, Jacobs EA, Chen AH, Mutha S. *Do professional interpreters improve clinical care for patients with limited English proficiency? A systematic review.* Health Serv Res 2007;42(2):727-754. PMID 17362215. doi:10.1111/j.1475-6773.2006.00629.x
- [D6] Kulkarni S et al. *Evaluating professional interpreting services for patients with limited English proficiency in secondary care settings: a scoping review.* BMJ Open Qual 2025;14(4). PMID 41314683. doi:10.1136/bmjoq-2025-003691
- [T1] Sinsky C et al. *Allocation of Physician Time in Ambulatory Practice: A Time and Motion Study in 4 Specialties.* Ann Intern Med 2016;165(11):753-760. PMID 27595430. doi:10.7326/M16-0961
- [T2] *Is nursing and midwifery clinical documentation a burden? An empirical study of perception versus reality.* J Clin Nurs, Mar 2021. PMID 33590554. doi:10.1111/jocn.15718
- [I1] ISMU Foundation, *31st Report on Migrations*, Feb 2026 (data: ISTAT): https://www.ismu.org/wp-content/uploads/2026/02/31-Rapporto-ISMU_Slide_Ortensi.pdf ; ISTAT demographic indicators: https://www.istat.it/comunicato-stampa/indicatori-demografici-anno-2025/
- [I2] Carrasco-Sanz A et al. *Migrant children's health problems, care needs, and inequalities: European primary care paediatricians' perspective.* Child Care Health Dev 2018;44(2):183-187. PMID 29159977. doi:10.1111/cch.12538
- [I3] Buonamassa R et al. *Implementation and Access Gaps in Infectious Disease Screening for Migrants in Europe: A Structured Review (ESGITM).* Ann Glob Health 2026;92(1):88. PMID 42699676. doi:10.5334/aogh.5363
- [H1] Bernama, "Thailand records 32.97 million foreign tourist arrivals in 2025", 6 Jan 2026, citing the Ministry of Tourism and Sports: https://www.bernama.com/en/news.php?id=2509419
- [H2] Khaosod English, "Thailand to Legalize 700,000 Undocumented Workers from 4 Nations", 6 Oct 2025: https://www.khaosodenglish.com/news/2025/10/06/thailand-to-legalize-700000-undocumented-workers-from-4-nations/
- [H3] Holumyong C et al. *The Access to Antenatal and Postpartum Care Services of Migrant Workers in the Greater Mekong Subregion.* J Pregnancy 2018. PMID 29686905. doi:10.1155/2018/9241923
- [H4] Kunpeuk W et al. *Understanding the Problem of Access to Public Health Insurance Schemes among Cross-Border Migrants in Thailand through Systems Thinking.* Int J Environ Res Public Health 2020;17(14):5113. PMID 32679855. doi:10.3390/ijerph17145113
- [H5] Pinna C et al. *Evaluation of Immunization Services for Children of Migrant Workers Along Thailand-Myanmar Border.* Vaccines 2020;8(1):68. PMID 32033393. doi:10.3390/vaccines8010068
- [L1] *A framework to assess clinical safety and hallucination rates of LLMs for medical text summarisation.* npj Digit Med, May 2025. PMID 40360677. doi:10.1038/s41746-025-01670-7
- [L2] *Expert Evaluation and Consensus on GPT-4o Summaries of Clinical Letters (FAITH project).* JMIR Med Inform, May 2026. PMID 42114040. doi:10.2196/90374
- [L3] *Physician-Reported Safety Outcomes of AI-Generated Hospital Course Summaries.* JAMA Netw Open, May 2026. PMID 42101844. doi:10.1001/jamanetworkopen.2026.16556

## Left out on purpose (could not verify from a primary source)

Thai medical-tourism patient counts (sources disagree: 632,000 vs 1.4 million; definitions differ); Italian tourist arrival totals (sources disagree on definition); Thailand total registered migrant workers (3.34 million figure seen only in a search snippet); any triage-specific minutes-per-patient figure; any claim that interpreter use shortens stays.
