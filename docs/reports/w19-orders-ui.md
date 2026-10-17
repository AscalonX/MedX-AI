# w19 · Clinician web builder (orders UI)

## STATUS
done

## SUMMARY
The doctor's Orders page (`/review/[id]/orders`, Prescribing card) now covers the two-pharmacist flow from the walkthrough video:

1. **Returned orders.** A "Pharmacist report" panel shows who returned the order and when, the pharmacist's note, and the checks the pharmacist flagged (`pharmacist.report.alertIds`; those alert cards also carry a "Flagged by pharmacist" chip). If a flagged check no longer fires after the latest re-check, a count line says so. "Suggested alternatives (for your review)" comes from `report.suggestedGenerics`. Each suggestion has an "Edit with {generic}" button that opens the existing edit form with that drug in the drug field. Dose and frequency are cleared and the previous prescription is shown for reference, so the doctor sets dose, route and frequency. The server re-runs the checks on "Update and re-check", and the doctor submits again, which is the confirmation.
2. **Draft (and returned) orders.** Any alert with `alternatives` shows an "Options to review" box with the same "Edit with" action, the curated medrules note for that alert (from `medrules.alternatives`, matched by kind and drug class) and a collapsible source. Nothing is applied automatically. Every alternative is labelled as an option for prescriber review, not a prescription.
3. **Status.**
   - Verified orders show "Verified by {who}, {time}".
   - Dispensed orders show "Dispensed by {who}, {time}", the final double-check line (only when every checklist item is true) and the dispense note.
   - The verified and dispensed badges now use different icons (check vs circle-check) so the two "done" states stay distinct.
   - A session-level "Medicine pickup" strip shows one of three states: "Being prepared: n of total dispensed", "Ready, patient called to counter {n}" with who called and when, or "Medicines collected" with who handed over and when.
   - The order history timeline now also reads `order_dispensed`, `pickup_called` (first call vs re-call, with counter), `pickup_collected`, the `pickupReset` flag on `order_submitted`, and the generics suggested in a return. Pickup events are matched through `payload.orderIds`.
4. **Cancel.** Cancel is rendered only for draft, returned and submitted orders. Verified and dispensed orders show "cannot be cancelled here, contact the pharmacy"; the server also refuses. Cancel and submit errors now appear on the card that failed. Before, they showed only on draft cards, so a failed cancel on a returned or submitted order was silent.

No colour outside the tokens is used:
- Red only for high-severity alerts (unchanged).
- Amber dashed for the pharmacist report (needs check).
- Ocean dashed for options under review.
- Teal for verified, dispensed and collected.

## FILES CHANGED
- `apps/web/app/(orders)/_lib.ts`: 31 new strings in en, th and it (`stDispensed` was already in the working tree). New `drugTextFor(generic)`, which returns the drug-field text the engine dictionary resolves back to that generic; combinations resolve by product name. New `alternativeNotes(kind, drugClass)`.
- `apps/web/app/(orders)/_bits.tsx`: status badge icons for verified, dispensed and returned.
- `apps/web/app/(orders)/review/[id]/orders/_meds.tsx`: pharmacist report panel, `AltOptions`, the edit-with-alternative flow, verified and dispensed status lines, `PickupStrip`, the `CANCELLABLE` gate, per-order errors and the extended `Timeline`.
- `apps/web/app/(orders)/orders-lib.test.ts` (new): 4 tests, run by the default vitest config.

## TESTS RUN + RESULTS
All commands run from `apps/web`.
- `./node_modules/.bin/tsc --noEmit -p .`: exit 0, no output (whole project, final run).
- `./node_modules/.bin/eslint "app/(orders)"`: exit 0, no output.
- `./node_modules/.bin/vitest run "app/(orders)/orders-lib.test.ts"`: 1 file, 4 tests passed. It checks four things:
  - every specific (non-"unspecified") dictionary generic G satisfies `lookupDrug(drugTextFor(G)).generic === G` (engine parity);
  - `alternativeNotes` filtering;
  - every chrome string is non-empty in th, it and en, with the same `{placeholders}` in each;
  - the alternatives copy says "for your review" and "not a prescription".
- Render tests ran under a scratch vitest config, because the shared config has no `@/` alias and does not include `.tsx`. The files were removed from the repo afterwards and kept in the scratchpad.
  - `_meds.render.test.tsx` (hand-built sessions): 7 tests passed. Covers the returned report with flagged and no-longer-firing checks, "Edit with" for each suggestion, draft "Options to review" with the curated note, verified, dispensed and checklist lines, pickup ready, collected and preparing, the timeline labels (dispensed, called, re-called, collected, suggested, pickup reset), cancel absent on verified and dispensed (exactly 2 "Cancel order" for 4 orders), and read-only viewers seeing no actions.
  - `_engine.render.test.tsx` (real engine calls `medicationOrder`, `medicationAction`, `dispenseOrder` and `pickupAction`, then rendering the real session and audit): 3 tests passed. The first run failed one assertion. The cause was my test expecting "Resubmitted by" before it had resubmitted. I fixed the test, not the UI code, and the rerun passed.
- Not run: `next build` and `next dev` (forbidden by the task), so nothing was checked in a browser.

## EVIDENCE
- Engine run: ibuprofen 400 mg tid for a patient on warfarin gives the draft check `interaction/high/paracetamol`. The rendered draft contains "Options to review" and "Edit with paracetamol".
- After return, the timeline row reads: `Returned by Pharmacist Laura Conti: Interaction with warfarin; suggested for review: paracetamol`.
- Re-editing with `drugTextFor("paracetamol")`, then dose 500 mg every 6 hours, makes the engine resolve generic `paracetamol` with status `draft`. After resubmit, the timeline shows "Resubmitted by Dr. Marco Bianchi".
- Pickup ran: call at counter 3, re-call (counter kept by the engine), then collected by a different pharmacist. The render shows "Ready, patient called to counter 3", then "Patient called again by … : counter 3", then "Medicines collected · Handed over by Pharmacist Laura Conti".
- Pickup reset: a new order submitted while the pickup is ready shows "pickup reset, medicines being prepared again" and "Being prepared: 1 of 2 dispensed".
- No screenshots: there was no browser run.

## ASSUMPTIONS
- "Edit with {generic}" clears dose and frequency, keeps route and duration, and shows the previous prescription for reference. Carrying another drug's dose into a new drug is unsafe; the task says the doctor sets dose, route and frequency.
- Alternatives are actionable only on orders the prescriber owns (draft and returned). They are hidden on submitted, verified and dispensed orders. Read-only roles (nurse) see them as plain chips with no buttons.
- The pickup strip also shows a "preparing" state, with the count of dispensed against active orders. The contract only names ready and collected for the clinician side; preparing mirrors the patient view rule.
- For combination generics, `drugTextFor` returns the first Latin-script dictionary name that resolves back to the generic, for example "augmentin" for amoxicillin+clavulanic acid. The card then reads "augmentin (amoxicillin+clavulanic acid)".

## RISKS
- `drugTextFor` copies the engine's name matching on the client. If `medrules.json` changes names, the parity test in `orders-lib.test.ts` catches drift. Either way the server re-resolves and re-checks, so a mismatch shows the wrong generic name but skips no check.
- The th and it strings need native-speaker review, like the rest of `_lib.ts`.
- The UI was never seen in a real browser (layout and focus behaviour of "Edit with" are unverified). Focus moves to the Dose field via `input[name="dose"]`.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Report lost on edit (engine).** `medicationOrder` replaces a returned order with a new draft object, so `pharmacist.report` disappears from the order once the doctor presses "Update and re-check". The UI keeps it visible only through the audit timeline (note plus "suggested for review"). If the report should stay on the draft card, the contract needs something like `MedicationOrder.lastReturn?: { by; at; note?; report? }`, kept on edit.
2. **Pickup after "collected" (contract).** An order submitted after the medicines were collected can never be called: `call` is refused after collected, and `pickupReset` only fires while ready. The UI shows "Medicines collected" plus a "Being prepared" chip in that case. Should a submit after collection reset pickup as well?
3. **Vitest config (`apps/web/vitest.config.ts`, outside my scope).** Please add `resolve.alias { "@": <apps/web> }`, `esbuild.jsx: "automatic"` and `app/**/*.test.tsx` to `include`. The render tests (scratchpad `_meds.render.test.tsx` and `_engine.render.test.tsx`) can then be checked in so UI regressions run in CI.
4. Optional: move the dictionary `lookup` into `packages/shared` as a pure function, so the UI and engine share one implementation.

## NEXT ACTION
Orchestrator: review the diff, run a browser pass on `/review/<id>/orders`, and decide on items 1 to 3. If item 3 lands, I will add the render tests to `app/(orders)/`.
