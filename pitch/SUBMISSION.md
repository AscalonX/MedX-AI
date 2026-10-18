# MedX: lablab submission copy

| Field | Value |
|---|---|
| Live demo | https://medx.areazeroai.com (pick a role: https://medx.areazeroai.com/demo) |
| Video: 60-second film | https://medx.areazeroai.com/media/medx-promo.mp4 (repo: `apps/web/public/media/medx-promo.mp4`) |
| Video: 60-second product walkthrough | https://medx.areazeroai.com/media/medx-demo.mp4 (repo: `apps/web/public/media/medx-demo.mp4`, English captions `medx-demo.en.vtt`) |
| Repo | https://github.com/KingPhuripol/MedX-AI |
| Deck | `pitch/deck/MedX-deck-v2.pdf` (34 slides; its test count and "live demo URL pending" predate the launch wave and need a refresh. The PDF and `png-v2/` previews were rendered with SCBXBeta2, which this branch removed for licence reasons: `deck-v2.html` and `build-v2.py` now use Plus Jakarta Sans + Noto Sans Thai, so re-render before submitting). Earlier deck: `pitch/deck/MedX-deck.pdf` |
| Cover | `pitch/cover/cover-v6.png` (1600x900; no model claim, no clinical term next to Fin) |
| Team | Team MedX. Built by a human lead orchestrating Claude (Opus and Sonnet) and OpenAI Codex agents in role-based lanes. |
| Track | Track 2, Health and Wellbeing |

Research prototype, synthetic data only. Items marked [pending AMD run] are filled from `eval/REPORT.md` after a Gemma-on-AMD run; never publish a number that is not in that report. While `/api/health` on the live demo reports `provider: "mock"`, do not claim the demo uses AMD hardware.

## lablab form (copy-paste, fits the form limits)

**Submission Title** (≤50, 47 chars): MedX: Multilingual AI Copilot for Clinic Visits

**Short Description** (≤255, 253 chars):

MedX turns a multilingual patient conversation into an evidence-linked case: patient app with voice, nurse and doctor consult assistant, prescribing checks and two-pharmacist dispensing. Every field points back to the patient's own words. People decide.

**Long Description** (600–2000, 1968 chars; 1981 if the form counts each line break as two):

Problem: when patient and clinic do not share a language, communication errors become safety events. In six US hospitals, adverse events in limited-English patients caused physical harm in 49.1% of cases vs 29.5% for English speakers (Divi 2007), and 13-59% of admission medication lists contain unintended errors.

MedX follows one patient journey, five roles:
- Patient (Thai, Italian or English) answers a guided intake by voice or text and confirms the transcript before sending; the phone later shows the pickup counter, never drug names.
- Nurse: a consult assistant listens during history-taking, links every summary field to the patient's own sentence, and suggests "ask next" and "rule out" questions. Vitals give a NEWS2-based triage suggestion the nurse confirms.
- Doctor: doctor-only considerations from a fixed rule list (not a diagnosis) with guideline links, an evidence-linked draft note to sign, and orders with deterministic checks (allergy, interaction, duplicate, pregnancy, dose range). Overriding a high alert needs a written reason.
- Pharmacist 1 verifies each prescription or returns it to the prescriber with a report; Pharmacist 2, a different person, does the final check and dispenses.
Every case has a Case trace of rule checks, model calls and human decisions. Live demo (six synthetic roles): https://medx.areazeroai.com

AMD: designed to run Gemma via the AMD Token Factory (OpenAI-compatible) for extraction, translation, an add-only red-flag screen and follow-up questions. The demo runs a mock model until it is connected.

Safety: 18 deterministic red-flag rules run before any model and cannot be cleared by it; fields without a verified patient quote show "needs check"; failures go to human review; the AI never diagnoses, orders, prescribes or confirms triage. 2,451 automated tests, 52 synthetic cases and an 18-case blind holdout.

Research prototype with synthetic data only; not clinically validated, not a medical device.

**Participation Mode:** Online · **Track:** Health and Wellbeing (Track 2) · **Technologies:** Gemma, AMD, Next.js, TypeScript, React Native, Expo, Neon Postgres, Vercel

---

## Title

**MedX** (mascot: Fin the dolphin)

## Tagline

Every word, understood. One patient journey, from the patient's own words to the pharmacy counter.

## Short description (max 255 characters)

Multilingual pre-visit intake: patients speak Thai, Italian or English, every field cites their words, red flags are code, and a nurse, a doctor and two pharmacists decide. Gemma on AMD is the designed target; the demo runs a mock model. Synthetic data.

(Character count: 253, checked with Node `String.length`.)

## Long description

**Problem.** When patient and clinic do not share a language, communication errors become safety events: in six US hospitals, adverse events in patients with limited English involved physical harm in 49.1% of cases, against 29.5% for English speakers (Divi et al. 2007). Medicine lists are fragile too: across six pharmacist-checked studies, 13% to 59% of patients had an unintended error in their admission medicine list. And doctors spend 49.2% of the office day on EHR and desk work, against 27.0% with patients (Sinsky et al. 2016).

**One journey, one record.** The *patient* tells Fin what brings them in, by voice or text, in Thai, Italian or English (English is the default), and checks every word before sending. The *nurse* sees a summary where every field links to the patient's own sentence, a consult assistant that listens during history-taking (after a recorded consent step) and pops up "ask next" and "rule out" questions, and a NEWS2-based triage suggestion the nurse confirms. The *doctor* gets doctor-only considerations from a fixed curated rule list (labelled "not a diagnosis", with guideline links), an evidence-linked draft note to sign, and orders with deterministic checks (allergy, interaction, duplicate, pregnancy, dose range); a high alert needs a written reason and lists options to review from a sourced alternatives table. **Pharmacist 1** verifies, or returns the order with a report and options for prescriber review; the system never writes an option into the order. **Pharmacist 2**, a different person, completes a six-item final check and dispenses; the server refuses the pharmacist who verified. The patient's phone then shows the pickup counter and code, never drug names. The clinic manager sees the queue, escalations, abstentions and the pharmacy pipeline, and every case has a trace of each rule check, model call and human decision.

**Try it.** Six synthetic roles on the landing page (Patient, Nurse, Doctor, Pharmacist 1, Pharmacist 2, Clinic operations). Each card signs you in as that person; staff cards open a fresh synthetic case at their step.

**Gemma via AMD.** All model calls (extraction and translation, an add-only red-flag safety screen, the next question, medication extraction) are designed to run on Gemma through the hackathon's AMD Token Factory, behind one OpenAI-compatible client with JSON-schema output, a per-call timeout and one repair retry. Safety checks are plain code. The live demo runs a deterministic mock model until the endpoint is connected, and says so: its model label is read from `/api/health`. Accuracy and latency on AMD: [pending AMD run].

**Safety.** 18 deterministic red-flag rules run before any model and no model can clear them; a hit stops the intake with zero model calls. Fields without a verified patient quote show "Needs check", never as fact. Provider failure, schema failure or low confidence means abstain and "needs human review". The AI never diagnoses, prescribes or decides urgency; nothing is final until a clinician approves, and every action goes to an append-only audit log. Raw patient text is redacted before storage or any model call. The public URL has security headers, a rate limit and role checks on clinical writes.

**Evidence (synthetic, small n).** 52 synthetic evaluation cases (40 intake in three languages + 12 medication) and an 18-case blind red-flag holdout written without seeing the rules. Clinical rule checks: 175 red-flag, 253 medication-rule and 87 consult-rule reference tests, all passing. 2,451 automated tests passing (vitest, 53 files). End-to-end journey script against a real server: 113 of 113 steps passed in its last recorded run. On the blind holdout, keyword rules alone caught 7 of 10 emergencies with 3 of 8 false alarms, which is why the add-only model screen exists. With the screen on Gemma: [pending AMD run].

**Business case.** Buyers: private hospitals and clinics with international patients, and clinics in tourist areas (Thailand had 32.97 million foreign tourist arrivals in 2025). Pains: interpreter cost and throughput (CEO, CFO), documentation time (head nurse), AI they can verify (doctors), medication errors (quality team). Next step: a measured pilot at one clinic; we claim no savings figure.

**Limitations and safety.** Research prototype that supports clinicians; the AI never diagnoses, prescribes or decides urgency. Synthetic data only; not clinically validated, not a medical device. The demo runs a mock model; Gemma on AMD is unmeasured. Red-flag rules run before any model and cannot be cleared by it, but miss paraphrases (7 of 10 emergencies on an 18-case synthetic holdout). Considerations come from a fixed 12-presentation list, not a complete differential. The NEWS2 triage level is a suggestion for adults (not pregnancy); the nurse confirms. Prescribing checks use a small rule set (59 drugs, 18 interactions, adult dose ceilings for 31) and miss what it lacks. Speech goes to the browser's or phone's cloud speech service. Redaction is pattern-based and imperfect. Reviewer identity is self-declared, so the two-person dispense check is procedural, not authenticated. Thai and Italian text needs native-speaker review. The public demo resets daily at 03:00 ICT.

## Technology tags

Gemma, AMD, AMD Token Factory, Next.js, TypeScript, React Native, Expo, Neon Postgres, Vercel, voice interface, healthcare, multilingual, clinical decision support, human-in-the-loop

## Category

Health and Wellbeing (Track 2). Patient journey: intake, nurse assessment, doctor consult and orders, two-stage pharmacy check and dispensing, patient pickup.
