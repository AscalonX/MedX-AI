# W19 Pharmacist web: two-stage pharmacy (verify, dispense, pickup)

## STATUS
done. One gap: I could not click through it in a running browser against the live server (see RISKS). Rendering, request shapes and server refusals were verified another way, described under TESTS.

## SUMMARY
`/pharmacy` now follows the flow from the team lead's video: doctor sends the order, pharmacist 1 checks it (or returns it with a report), pharmacist 2 picks the medicine and does the final double check, then the pharmacist calls the patient to collect. Rules and alternatives are decision support only. A person makes every decision, and the server writes every action to the audit log.

1. **Queue by stage.** The "Prescriptions" tab now opens first and remembers the viewer's choice in localStorage. It has stage pills with counts:
   - To verify (orders submitted);
   - To dispense (orders verified);
   - To call (every active order dispensed, patient not called yet);
   - Ready for pickup (`pickup.status = ready`);
   - Collected today.

   Verify and dispense are counted per order; the pickup stages per patient. This matches `OpsMetrics.pharmacy`. The stat tiles on top switch to the stage counts while the Prescriptions tab is open.
   - "To call" is an extra stage beyond the four requested. Without it, a patient whose orders are all dispensed but who has not been called would appear in no list.
   - Dispense rows show "Verified by <name>, <time>". When the signed-in pharmacist is the verifier, the row shows the amber chip "You verified it: needs a second pharmacist".
2. **Stage 1, verify (pharmacist 1).**
   - Each submitted order shows its deterministic checks, as before.
   - Under any alert that has `alternatives`, a neutral inset panel titled "Options for prescriber review" shows the generics. It also shows the curated medrules note (matched with the same rule as the engine), the line "Not a prescription … listed does not mean checked safe. The prescriber decides.", and a collapsible source.
   - The Verify rule is unchanged: a high alert without a prescriber override blocks it, with a visible reason.
   - **Return to prescriber** opens a form with:
     - a required note;
     - "Alerts to raise", with high alerts preselected;
     - "Options for prescriber review (optional, up to 5)", listing the alerts' alternatives plus any dictionary generic the pharmacist adds (datalist, validated against the dictionary, never the ordered generic, at most 5).

     It POSTs `alertIds` and `suggestedGenerics`.
   - A returned order shows the note, the alerts raised and the suggestions, labelled "Options for prescriber review, not a prescription", plus "Waiting for the prescriber to review, edit or cancel the order".
3. **Stage 2, dispense (pharmacist 2).**
   - A verified order shows "Verified by <name> at <time>".
   - If the signed-in pharmacist is the verifier, dispensing is replaced by an amber explanation of the two-person check. It has a "Sign in as <other pharmacist>" button, which changes the self-declared identity used for all actions.
   - Otherwise it shows six separate checkboxes, all starting unticked, with no "select all". Each has its own label and a hint from PHARMACY-SPEC §9.2:
     - Right patient, with the patient code shown;
     - Right drug, with the verified order shown;
     - Right dose;
     - Right route;
     - Allergies re-checked, with the recorded allergies shown (amber when they are unverified, not stated, or the summary abstained);
     - Labelled.
   - Below the boxes: an optional note, and "Record final check and dispense", enabled only when all six are ticked, with an "n of 6 confirmed" counter. It POSTs `/dispense`.
   - A dispensed order shows "Dispensed by <name>, <time>. All six final checks confirmed."
4. **Pickup card** (session page, `#pickup`).
   - The patient code is shown large.
   - While any active order is not dispensed, "Call patient" is disabled and the card lists what is still open: to verify n, to dispense n, n with the prescriber.
   - When everything is dispensed, the pharmacist picks Counter 1, 2 or 3 and clicks "Call patient".
   - Once called, the card shows the code and the counter large, plus "Called by … (waited)". The actions are "Mark collected" and "Call again" (a re-call, with a counter choice).
   - Collected shows a teal receipt: handed over by, called by, counter.
   - If an order arrives after collection, an amber note says the system cannot call the patient again.
   - The hero shows a "Ready for pickup, counter N" or "Collected" badge.
5. **Copy.** "Nothing is dispensed from this screen" is replaced by: "Next: a second pharmacist picks the medicine and records the final check on this screen. Handing it to the patient stays with the pharmacist at the counter."
6. **Errors.** Every order and pickup action shows the server's refusal message (409 and 400) inside its own card, in amber "blocked" styling with the prefix "Server refused:". Red stays reserved for urgency. Reconciliation actions still report in the sticky sign-off bar.
7. **Fixtures (`?fixtures=1`, or when there are no live sessions)**:
   - Order generic and class now use the dictionary spelling.
   - F-202 amoxicillin carries `alternatives: ["clarithromycin","doxycycline"]`. A test checks this equals what the engine's `alternativesFor` derives for that patient.
   - New F-206: cetirizine, verified by Pharmacist Laura Conti, waiting for a second pharmacist.
   - New F-207: omeprazole, dispensed by Pharmacist Nattaya Wong, called to counter 2.
   - Fixture actions apply local mirrors of the engine rules. They throw the same messages as the server (a test checks this word for word) and record local audit events.
8. **Audit lines** localized (th/it/en): order drafted, sent, cancelled, verified, returned with report, dispensed, patient called (with counter, re-call) and collected.

All new strings are in th, it and en. The folder contains no em or en dashes and no emoji (checked with a Unicode scan).

## FILES CHANGED
- `apps/web/app/(pharmacy)/_lib.ts`:
  - stage helpers (`activeOrders`, `verifiedOrders`, `canCall`, `stageRows`, `STAGES`, `STAGE_LABEL`);
  - `samePerson`, which treats staff id and name as one person, as the engine does;
  - the alternatives lookup (`alternativeEntries`, `DICTIONARY_GENERICS`, `toDictionaryGeneric`);
  - local rule mirrors `applyOrderAction`, `applyDispense`, `applyPickup`;
  - new audit lines.
- `apps/web/app/(pharmacy)/_shell.tsx`: one `mutate` write path. `submitOrder` now takes a report; `dispense` and `pickup` are new. Fixture audit events are recorded. `PharmacyContext` and `PharmacyCtx` are exported for render harnesses.
- `apps/web/app/(pharmacy)/_orders.tsx`: rewritten.
  - Order card with stage 1 and stage 2.
  - `AlertOptions`, `ReturnForm` (exported), `DispensePanel`.
  - `PickupCard`.
  - Stage-based `PrescriptionQueue`, `stageCounts`, and the `Run` type.
- `apps/web/app/(pharmacy)/_queue.tsx`: Prescriptions tab first, remembered per viewer; stage stat tiles; tab count from the stages.
- `apps/web/app/(pharmacy)/_workspace.tsx`:
  - `run(fn, onError?)`;
  - `PickupCard`;
  - pickup badge in the hero;
  - the "no medication data" screen localized.
- `apps/web/app/(pharmacy)/_fixtures.ts`: dictionary generics and classes, alternatives on F-202, new F-206 and F-207.
- New `apps/web/app/(pharmacy)/pharmacy-lib.test.ts` (9 tests) and `apps/web/app/(pharmacy)/pharmacy-live.test.ts` (1 end-to-end test against the route handlers).
- New screenshots: `docs/reports/screens/w19-pharmacy-*.png` (7 files).

## TESTS RUN + RESULTS
- `./node_modules/.bin/tsc --noEmit -p .` (apps/web): exit 0.
- `./node_modules/.bin/eslint "app/(pharmacy)"`: exit 0, no output.
- `./node_modules/.bin/vitest run "app/(pharmacy)"`: 2 files, 10 tests passed.
- `./node_modules/.bin/vitest run "app/(pharmacy)" lib/pipeline/__tests__/wave19.test.ts "app/(orders)"`: 4 files, 74 tests passed.
- `./node_modules/.bin/vitest run` (full suite): **did not complete**. Vitest reported 1 unhandled error, `[vitest-worker]: Timeout calling "onTaskUpdate"`, after 1 of 29 files; 181 tests passed and 0 failed before the abort. The machine was under load from parallel agents. I did not rerun it; the gate should.
- `pharmacy-live.test.ts` drives the real POST handlers (`/pharmacy`, `/dispense`, `/pickup`) with the exact bodies the shell builds:
  - return with report, then verify;
  - the verifier refused at dispense (409 "A second pharmacist must dispense…");
  - an incomplete checklist (400);
  - a call before dispensing (409);
  - dispense by the second pharmacist, call at counter 2, collect;
  - a call after collection (409).

  Each response is a session with the same id, which is what the shell swaps in. Each refusal message equals the local mirror's message.
- Static render harness (scratchpad; esbuild bundle plus `react-dom/server`, with `next/link` and the router stubbed): 16 renders and 62 assertions, all passed. They cover:
  - options under the alert in en, th and it;
  - the return form: high alert preselected, ordered generic not offered, datalist present;
  - the returned report;
  - the two-person block for the verifier;
  - the six-item checklist for a second pharmacist, with the submit button disabled at "0 of 6 confirmed";
  - Call patient disabled while not all orders are dispensed, enabled once they are;
  - ready (code and counter) and collected;
  - stage pills on the fixtures: To verify 4, To dispense 1, To call 0, Ready for pickup 1, Collected today 0.

## EVIDENCE
Screenshots: the static renders above, styled with the app's own Tailwind build of `globals.css`, captured with headless Edge. The SCBX font is not loaded, so a system font is used.
- `docs/reports/screens/w19-pharmacy-queue-stages.png`: stage pills with counts; amoxicillin row with an "Options for prescriber review" chip.
- `docs/reports/screens/w19-pharmacy-verify-options.png`: high allergy alert with options clarithromycin and doxycycline, the curated note, "Not a prescription …", and Verify blocked.
- `docs/reports/screens/w19-pharmacy-return-report.png`: the return form with the high alert preselected and options from the table; the returned card with note, alerts raised and options.
- `docs/reports/screens/w19-pharmacy-two-person-block.png`: the verifier sees "A second pharmacist must dispense" and "Sign in as Pharmacist Nattaya Wong".
- `docs/reports/screens/w19-pharmacy-dispense-checklist.png` and `-th.png`: the six unticked items, the patient code, recorded allergies, and the disabled submit at "0 of 6 confirmed".
- `docs/reports/screens/w19-pharmacy-pickup.png`: call (F-206, Counter 1); ready (F-207, counter 2, Mark collected, Call again); collected receipt.

## ASSUMPTIONS
- The display name is sent as `reviewerId`, as before. The engine's `person()` maps staff names and ids to one identity; the client `samePerson` does the same, so the UI blocks exactly what the server refuses.
- Suggested generics are sent in dictionary spelling, lowercase, which the server also normalizes. Options are never preselected: pharmacist 1 chooses them.
- "Collected" in the queue means collected today, matching `OpsMetrics.pharmacy.collectedToday`. The counter choice is 1 to 3, as suggested in the task.

## RISKS
- **Not exercised in a live browser.** The task forbids `next dev` here. Port 3000 serves `C:\Users\User\medx-run` (an older checkout: `/api/sessions/:id/pickup` returns 404 there), so it could not be used. The route handlers, request shapes and refusals are covered by `pharmacy-live.test.ts`, and the markup by static renders. Real clicks, focus and the 5-second polling around the new actions were not exercised. Next step: the orchestrator, with a dev server on this tree, walks F-202 to return, F-206 to dispense, call and collect, and the seeded live cases.
- Fixture mode applies the rules locally; live mode uses the server. Both paths share the request builder, and the messages are pinned by tests.
- th and it wording is mine and has not been reviewed by native speakers.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- Engine, `apps/web/lib/pipeline/orders.ts` (AI engineer): once pickup is "collected", a newly submitted order can never be called ("Medicines already collected"). The UI tells the pharmacist to tell the patient in person. Option: start a new pickup cycle on submit after collection.
- Engine: drafts count as active for the call rule, so an unsent doctor draft blocks "Call patient". The UI lists it as "with the prescriber". Consider excluding `draft` from `active`.
- Orders UI (`apps/web/app/(orders)/`): the prescriber should see `pharmacist.report` (alerts raised plus suggested generics) labelled "Pharmacist report: options for prescriber review, not a prescription" (spec §9.3). I did not check that folder's w19 work.
- CR-18: the pickup and "Options for prescriber review" strings live locally in `(pharmacy)/_orders.tsx`. They can move to shared i18n when the orchestrator adds them.
- `_shell.tsx` now exports `PharmacyContext` and `PharmacyCtx`, and `_orders.tsx` exports `ReturnForm`. These are only for render harnesses, with no behaviour change.

## NEXT ACTION
Orchestrator: rerun the full vitest suite at the gate (it aborted here on a worker timeout). Then, with a dev server on this working tree, do a manual pass of `/pharmacy` on the live seed:
1. To verify: amoxicillin with alternatives; return it with a report.
2. To dispense: ibuprofen verified by Laura Conti. Switch to Nattaya Wong, tick all six and dispense.
3. Call the patient at a counter, then mark collected.
4. Ready for pickup: paracetamol at counter 2.

Check the patient app shows the pickup status.
