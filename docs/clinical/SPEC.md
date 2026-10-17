# MedX: clinical spec (Doctor, v1.1.1 rules, Sat 17 Oct 2026)

Scope: what the intake must capture, when it escalates, what the nurse sees, and when it must abstain.
Contracts: `packages/shared/src/types.ts` (not edited). Rules: `packages/shared/src/redflags.json`. Tests: `docs/clinical/REDFLAG-TESTS.md`.

## 1. Intended user and setting

| Item | Spec |
|---|---|
| Primary user | Triage nurse at a walk-in clinic or ED front desk. GP reads the same summary afterwards. |
| Time budget | 2–3 min per intake; the summary must be readable in **≤ 30 s**. |
| Patient | Adult (≥ 16 y) walk-in, ambulatory, able to type on their own phone (or a companion types). May not share a language with staff (TH / IT / EN). |
| When | Before the nurse sees them: in the waiting area or on arrival. Not for patients who are already collapsed: those go straight to the desk. |
| Not for | Children as the primary subject (the infant fever rule exists only so a caregiver report is not silently missed), ambulance arrivals, follow-up visits, prescribing, discharge. |
| Data | Synthetic only in this prototype. |

## 2. Intake fields

`required` is set by the pipeline per session. Missing ≠ negative: "no allergies" must come from a patient quote; silence is `missing`.

| FieldKey | Required? | Why (one line) |
|---|---|---|
| `chief_complaint` | **Required** | Without the reason for the visit there is nothing to triage. |
| `onset` | **Required** | Time-critical conditions (stroke, ACS, SAH) depend on when it started. |
| `severity` | **Required** | Drives acuity; pain 7–10/10 changes queue position. |
| `age` | **Required** | Risk changes sharply with age; also gates the adult-only scope. |
| `allergies` | **Required** | Must be known before any drug is given; explicit "none" is a valid value. |
| `medications` | **Required** | Anticoagulants, insulin, etc. change risk and management; explicit "none" is valid. |
| `pregnancy_status` | **Conditional**: required if `sex` is female or unknown **and** age is 12–55 or unknown | Changes differential (ectopic), imaging and drug choices. |
| `sex` | Optional | Only needed to decide whether the pregnancy question applies. |
| `duration` | Optional | Usually inferable from onset; nice for the GP. |
| `location` | Optional | Useful for pain complaints; the nurse examines anyway. |
| `associated_symptoms` | Optional | Dangerous combinations are caught by the deterministic rules, not by this field. |
| `medical_history` | Optional | Useful context; not needed to triage. |

### Follow-up question priority (one question at a time, most safety-critical missing field first)

1. `chief_complaint` 2. `onset` 3. `severity` 4. `pregnancy_status` (only if conditionally required) 5. `allergies` 6. `medications` 7. `age`

Rules: never ask a follow-up after a red-flag hit (the patient goes to the desk instead). Ask at most **3** follow-ups per session, then hand over to the nurse with the rest marked `missing`. Questions are plain and short in the patient's language (e.g. "When did this start?" / "Quando è iniziato?" / "เริ่มมีอาการเมื่อไหร่คะ").

## 3. Escalation policy

**Red flags override everything.** They run first, on every new patient turn, in deterministic code. No model output, no later turn and no abstain path can clear a hit. A clinician may *acknowledge* or mark *false alarm with a reason*; both are audit events and the hit stays visible.

| | Emergency | Urgent |
|---|---|---|
| Meaning | Could be life-threatening in minutes. ESI 1–2 type. | Needs priority assessment, not routine queue. |
| Rules (v1.1) | CHEST-01, STROKE-01/02/03, BREATH-01, ANAPH-01, SUICIDE-01, BLEED-01, PREG-01, HEAD-01, SEIZ-01, MENING-01, CONSC-01 | CHEST-02, BREATH-02, SYNC-01, ABD-01, FEVER-INF-01 |
| Session status | `escalated` | `escalated` |
| Intake flow | Stops immediately. No more questions. | Stops. No more questions. |
| **Patient sees** | Full-screen calm message in their language: go to the nurse desk now and show this screen to the staff; if not at the clinic, call the emergency number (in Thailand 1669, in Italy 112, elsewhere the local number). Session code shown large. **No diagnosis, no rule name, no confidence.** Suicide/self-harm also lists support lines (TH 1323, IT Telefono Amico 02 2327 2327). | "Show this screen to the staff at the desk now. If your symptoms get worse or you feel very unwell, tell staff straight away; if you are not at the clinic, call the emergency number (1669 / 112 / local)", plus any rule safety advice (sit or lie down; do not eat or drink). **No promise of priority or of being seen first:** only staff can make that call. |
| **Clinician sees** | Top of queue, red interrupt that pushes the summary away. Rule label + action (in clinician language), the exact patient sentence highlighted, time of hit, every rule that fired. | Top of the routine queue, amber banner, same detail. |
| Multiple hits | Show all; sort by severity (emergency first). | |

Only `emergency` and `urgent` exist. Anything else is a normal intake; the system never labels a patient "non-urgent" or "safe".

## 4. What the nurse needs on ONE screen (top to bottom)

1. **Red-flag interrupt** (only if hit): severity, label, recommended action, highlighted patient quote, time. Acknowledge button.
2. **Header line:** session code · patient language · age · sex · pregnancy (if relevant) · minutes waiting · status.
3. **Chief complaint**: one line in the clinician's language, original quote one click away.
4. **Safety block:** allergies · medications · pregnancy status. Each shows `missing` loudly if not known.
5. **Present illness:** onset · duration · severity · location · associated symptoms.
6. **Background:** medical history.
7. **Not known / unverified list:** every `missing` field and every `unsupported` field (pencil style, never as fact).
8. **Follow-up asked + answer** (question in both languages).
9. **Actions:** approve field · edit · approve all · take over. Transcript drawer with highlighter links.
10. **Footer:** model + latency + "Decision support. Research prototype. Clinician confirms."

No differential diagnosis and no treatment suggestion on this screen. The tool structures what the patient said; it does not interpret it.

## 5. Abstain policy (clinical view): when the system must say "needs human review"

| Trigger | Behaviour | `abstainReason` |
|---|---|---|
| Model/provider error or timeout | No summary; nurse takes the raw (redacted) transcript. | `provider_error` |
| Output fails schema | Same. | `schema_error` |
| Chief complaint unsupported or missing after follow-ups | Abstain: a summary without a verified reason for the visit is worse than none. | `low_confidence` |
| Any **required** field below the confidence threshold set by the AI researcher | Abstain (do not show a guessed allergy/medication list). | `low_confidence` |
| Language not TH/IT/EN, or text unreadable | Abstain; nurse uses interpreter service. | `unsupported_language` |
| Patient contradicts themselves on a safety field (e.g. "no allergies" … "allergic to penicillin") | Abstain or mark field conflict; never pick one silently. | `low_confidence` (see CR-2) |
| Age < 16 as the subject | Abstain from summary (out of scope); red flags still run. | `low_confidence` (see CR-2) |
| Text looks like instructions to the system (prompt injection) | Abstain; red flags still run on the text. | `schema_error` or `low_confidence` |

Abstaining never hides or delays a red flag. Red-flag evaluation does not depend on the model at all.

## 6. Claim boundary (pitch wording)

Say:
- "MedX **supports** triage nurses: it structures what the patient said, in the nurse's language, with every field linked to the patient's own sentence."
- "Red flags are **deterministic, guideline-based rules** that run before the AI and that the AI cannot switch off. They **flag for the clinician**; the clinician decides."
- "When the system is unsure, it **says so** and hands over to a human."
- "**Research prototype**, evaluated on **synthetic** cases only. Not a medical device. Not validated for clinical use."

Never say: diagnoses, triages (on its own), decides urgency, safe to wait, replaces the nurse/interpreter, clinically validated, prescribes, "AI doctor".

## 7. Red-flag rule design notes

- 18 rules (v1.1), every rule backed by a guideline (`source` field; PubMed-verified DOIs where the source is a journal article: Gulati 2021, Powers 2019, Cardona 2020, Godwin 2019, Perry 2013).
- Bias is deliberately toward **false alarms over misses**. Known false-alarm source: bare Thai `ไม่เจ็บหน้าอก` ("no chest pain") still escalates via RF-CHEST-02. Bare Thai `ไม่` is not a negation cue (it appears inside red-flag phrases like `หายใจไม่ได้`). Known accepted false positives are listed and pinned as tests.
- `requires` is unused on purpose: it would let a model-extracted field veto a deterministic rule.
- Terms avoid known collisions: `ชักจะ` (getting worse) ≠ seizure, `เป็นลมพิษ` (hives) ≠ fainting, `แน่นอน` ≠ `แน่นอก`, `ปวดท้องได้ 2 วัน` ≠ pregnant, "I can't speak Thai" ≠ stroke, "parlo male il thai" ≠ stroke.

## 8. Contract change requests (orchestrator decides; types.ts not edited)

| ID | Request | Why | Priority |
|---|---|---|---|
| CR-1 | Optional `exclude?: string[]` per `RedFlagRule` (phrases that cancel a match), or per-language negation window | Lets Thai negation (`ไม่เจ็บหน้าอก`) be handled without the global-cue false-negative risk | Post-hackathon |
| CR-2 | Add `"out_of_scope"` and `"conflicting_information"` to `abstainReason` | Abstain reasons in §5 currently have to be squeezed into `low_confidence` | Nice to have |
| CR-3 | Optional FieldKey `reporter` ("self" / "companion") | Confusion, seizure, infant cases are usually typed by someone else; the nurse should know | Nice to have |
| CR-4 | Optional `acknowledgedBy` / `falseAlarmReason` on `RedFlagHit` (or as audit payload only) | Clinician acknowledges without deleting a hit | Can live in audit payload |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | Sat 17 Oct | 16 rules, written **before** any synthetic case existed. Frozen copy: `eval/redflags.v1.0.frozen.json`. |
| 1.1 | Sat 17 Oct (wave 2) | **Revised after seeing the 40 synthetic cases** (`data/cases/`). (1) Italian sweat stem `sudo` restored (covers `sudo freddo`, `sudore`, `sudorazione`) alongside `sudat`. (2) Italian chest-pain word-order/plural variants (`dolore forte al petto`, `forte dolore al petto`, `dolori al petto`, `dolore al torace`, …) and EN `chest is/feels tight`. (3) New RF-STROKE-02 (face/mouth word AND droop word, any order: catches `ปากผมเบี้ยว`) and RF-STROKE-03 (arm word AND cannot-lift word: catches `แขนซ้ายก็ยกไม่ค่อยขึ้น`). (4) Matcher semantics: negation does not cross a clause boundary (punctuation, but/ma/però/แต่); cues are matched with their spaces, never trimmed. Window unchanged at 14: widening it to catch "Non ho pensieri suicidi" would negate "Non so perché voglio morire", so that denial stays a pinned fail-safe false positive. |
| 1.1.1 | Sat 17 Oct (wording wave, after w9 clinical safety review) | **Patient-facing wording only; no `match`, cue, window, label or action changed** (asserted by script; 175/175 tests unchanged). Urgent messages no longer promise "seen as a priority" / `ตรวจก่อน`; they say: show this screen to staff now; if worse or very unwell tell staff at once; if not at the clinic call 1669 (Thailand) / 112 (Italy) / local number. All emergency messages name 1669 and 112 identically in th/it/en. RF-SUICIDE-01 lists support lines in all three languages: Thailand 1323, Italy Telefono Amico 02 2327 2327 (number checked on telefonoamico.it press releases; the line is not 24 h, so 112 stays alongside). Italian rewritten in formal *Lei*, gender-neutral ("Qui ci sono persone che possono aiutarla", "rimanga in posizione seduta"); Thai neutral politeness, no ค่ะ/ครับ. "Never leave the patient alone" stays in the clinician `action`. |

**Evidence caveat:** v1.1 was tuned with knowledge of the synthetic cases (IT-06, IT-12, TH-06 exposed the gaps). Red-flag recall on those 40 cases under v1.1 is therefore **not independent evidence**. Report v1.0-frozen numbers as the pre-case result, and v1.1 numbers only with this caveat. Independent evidence needs new, unseen cases written by someone who has not read the rule terms.
