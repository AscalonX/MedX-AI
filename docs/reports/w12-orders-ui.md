# W12 Orders and vitals UI

STATUS: done (UI built against the contract; backend routes were not yet answering, so verified on fixtures).

## Summary
Two pages in a new route group `apps/web/app/(orders)/`, wrapped in the existing `ClinicianFrame` (language, reviewer, nav) without editing `(clinician)`.
- `/review/[id]/vitals` (nurse): large keyboard-first form (HR, BP sys/dia, RR, Temp, SpO2, on O2, pain 0-10, ACVPU with "Not assessed" default so missing stays missing), range and BP-pair validation, vital alert chips (red high, amber moderate), "Suggestion for nurse confirmation" triage card with 1-5 segmented confirm, note required when choosing lower urgency than suggested, Receipt "Triage confirmed by ...", history table with trend arrows.
- `/review/[id]/orders` (doctor): Investigations card (search, category pills, 34-item `investigations.json` catalog, "Suggested by consult" chips labelled "considered, not ordered", pick then explicit "Order X" click, ordered list with status; guideline "Read guideline" links, https only). Prescribing card (drug/dose/route/frequency/duration, "Check", server checks as alert cards with patient-quote evidence, typed reason per HIGH alert, "Submit to pharmacy" disabled with explanation, status pill, returned shows pharmacist note with Edit and resubmit, Cancel). Footer uses live counts from `medrules.json` (59 drugs, 18 interactions). No drug or dose suggestion anywhere.
- Data: real routes first; 404/405/5xx/network falls back to a typed fixture with a "fixture" badge (4xx errors such as 409 are shown, never masked). Fixture logic is sample only, not clinical rules.

## Files
apps/web/app/(orders)/{layout.tsx,_lib.ts,_fixture.ts,_bits.tsx}, review/[id]/vitals/{page.tsx,_vitals.tsx}, review/[id]/orders/{page.tsx,_orders.tsx,_meds.tsx}; docs/reports/w12-orders-ui.md; screens v7-vitals.png, v7-orders.png, v7-orders-blocked.png (draft with HIGH allergy alert, submit disabled).

## Tests
- `tsc --noEmit` clean; `eslint 'app/(orders)'` clean.
- Browser (fixtures): vitals save, alerts, level guard (lower level without note blocked), confirm receipt, history trends, Enter submits, validation errors; orders: chip pick then order, allergy HIGH alert with quote, submit blocked until reason, submit; mobile 390px no page-level horizontal scroll.
- Not tested: against Codex routes (not live), pharmacist return/verify rendering (needs backend state), th/it visual pass.

## Risks
- Response shape assumed: route returns the session or `{ session }` (both handled). If it returns only the order/triage, `asSession` needs adapting.
- Investigation `code` sent is the catalog id; consult `workup[].id` must equal catalog ids (they do in current JSON).
- Reviewer selector is the shared header one: pick "Dr. M. Bianchi" for orders (not enforced; no auth in prototype).
- th/it strings need native review.

## Next
Point at live routes when Codex lands; check returned-order flow end to end; link from the case page (`/review/[id]/vitals`, `/review/[id]/orders`).

## Live verification (real routes, no fixture badge)
Run with Playwright against :3000; screenshots v9-vitals-live.png, v9-orders-live.png.
- Vitals: save sends `onOxygen` explicitly (false default); alerts and suggested level render from the server; confirm of a less urgent level needs a note (client guard, and server 400 "Note required for less urgent confirmation" is surfaced inline); receipt shown.
- Orders: Augmentin 1000 mg every 8 h gives HIGH allergy_conflict (+ moderate duplicate_therapy); submit disabled with explanation until a reason is typed; submit gives status "submitted"; pharmacist return (via /pharmacy route) shows the note with "Edit and resubmit"; edit then "Update and re-check" works; paracetamol 2000 mg gives HIGH dose_range; investigation order and consult "considered" chips + guideline links work. No 4xx/5xx from the UI during the run.
- Fixes made: consult chips de-duplicated by workup id; page title now "MedX". Copy has no "Bridge"/mascot references.
## Observed backend issues (not mine)
- allergy_conflict returned with empty `evidence` for B-014 although the patient said they were allergic, so no patient quote shows.
- dose_range returns two identical HIGH alerts for one paracetamol order (single and daily?), each needing its own override reason.
- Triage for a case with an emergency red flag says "complete NEWS2 before confirming" when ACVPU is not assessed; the form leaves ACVPU blank on purpose.

## Safety must-fixes (MF-3, MF-4, MF-6/7/8 UI, SF-7)
- MF-3: `call()` in `_lib.ts` now falls back to fixtures for reads only. Every write (vitals, triage confirm, orders, submit, cancel) throws the server message (or "Network error. Nothing was saved.") and the form keeps its values. Medication Check errors now show in the form even when orders already exist.
- MF-4: if `suggestedLevel` is more urgent than `confirmed.level`, a red-accent banner "Suggested level is now more urgent than the confirmed level. Re-confirm." shows with the confirm control visible (previous level shown). Live: banner appeared after worsening vitals; screenshot v10-vitals-reconfirm.png.
- Oxygen: "On supplemental oxygen?" is a required yes/no (room air / on oxygen), no default; Save shows "Choose yes or no." until chosen. Live-verified.
- MF-6/7: alerts with ruleId MR-DOSE-UNCHECKED or MR-ALLERGY-UNKNOWN render as a bold amber "Not checked" card. NOT live-verified: the server did not emit them yet (Ibuprofen "some tablets" returned no checks).
- MF-8: override reason needs at least 5 letters (client), submit stays disabled otherwise.
- tsc and eslint 'app/(orders)' clean. Live: write against an unknown session showed "Session not found" and added no history row.

## UX audit P0/P1 fixes (w16)
- P0-2: a returned order shows the pharmacist note, and "Edit prescription" opens the form pre-filled (drug, dose, route, frequency, duration) with the note above it. Nothing is re-sent until the doctor edits and presses Check, then Submit; the drug can be changed. Returned orders no longer have a one-click resubmit. Live-verified (order stayed "Returned" after opening the form).
- P0-3: `useIdentity` (in `_bits.tsx`) reads and writes `ROLE_STORAGE_KEY` and `reviewerStorageKey(role)` from `staff.ts`. Doctor role stays doctor with "Dr. Marco Bianchi" on Orders and Vitals. Orders: read-only with "Prescribing and ordering are for doctors" for nurse/pharmacist/ops (no form, no submit/cancel/order buttons). Vitals: entry and triage confirm for nurses only; doctors view with a note. Live-verified for nurse and doctor.
- P1/P2: per-page titles ("Vitals | MedX", "Orders | MedX"); em dashes in server text shown as commas; two-step Cancel order; ACVPU is now wrapping radio chips (no clipping); history table gains On O2 and ACVPU columns.
- Note: `tsc` currently reports an error in `lib/pipeline/pharmacyExtraction.ts` (not my area). `app/(orders)` is clean.
- Caveat: the shared frame (`(clinician)/_frame.tsx`) still holds role in React state; my pages sync it from storage on mount, so the header follows. Pharmacist/ops stored roles are treated as read-only here.
