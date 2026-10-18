# w20 fixes (fixer)

## STATUS
partial. I fixed all 12 confirmed findings I could read, with tests. Some follow-up sits outside a fixer's reach:
- The 60-second video, its captions and the landing stills still show the old golden case. They need a re-record.
- The new consult rule CR-THROAT-05 needs Doctor sign-off.
- The confirmed-findings and LOW lists I received were cut off part-way, so I may not have seen every finding.

## SUMMARY
**Confirmed findings (12)**

1. **High. Pickup gate (orders.ts).** A new high alert no longer reaches the patient.
   - refreshOrders now treats a dispensed order that is not yet collected the same way as a verified one. The order goes back to "submitted" for pharmacist 1 with `recheck`. The verify record moves to `pharmacistHistory`, and `dispense` is removed from the order but kept in the audit log.
   - The `order_recheck` audit event now carries `wasDispensed` and `previousDispenser`. If the patient had already been called ("ready"), they go back to "preparing".
   - `pickupAction` runs `refresh()` first, so the re-check is saved even when the action is refused. It answers 409 "Re-check needed…" for call and collected, and has a belt-and-braces gate on any handover order with an open high alert.
   - Orders the patient has already collected are never pulled back.
   - Deviation: this replaces the tested w20 decision "(c) dispensed orders are never pulled back". That test is now "collected orders are never pulled back". A gate on its own would leave the case stuck for good, because a dispensed order cannot be verified, edited or cancelled.
2. **Medium. Cancelled follow-up (orders.ts).** A follow-up order that never reaches the patient no longer leaves the case stuck.
   - Every order write runs `restoreCollectedPickup`. When nothing waits on the pharmacy and every dispensed order was collected (per the audit), it rebuilds `pickup: collected` from the last `pickup_called` / `pickup_collected` events, counter included. The audit payload gets `pickupRestored: 'collected'`.
   - This covers both a cancel and a returned order edited back to a draft.
   - Stage, patient view and pharmacy queue now all show "collected".
3. **Medium. Intake review re-check (pipeline.ts).** `review()` now calls `refreshOrders` and `auditRechecks`. It also calls `refreshMedAlerts` when the pregnancy or allergies field is edited. A pregnancy edit re-checks a verified doxycycline order straight away (MR-PREG-01), instead of waiting for dispense.
4. **High. Consult page (_consult.tsx, new _outbox.ts).**
   - Fixture mode now only turns on when the route is missing on this server (HTML 404/405).
   - A 5xx, a 503 from the shared store or a network error keeps the last server state and shows a "needs human review" banner.
   - Every line is always POSTed with its clientTurnId and kept in an ordered outbox. A retryable failure is retried, respecting Retry-After; a 4xx refusal is final.
   - Unsaved lines show a "Not saved yet" or "Sending" chip in italics and are never shown as part of the record. A banner gives the count, with a "Send again" button.
   - Signing is blocked while any line is unsaved.
   - "Keep in note" and dismiss roll back if the save fails.
   - The fixture overlay now marks fields "unsupported", never supported.
   - `getJson` throws an `HttpError` that carries status, apiError and retryAfter.
5. **Medium. Orders, vitals and trace reads ((orders)/_lib.ts `call`).**
   - These pages no longer show sample data on 5xx, network errors or 404 "Session not found". The server's message is thrown, and the pages keep their last real data.
   - Fixtures are used only when the route is missing, or when the page is opened with `?fixtures=1`.
   - The pharmacy queue no longer shows fixture cases when its first load fails (unless `?fixtures=1` is set).
6. **Medium. Snapshot cap (store.ts).** When the snapshot is still over 2 MB after the 24 h prune, `capped()` prunes per-visitor demo-start sessions that have been idle for 90 minutes or more, oldest first, until it fits. Seeded cases, sessions written in the same commit and all audit events stay.
7. **Medium. Golden demo case (claims-safety).** DEMO-GOLD is now an uncomplicated sore throat.
   - New patient text: "…sore throat for two days and I can see white spots on my tonsils. It hurts to swallow…". The one-sided pain and trismus are gone, so CR-THROAT-03 (quinsy) no longer fires.
   - New consult rule CR-THROAT-05 (consultrules 1.3): "Consider bacterial tonsillitis: check the FeverPAIN or Centor score", from NICE NG84, with no workup. It has fire/no test rows in CONSULT-SPEC.md §13.
   - The demo now keeps `consider:CR-THROAT-05:CR-THROAT-05-C1`, and the investigations are a throat swab instead of FBC and CRP.
   - Synced: DEMO_SAMPLES, seed comment, e2e-journey.mjs (asserts no CR-THROAT-03), VIDEO-SCRIPT.md beat, and tests.
8. **Medium. Open Graph image.** The new source is `pitch/cover/cover-v5-og.html` and the renderer is `pitch/cover/render-og.mjs`.
   - The chip next to Fin now reads "Sent. A nurse will review." instead of "chest pain".
   - A "Research prototype · Synthetic data only" pill is added.
   - The "Gemma on AMD" chip row is left out (no model claim).
   - Re-rendered to `apps/web/app/opengraph-image.png` at 1200x630, with updated alt text.
9. **Medium. Thai "Try saying" sample.** TH-01 is added to DEMO_SAMPLES (verbatim). The landing TRY_SAYING list is built only from DEMO_SAMPLES, and the patient web export is rebuilt, so `/patient/?new=1&lang=th&sample=TH-01` prefills the Thai sentence.
10. **Medium. Sign-out notice.** `<SignedOutNotice>` is mounted once in DemoHub, so `/demo?signedOut=1` shows the notice and removes the flag from the URL.
11. **Medium. Demo launcher.** The launcher writes `medx.demo.case` for a fresh case and removes it otherwise (`rememberPersonaCase`). DemoGuide's "Open my demo case" now only offers the visitor's own case for the current persona.
12. **Medium. SegmentedControl.** `activation="manual"` makes arrow, Home and End move focus only; Enter, Space or a click selects.
    - Used by: the marketing nav language control, the AppShell role switch and the clinician sign-in role switch.
    - The ops shell role switch got the same behaviour.
    - The pure helper `segmentKeyTarget` is unit tested.

**LOW items done**
- **record-demo.mjs:** the ops caption is built from /api/health. It says "mock model, not AMD" only when health reports provider mock; an AMD provider that is not configured fails the recording.
- **copy.ts (en, th, it):**
  - "Under the hood" subtitle: only the model label is live; the Neon chip is qualified as "on the public demo".
  - "Try a role" subtitle: each role now opens a fresh synthetic case.
  - New limitation: the daily 03:00 ICT reset clears demo cases and their audit log.
  - Ops and considerations alt texts now match the current stills (I checked both images).
- **Clinician queue:** Fin and "No intakes yet" show only when the queue is truly empty. When the filter hides every case, a neutral "No cases match this filter" appears with a "Show all cases" action.
- **Staff home:** Fin removed from the hero above the red Escalated tile.
- **Editing a returned order** keeps its `pharmacistHistory`.

**LOW item tried and reverted:** "a draft's alert should not block pharmacist 1 verify". This contradicts `wave12.test.ts` "rechecks new interactions at verify and blocks stale overrides". That test asserts a 409 when an interacting draft exists, which is the more conservative, fail-closed rule. I reverted it and listed it as an open question.

**LOW items not done:** "mark scripted demo steps in the audit" (not cheap: it needs an AsyncLocalStorage context plus trace and audit UI labels), and the cut-off "The seed never resume…" item.

## FILES CHANGED
- Engine:
  - `apps/web/lib/pipeline/orders.ts`
  - `apps/web/lib/pipeline/pipeline.ts`
  - `apps/web/lib/pipeline/store.ts`
  - `apps/web/lib/pipeline/seed.ts` (comment only)
- Engine tests:
  - `apps/web/lib/pipeline/__tests__/pickup-cycle.test.ts`
  - `apps/web/lib/pipeline/__tests__/store-remote.test.ts`
  - `apps/web/lib/pipeline/__tests__/demo-entry.test.ts`
  - `apps/web/lib/pipeline/__tests__/approved-consult.test.ts`
  - `apps/web/lib/pipeline/__tests__/contracts.test.ts`
- Clinician:
  - `apps/web/app/(clinician)/review/_lib.ts`
  - `apps/web/app/(clinician)/review/_queue.tsx`
  - `apps/web/app/(clinician)/review/_i18n.ts`
  - `apps/web/app/(clinician)/review/[id]/consult/_consult.tsx`
  - `apps/web/app/(clinician)/review/[id]/consult/_c18n.ts`
  - `apps/web/app/(clinician)/review/[id]/consult/_fixture.ts`
  - `apps/web/app/(clinician)/review/[id]/consult/_outbox.ts` (new)
  - `apps/web/app/(clinician)/review/[id]/consult/_outbox.test.ts` (new)
  - `apps/web/app/(clinician)/_frame.tsx`
- Orders, pharmacy and ops:
  - `apps/web/app/(orders)/_lib.ts`
  - `apps/web/app/(orders)/orders-lib.test.ts`
  - `apps/web/app/(pharmacy)/_shell.tsx`
  - `apps/web/app/(pharmacy)/_lib.ts` and `_orders.tsx` (net no change after the revert; line endings normalised)
  - `apps/web/app/(ops)/components/OpsShell.tsx`
- Landing and demo:
  - `apps/web/app/demo/DemoHub.tsx`
  - `apps/web/app/demo/[persona]/Launcher.tsx`
  - `apps/web/app/_landing/demo.ts`
  - `apps/web/app/_landing/data.ts`
  - `apps/web/app/_landing/copy.ts`
  - `apps/web/app/_landing/landing.test.ts`
  - `apps/web/app/_shared/DemoGuide.tsx`
  - `apps/web/app/_shared/signout.test.ts`
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/layout.tsx` (comment only)
  - `apps/web/app/patient-stamp.test.ts`
  - `apps/web/app/opengraph-image.png`
  - `apps/web/app/opengraph-image.alt.txt`
- UI kit:
  - `apps/web/components/ui/SegmentedControl.tsx`
  - `apps/web/components/ui/MarketingNav.tsx`
  - `apps/web/components/ui/AppShell.tsx`
  - `apps/web/components/ui/ui.test.ts`
- Shared contracts (orchestrator-owned; changed under the fixer remit):
  - `packages/shared/src/demo.ts`: DEMO-GOLD text and label, TH-01 sample.
  - `packages/shared/src/consultrules.json`: 1.3, CR-THROAT-05.
  - `packages/shared/src/types.ts`: comments only.
- Mobile: `apps/mobile/src/samples.ts` (comment), and the `apps/web/public/patient/**` export rebuilt with `scripts/build-patient-web.sh`.
- Data and clinical docs:
  - `data/cases/DEMO-GOLD.json`
  - `docs/clinical/CONSULT-SPEC.md` (header version and §13 with test rows)
- Scripts and pitch:
  - `scripts/e2e-journey.mjs`
  - `scripts/record-demo.mjs`
  - `pitch/VIDEO-SCRIPT.md` (doctor beat)
  - `pitch/cover/cover-v5-og.html` (new)
  - `pitch/cover/render-og.mjs` (new)

## TESTS RUN + RESULTS
All run from `apps/web` unless noted.
- **Baseline before my changes:** `vitest run` gave 50 files, 2402 tests, all passed.
- **Final:** `./node_modules/.bin/vitest run` gave 51 files, 2436 tests, all passed. That is 34 more tests and one new file.
- `./node_modules/.bin/tsc --noEmit -p .`: exit 0.
- `./node_modules/.bin/eslint` on every changed web file: exit 0, no output.
- Clinical checkers, from the repo root:
  - check-consultrules: 87 passed, 0 failed, 51 rules (it was 50 rules).
  - check-medrules: 253 passed.
  - check-redflags: 175 passed.
  - check-vitalrules: all passed.
- `node --check` on record-demo.mjs, e2e-journey.mjs and render-og.mjs: OK.
- `bash scripts/build-patient-web.sh`: exit 0. New `source.sha` is 022b28b9…; the bundle contains "TH-01" and the new golden sentence. The patient-stamp test passes.
- **One intermediate failure:** wave12 "rechecks new interactions at verify…" failed on the draft-alert LOW change. I reverted that change; the final run is green.
- **Not run:** next build, next start, e2e-journey or record-demo against a live server (the task forbids next build, dev and start). The video, VTT and stills were not re-recorded.

## EVIDENCE
- **Pickup gate, new tests in pickup-cycle.test.ts.** These tests:
  - state an allergy after dispense and after the patient is called, then check that the order is back to submitted, has no `dispense`, has a `pharmacistHistory` entry and an `order_recheck` with `wasDispensed`, that the patient view shows "preparing", and that the API returns 409 for both call and collected;
  - make the stale checks unrefreshed, then check that "collected" is refused, the re-check is saved and no `pickup_collected` is written;
  - check that collected orders are never pulled back.
- **Cancel and restore:** stage `collected`, patient view `{status:'collected'}`, and the call answers 409 "Medicines already collected". A returned order edited to a draft restores counter 4. Cancelling while medicines are uncollected keeps the call open.
- **Intake review:** a pregnancy edit gives MR-PREG-01 high, and the last two audit events are `review` then `order_recheck`.
- **Snapshot cap:** 30 idle demo-start cases of about 90 kB each plus a fresh and a seeded one. After the flush the row is ≤ 2 MB, only the oldest idle cases are dropped, and the fresh and seeded cases stay. Cases active within 90 minutes are never pruned. Both fake Neon and fake Upstash pass.
- **Consult and orders reads:** `_outbox.test.ts` covers 503 with Retry-After 5, 404 API vs HTML 404, network error, 4xx final and ordering. `orders-lib.test.ts` covers `call()` throwing on 503, 404 JSON, 500 and network errors, falling back only on HTML 404 or `fixtures`, and writes never falling back.
- **Golden case:** a mock-provider probe (scratch, outside the repo) showed the new text reaches awaiting_review with chief complaint "sore throat", onset, severity, medications, allergies (penicillin) and age all supported, and no red flags. Doctor suggestions no longer include CR-THROAT-03. demo-entry.test checks that CR-THROAT-05 is kept (status asked), appears in the signed note's considerations, and that the investigations are `['throat_swab']`.
- **OG image:** I viewed the new 1200x630 PNG. It has no "chest pain", no "Gemma on AMD", and has the synthetic-data pill.

## ASSUMPTIONS
- Pulling a dispensed but uncollected order back to pharmacist 1 is the intended reading of "never reaches the patient unreviewed". A gate alone would leave the case stuck: a dispensed order cannot be verified, edited or cancelled.
- The restored pickup is rebuilt from the append-only audit log (`pickup_collected` and `pickup_called`). No contract field was added.
- 90 minutes of idleness is the bar for pruning a demo-start case for size.
- The ops-shell and landing language switches navigate, so they use manual activation. In-place toggles (staff language, consult speaker, trace view) keep auto activation.
- Throat swab is a reasonable synthetic-demo investigation for this presentation. FBC and CRP belonged to the quinsy workup.

## RISKS
- **The video and stills are out of date.** `apps/web/public/media/medx-demo.mp4`, its poster and the landing stills (hero-consult, consult, nurse-case and others) still show the old "worse on one side … can't open my mouth fully" transcript and the "Peritonsillar abscess" card. The VTT cues are generic, so the text track is still accurate. The record-demo script needs no code change for the new case: the consideration card still appears and is kept.
- **CR-THROAT-05 is clinical content I wrote as the fixer.** It is clearly labelled in CONSULT-SPEC §13 and in the rule's `source`. The Doctor should confirm the terms and wording.
- **Shared store snapshots** taken before this change still hold sessions whose dispensed, uncollected orders have stale checks. They are re-checked on the next write or pickup action, which is the intended behaviour.
- **Line endings:** my Python edits briefly wrote CRLF. I normalised every touched file back to LF; `.gitattributes` has eol=lf.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Orchestrator:** confirm the change to w20 decision (c). A dispensed order the patient has not collected is now sent back to pharmacist 1 on a new high alert, and the pickup re-checks first. The test was renamed to "collected orders are never pulled back".
- **Orchestrator:** shared changes made under the fixer remit:
  - DEMO_SAMPLES: DEMO-GOLD text and label, and TH-01 added.
  - consultrules 1.3 with CR-THROAT-05.
  - types.ts comments.
- **Doctor:** sign off CR-THROAT-05 and the new DEMO-GOLD presentation and pathway: uncomplicated sore throat with tonsillar exudate, amoxicillin, return for penicillin allergy, then clarithromycin 500 mg twice daily for 5 days, plus a throat swab.
- **Doctor or orchestrator:** should an alert that involves a draft still with the prescriber block pharmacist 1's verify? Today it does: wave12 asserts 409, while refreshOrders waits for the draft. I kept the conservative rule.
- **Video agent:** re-run `scripts/record-demo.mjs` (video and stills) on the new golden case. The ops caption now comes from /api/health.
- **Possibly unseen findings:** the confirmed-findings list I received was cut off after finding 12 (SegmentedControl), and the LOW list was cut off at "The seed never resume…". There may be findings I did not see.

## NEXT ACTION
- **Orchestrator:** review and commit; then run `next build` and `scripts/e2e-journey.mjs` against a live server. e2e-journey now expects CR-THROAT-05 and a throat swab, and checks that CR-THROAT-03 never fires.
- **Video agent:** re-record the video and stills.
- **Doctor:** sign off CR-THROAT-05.
