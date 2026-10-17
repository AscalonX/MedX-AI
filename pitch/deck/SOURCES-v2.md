# deck-v2 sources (slide -> number -> source)

Slide numbers are PDF pages. No new web research was added; every external figure is already cited in docs/research/PROBLEM.md or PHARMACY-PROBLEM.md (read from abstracts on 17 Oct 2026). Business content is labelled "assumption for discussion" on the slides.

| Slide | Number | Source |
|---|---|---|
| 2, 3, 9 | 49.1% vs 29.5% physical harm; 46.8% vs 24.4%; 52.4% vs 35.9% | Divi 2007, Int J Qual Health Care, PMID 17277013 |
| 3 | 17.7% vs 9.6%, aOR 2.1 (1.2-3.7), n=1,666 | JAMA Pediatrics Dec 2020, PMID 33074313 |
| 3 | 33 studies | Liu 2024 J Surg Res, PMID 39178570 |
| 3 | 28 studies | Karliner 2007 Health Serv Res, PMID 17362215 |
| 3 | 11 studies, inconsistent length of stay | Kulkarni 2025 BMJ Open Qual, PMID 41314683 |
| 4 | 13%-59% discrepancy range; 59/48.3/42.4/29.4/13.0/10.5%; 37%/77% omissions; 52%; OR 4.0 | PHARMACY-PROBLEM.md M1-M6 (PMIDs 30367379, 29248986, 28877049, 42001177, 32791965, 30155773) |
| 4 | 13 studies | PMID 40180697 |
| 5 | 36% (52/145), 56%; 83% (117/141), 17% (15/88) | PMID 38721775; PMID 41763604 |
| 5 | paracetamol/Reactine case | ISMP Canada 2014 newsletter 5(5) |
| 6, 9 | 27.0% face time, 49.2% EHR; n=57, 430 h | Sinsky 2016, PMID 27595430 |
| 6, 9 | 28.1/22.7/20.9% (nurses 50.4/40.7/37.9% estimated), 120 h | J Clin Nurs 2021, PMID 33590554 |
| 7 | 1.47% hallucination, 3.45% omission, 12,999 sentences | npj Digit Med 2025, PMID 40360677 |
| 7 | 78% correct, 30 letters, 31 clinicians | JMIR Med Inform 2026, PMID 42114040 |
| 7 | 25% omissions, 20% inaccuracies, 2% hallucinations, 88% no harm | JAMA Netw Open 2026, PMID 42101844 |
| 8 | 32,974,321 tourists 2025 | Bernama 6 Jan 2026 (Ministry of Tourism and Sports) |
| 8 | ~338,000 unregistered workers | Khaosod English 6 Oct 2025 |
| 8 | 5.37M, 9.1% foreign residents (secondary; ISTAT 5.42M, 9.2%) | ISMU 31st Report Feb 2026 / ISTAT |
| 8, 23 | 90% barrier, 37% interpreter access, n=492 | Carrasco-Sanz 2018, PMID 29159977 |
| 8 | 987 migrant workers; border immunisation | PMID 29686905; PMID 32033393 |
| 2, 28 | 1,872 tests | `npm --prefix apps/web test` 18 Oct 2026: 23 files, 1872 passed |
| 2, 18, 28 | 18 red-flag rules | packages/shared/src/redflags.json (rules array length 18) |
| 15, 28 | 59 drugs, 18 interactions | packages/shared/src/medrules.json v3 |
| 15, 28 | dose ceilings for 31 | README Limitations; pitch/SUBMISSION.md (not re-counted) |
| 2, 28 | 52 synthetic cases, 18 holdout | data/cases (52 json), data/holdout (18 json) |
| 18, 28 | holdout rules-only 7/10 recall, 3/8 false alarms, 95% CI 40-89% | eval/results/holdout-rules-only.md; eval/REPORT.md |
| 29 | targets >=9/10, >=0.70, <=5%, >=0.90, <=0.10, <=6 s/12 s | docs/ai/METRICS.md |
| 29, 21, 30, 34 | Gemma/AMD accuracy and latency | "[pending AMD run]", no number exists |
| 25, 26, 27 | competitor categories, revenue options, phases, gates | our plan; assumption for discussion; pitch/SUBMISSION.md, docs/PLAN.md |
