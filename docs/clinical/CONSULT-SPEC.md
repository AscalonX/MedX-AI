# MedX Bridge: consult assistant spec (Doctor, consultrules v1.0, Sat 17 Oct 2026)

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
