# MedX: deck outline (original 8-slide plan, kept for history)

> **Current deck (wave 20, Sun 18 Oct 2026):** `pitch/deck/deck.html` is the source of truth (PDF `MedX-deck.pdf`, previews `png/`), 10 slides in the v3 "calm clinical banking" look with Plus Jakarta Sans: 1 title, 2 problem (cited), 3 one journey and the patient phone, 4 nurse, 5 doctor, 6 prescribing checks and the two-stage pharmacy (pharmacist 1 verify or return with options for prescriber review, pharmacist 2 two-person dispense, pickup), 7 safety by design, 8 evidence (52 cases, 18 blind holdout, 175 red-flag and 253 medication-rule reference tests, 2,436 automated tests, 7/10 keyword recall; Gemma on AMD [pending AMD run]), 9 business case, 10 next steps and team. Live demo: https://medx.areazeroai.com. The outline below is the original wave-1 plan and its "Clinical paper" look is superseded.


Visual language at the time (superseded by DIRECTION.md v3.1): "Clinical paper": warm off-white, ink-black type, serif display, red only for urgency, no gradients, no card grids. Every number must be cited or marked [pending AMD run].

## 1. MedX
- **Message:** Every field points back to the patient's own words.
- **On slide:** MedX. Multilingual pre-visit intake that supports clinicians. Research prototype, synthetic data. AMD Developer Hackathon ACT III, Track 2.
- **Visual:** Large serif title on paper; below it one intake sheet with a single yellow highlighter stroke across a patient sentence.
- **Notes:** We built a pre-visit intake for clinics where patient and staff do not share a language. It supports the nurse; it never diagnoses. Everything you see runs on synthetic data.

## 2. Language gaps become safety events
- **Message:** Communication errors drive harm, and clinicians have no time to read.
- **On slide:** Harm in adverse events: 49.1% limited-English vs 29.5% English. Doctors: 49.2% of day on EHR and desk work, 27.0% face time.
- **Visual:** Two plain paired bars (49.1 vs 29.5) in ink and graphite, no red; source line "Divi 2007; Sinsky 2016" beneath.
- **Notes:** In six US hospitals, harmful events were more frequent for patients with limited English, and communication errors caused 52.4 percent against 35.9. Clinicians have little time to read. Thailand had 32.97 million tourist arrivals in 2025; Italy has about 5.4 million foreign residents.

## 3. The nurse, the two minutes
- **Message:** One user, one moment: the intake before the consult.
- **On slide:** Triage nurse. Walk-in clinic. 2 to 3 minutes per intake. Patient writes in Thai, Italian or English. Nurse reads English (design goal: about 30 seconds).
- **Visual:** A waiting-room line sketch; left a phone with Italian text, right a clinician sheet in English, a thin line joining them.
- **Notes:** The user is the triage nurse or GP. The two-to-three-minute figure is our design assumption, not a cited fact. The patient fills in the intake on their phone before being seen.

## 4. How it works
- **Message:** Rules first, Gemma second, human last.
- **On slide:** Redact, then red-flag rules, then Gemma on AMD (extract and translate, quote check) in parallel with safety screen, then next question, then clinician.
- **Visual:** Left-to-right flow on a ruled sheet; rules box in red outline; two parallel Gemma lanes; clinician at the end with a stamp.
- **Notes:** Text is redacted first. Deterministic rules run before any model and cannot be overruled. Gemma extracts, translates and screens; code verifies every quote. The nurse approves.

## 5. Safety by design
- **Message:** Each Track 2 safety question has a mechanism.
- **On slide:** Unsupported: pencil, never fact. Sensitive: redacted, synthetic. Uncertain: abstain. High-risk: rules plus add-only screen. Human review: approve, edit, audit.
- **Visual:** Five ruled rows, left the question, right a small drawing of the mark: pencil line, redaction bar, blank form line, red band, ink stamp.
- **Notes:** Fields without a verified quote are shown as unsupported. When unsure, the system abstains and says needs human review. Red flags are code. Nothing is final until a clinician approves, and every action is logged.

## 6. Results (synthetic)
- **Message:** We measure, including where it falls short.
- **On slide:** Blind holdout: rules alone 7/10 emergencies caught. With Gemma screen: [pending AMD run]. Precision, unsupported rate, reading load: [pending AMD run].
- **Visual:** One table, ink on paper: metric, value, n, threshold; unmet thresholds shown in the same style as met ones.
- **Notes:** We wrote the holdout without seeing the rules; rules alone missed three emergencies and raised three false alarms. That motivated the screen. All numbers are synthetic, small n, with confidence intervals. Placeholders get filled from the AMD run.

## 7. Gemma on AMD
- **Message:** Every model call is designed to go through one gateway to Gemma on AMD Token Factory (pending a key; the demo runs a mock model).
- **On slide:** Gemma via AMD Token Factory (design target). Extraction, translation, safety screen, next question. Latency p50 / p95: [pending AMD run].
- **Visual:** Architecture sketch: phone and web clients, API gateway, adapter, AMD Token Factory endpoint; latency stamp box left blank on purpose.
- **Notes:** All model calls go through one OpenAI-compatible client reading endpoint and model id from environment. Integration awaits our key; until then tests use a mock provider. Variant is chosen on a dev split by schema validity and latency.

## 8. What's next, and the team
- **Message:** Prove it on real workflows before anyone relies on it.
- **On slide:** Next: native-speaker review, clinician usability study, larger evaluation. Not a medical device. Team MedX.
- **Visual:** Short ruled checklist left; team names set in serif on the right.
- **Notes:** Next steps are validation, not features: native-speaker review of Thai and Italian, a clinician timing study, and ethics approval before any real data. Thank judges; invite questions.
