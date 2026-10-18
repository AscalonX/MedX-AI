# Local setup and computer-use review

STATUS: done — local setup and browser review. Open UI findings are listed below.

## Summary

Fetched main through `e049be6` into the permanent checkout at
`/Users/saltywan/KMUTT/SeniorProj/MedX-AI`. Installed the locked web dependencies
using `npm ci --ignore-scripts` and the previously populated npm cache. Node is
22.23.1. The included Expo web export runs under the Next server.

Created an ignored, mode-0600 local environment with the mock provider, automatic
synthetic seeding, random reset token, and a durable local JSON file. Added a
launcher that copies static/public assets into Next's standalone output and
binds only to `127.0.0.1:3000`. Restart instructions are in `docs/LOCAL-SETUP.md`.

## Browser workflow results

All actions were performed in the in-app browser against the local server.
No production/demo website data was changed.

| Flow | Observed result |
|---|---|
| Fresh Italian patient intake | B-012 created, submitted, appeared in clinician queue with English summary and Italian source quotes |
| Evidence review and approval | Onset selected its evidence; seven supported fields approved by the selected synthetic nurse; audit recorded the action |
| Patient status synchronization | B-012 changed from waiting to read without manual patient-page refresh |
| Fresh Thai urgent case | B-013 displayed immediate patient warning and entered the emergency queue |
| Staff urgent handoff | Acknowledgement and takeover recorded with selected nurse and reason; summary became read only |
| Urgent trace | Zero model calls, skipped extraction/screen steps, and clinician actions visible; re-derive reported identical digest |
| Pharmacy reconciliation | B-009 allergy alert initially blocked sign-off; acknowledgement enabled reconciliation according to the existing unreviewed-alert contract |
| Doctor prescription checks | Synthetic amoxicillin order raised high allergy and moderate duplication alerts; submission disabled until a high-alert override reason was entered |
| Pharmacist return | Submitted order appeared in prescription queue; required return note saved and returned status appeared in doctor queue |
| Typed consult and note | Added synthetic negative findings; discovered and corrected mock negation bug below; corrected draft then signed by selected synthetic doctor |
| Vitals and triage | Synthetic vital signs saved; NEWS2 score 0 and level-4 suggestion shown; nurse confirmation and note saved |
| Ops | 13 sessions and mock-provider label visible; mock model latency explicitly unmeasured |
| Process restart | 13 cases, B-012 approval and B-013 takeover remained visible after dev-to-production restart; local JSON retained confirmed vitals, signed consult and returned order |

Microphone permissions were not requested. The browser console had no captured
warnings or errors at the end of the reviewed workflows. The patient app was
reviewed at its narrow layout; staff pages used the default desktop layout.
No exhaustive breakpoint sweep was performed.

## Fixed: mock turns a denied symptom into a complaint

Reproduction: open B-003 doctor consult, append
`No fever or flank pain. No blood in my urine.`, then draft the note.
Before the fix, the mock changed `burning urination` to `fever`, and the note
repeated that incorrect complaint.

The mock now skips negated complaint matches using the existing clause/window
helper plus Thai denial prefixes. Rejected instruction sentences are masked
without shifting source offsets. A later affirmative occurrence of a repeated
symptom includes context so evidence does not resolve only to an earlier denial.

Twelve regression cases cover standalone English, Italian and Thai denials,
the complete consult-to-note reproduction, and affirmative mentions after a
denial. Before the fix, nine of twelve failed. All twelve passed after the fix.
The exact negative answer was repeated through the browser, the complaint stayed
`burning urination`, and the regenerated note showed that complaint and signed.

This is a bounded mock-extractor correction. It does not establish general
semantic or clinical correctness and does not change the AMD provider.

## Open UI findings

1. **P1: approval removes onward case navigation.** In
   `apps/web/app/(clinician)/review/_workspace.tsx:252`, the approved/no-flags
   receipt replaces the normal case header with only Next case and Review queue.
   Orders, Vitals, Case Trace and consult links disappear. Reproduced on B-012,
   including after switching to doctor mode. Keep persistent case navigation in
   the approved receipt, and distinguish intake approval from the ongoing visit.
   This blocks the natural patient → nurse approval → doctor workflow through
   visible controls. Existing direct endpoints still exist.
2. **P2: reviewed versus resolved pharmacy wording.** On B-009, clicking
   Acknowledge leaves the allergy alert labelled Acknowledged but changes the
   sign-off text to `Every high alert is handled` and removes the follow-up
   question. The clinical spec intentionally gates reconciliation on *review*,
   so this review did not change that policy. Change the readiness text to
   describe review rather than resolution and keep acknowledgement distinct
   from resolving a conflict. Prescribing still required its separate override.

The clinician and pharmacist UI lanes are assigned to other roles by CLAUDE.md;
these are precise change requests for those owners. No change to the clinical
review/sign-off contract was inferred from a UI review.

## Files changed

- `.gitignore`: ignore local `.data/` runtime stores.
- `.env.example`: correct POST documentation and include auto-seed, reset-token
  and store-path settings.
- `apps/web/.env.local`: ignored local configuration, not part of the diff.
- `apps/web/lib/pipeline/mock.ts`: negation and contextual-evidence correction.
- `apps/web/lib/pipeline/__tests__/browser-regressions.test.ts`: 12 regressions.
- `apps/web/lib/pipeline/__tests__/trace.test.ts`: remove a flaky privacy-test
  false positive from random opaque identifiers; content fields remain checked.
- `scripts/start-local.sh`: local standalone production launcher.
- `docs/LOCAL-SETUP.md`: restart and AMD setup instructions.
- This report and `docs/reports/screens/2026-10-18-local/*.jpg`.

## Tests and build

- Focused regressions: 12 passed; nine failed before the fix.
- Full suite after initial negation fix: **1,884 passed in 24 files**.
- Full-suite rerun after contextual-evidence refinement: 1,883 passed, one flaky
  privacy assertion failed because a random audit UUID contained `081`.
  Inspection confirmed the name and phone were redacted. The assertion now
  excludes opaque IDs/digests while checking all content fields. Focused trace
  and new-regression suites passed together (19 tests). **Final full-suite run:
  1,884 passed in 24 files**, 106.40 seconds, exit 0.
- Production build after final refinement: passed compilation, lint/type checks,
  page generation and build tracing.
- `bash -n scripts/start-local.sh`: passed.
- `git diff --check`: passed.
- Local env and JSON store confirmed ignored; local env permissions confirmed 0600.

Build/test logs: `/private/tmp/medx-local-final-build.log` and
`/private/tmp/medx-local-final-tests.log`.

## Evidence

Screenshots under `docs/reports/screens/2026-10-18-local/`:

- `01-approved-staff.jpg`, `02-patient-reviewed.jpg`
- `03-urgent-patient.jpg`, `04-urgent-trace.jpg`
- `05-pharmacy-acknowledged.jpg`, `06-prescription-blocked.jpg`
- `07-pharmacy-return.jpg`
- `08-negation-before.jpg`, `09-negation-fixed.jpg`
- `10-vitals-confirmed.jpg`, `11-ops.jpg`
- `12-production-review.jpg`: final standalone build after restart, with persisted queue

Synthetic IDs:

- B-012: `7b06a0a0-09c7-4b23-add4-9c7e64c03655`
- B-013: `9abf0d34-f8dd-4817-b2c6-8314453f0b1b`
- B-003: `082fcfe3-d3f9-4a7a-839b-8e8e0de4aa2c`
- B-009: `9f2400bd-9175-4f15-b253-c41fd7c3c9ed`

## Assumptions and limits

- "Set this up" was implemented as a local setup; no cloud account or paid
  infrastructure was created, and no GitHub push was performed.
- AMD credentials were not supplied. All browser inference used the labelled
  deterministic mock. A configured `/api/health` label alone is not proof of a
  successful AMD inference call.
- Native Expo, physical phones, cloud speech, and live AMD accuracy/latency were
  not tested. The keyword mock remains intentionally narrow.
- Local persistence is one-process JSON storage, not multi-instance deployment.
- Synthetic identities and cases were used throughout.

## Next action

Fix the approval receipt navigation before recording the complete visit demo.
Clarify pharmacy readiness wording. When the AMD credentials arrive, configure
the ignored environment, restart, and verify a successful non-escalated AMD
call through a new synthetic case before updating execution claims.
