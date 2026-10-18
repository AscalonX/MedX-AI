# MedX: consult assistant spec (Doctor, consultrules v1.3, vitalrules v1.0, investigations v1.0)

Ambient assistant for the nurse's history-taking and the doctor's consult: speech-to-text of the conversation → pop-up questions, don't-miss "rule out" questions, doctor-only "consider" items, and an evidence-linked draft note the doctor edits and signs.
Contracts: `ConsultMode`, `ConsultSuggestion`, `ConsultNote`, `ConsultNoteLine`, `ConsultState`, `ConsultRuleFile` (`packages/shared/src/types.ts`). Rules: `packages/shared/src/consultrules.json`. Check: `node docs/clinical/check-consultrules.mjs` (cases in §8).

## 1. Claim boundary (non-negotiable)

- The assistant **prompts the clinician**. It does not diagnose, triage, prescribe, or talk to the patient.
- "Consider" items carry the fixed label **"AI suggestion for clinician judgement — not a diagnosis"** (th: "ข้อเสนอแนะจาก AI เพื่อประกอบการตัดสินใจของแพทย์ ไม่ใช่การวินิจฉัย"; it: "Suggerimento dell'IA per il giudizio clinico — non è una diagnosi").
- Consider items are **doctor mode only**. They never appear in nurse mode, on the patient's phone, in any patient-facing text, or in the signed note unless the doctor explicitly keeps them.
- Forbidden wording in any suggestion or note line: "diagnosis is", "likely", "probable", "confirms", "rules in", "safe to", percentages or probabilities, and any treatment, drug or dose advice.
- Pitch wording: "A consult assistant that reminds the clinician what not to miss and drafts a note linked to what the patient actually said. The clinician decides and signs."

## 2. Inputs and what may trigger what

| Input | Triggers consult rules / note evidence? | Triggers red flags? |
|---|---|---|
| Patient-attributed speech turns (`role: "patient"`) | **Yes** | Yes |
| Clinician speech (`role: "clinician"`, e.g. "Any chest pain?") | **No.** A question is not a symptom, and is never used as evidence. | Yes (fail-safe: a false alarm in the room costs seconds) |
| Speaker unclear (diarisation uncertain) | No (treated as clinician for evidence) | Yes |
| Intake summary from the patient's phone (fields, meds, allergies) | Used for `ask_next` gaps and note sections | Already done at intake |

Matching uses red-flag semantics (REDFLAG-TESTS.md): NFC, lower-case, curly→straight quotes, whitespace collapse, leading-space pad, substring terms, negation cues and window **from `redflags.json`**, clause-bounded. A rule fires once per session and stays fired; later negations do not remove questions already shown.

## 3. Nurse vs doctor view

| Element | Nurse mode | Doctor mode |
|---|---|---|
| Red-flag banner (deterministic, from `redflags.json`) | Always on top, not counted as a popup | Same |
| `rule_out` questions (consult rules, `modes` includes the mode) | Yes: SOCRATES and don't-miss screening | Yes, including doctor-only questions |
| `ask_next` (missing required field, SPEC §2 order) | Yes | Yes |
| Model suggestions (`source: "model"`) | `ask_next` only, labelled "model" | `ask_next` + `consider`, labelled "model" |
| `consider` items | **Never** | Side panel "Consider", with the label in §1 |
| Draft note | Nurse sees history sections only, cannot sign | Full note, edit + sign |

## 4. Ranking and display

Popups hold **questions only** (`rule_out`, `ask_next`). **At most 3 visible at a time**; the rest queue.

1. **Red flag:** banner, outside the popup budget, never dismissible by the assistant. Clinician acknowledgement follows the red-flag review flow.
2. **`rule_out` from rules**, ordered by rule firing time, then question order in the file (the most dangerous question is listed first per rule).
3. **`ask_next` for missing required fields**, in SPEC §2 order (chief complaint → onset → severity → pregnancy status if conditionally required → allergies → medications → age).
4. **Model suggestions**, confidence ≥ the AI researcher's threshold. Never above any rule or required-field item, and never shown when the model abstained.

The "Consider" panel (doctor only) shows rule items first (by rule firing order), then model items. At most 4 visible.

Deduplication: if a question's answer is already a `supported` field or quote, it is not shown (status `answered`). The same question id is never shown twice.

## 5. Status semantics (`ConsultSuggestion.status`)

| Status | Set by | Meaning / behaviour |
|---|---|---|
| `open` | system | Eligible for display (subject to ranking and the 3-popup limit). |
| `asked` | clinician taps "Asked" | Leaves the popup area; listed under "asked, awaiting answer" in the note's open questions. |
| `answered` | system, when a later **patient** turn contains a verified quote for that question's topic, or the clinician marks it answered | Removed from popups. The quote becomes note evidence. |
| `dismissed` | clinician taps "Not relevant" | Never shown again in this session. Dismissing a `rule_out` question is audited (`consult_suggestion`) with clinician id. No reason is required, but one is offered. |

Every status change is an audit event. The assistant never auto-dismisses a `rule_out` question. A `rule_out` question that was dismissed or never asked is listed in the note under **Open questions** as "Not asked: …", so the signed note shows what was not screened.

## 6. Draft note (`ConsultNote`)

Sections, in order: **presenting_complaint · history · medications · allergies · red_flags · considerations (doctor only) · open_questions**.

| Rule | Detail |
|---|---|
| Evidence | Every line in presenting_complaint, history, medications, allergies and red_flags needs ≥ 1 verified **patient** quote (`status: "supported"`). Without one it is `unsupported`: shown as **needs-check** (pencil), never as fact. |
| Red flags | Copied from deterministic hits with their quotes. Cannot be deleted from the note, only annotated. |
| Considerations | Doctor mode only; heading "Considered (AI suggestion for clinician judgement — not a diagnosis)". Lines start as drafts and are **dropped at signing unless the doctor keeps them** (kept lines become `clinician`). |
| Open questions | Asked-but-unanswered and not-asked `rule_out` questions; missing required fields. |
| Edits | Any doctor edit → `edited`; doctor-typed lines → `clinician`. |
| Signing | Doctor only (`signed: { reviewerId, at }`). Blocked while any `unsupported` line remains unresolved (edit, accept as clinician, or delete). Audit `consult_note_signed`. |
| Disclaimer | `ConsultNote.disclaimer`: en "Draft for clinician review. Not a diagnosis." · it "Bozza per la revisione del clinico. Non è una diagnosi." · th "ร่างสำหรับให้แพทย์ทบทวน ไม่ใช่การวินิจฉัย" |
| Patient | **Nothing from the consult assistant goes to the patient**: no questions, no considerations, no note. |

## 7. Limits

- 12 presentation rules with fixed don't-miss lists. They are not a complete differential. No "consider" item ever means that other conditions are excluded.
- Speech-to-text and speaker attribution errors can drop or misattribute symptoms. Patient quotes in the note must be checked against what was actually said.
- Lay paraphrases outside the term lists will not trigger rules (same limit as red flags). Thai `ไอ` (cough) is matched only in longer forms to avoid `ไอศกรีม`, `ไอบูโพรเฟน`, `ไอน้ำ`.
- Known false-trigger example (low harm, pinned in §8): Thai `ปวดหลังเท้า` (pain on the top of the foot) triggers the back-pain questions.
- English is the primary demo language. The Thai and Italian question text was written by the team clinician and needs a native-speaker read.
- Sources are guideline names; PubMed-verified DOIs are given where the source is a journal article.

## 8. Reference cases (`node docs/clinical/check-consultrules.mjs`)

| rule | lang | expect | patient speech |
|---|---|---|---|
| CR-CHEST-01 | en | fire | I have chest pain since this morning |
| CR-CHEST-01 | it | fire | Ho un dolore forte al petto |
| CR-CHEST-01 | th | fire | แน่นหน้าอกมาสองชั่วโมง |
| CR-CHEST-01 | en | no | No chest pain, just a cough |
| CR-SOB-01 | en | fire | I get short of breath walking upstairs |
| CR-SOB-01 | it | fire | Ho il fiato corto da ieri |
| CR-SOB-01 | th | fire | หายใจเหนื่อยมาสามวัน |
| CR-SOB-01 | it | no | Non ho fiato corto, respiro bene |
| CR-HEAD-01 | en | fire | I've had a headache for two days |
| CR-HEAD-01 | it | fire | Ho mal di testa da stamattina |
| CR-HEAD-01 | th | fire | ปวดหัวข้างขวา |
| CR-HEAD-01 | th | no | ไม่มีอาการปวดหัว ไอนิดหน่อย |
| CR-ABD-01 | en | fire | I have stomach pain since yesterday |
| CR-ABD-01 | it | fire | Ho mal di pancia |
| CR-ABD-01 | th | fire | ปวดท้องน้อยด้านขวา |
| CR-ABD-01 | en | no | My stomach is fine, I have a rash |
| CR-FEVER-01 | en | fire | I have had a fever for three days |
| CR-FEVER-01 | it | fire | Ho la febbre a 39 |
| CR-FEVER-01 | th | fire | มีไข้สูงหนาวสั่น |
| CR-FEVER-01 | en | no | No fever, just a sore throat |
| CR-DIZZY-01 | en | fire | I felt dizzy and nearly fainted |
| CR-DIZZY-01 | it | fire | Mi gira la testa da ieri |
| CR-DIZZY-01 | th | fire | เวียนหัวบ้านหมุน |
| CR-DIZZY-01 | en | no | I never fainted and I'm not dizzy |
| CR-BACK-01 | en | fire | Lower back pain after lifting a box |
| CR-BACK-01 | it | fire | Ho mal di schiena da una settimana |
| CR-BACK-01 | th | fire | ปวดหลังมาสามวัน |
| CR-BACK-01 | en | no | No back pain at all |
| CR-URINE-01 | en | fire | It burns when I pee |
| CR-URINE-01 | it | fire | Ho la cistite |
| CR-URINE-01 | th | fire | ปัสสาวะแสบขัด |
| CR-URINE-01 | it | no | Non ho bruciore quando urino |
| CR-COUGH-01 | en | fire | I've had a cough for a week |
| CR-COUGH-01 | it | fire | Ho la tosse secca |
| CR-COUGH-01 | th | fire | ไอแห้งมาห้าวัน |
| CR-COUGH-01 | th | no | กินไอศกรีมแล้วเสียวฟัน |
| CR-THROAT-01 | en | fire | I have a sore throat |
| CR-THROAT-01 | it | fire | Ho mal di gola |
| CR-THROAT-01 | th | fire | เจ็บคอมาสองวัน |
| CR-THROAT-01 | en | no | No sore throat |
| CR-RASH-01 | en | fire | I have an itchy rash on my arms |
| CR-RASH-01 | it | fire | Ho delle macchie rosse sulle gambe |
| CR-RASH-01 | th | fire | มีผื่นขึ้นที่แขน |
| CR-RASH-01 | th | no | ไม่มีอาการผื่น |
| CR-GI-01 | en | fire | I've been vomiting since last night |
| CR-GI-01 | it | fire | Ho la diarrea da due giorni |
| CR-GI-01 | th | fire | ท้องเสียถ่ายเป็นน้ำ |
| CR-GI-01 | en | no | I have not been vomiting |
| CR-COUGH-01 | th | no | กินไอบูโพรเฟนเพราะปวดเข่า |
| CR-BACK-01 | th | fire | ปวดหลังเท้าเวลาเดิน |

## 9. Nurse vitals and triage suggestion (`vitalrules.json`, check: `node docs/clinical/check-vitalrules.mjs`)

- **NEWS2 (RCP 2017), SpO2 scale 1, adults 16+ only.** Not for pregnancy (use an obstetric score) or for SpO2 scale-2 patients unless a clinician sets it.
- The engine computes a **suggestion**; only `TriageAssessment.confirmed` (the nurse's level) is the clinical decision. The UI label reads "Suggested level — nurse confirms".
- Band semantics: `min`/`max` are inclusive, applied to values rounded to the recorded resolution (integers; temperature to 0.1 °C). There are no gaps; the checker verifies coverage.
- Encodings: `onOxygen` true = 1, false = 0. `consciousness` ordinal: alert 0 · new_confusion 1 · voice 2 · pain 3 · unresponsive 4. Any value ≥ 1 scores 3 (ACVPU).
- `warningScore` is reported only when all 7 parameters are present.
- Levels, first match wins:

| Condition | Level |
|---|---|
| Emergency red flag | 1 |
| Urgent red flag | 2 |
| NEWS2 ≥ 7 | 2 |
| NEWS2 5–6 | 2 |
| Any single parameter scoring 3 | 2 |
| NEWS2 1–4 | 3 |
| Otherwise | 4 |

  - No level 5: "routine admin" is not a clinical triage output.
- **Incomplete vitals never yield level 4**. With vitals missing, the result is level 3 plus the engine constant reason "Vitals incomplete — complete NEWS2 before confirming" (th "สัญญาณชีพยังไม่ครบ — วัดให้ครบก่อนยืนยัน", it "Parametri incompleti — completare il NEWS2 prima di confermare") (CR-12).
- Band alerts: every 3-point band raises a **high** alert, every 2-point band a **moderate** one.
- The level mapping is MedX's own, not an RCP or ESI scale.

## 10. Investigations (`investigations.json`, `InvestigationCatalog`)

- 34 common walk-in/ED investigations, shaped `{ id, category: lab | imaging | ecg | other, label: {th,it,en} }`.
- Consult "consider" items list `workup` ids from this catalog: **investigations worth considering, for the doctor to choose**. Nothing is ordered automatically. An `InvestigationOrder` records `fromSuggestionId` when the doctor orders from a suggestion.
- `guideline` links to a public guideline page, checked to load this wave (NICE guidance pages, WHO, PubMed for journal guidelines). It is omitted where no verifiable page was found.
- The checker enforces that every workup id exists, every guideline has a title and an https URL, and that consideration text contains no dose, mg or "give/start/prescribe" wording.

## 11. Doctor orders and prescribing checks

- `MedicationOrder.checks` reuse the pharmacy engine (PHARMACY-SPEC §5) against allergies, current meds, other new orders and pregnancy, plus **dose_range**:
  - MR-DOSE-RANGE: one high alert per order when the single dose > `doseRange.maxSingleMg` or dose × timesPerDay > `doseRange.maxDailyMg`; lists each exceeded limit; wording "Dose is outside the usual adult range — check".
  - MR-DOSE-UNCHECKED: moderate alert when the drug/range is unknown or dose/frequency cannot be parsed; "Dose not checked — verify against a full reference". An unknown drug also gets `unknown_medication`.
- High alerts need a documented doctor override reason. The pharmacist then verifies or returns the order.
- The AI never proposes a drug, dose, route or frequency. Considerations carry guideline links only.

## 12. v1.2: considerations need specific features (after UX audit w16)

- In v1.1 single words such as "fever", "cough" and "rash" fired 12 considerations for a 34-year-old with a one-day sore throat (lung cancer, TB, SJS…), and Orders then listed lumbar puncture.
- In v1.2, each of the 12 **base rules** (first match group = the presenting complaint) keeps its questions. Only CR-CHEST-01 keeps a consideration (ACS on chest pain).
- Every other consideration moved to its own **feature rule** (`questions: []`). Its first group is the same presenting complaint, plus one or two AND-groups of the specific features, for example:

| Consideration | Rule | Required features, beyond the presenting complaint |
|---|---|---|
| TB | CR-COUGH-03 | ≥ 2–3 weeks / months, weight loss, night sweats, haemoptysis, or TB contact |
| Lung cancer | CR-COUGH-04 | chronic (weeks/months) **and** smoking, weight loss or haemoptysis |
| SJS/TEN | CR-RASH-03 | blisters, peeling, mouth or eye involvement, or a new medicine |
| Meningitis (fever rule) | CR-FEVER-03 | neck stiffness, photophobia, non-blanching rash, or confusion |
| Meningitis (headache rule) | CR-HEAD-03 | neck stiffness, photophobia, non-blanching rash, or confusion |
| Meningococcal (rash rule) | CR-RASH-02 | fever **and** non-blanching rash |
| SAH | CR-HEAD-02 | sudden, worst, thunderclap |
| PE | CR-CHEST-03, CR-SOB-02 | haemoptysis, swollen leg or calf, long travel or recent surgery, pleuritic pain |
| Ectopic | CR-ABD-02 | pregnancy, late or missed period, vaginal bleeding |
| AAA | CR-ABD-05, CR-BACK-04 | radiation to the back (or abdominal pain with back pain), pulsing, known aneurysm |
| Sepsis | CR-FEVER-02 | confusion, drowsiness, fast breathing, very unwell, low urine, mottled skin |
| Epiglottitis (doctor only) | CR-THROAT-02 | stridor or noisy breathing, drooling, muffled voice, cannot swallow saliva |
| Peritonsillar abscess (doctor only) | CR-THROAT-03 | one-sided, trismus, muffled voice, drooling |

- The checker enforces that every rule with considerations has ≥ 2 match groups, except CR-CHEST-01.
- `NO-CONSIDER` rows assert that the audit case fires no consideration at all.
- This is a tightening after seeing an audit case, not independent evidence of specificity.

| rule | lang | expect | patient speech |
|---|---|---|---|
| NO-CONSIDER | en | I've had a sore throat since yesterday, with a fever and a cough. I'm 34. I'm allergic to penicillin, it gives me a rash. |
| NO-CONSIDER | it | Ho mal di gola da ieri, con febbre e tosse. Ho 34 anni. Sono allergico alla penicillina, mi dà uno sfogo, un'eruzione. |
| NO-CONSIDER | th | เจ็บคอมาตั้งแต่เมื่อวาน มีไข้และไอมา อายุ 34 แพ้ยาเพนิซิลลิน ขึ้นผื่น |
| CR-COUGH-03 | en | no | Cough since yesterday |
| CR-COUGH-03 | en | fire | I've had a cough for three weeks and night sweats |
| CR-COUGH-03 | th | fire | ไอมาสามสัปดาห์ น้ำหนักลด |
| CR-COUGH-04 | en | no | I smoke and have had a cough since Monday |
| CR-COUGH-04 | en | fire | Cough for two months, I smoke and I'm losing weight |
| CR-RASH-03 | en | no | I get a rash from penicillin |
| CR-RASH-03 | en | fire | A rash with blisters and a sore mouth since I started a new medicine |
| CR-RASH-03 | it | fire | Ho un'eruzione con vescicole e piaghe in bocca |
| CR-FEVER-03 | en | no | Fever and a sore throat |
| CR-FEVER-03 | en | fire | Fever and a stiff neck |
| CR-FEVER-03 | th | fire | ไข้สูง คอแข็ง |
| CR-HEAD-03 | en | fire | Headache and the light hurts my eyes |
| CR-HEAD-03 | en | no | Headache with a fever |
| CR-HEAD-02 | en | fire | Sudden worst headache of my life |
| CR-HEAD-02 | en | no | Headache on and off for a week |
| CR-CHEST-03 | en | fire | Chest pain worse when I breathe in, after a long flight |
| CR-CHEST-03 | en | no | Chest pain when I press on my ribs |
| CR-ABD-02 | en | fire | Stomach pain and my period is late |
| CR-ABD-02 | en | no | Stomach pain after a big meal |
| CR-ABD-05 | en | fire | Belly pain going through to my back |
| CR-FEVER-02 | en | fire | Fever and now I'm confused |
| CR-FEVER-02 | en | no | Fever and body aches |
| CR-THROAT-02 | en | fire | Sore throat, I'm drooling and have noisy breathing |
| CR-THROAT-03 | en | fire | Sore throat much worse on one side, I can't open my mouth |
| CR-THROAT-03 | it | fire | Mal di gola molto peggio da un lato, non riesco ad aprire la bocca |
| CR-THROAT-02 | en | no | I have a sore throat |
| CR-THROAT-03 | en | no | I have a sore throat |

## 13. v1.3: a non-suppurative consideration for the golden demo (w20 fix, needs Doctor sign-off)

- Why: the golden demo (data/cases/DEMO-GOLD.json) used to describe a suspected quinsy (one-sided pain, trismus) and then end in oral antibiotics and pickup, which goes against NICE NG84 (refer suspected quinsy). The case is now an uncomplicated sore throat with white spots on the tonsils and a penicillin rash allergy, so CR-THROAT-03 does not fire.
- New feature rule **CR-THROAT-05** (doctor-only consideration, no workup): presenting complaint sore throat **and** tonsillar pus, white spots or swollen tonsils. Text: "Consider bacterial tonsillitis: check the FeverPAIN or Centor score". It prompts a scoring step named by NG84; it never proposes a drug, dose or decision.
- The w16 audit case (sore throat, fever and cough, no tonsil finding) still fires no consideration (NO-CONSIDER rows above).
- Fixer wrote this rule, not the Doctor: the Doctor should confirm the terms and the wording before the final demo.

| rule | lang | expect | patient speech |
|---|---|---|---|
| CR-THROAT-05 | en | fire | I've had a sore throat for two days and I can see white spots on my tonsils |
| CR-THROAT-05 | en | fire | My throat hurts and my tonsils are swollen |
| CR-THROAT-05 | it | fire | Ho mal di gola e le tonsille gonfie con placche bianche |
| CR-THROAT-05 | th | fire | เจ็บคอ มีจุดขาวที่ต่อมทอนซิล |
| CR-THROAT-05 | en | no | I have a sore throat |
| CR-THROAT-05 | en | no | I have a sore throat, no white spots on my tonsils |
| CR-THROAT-03 | en | no | I've had a sore throat for two days and I can see white spots on my tonsils. It hurts to swallow. |
