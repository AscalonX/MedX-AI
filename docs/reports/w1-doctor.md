# w1 · Doctor (clinical lead) report

## STATUS
done

## SUMMARY
- Clinical spec written: user/setting, required vs optional FieldKeys + follow-up order, escalation policy (emergency vs urgent, patient view vs clinician view), one-screen nurse layout, abstain policy, pitch claim wording.
- `redflags.json` replaced: version `1.0`, **16 rules** (11 emergency, 5 urgent), each with TH/IT/EN label, action and patientMessage, multilingual lay terms, guideline source.
- 148 test rows (2 positive + 1 tricky negative × 3 languages × 16 rules, plus 4 pinned known false positives) and a reference matcher that runs them.

## FILES CHANGED
- `packages/shared/src/redflags.json` (replaced placeholder)
- `docs/clinical/SPEC.md` (new)
- `docs/clinical/REDFLAG-TESTS.md` (new)
- `docs/clinical/check-redflags.mjs` (new): reference matcher + runner; pins the matching semantics for the AI engineer
- `docs/reports/w1-doctor.md` (this file)

## TESTS RUN + RESULTS
- `node -e "JSON.parse(require('fs').readFileSync('packages/shared/src/redflags.json'))"` → OK
- Schema check (every rule has th/it/en label/action/patientMessage, valid severity, source, lower-case terms) → OK
- `node docs/clinical/check-redflags.mjs` → **148 passed, 0 failed, 16 rules**
- Bugs found and fixed while testing: Italian stem `sudo` did not match `sudato` (now `sudat`/`sudor`); Thai cue `ไม่เคยมีอาการ` (13 chars) did not fit a 12-char window (window now 14); Italian cue `mai` negated the textbook SAH phrase "non ho mai avuto un mal di testa così" (cue removed).

## EVIDENCE
- Citations verified via PubMed (metadata fetched): Gulati 2021 Circulation doi:10.1161/CIR.0000000000001029; Powers 2019 Stroke doi:10.1161/STR.0000000000000211; Cardona 2020 WAO J doi:10.1016/j.waojou.2020.100472; Godwin 2019 Ann Emerg Med doi:10.1016/j.annemergmed.2019.07.009; Perry 2013 JAMA doi:10.1001/jama.2013.278018.
- NICE (CG95, CG141, NG126, NG143, NG217, NG225, NG240, CG109), ESI v4 handbook and Manchester Triage System are cited **by name only** (not PubMed-indexed; not re-verified online this session).

## ASSUMPTIONS
- The engine implements the semantics in REDFLAG-TESTS.md §"Matcher semantics": NFC, lower-case, curly→straight quotes, collapse whitespace, **leading space prefix**, substring match, negation if a cue is in the 14 chars before, term counts if any occurrence is un-negated.
- Clinic is in Thailand (1669 in patient messages; 112 given for European visitors).
- Both emergency and urgent hits set status `escalated` and stop follow-up questions.
- Thai mental-health hotline 1323 is included in the Thai suicide message (Department of Mental Health hotline).

## RISKS
- **Keyword rules miss paraphrases.** Recall is bounded by the term lists; misspellings, transliteration (Thai typed in Latin script, "jeb na ok") and unusual phrasing will be missed. The demo should not claim full red-flag coverage.
- **Thai negation is deliberately weak** (bare `ไม่` is not a cue) → known false positives such as `ไม่เจ็บหน้าอก` firing CHEST-02. Accepted as fail-safe; pinned in tests.
- Latin negation can still produce a false negative when a cue lands within 14 chars by accident (e.g. "no idea why, chest pain"). Mitigation: the model-free rules are one layer; the nurse still sees the full transcript.
- Broad 2-group rules (ABD-01, MENING-01, PREG-01) will over-fire on some benign text. Acceptable for triage support, but it will move the false-alarm rate in the eval.
- Elderly fever is not covered (age is not reliably present in free text and `requires` would let the model veto a rule).
- Rules are a clinician-authored prototype, not a validated triage instrument.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- CR-1: optional `exclude?: string[]` per rule (or per-language negation window) to handle Thai negation safely. Post-hackathon.
- CR-2: add `"out_of_scope"` and `"conflicting_information"` to `abstainReason`.
- CR-3: optional FieldKey `reporter` (self / companion).
- CR-4: clinician acknowledge / false-alarm reason on a red-flag hit (audit payload is enough for now).
- Q: Should urgent hits let the patient keep answering follow-ups while they walk to the desk? Spec says no (simpler, safer). Orchestrator to confirm.
- Q for AI researcher: the confidence threshold for required fields (SPEC §5) is theirs to set.

## NEXT ACTION
- AI engineer: port `check-redflags.mjs` semantics into `apps/web/lib/pipeline/` and use the REDFLAG-TESTS table as unit tests.
- Medical researcher: include the known-FP phrases and the collision phrases (`ชักจะ`, `แน่นอน`, `ปวดท้องได้ 2 วัน`, "I can't speak Thai") in the 40 synthetic cases; the Doctor reviews the gold labels.
- Doctor: review gold labels; clinical sign-off on demo script and pitch claims (Sun 13:00).
