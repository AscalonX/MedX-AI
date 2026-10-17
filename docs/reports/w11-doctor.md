# w11 · Doctor report: consult assistant rules + spec

## STATUS
done (nothing committed)

## SUMMARY
- `packages/shared/src/consultrules.json` v1.0 (`ConsultRuleFile`) has 12 presentation rules for adult walk-in care. It holds **57 questions** (3–5 per rule, each with `why` and `modes`) and **39 doctor-only "Consider …" items** (2–4 per rule), all in en/it/th.
  - Rules: chest pain, shortness of breath, headache, abdominal pain, fever, dizziness/syncope, back pain, urinary symptoms, cough, sore throat, rash, vomiting/diarrhoea.
  - The questions are SOCRATES-style plus don't-miss screening, for example:
    - chest pain: radiation, exertion, sweating, risk factors, PE risk;
    - headache: thunderclap, fever/neck stiffness, neuro deficit, anticoagulants;
    - abdominal pain: pregnancy possibility, GI bleed, peritonism, obstruction, AAA.
  - The considerations cover the can't-miss differential (ACS, aortic dissection, PE, SAH, meningitis, ectopic pregnancy, sepsis, cauda equina, SJS/TEN, DKA …).
  - They contain no treatment advice.
- `docs/clinical/CONSULT-SPEC.md` covers:
  - the claim boundary and fixed label "AI suggestion for clinician judgement — not a diagnosis" (th/it/en);
  - which speech may trigger what;
  - nurse vs doctor view;
  - ranking: red-flag banner, then rule-out, then missing required fields, then model; at most 3 popups, and Consider items in a separate doctor-only panel;
  - open/asked/answered/dismissed semantics;
  - the draft-note structure, needs-check rule and signing gate;
  - "nothing to the patient";
  - limits and reference cases.
- `docs/clinical/check-consultrules.mjs` is the reference matcher. It reuses the red-flag semantics, with negation cues from `redflags.json` and the clause boundary.

## FILES CHANGED
- `packages/shared/src/consultrules.json` (new)
- `docs/clinical/CONSULT-SPEC.md` (new)
- `docs/clinical/check-consultrules.mjs` (new)
- `docs/reports/w11-doctor.md`

## TESTS / EVIDENCE
- JSON parses; `tsc --strict` cast to `ConsultRuleFile` → OK.
- `node docs/clinical/check-consultrules.mjs` → **50 passed, 0 failed, 12 rules**. That is 3 positives (en/it/th) and 1 tricky negative per rule, plus 2 pinned limit rows: `ไอบูโพรเฟน` must not trigger cough, and `ปวดหลังเท้า` is a known back-pain false trigger.
- Structural checks: unique ids, every question in 3 languages, every consideration starts with "Consider ". No ค่ะ/ครับ in the Thai text.
- Negative control: a deliberately wrong row was reported as FAIL, and the file was restored.
- Red-flag suite unaffected: 175/175.
- Sources verified via PubMed (metadata fetched this wave):
  - ESC 2023 ACS (Byrne) doi:10.1093/eurheartj/ehad191
  - ESC 2019 PE (Konstantinides) doi:10.1093/eurheartj/ehz405
  - Sepsis-3 (Singer 2016) doi:10.1001/jama.2016.0287
  - ESC 2018 syncope (Brignole) doi:10.1093/eurheartj/ehy037
  - ESVS 2019 AAA (Wanhainen) doi:10.1016/j.ejvs.2018.09.020
  - UK SJS/TEN guideline (Creamer 2016): PMID 27317286 via citation lookup.
  - Earlier-verified sources reused: Gulati 2021, Godwin 2019, Perry 2013.
- NICE (CG95, CG150, NG126, CG141, NG51, NG240, CG109, NG59, NG234, NG109, NG111, NG120, NG12, NG33, NG84, NG158, CKS Gastroenteritis), BTS/SIGN asthma, JBDS-IP DKA and WHO Dengue 2009 are cited **by name only**.

## ASSUMPTIONS
- `ConsultRuleFile` has no negation fields, so the engine reuses `redflags.json` `negationCues` / `negationWindowChars` and the clause rule.
- Consult rules and note evidence use **patient-attributed** turns only. Red flags run on all consult speech (fail-safe).
- The model-suggestion confidence threshold is the AI researcher's.

## RISKS
- **The "Consider" items are the claim-boundary risk.** They must stay doctor-only, keep the fixed label, and be dropped from the signed note unless the doctor keeps them. A UI that shows them in nurse mode or in any patient view breaks the claim boundary.
- STT and speaker-attribution errors can put clinician words into patient evidence. The spec treats unclear speakers as clinician for evidence. The engine must enforce that.
- Term lists miss paraphrases, and some Thai stems over-trigger (`ปวดหลังเท้า`); both are documented.
- Italian is formal and mostly gender-neutral (question text was rephrased). The Thai and Italian text still needs a native read.
- These are not a complete differential. The UI must not imply that absent items are excluded.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- CR-10: optional `negationCues` / `negationWindowChars` on `ConsultRuleFile` (today the engine borrows them from `redflags.json`).
- CR-11: a `ConsultSuggestion` reference to the question/consideration id from the rule file (only `ruleId` exists today; the id convention `CR-X-01-Q1` is in the JSON).
- Orchestrator: confirm that the Consider panel is separate from the 3-popup budget, as CONSULT-SPEC §4 proposes.

## NEXT ACTION
- AI engineer: implement the consult engine per CONSULT-SPEC §2–§6 and port the §8 rows as unit tests.
- Clinician web builder: popups (max 3), the doctor-only Consider panel with the fixed label, and a note editor with needs-check and the signing gate.
- Doctor: sign off on the EN demo consult script (chest pain or headache) before recording.
