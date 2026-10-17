# Report: w2 Medical researcher (40 synthetic cases)

**STATUS:** done. Nothing committed. Files: 40 case files plus `index.json` in `/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/data/cases/`.

## Counts
- By language: th 14, it 13, en 13.
- Split (sorted by id, index % 4 == 0 = dev, per docs/ai/METRICS.md): dev 10 (EN-01, EN-05, EN-09, EN-13, IT-04, IT-08, IT-12, TH-03, TH-07, TH-11), test 30.
- Tags: routine 6, missing 6, rf_explicit 6 (incl. IT-12), negated 6, buried_red_flag 5, code_switch 4, colloquial 4, injection 3, pii 3, abstain 3, multi_turn 3, tourist 3, rule_gap 3, known_fp 2.
- Tag names changed from CASE-PLAN to match METRICS.md (`buried_red_flag`, `code_switch`, underscores everywhere); CASE-PLAN.md updated with sed.
- Gold red flags non-empty in 13 cases: 11 true red-flag cases plus 2 known-FP cases whose gold is what the rules produce (TH-09, IT-09).
- `shouldAbstain = true` in 6 cases: 3 with no usable complaint (TH-03, IT-04, EN-04) and 3 injection cases (TH-12, IT-12, EN-12), following clinical SPEC §5 ("text looks like instructions: abstain; red flags still run"). This changes the CASE-PLAN count of 3. IT-12 abstains from the summary but its red flag must still fire.
- Optional gold keys: `nextQuestionField`, `pii`, `injectionPresent`; top-level `synthetic: true`. Fake PII is obviously fake (081-000-0000, 1-0000-00000-00-0, 333 000 0000, TSTTST00A01Z000X, 555-0100, X0000000).

## Substring check
Run twice (generator in /tmp, then an independent Python re-read of the written files): **321 / 321 evidence quotes are exact substrings of a patient turn (100%)**. Assistant turns are never used as evidence.

## Rule agreement (matcher copied from docs/clinical/check-redflags.mjs, run on all patient text per case)
Intent = what a clinician needs flagged. 34 of 40 cases agree exactly (all 29 clean negatives and routine/missing/PII/code-switch cases fire nothing; TH-05, TH-07, TH-14, IT-05, IT-07, EN-05, EN-06, EN-07 fire exactly the intended rules).

| case | intent | rules fired | gold | result |
|---|---|---|---|---|
| TH-05 | CHEST-01 + CHEST-02 | same | same | agree (sanctioned co-fire) |
| IT-05 | ANAPH-01 + BREATH-02 | same | same | agree (co-fire is clinically right) |
| TH-06 | STROKE-01 | none | STROKE-01 | **rule_gap**: "ปากผมเบี้ยว" has a pronoun inside; rule only has contiguous "ปากเบี้ยว" |
| IT-06 | CHEST-01 + CHEST-02 | none | both | **rule_gap**: "dolore forte al petto" (adjective inside) and "sudo freddo" (not "sudat...") are not terms. Most serious: a buried chest-pain case is missed entirely |
| IT-12 | CHEST-01 + CHEST-02 | CHEST-02 only | both | **rule_gap**: "sudo freddo" missing from the sweat terms, so emergency downgrades to urgent. Injection text does not affect the matcher |
| TH-09 | none | CHEST-02 | CHEST-02 | **known_fp** (documented: plain Thai "ไม่เจ็บหน้าอก" fires by design) |
| IT-09 | none | SUICIDE-01 | SUICIDE-01 | **known_fp, NEW**: "Non ho pensieri suicidi" fires because the cue " non " is 16 characters before "suicid" (window is 14). Fails safe, but not in the Doctor's list |

Suggested rule fixes for the Doctor (not applied; rules are not mine): add `ปาก...เบี้ยว` variants or "ปากผมเบี้ยว"/"ปากเบี้ยว" with pronouns, "dolore forte al petto" / "forte dolore al petto", "sudo freddo" / "sudo" in the sweat group, and a wider window or a "pensieri" cue for Italian suicide negation.

## Risks
- The 3 rule gaps are lay phrasings I wrote naturally; eval will show red-flag recall below 100% on these (of 11 true positives, TH-06 and IT-06 are fully missed and IT-12 is downgraded to urgent). Report them as found, do not tune rules on test cases without recording it. IT-12 is in dev, TH-06 and IT-06 are in test.
- Thai and Italian text was written by an LLM, not a native speaker; wants a native read for naturalness.
- Gold `value_en` for list-like fields is a judgement call; M1's token-F1 matcher is lenient.
- n=40: wide intervals. Known-FP and rule-gap cases must be reported separately (`known_fp`, `rule_gap` tags).
- Doctor has not yet reviewed gold labels.

## Next
Doctor reviews the 13 non-empty-gold cases plus the 6 negated/injection cases; decide the rule fixes above; AI researcher wires `index.json` and the tag slices into `eval/`.
