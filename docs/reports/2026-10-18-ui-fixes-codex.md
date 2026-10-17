# Application bug fixes and responsive UI review

STATUS: done — application fixes implemented, browser verified and tests passed.

## Summary

The user clarified that the requested updates were code fixes and UI improvements.
This authorizes the clinician, pharmacy and shared UI edits below despite the
folder ownership lanes in CLAUDE.md. The checkout remains on main at 94d0c4e,
with the prior local setup and mock-extractor fixes preserved. No slide edits,
commit or push were made in this task.

Fixed four application issues:

1. Approved intakes lost onward navigation. The approved receipt now retains
   Case Trace, Vitals, doctor-only Orders, Queue, Next case and the narrow-screen
   Patient's words drawer. Doctors can see nursing vitals through their existing
   read-only page. Approval does not reopen the patient or consult transcript.
2. Strict Mode effect cleanup could invalidate the initial queue request while
   leaving the single-flight guard set, delaying the next load until polling.
   Cleanup now releases that guard; obsolete requests cannot release a newer
   request's guard.
3. Pharmacy acknowledgement hid the follow-up question, removed resolution
   controls and implied that every high alert was handled. Acknowledged alerts
   now retain their high-alert styling, queue badge, follow-up questions and
   Resolved / False alarm controls. Readiness copy describes review, and explains
   reconciliation sign-off separately from alert resolution and prescription
   approval. Required-review counters still count unreviewed alerts; the backend
   sign-off policy is unchanged.
4. Fixed-width field labels and editing inputs clipped values and approval
   labels on phones. Field rows stack below the small breakpoint; value/status
   content wraps, and editing inputs and actions fit the available width.

## Files changed in this task

- apps/web/app/(clinician)/review/_shell.tsx
- apps/web/app/(clinician)/review/_workspace.tsx
- apps/web/components/ui/PencilField.tsx
- apps/web/app/(pharmacy)/_lib.ts
- apps/web/app/(pharmacy)/_queue.tsx
- apps/web/app/(pharmacy)/_workspace.tsx
- apps/web/app/(pharmacy)/review-status.test.ts
- This report and docs/reports/screens/2026-10-18-ui-fixes/*.jpg

Earlier uncommitted setup, mock extraction and test changes are documented in
2026-10-18-local-codex.md. The requested pull is documented in
2026-10-18-pull-review-codex.md.

## Tests run and results

- Three new integration regressions passed: acknowledgement retains follow-up
  while satisfying the existing review gate; acknowledgement can progress to
  resolved or false alarm while preserving both audit events.
- Full suite: **1,887 tests passed in 25 files**, 107.76 seconds, exit 0.
  Log: /private/tmp/medx-ui-tests.log.
- Production build passed compilation, lint/type checking, all 11 static pages,
  optimization and tracing. Log: /private/tmp/medx-ui-build.log.
- git diff --check: passed.

## Browser evidence

Computer-use review used the local synthetic dataset in the in-app browser.

| Check | Observed result |
|---|---|
| Approved B-012, nurse and doctor | Persistent navigation; Orders appears for doctor; Vitals remains available |
| Doctor Orders after approval | Actual order page reached; drug input enabled |
| Doctor Vitals | Nursing vital signs remain read only |
| 1024 px evidence drawer | Patient's words opens; Escape closes and returns focus to its opener |
| 390 px approved fields | Chief complaint and approver label fully readable; measured field clientWidth 324 and scrollWidth 324 |
| 390 px unapproved field editor | Input, Save and Cancel visible within card; cancel left B-004 unchanged |
| Acknowledged B-009 allergy alert | High alert badge, patient follow-up question and resolution actions remain visible |
| False alarm form | Blank note disables Save; cancelled without changing the record |
| Acknowledgement to resolution | Synthetic QA note saved; follow-up question clears; audit shows acknowledgement and later resolution |
| Production restart | B-009 resolution and B-012 approval persisted; restored navigation visible in built app |

Screenshots under docs/reports/screens/2026-10-18-ui-fixes/:

- 01-approved-navigation.jpg
- 02-approved-evidence-tablet.jpg
- 03-approved-phone.jpg
- 04-phone-editor.jpg
- 05-acknowledged-alert.jpg (full page)
- 06-alert-resolved.jpg
- 07-production-approved.jpg

The browser captured no application errors during the reviewed flows. One
expected development Fast Refresh warning occurred when a shared helper changed.
Viewport overrides were reset to the default desktop size after testing.
The final standalone production server is bound to 127.0.0.1:3000.

## Assumptions, risks and open questions

- All cases, reviewers and medication actions used synthetic demo data.
- Existing deterministic rules, abstention, evidence verification, approval
  gates and append-only audit contracts were preserved.
- AMD credentials remain absent. The running app clearly uses the mock provider;
  no live AMD execution or clinical validation is claimed.
- Native Expo, physical devices, microphone/speech, authentication and cloud
  deployment were not tested by this task. Responsive checks covered desktop,
  1024 px and 390 px, not every browser and breakpoint.
- Reconciliation acknowledgement satisfies the existing review gate but does
  not resolve an alert. Changing that clinical policy is outside this UI fix.
- No contract change requests.

## Next action

Review the local app and diff. Configure and verify real AMD inference when
credentials are available. Changes are local and uncommitted.
