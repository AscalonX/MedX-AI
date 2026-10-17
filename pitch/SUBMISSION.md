# MedX Bridge: lablab submission copy

Track 2, Health and Wellbeing. Research prototype, synthetic data only. Items marked [pending AMD run] are filled from `eval/REPORT.md` after the Gemma-on-AMD run; do not publish a number that is not in that report. Repo: https://github.com/KingPhuripol/medx-bridge

## Title options

1. **MedX Bridge** (recommended)
2. MedX Bridge: every field points back to the patient's own words
3. Bridge Intake

## Tagline

Multilingual intake where every field points back to the patient's own words.

## Short description (max 255 characters)

Multilingual pre-visit intake: patients speak or type in Thai, Italian or English; the nurse reads English with each field linked to the patient's words. Red flags escalate to a human; pharmacists reconcile meds. Gemma on AMD. Synthetic data.

(Character count: 242.)

## Long description

**Problem.** When patient and clinic do not share a language, communication errors become safety events: in six US hospitals, adverse events in limited-English patients involved physical harm in 49.1% of cases vs 29.5% for English speakers (Divi 2007). Medication lists are fragile too: 13% to 59% of patients had an unintended error in their admission list across six pharmacist-checked studies.

**Who it helps.** The patient (Thai, Italian or English), the triage nurse, the pharmacist, and the clinic manager.

**What it does.** A patient answers a short guided intake on their phone, by voice or text. A voice agent reads each question aloud, and the patient checks and corrects the transcript before sending. The nurse reads an English summary where every field links to the patient's own sentence. Missing items trigger one follow-up question in the patient's language. When the nurse approves, the patient's phone shows the status change. The pharmacist reconciles named medicines (brand to generic, duplicate paracetamol, allergy conflicts, interactions) from a 59-drug dictionary. The manager sees an ops dashboard: queue by urgency, escalations, abstain rate, model latency.

**Gemma on AMD.** Designed to run Gemma on AMD via the hackathon's AMD Token Factory (OpenAI-compatible), Gemma does three jobs behind one gateway: extraction and translation with a quote per field; an add-only red-flag safety screen in parallel; and the next question. Quote verification is plain code. The Token Factory key was pending at submission build time, so current results use a mock model until the endpoint is connected, and latency is [pending AMD run].

**Safety (Track 2 questions).**
- Unsupported answers: no verified quote means "needs check", never fact.
- Sensitive information: redaction before storage or any model call; synthetic data only.
- Uncertain results: confidence is shown; low confidence or provider failure means abstain, "needs human review".
- High-risk decisions: 18 deterministic red-flag rules run before any model and cannot be cleared by it. The Gemma screen only adds flags, shown as "model-suggested, confirm".
- Human review: nothing is final until a clinician approves; every action is in an append-only audit log.

**Evidence (synthetic, small n).** 52 synthetic cases and an 18-case blind holdout; 18 red-flag rules with 175 reference tests; 1,119 automated tests passing; an independent read-only review of the Codex-built engine plus QA scripts, with findings fixed under regression tests. On the blind holdout, keyword rules alone caught 7 of 10 emergencies with 3 of 8 false alarms, which is why we added the Gemma screen. With the screen: [pending AMD run].

**Limitations & safety.** Research prototype that supports clinicians; it does not diagnose, triage, treat or prescribe, and nothing is final until a clinician approves. Synthetic data only; not clinically validated, not a medical device. Deterministic red-flag rules run before any model and no model output can clear them, but keyword rules miss paraphrases (7/10 emergencies caught on an 18-case synthetic blind holdout). The add-only Gemma screen is not yet measured on AMD; current results use a mock model. Fields without a verified patient quote show as unsupported; errors or low confidence give "needs human review". Limits: redaction is pattern-based and imperfect, voice input uses Apple or Google speech services, the demo has no clinician login (reviewer identity is self-declared), and Thai/Italian text awaits native-speaker review. The verifier checks that a quote exists, not that its meaning is right.

## Technology tags

Gemma, AMD, AMD Token Factory, Next.js, TypeScript, React Native, Expo, voice interface, Docker, healthcare, multilingual, clinical decision support, human-in-the-loop

## Category

Health and Wellbeing (Track 2). Patient journey step: pre-visit intake and medication reconciliation.
