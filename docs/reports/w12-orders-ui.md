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
