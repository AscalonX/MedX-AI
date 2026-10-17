# MedX Bridge: lablab submission copy

Track 2, Health and Wellbeing. Research prototype, synthetic data only. Items marked [TBD-METRIC] are filled from `eval/REPORT.md` after the Gemma-on-AMD run. Do not publish a number that is not in that report.

## Title options

1. **MedX Bridge** (recommended)
2. MedX Bridge: the intake a nurse can trust in 30 seconds
3. Bridge Intake

## Tagline

Multilingual pre-visit intake where every field points back to the patient's own sentence.

## Short description (max 255 characters)

Multilingual pre-visit intake for clinics. A patient writes in Thai, Italian or English; the nurse reads a summary in English, each field linked to the patient's own words. Red flags escalate to a human. Gemma on AMD. Research prototype, synthetic data.

(Character count: 253.)

## Long description

**The problem.** When a patient and a clinic do not share a language, communication errors become safety events. In six US hospitals, adverse events in patients with limited English proficiency involved physical harm in 49.1% of cases against 29.5% for English speakers (Divi et al., Int J Qual Health Care 2007). Doctors also spend 49.2% of the office day on EHR and desk work against 27.0% face time (Sinsky et al., Ann Intern Med 2016). Thailand had 32.97 million foreign tourist arrivals in 2025, so a language mismatch at the desk is routine.

**The user.** A triage nurse at a walk-in clinic, and the GP who reads the same page afterwards. They need a summary readable in 30 seconds.

**What it does.** Before the nurse sees the patient, the patient answers a short guided chat on their phone in Thai, Italian or English. The nurse gets a one-screen summary in English. Click a field and the patient's original sentence is highlighted. If a required item is missing, the patient gets one follow-up question in their own language.

**How Gemma on AMD is used.** Gemma, served on AMD Instinct GPUs (ROCm) through the hackathon Token Factory, does three jobs behind one gateway: (1) extraction and translation of the transcript into a typed JSON record with an evidence quote per field; (2) an add-only red-flag safety screen that runs in parallel with extraction; (3) generation of the next question in the patient's language. Quote verification is plain code. The Token Factory integration is pending our key; the endpoint and model id come from environment variables, and tests use a mock provider.

**Safety design (Track 2 questions).**
- *Unsupported responses:* a field without a verified quote is shown as "unsupported", never as fact.
- *Sensitive information:* patient text is redacted before storage or any model call; synthetic data only.
- *Uncertain results:* confidence is shown visually; provider error, schema error or low confidence gives "needs human review", never a guess.
- *High-risk decisions:* about 18 deterministic red-flag rules run before any model call and no model output can clear them. The Gemma screen can only add flags, shown as "model-suggested, confirm".
- *Human review:* nothing is final until a clinician approves, edits or takes over. Every action goes to an append-only audit log.

**Measurable results** (synthetic evaluation, n = 40 cases plus an 18-case blind holdout, research prototype):
- Asserted-field precision; unsupported-claim rate with vs without verifier: [TBD-METRIC]
- Red-flag recall on the blind holdout: keyword rules alone 7/10 emergencies caught, 3/8 false alarms. With the Gemma screen added: [TBD-METRIC]
- Reading load (summary / transcript words); Gemma-on-AMD latency p50 / p95: [TBD-METRIC]

**Limitations.** Synthetic cases only; small n; not clinically validated and not a medical device. It supports a clinician and never diagnoses, triages on its own or prescribes. The verifier checks that a quote exists, not that its meaning is right, so the clinician confirms. The model screen will miss some cases and raise some false alarms. Italian and Thai text needs native-speaker review.

(About 450 words.)

## Technology tags

Gemma, AMD Instinct, ROCm, AMD Token Factory, vLLM, Next.js, TypeScript, React Native, Expo, Docker, healthcare, multilingual, clinical decision support, human-in-the-loop

## Category

Health and Wellbeing (Track 2). Patient journey step: pre-visit intake and triage support.
