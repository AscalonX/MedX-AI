# Report: w1 Medical researcher

**STATUS:** done (cases themselves are next wave, as planned)

**SUMMARY:** Wrote the evidence case (`docs/research/PROBLEM.md`) with 19 cited sources and the 40-case benchmark design (`docs/research/CASE-PLAN.md`) with full table, distribution, and JSON format. Findings were read from PubMed abstracts and news/government pages; unverifiable items were left out and listed.

**FILES CHANGED:**
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/docs/research/PROBLEM.md`
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/docs/research/CASE-PLAN.md`
- `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/docs/reports/w1-medical-researcher.md`

**EVIDENCE (headline numbers, all in PROBLEM.md with PMID/DOI/URL):**
- LEP adverse events with physical harm 49.1% vs 29.5%; communication-error cause 52.4% vs 35.9% (Divi 2007, PMID 17277013).
- Children of parents with limited English comfort: adverse events 17.7% vs 9.6%, aOR 2.1 (JAMA Pediatr 2020, PMID 33074313).
- Physician time: 27.0% face time vs 49.2% EHR/desk (Sinsky 2016, PMID 27595430). Nurse documentation 20.9-28.1% observed (J Clin Nurs 2021, PMID 33590554).
- LLM note generation: 1.47% hallucination, 3.45% omission (npj Digit Med 2025, PMID 40360677); 25% omissions / 20% inaccuracies / 2% hallucinations in pilot (JAMA Netw Open 2026, PMID 42101844).
- Thailand 32,974,321 foreign arrivals in 2025 (Bernama citing Ministry of Tourism and Sports).
- Case plan: 40 cases, th/it/en = 14/13/13; 11 red-flag positives, 29 negatives; 3 abstain cases.

**ASSUMPTIONS:** RF family names (RF-STROKE, RF-SUICIDE, RF-ANAPH, RF-BLEED, RF-PREG, RF-NEURO) are provisional because `redflags.json` is a placeholder with only RF-CHEST-01 and `docs/clinical/` is empty. Added three optional case keys (`nextQuestionField`, `pii`, `injectionPresent`) and allowed `assistant` turns.

**RISKS:**
- Italy's foreign-resident figure (about 5.37 million, 9.1%) is from ISMU's report on ISTAT data via a search summary; I could not open the ISTAT PDF text. Verify before it goes on a slide.
- Most language-barrier evidence is US/English-language; Thai and Italian settings are supported by context, not by direct adverse-event rates. Say "evidence from US hospitals" on the slide.
- Length-of-stay evidence is mixed; deliberately not claimed.
- No triage-specific timing statistic was verified; "2-3 minutes per intake" is a design assumption.
- n=40 gives wide confidence intervals; report counts.

**OPEN QUESTIONS:**
- Doctor: confirm final RF ids and whether the 6 negated cases should include the suicide negation (IT-09) given its sensitivity.
- Orchestrator: OK to add the optional gold keys to the eval harness schema (AI researcher)? No change to `types.ts` needed.
- Is a native Thai or Italian speaker available to proofread generated text for naturalness before gold labels are frozen?

**NEXT ACTION:** Once Doctor's `redflags.json` lands, generate the 40 JSON files in `data/cases/`, run an exact-substring evidence check script, then send positives and negated cases to the Doctor for label review.
