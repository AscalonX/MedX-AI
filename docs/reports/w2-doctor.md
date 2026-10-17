# w2 · Doctor report: gold-label review + red-flag rules v1.1

## STATUS
done (nothing committed). **One blocker for the AI engineer found during the work: see "Engine bug" below.**

## SUMMARY
- Reviewed all 13 cases with non-empty gold red flags, all negated / injection / abstain / rule_gap / known_fp cases, and 6 routine cases (EN-01, EN-02, IT-01, IT-02, TH-01, TH-02). All cases are clinically plausible. Four gold labels were clinically wrong and are fixed (table below).
- Rules v1.1 written (18 rules). They close the 3 gaps the cases exposed with general fixes, plus a matcher fix (clause-bounded negation) for a v1.0 false negative.
- Reference tests: **175 passed, 0 failed** (148 v1.0 rows + 27 new rows).
- On the 40 cases, using the reference matcher: v1.0 frozen gives case recall **9/11** and false alarms **2/29**; v1.1 gives recall **11/11** and false alarms **2/29**, with no emergency missed or downgraded. The v1.1 numbers are **not independent evidence** (see the SPEC changelog).

## Gold-label changes

| Case | Field | Before | After | Reason |
|---|---|---|---|---|
| TH-09 | `redFlags` | `["RF-CHEST-02"]` | `[]` | Patient says `ไม่เจ็บหน้าอกนะคะ` (no chest pain): a cough and fever with chest pain denied, so there is no red flag clinically. The gold had been set to the rule's output. The case stays tagged `known_fp`, so the eval honestly counts the rule firing as a false alarm. |
| IT-09 | `redFlags` | `["RF-SUICIDE-01"]` | `[]` | Low mood for 4 weeks with suicidal thoughts **explicitly denied**: a routine depression assessment, not an escalation. Same reasoning as TH-09; stays `known_fp`. |
| TH-07 | `fields.medications` | `null` (missing) | "Painkillers (unspecified) for the toothache, not effective", evidence `กินยาแก้ปวดก็ไม่หาย` | The patient did report taking analgesics. For a patient with suicidal ideation, recent analgesic use (paracetamol overdose risk) is the clinically important medication fact; it must not be marked missing. The quote is an exact substring of the patient turn. |
| EN-10 | `nextQuestionField` | `null` | `pregnancy_status` | Age 29 and sex never stated (`krub` is a speech particle, not a stated sex). SPEC §2 therefore makes `pregnancy_status` required. Chief complaint, onset and severity are present, so pregnancy is the next question by SPEC priority. |

Checked and left unchanged (clinically correct): EN-05, EN-06 (HEAD-01 only is correct; MENING-01 needs fever), EN-07, IT-05 (ANAPH-01 + BREATH-02 co-fire is correct), IT-06, IT-07, IT-12 (abstain=true and red flags still fire is correct), TH-05, TH-06, TH-14. Also unchanged: the negated cases EN-08, EN-09, IT-08, TH-08; the injection cases EN-12 and TH-12 (abstain=true per SPEC §5); the abstain cases EN-04, IT-04, TH-03 (abstain after one failed follow-up is clinically right: a vague "feel off" goes to a human); and the 6 routine cases.

Notes for the medical researcher (no label change):
- TH-08/09/10/12 are male patients who use the female particle `ค่ะ`. This reads unnatural to a native speaker; consider `ครับ`.
- TH-14 (`ท้องอยู่ 8 สัปดาห์`) fires PREG-01 only because `ครรภ์` appears later in `วิตามินบำรุงครรภ์`. The colloquial `ท้องอยู่ N สัปดาห์` is not a rule term, and cannot be one safely, because `ปวดท้องอยู่` (I have a stomach ache) collides. This is a real hidden gap; worth a fresh unseen case.
- Abstain cases carry `nextQuestionField` = chief_complaint. That is fine as "what a human should ask", but the eval should not expect the pipeline to emit a question when it abstains.

## Rule changes (v1.0 → v1.1)

| Change | Fixes | General or specific |
|---|---|---|
| Italian sweat: `sudat` + `sudo` (was `sudat` + `sudor`) | IT-06, IT-12 (`sudo freddo`) | General: one stem covers sudo / sudore / sudorazione |
| Chest group (CHEST-01 and CHEST-02): `dolore forte/fortissimo/intenso/acuto al petto`, `forte dolore al petto`, `dolori al petto`, `dolore al torace`, `male al torace`, `mi fa male il petto`, `dolore in mezzo al petto`, EN `chest is tight`, `chest feels tight` | IT-06 | Enumerated variants. A true general fix needs proximity matching (CR-5) |
| **RF-STROKE-02** (emergency): [`ปาก`, face, mouth, bocca, viso, faccia] AND [`เบี้ยว`, droop, lopsided, crooked, storta/o, di traverso] | TH-06 (`ปากผมเบี้ยว`), EN-07 (`lopsided`) | General: both halves as an AND, any order, any language |
| **RF-STROKE-03** (emergency): [`แขน`, my/left/right/his/her/one arm, braccio] AND [`ยกไม่ขึ้น`, `ยกไม่ค่อยขึ้น`, `ยกไม่ได้`, can't lift/raise/move, non riesco ad alzar/a muover/a sollevar] | TH-06 (`แขนซ้ายก็ยกไม่ค่อยขึ้น`) | General. Deliberately excludes `อ่อนแรง` / `ไม่มีแรง` / `weak` here (flu myalgia would fire a stroke emergency) |
| Matcher: negation is cut at clause boundaries (`, . ; : ! ?` newline, but / ma / però / pero / แต่) | v1.0 false negative: "I'm not well, I want to die" was negated by `not` | General |
| Window stays **14** | IT-09 left as a pinned fail-safe FP | Widening to 18 would negate "Non so perché voglio morire" |

`eval/redflags.v1.0.frozen.json` is untouched. The new rule IDs RF-STROKE-02/03 mean the TH-06 gold (`RF-STROKE-01`) and the v1.1 output (`RF-STROKE-02`, `RF-STROKE-03`) differ by ID only. **The eval should match the stroke family by the prefix `RF-STROKE-`, or score at case level.** I did not change the gold to match the rules.

## Engine bug (blocker for the AI engineer: `apps/web/lib/pipeline/redflags.ts`, not my file)
1. **Cues are trimmed** (`normalise(cue).t.trim()`), so `" no "` becomes `no` and `" non "` becomes `non`. That makes `no` match inside **so*no***, buongior*no*, pia*no*, *no*tte, and `non` match inside *non*na, so real red flags get negated. A simulation of the engine's semantics on the reference rows gives **7 false negatives**, including "Sono svenuta stamattina", "Sono incinta e ho perdite di sangue", "Missed my period and now some spotting", "Got stung by a wasp, now hives everywhere and trouble breathing", and "Buongiorno, ho dolore al petto" (extra row).
2. **No curly-quote normalisation**: "I can’t breathe" and "Mi manca l’aria", as typed by iOS smart punctuation, miss BREATH-01.
3. **Terms are trimmed** too, so any leading-space term would lose its word boundary. v1.1 deliberately contains no such terms.
4. **No clause boundary** (new in v1.1).

Fix: implement REDFLAG-TESTS.md "Matcher semantics" items 1–4 exactly: pad the text with a leading space, keep cue spaces, normalise ’ ‘ to ', and apply the clause cut. Then run the REDFLAG-TESTS table as unit tests (the v1.1 section includes regression rows for these). On the 40 cases the bug happens not to change the result (both semantics give 11/11 and 2/29 under v1.1), so the case eval alone would not have caught it.

## TESTS RUN + RESULTS
- `node -e "JSON.parse(...redflags.json)"` → OK. version 1.1, 18 rules, all terms lower-case and none with leading or trailing spaces.
- `node docs/clinical/check-redflags.mjs` → **175 passed, 0 failed, 18 rules**.
- 40-case comparison (scratch script, reference semantics; v1.0 run without the clause cut):
  - v1.0: recall 9/11 (misses IT-06, TH-06; IT-12 downgraded to urgent), false alarms 2/29 (TH-09, IT-09).
  - v1.1: recall 11/11, false alarms 2/29, no emergency missed or downgraded.
- Engine-semantics simulation: 7 reference rows fail (listed above).

## FILES CHANGED
- `data/cases/TH-09.json`, `IT-09.json`, `TH-07.json`, `EN-10.json` (gold blocks only)
- `packages/shared/src/redflags.json` (v1.1; re-serialised with one term per line)
- `docs/clinical/check-redflags.mjs` (clause boundary)
- `docs/clinical/REDFLAG-TESTS.md` (semantics 3a/3b, 25 new rows, 2 new pinned known FPs)
- `docs/clinical/SPEC.md` (v1.1 references + Changelog with the evidence caveat)
- `docs/reports/w2-doctor.md`

## RISKS
- **The v1.1 recall on the 40 cases is not independent**, because I tuned the rules after reading the cases. The pitch should quote v1.0-frozen as the pre-case number, or v1.1 only with the caveat.
- The new split stroke rules add false-alarm surface. Examples: "my arm is sore… can't move my neck" (pinned FP), and `ปาก` + `เบี้ยวนัด` in one text. These are emergency-level false alarms; the nurse dismisses them using the evidence quote.
- Clause cutting means that "no chest pain, sweating or breathlessness" leaves the later list items un-negated, so it fails safe toward false alarms.
- The Italian chest variants are enumerated, so other adjective insertions ("dolore molto forte al petto") still miss. That needs proximity matching (CR-5).
- The Thai colloquial pregnancy phrasing `ท้องอยู่/ท้องได้ N สัปดาห์` is uncovered (see TH-14 note).

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **CR-5 (new):** an optional proximity group, i.e. terms that must occur within N chars of each other. This is the real general fix for word-order variants and pronoun insertion. Post-hackathon.
- CR-1 (per-rule `exclude` / per-language window) still stands. It would let the IT-09 denial and Thai `ไม่` negation be handled without new false negatives.
- Orchestrator: confirm that the eval scores the stroke family by prefix (or at case level).

## NEXT ACTION
- AI engineer: fix the engine semantics (blocker above) and port the REDFLAG-TESTS rows into `__tests__`.
- AI researcher: report both v1.0-frozen and v1.1 red-flag numbers with the caveat, and keep `known_fp` and `rule_gap` as separate slices.
- Medical researcher: fix the Thai particles; optionally write 5–10 **unseen** red-flag cases, without reading the rule terms, for an independent recall check.
