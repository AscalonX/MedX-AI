# Track 2 fit and claim review

STATUS: done — assessment only; no application changes.

> Historical review of the earlier local build. Subsequent changes replaced the
> UI fonts and removed the old font files. The font-file finding below is no
> longer an open cleanup item; see `2026-10-18-scbx-cleanup-codex.md`. Other
> implementation and AMD statements below also describe that earlier snapshot.

## Summary

MedX strongly fits Health and Wellbeing Track 2. The official brief expressly
includes patient intake, record summaries, appointment preparation, multilingual
communication and administrative workflows. The current app combines several
of these around one visit. Covering multiple roles is not prohibited by the
brief's request to improve a part of the patient journey.

The browser-reviewed implementation has visible missing/unsupported fields,
staff approval, urgent escalation and takeover, doctor-entered prescriptions,
pharmacist return, and an audit-derived case trace. These mechanisms address
the brief's five safety questions. This is an assessment against the published
wording, not organizer certification or clinical validation.

## Primary source checked

https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii

Verified 18 October 2026: Track 2 brief, technology requirement, Token Factory
FAQ, optional partner awards, original/MIT-compliant submission statement, and
submission/judging sections.

The exact safety restriction is: "The product must not present autonomous
diagnosis or treatment as medical advice."

## Findings

1. **Hard technology requirement remains unmet in this verified setup.**
   A meaningful workload must actually run on AMD and appear in the working
   judge demo. The local setup uses mock; the submission copy accurately says
   AMD integration is pending. An adapter or configured health label is not
   proof of inference. The event explicitly offers the Token Factory API route.
   Google and Evolus are optional partner awards; Evolus's own-vLLM-endpoint
   requirement should not be applied to ordinary Track 2 participation.

2. **No apparent autonomous-diagnosis/treatment contradiction in the reviewed
   flow, provided its boundary is retained.** Doctor-only considerations are
   curated suggestions, vitals produce a nurse-confirmed triage suggestion,
   doctors enter drugs/doses, and pharmacists verify or return. Interpret these
   as staff decision support. Do not frame them as AI diagnoses, AI prescribing,
   autonomous final triage, or proof of patient safety. Labels alone would not
   cure contradictory behavior. Generic urgent handoff to staff is different
   from a patient-facing autonomous diagnosis or treatment plan.

3. **Possible submission-licensing conflict.** The event asks for original,
   MIT-compliant submissions. `docs/DECISIONS.md:9` records SCBXBeta2 font
   metadata as all-rights-reserved with no licence text and acknowledges the
   redistribution issue. Those font files remain in the native assets and the
   exported patient web assets. README excludes them from its MIT grant. That
   exclusion does not establish permission to redistribute them. Obtain the
   applicable permission or replace the fonts and rebuild all exported assets
   and pitch artifacts. This review has not established a licence violation;
   it has established unresolved permission evidence.

4. **Measured benefit is still a judging gap.** The brief asks good projects to
   show measurable improvement in time, accuracy, accessibility or workload.
   The existing `eval/REPORT.md` declares a mock provider and explicitly is not
   evidence about Gemma/AMD. Automated test counts demonstrate software checks,
   not clinical efficacy or reduced staff workload. Measure at least one honest
   task-level comparison using synthetic cases and report errors and limitations.
   This is distinct from the hard AMD requirement.

5. **Keep implementation claims precise.** Quote verification checks whether
   words exist, not whether a translated/extracted value means the same thing.
   The browser-discovered "No fever" mock defect illustrates this distinction.
   Case Trace reconstructs an audit graph; its digest is not provider
   re-execution or immutable clinical evidence-version replay. Pattern-based
   redaction is imperfect, reviewer identities are self-declared, and cloud
   speech processing is disclosed. Continue the synthetic-only prototype claim.

6. **The demo needs an unbroken workflow.** The prior browser review found
   that intake approval removes onward case links. Fix that navigation before
   demonstrating the complete patient-to-pharmacist journey. This is a product
   defect, not a separate track prohibition.

## Recommended pitch boundary

"MedX helps multilingual patients describe their concerns and gives healthcare
staff a source-linked record to review, with deterministic safety checks and
human decisions throughout the visit."

Only add a claim of actual AMD execution after a successful AMD-backed case is
recorded. Avoid claiming clinical accuracy or workload savings without results.

## Files changed

This report only.

## Tests and evidence

No tests rerun for this documentation-only assessment. Read the current
README, submission/safety copy, evaluation report, licensing decision, relevant
pipeline code, asset paths and the prior local computer-use report. Prior
browser-review evidence and 1,884 passing software tests are documented in
`docs/reports/2026-10-18-local-codex.md`; they are not clinical validation.

## Assumptions, risks, open questions and next action

No live AMD inference or font-redistribution permission has been established.
No authenticated submission form or organizer private exception was inspected.
The assessment applies to the published general Track 2 rules. Next actions:
connect and demonstrate AMD, resolve the font permission, measure a bounded
benefit, and fix approval navigation. No new approval flow is required for this
read-only review.
