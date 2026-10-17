# MedX: lablab submission copy

Live demo: [URL pending]

Team: Team MedX. Built by a human lead orchestrating Claude (Opus/Sonnet) and OpenAI Codex agents in role-based lanes.

Track 2, Health and Wellbeing. Research prototype, synthetic data only. Items marked [pending AMD run] are filled from `eval/REPORT.md` after the Gemma-on-AMD run; do not publish a number that is not in that report. Repo: https://github.com/KingPhuripol/medx-bridge

## Title

**MedX** (mascot: Fin the dolphin)

## Tagline

One patient journey, from the patient's own words to the pharmacy. Every field points back to what the patient said.

## Short description (max 255 characters)

One patient journey, patient to pharmacist. The patient speaks or types; the nurse and doctor see fields linked to the patient's words; orders get safety checks; a pharmacist verifies. People decide. Gemma via AMD Token Factory (design). Synthetic data.

(Character count: 253.)

## Long description

**Problem.** When patient and clinic do not share a language, communication errors become safety events: in six US hospitals, adverse events in limited-English patients involved physical harm in 49.1% of cases vs 29.5% for English speakers (Divi 2007). Medication lists are fragile too: 13% to 59% of patients had an unintended error in their admission list across six studies.

**One journey, four people.** The *patient* (Thai, Italian or English; English is our main demo) answers a guided intake by voice or text and checks the voice transcript before sending. The *nurse* gets a consult assistant that listens during history-taking, keeps a live summary where each field links to the patient's sentence, and pops up "ask next" and "rule out" questions; vitals produce a NEWS2-based triage suggestion that the nurse confirms. The *doctor* gets considerations for clinical judgement (labelled "AI suggestion for clinician judgement, not a diagnosis", with workup ideas and guideline links), an evidence-linked draft note to sign, and orders with deterministic checks (allergy, interaction, duplicate, pregnancy, dose range) and a written reason to override a high alert. The *pharmacist* verifies or returns each prescription and reconciles medicines.

**Gemma via AMD.** Designed to run Gemma on AMD via the hackathon's AMD Token Factory (OpenAI-compatible, behind one gateway) for extraction and translation, an add-only red-flag safety screen, suggested questions to ask, and the next question. Safety checks are plain code. Current results use a mock model until the endpoint is connected; latency and accuracy are [pending AMD run].

**Safety.** Red-flag rules (18, deterministic) run before any model and no model can clear them. Fields without a verified patient quote show as "needs check". Low confidence or provider failure means abstain and "needs human review". The AI never diagnoses, orders, prescribes or confirms triage; clinicians do these in MedX, with deterministic checks and an audit trail. Nothing is final until a clinician approves. The nurse's triage level is a NEWS2-based suggestion she confirms; the AI never proposes drugs or doses; the doctor's "consider" items come only from a fixed, curated rule list, are doctor-only, and are dropped from the signed note unless the doctor keeps them.

**Evidence (synthetic, small n).** 52 synthetic cases (40 intake + 12 medication) and an 18-case blind holdout; 175 red-flag reference tests; 194 medication-rule tests; 1,382 automated tests passing. On the blind holdout, keyword rules alone caught 7 of 10 emergencies with 3 of 8 false alarms, which is why we added the Gemma screen. With the screen: [pending AMD run].

**Business case.** Buyers: private hospitals and clinics with international patients, and tourist-area clinics. Pains: interpreter cost and throughput (CEO/CFO), documentation time (head nurse), verifiable AI (doctors), medication errors (quality team). Next step: a measured pilot at one clinic; we claim no savings figure.

**Limitations & safety.** Research prototype that supports clinicians; the AI never diagnoses, orders, prescribes or confirms triage. Synthetic data only; not clinically validated, not a medical device. Red-flag rules run before any model and cannot be cleared by it, but miss paraphrases (7/10 emergencies on an 18-case synthetic holdout). The consult assistant's doctor-only "consider" items come from a fixed 12-presentation list, not a complete differential. The NEWS2 triage level is a suggestion for adults (not pregnancy); the nurse confirms. Prescribing checks use a small rule set (59 drugs, 18 interactions, adult dose ceilings for 31) and miss what it lacks. Speech goes to the browser's or phone's cloud speech service. Redaction is imperfect; reviewer identity is self-declared; Gemma-on-AMD is unmeasured (mock model).

## Technology tags

Gemma, AMD, AMD Token Factory, Next.js, TypeScript, React Native, Expo, voice interface, Docker, healthcare, multilingual, clinical decision support, human-in-the-loop

## Category

Health and Wellbeing (Track 2). Patient journey: intake, nurse assessment, doctor consult and orders, pharmacist verification.
