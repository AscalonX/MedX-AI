# MedX: video scripts (v4, English)

Synthetic cases only. Say "supports", "suggests for review", "flags for the clinician", "research prototype". The AI never diagnoses, prescribes or decides urgency; clinicians do these in MedX with deterministic checks and an audit trail. Considerations come only from a fixed rule list. Speech goes to a cloud speech service; say so. While `/api/health` reports `provider: "mock"`, show the "mock model" label and say "Gemma on AMD is the designed target, the measurement is pending"; never present the demo as using AMD hardware, and every AMD number reads [pending AMD run] until `eval/REPORT.md` exists. Fin appears only on title, closing and patient-side frames, never next to clinical or red-flag content.

## 1. Delivered videos

| Video | File (served at) | Length, format | Source and re-render |
|---|---|---|---|
| **The 60-second film** "MedX: Every word, understood." | `apps/web/public/media/medx-promo.mp4` (`/media/medx-promo.mp4`), poster `medx-promo-poster.jpg` | 60.0 s, 1920x1080, 60 fps, H.264 + AAC original score; no voice-over, works muted | `pitch/promo/` (storyboard in `storyboard.md`, steps in `README.md`). Critic rounds 1 and 2 failed; the final render was not re-reviewed (docs/reports/w20-promo.md) |
| **The 60-second product walkthrough** "MedX in 60 seconds" | `apps/web/public/media/medx-demo.mp4` (`/media/medx-demo.mp4`), poster `medx-demo-poster.jpg`, captions `medx-demo.en.vtt` | 59.84 s, 1280x720, 25 fps, H.264, no audio; 20 captioned steps | `node scripts/record-demo.mjs --base <server> --token <DEMO_TOKEN> --video --stills` against a private `next start` (docs/reports/w20-video.md). A new cut needs a new file name (`/media/*` is cached for a year) |

The landing page plays the film first and offers the walkthrough as "Watch the full product walkthrough".

**Film story (no voice-over).** A Thai patient line from the synthetic case MED-01 → the language-gap statistic (49.1% vs 29.5%, Divi 2007, source shown) → the reveal → the journey rail: patient, nurse, doctor, pharmacist 1 verify or return, pharmacist 2 two-person check, pickup → trust beats: rules before any model, "Needs check", append-only log, "MedX prepares. People decide." → end card: "Try the live demo", medx.areazeroai.com, a QR code and "Research prototype · Synthetic data · Not a medical device".

**Walkthrough captions** (one synthetic visit, B-015, every step a real click):

| # | Persona | Caption |
|---|---|---|
| 1 | Title | MedX. Every word, understood. Multilingual pre-visit intake; Fin listens while nurses, doctors and pharmacists decide. |
| 2 to 3 | Patient | Picks a synthetic example, allergy included, and checks every word before sending. Gets a visit code. |
| 4 to 7 | Nurse | The visit arrives in the queue; signs in as a synthetic demo nurse; every field cites the patient's words; records vitals, NEWS2 suggests a level, the nurse confirms it. |
| 8 to 10 | Doctor | Keeps the rule-based considerations they agree with (not a diagnosis); signs the note; prescribing checks run as code: a penicillin allergy alert with options to review. |
| 11 to 13 | Pharmacist 1, doctor | Pharmacist 1 returns the order with a report and an option for prescriber review; the doctor resubmits clarithromycin; pharmacist 1 verifies. |
| 14 to 16 | Pharmacist 2 | Two-person rule: whoever verified cannot also dispense; six-item final check, then dispense; calls the patient to counter 2. |
| 17 | Patient | The phone shows the medicine is ready at counter 2. |
| 18 | Operations | Queue and pharmacy flow, counts only. Honest label: mock model, not AMD. |
| 19 | Case trace | Every rule check, model call and human decision, in order. |
| 20 | Closing | Research prototype. Synthetic data. Clinicians decide. Not a medical device. |

## 2. Narrated 3:00 demo (if a longer video is required)

Record the phone in the iOS Simulator or the `/patient` web export, staff pages in the browser at 1440 wide. Use the persona cards on https://medx.areazeroai.com/demo (or a local server) so each role opens a fresh synthetic case. Listening in the consult starts only after the consent box is ticked.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:15 **Problem** | Title with Fin. Fact card: "49.1% vs 29.5% physical harm in adverse events, limited-English vs English speakers (Divi 2007). 13% to 59% of patients: an unintended error in the admission medicine list." | "When patient and clinic do not share a language, communication errors become safety events, and medicine lists are often wrong. MedX follows one patient from the first words to the pharmacy counter, and every field points back to what the patient said." |
| 0:15 to 0:35 **Patient** | Phone, English. Fin reads the question aloud; the patient picks the synthetic sore-throat example (penicillin allergy), checks the words, sends; the visit code and timeline appear. | "The patient answers by voice or text. The app reads each question aloud, and the patient checks every word before sending. No advice, no diagnosis: a nurse reviews it." |
| 0:35 to 1:00 **Nurse** | Nurse persona. The "Who's signing in?" sheet, choose Nurse Anna Rossi. Click Allergies: the patient's sentence highlights. "Approve supported fields". Vitals: "Suggested triage level", then "Confirm level". | "The nurse signs in as a synthetic staff member, so every change is on the record under her name. Each field links to the patient's own words. Vitals give a NEWS2-based triage suggestion; she confirms it." |
| 1:00 to 1:25 **Doctor** | Doctor persona. Considerations card: "consider bacterial tonsillitis: check the FeverPAIN or Centor score", labelled not a diagnosis, with the NICE link; "Keep in note". Sign the note. Optional 5 s cut to the Case trace. | "The doctor sees considerations from a fixed, curated rule list with guideline links, clearly labelled as not a diagnosis, and kept only if the doctor agrees. The note is built from the patient's words; anything not found says needs check. The doctor signs it." |
| 1:25 to 1:45 **Orders and the allergy alert** | Prescribe amoxicillin 500 mg. Red "High: allergy conflict" with "Options to review" (clarithromycin, doxycycline). The doctor types a reason; submit enables only after it. | "A rule-based check, not the AI, flags the penicillin allergy and lists options to review, each checked against this patient. A high alert needs a written reason before it can be submitted." |
| 1:45 to 2:10 **Pharmacist 1** | Pharmacist 1 persona (Laura Conti). "Return to prescriber": note, the flagged alert, clarithromycin as an option for prescriber review, "Return with report". Doctor view: "Edit with clarithromycin", re-check, resubmit. Pharmacist 1: "Verify". | "The first pharmacist returns the order with a report and an option for the prescriber to review. The system never changes the order itself. The doctor decides, the order is checked again from scratch, and the pharmacist verifies." |
| 2:10 to 2:30 **Pharmacist 2 and pickup** | Pharmacist 2 persona: the two-person block for the verifier, then Nattaya Wong ticks the six-item check, "Record final check and dispense", "Call patient" to counter 2. Phone: "Please go to pharmacy counter 2 and show code". | "A second pharmacist does the final check; whoever verified cannot dispense. Then the patient's phone shows the counter and the code, never the medicine names." |
| 2:30 to 2:45 **Red flag and ops** | Patient types the Thai TH-05 sample: phone goes straight to the still "go to the desk" screen; the nurse queue shows the escalation. Ops: queue, pharmacy flow, model tile "Mock model (not AMD)". Overlay: "Keyword rules alone: 7 of 10 emergencies on a small synthetic blind set (18 cases)." | "Red-flag rules are plain code that run before any model, and no model can clear them. On a small blind set they caught 7 of 10 emergencies, so a model screen can add a flag, never remove one. The clinic manager sees the queue and the pharmacy pipeline, and the label says honestly that this demo runs a mock model; Gemma on AMD is the designed target, results pending." |
| 2:45 to 3:00 **Close** | Results line: 52 synthetic cases, 18 blind holdout, 2,436 automated tests passing; Gemma metrics [pending AMD run]. Closing frame with Fin: "MedX. Supports clinicians. Research prototype. Team MedX." | "When it is unsure, it says so and hands over to a person. Synthetic data, small sample, not clinically validated, not a medical device. MedX: every word, understood." |

## Recording notes
- About 30 words per 10 seconds. If over time, cut the ops segment first, then compress the doctor re-review; never cut the allergy alert, the two-person rule or the red-flag interrupt.
- The Thai segment needs a native-speaker check of on-screen text; Italian is secondary.
- Reset between takes: `curl -X POST -H "x-demo-token: $DEMO_TOKEN" <base>/api/demo/reset`.
- Capture tools: add `?motion=off` or use reduced motion so scroll reveals do not hide content.
