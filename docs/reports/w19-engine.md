# W19 engine report: two-stage pharmacy, dispense, pickup, alternatives

STATUS: done (not committed; the orchestrator handles git). Every test file passes when each file runs in its own vitest process (1,934 tests). `tsc` reports 3 errors, all in UI files outside my scope (see open question 1). eslint is clean on my files.

## SUMMARY
The engine now runs the pharmacy flow from the team lead's walkthrough. People make every decision; the rules only compute and check.

1. Pharmacist 1 (prescription check). `POST .../pharmacy` still verifies or returns the order. A return can now carry a report `{ alertIds, suggestedGenerics }` for the prescriber. A return requires a note. `alertIds` must be ids of this order's checks. `suggestedGenerics` must be specific dictionary generics: canonical lower case, deduped, at most 5, and not the ordered generic. The report is stored only on a return. Suggestions are never applied to the order. Resubmitting clears `pharmacist`, so the doctor's confirmation goes back to pharmacist 1.
2. Pharmacist 2 (pick + final double check). New `POST .../orders/medications/:orderId/dispense` (`dispenseOrder`).
   - Returns 409 unless the order is `verified`.
   - Returns 409 when the reviewer is the pharmacist who verified it. The message says a second pharmacist must dispense. The two names are compared after NFC, trim, lower case and space collapsing, and a staff id and its display name count as the same person, so `pharm-conti` and `Pharmacist Laura Conti` are one pharmacist.
   - Returns 400 unless all six checklist items are exactly `true`. Missing, extra and non-boolean items also get 400.
   - On success the order becomes `dispensed` with `{ by, at, checklist, note? }`. The audit event is `order_dispensed` and its payload includes `verifiedBy`.
3. Pickup. New `POST /api/sessions/:id/pickup` (`pickupAction`).
   - `call`: returns 409 when there is no non-cancelled medication order, when any non-cancelled order is not `dispensed`, or after `collected`. A re-call is allowed while the status is `ready`; it is audited with `recall: true`, and the counter is kept when none is given. The audit event is `pickup_called`.
   - `collected`: returns 409 unless the status is `ready`. The audit event is `pickup_collected`.
   - `counter` is redacted free text of at most 40 characters, accepted only with `call`.
4. Cancel. Dispensed orders cannot be cancelled (409). This is the same rule as for verified orders.
5. Submitting a medication order while the pickup status is `ready` deletes `session.pickup`. The `order_submitted` audit payload then carries `pickupReset: true`.
6. Alternatives (deterministic, no model). `alternativesFor(session, order, alert, table = MEDRULES.alternatives ?? [])` runs inside `prescribingChecks`.
   - It takes the curated entries matching the alert kind and the ordered drug's class.
   - It removes the ordered generic, generics not in the dictionary and `(unspecified)` generics.
   - It drops any candidate that, as a hypothetical replacement order with the same id, would raise `allergy_conflict`, `interaction`, `duplicate_therapy`, `pregnancy_caution` or `max_dose_risk` for this patient. The checks cover current meds, allergies, other active orders and pregnancy.
   - `alert.alternatives` is set only when the list is not empty.
7. Patient view. A new allowlisted key `pickup`:
   - `{ status, counter? }` from `session.pickup`;
   - otherwise `{ status: "preparing" }` when any medication order is `submitted`, `verified` or `dispensed`;
   - otherwise `null`.
   It never includes drug names, staff ids, notes or timestamps.
8. Trace. `pharmacist_action` nodes now have their own th/it/en labels and details:
   - Pharmacist 1 verified or returned, with report counts;
   - Pharmacist 2 dispensed (n of 6 items);
   - patient called or called again;
   - medicines collected.
   Edges run verify → dispense ("second check"), dispense → call (one edge per dispensed order), re-call ← previous call, and call → collected. The details hold counts only, with no names, notes or generics.
9. Metrics. `OpsMetrics.pharmacy` = `{ toVerify` (orders `submitted`), `toDispense` (orders `verified`), `readyForPickup` (sessions with pickup `ready`), `collectedToday` (sessions collected on the current UTC date) `}`. The counts use the same visible-session filter as the rest of `/api/metrics`.
10. Demo seed. Every pharmacy stage is now in the seeded queue, with no new sessions. Each step only runs when the replay reached its expected status, the same gate as the synthetic approval, so nothing is seeded after a provider failure.
    - MED-01 (penicillin allergy): amoxicillin, submitted with an override reason → the to-verify case. It has a high MR-ALLERGY-PEN alert, and the shipped `ALT-BETALACTAM-ALLERGY` entry gives it alternatives.
    - IT-01: ibuprofen, verified by Pharmacist Laura Conti → the to-dispense case.
    - EN-01: paracetamol, verified by Conti, dispensed by Pharmacist Nattaya Wong, patient called to counter 2 → the ready-for-pickup case.

## FILES CHANGED
- packages/shared/src/types.ts: OrderStatus `dispensed`, PharmacistReport, DispenseChecklist, PickupState, `IntakeSession.pickup`, `MedicationOrder.pharmacist.report` and `.dispense`, `MedAlert.alternatives`, `MedRuleFile.alternatives`, 3 AuditTypes, `OpsMetrics.pharmacy`
- packages/shared/src/api.ts: PharmacyOrderActionReq (`alertIds`, `suggestedGenerics`), DispenseOrderReq, PickupReq, cancel doc
- apps/web/lib/pipeline/orders.ts: alternatives, report, dispense, pickup, cancel rule, pickupReset
- apps/web/lib/pipeline/patientView.ts: `pickup` (allowlist), exported `patientPickup`
- apps/web/lib/pipeline/pipeline.ts: `metrics().pharmacy`
- apps/web/lib/pipeline/trace.ts: localized pharmacist nodes; `add()` accepts a Localized detail and label
- apps/web/lib/pipeline/seed.ts: pharmacy stages on EN-01, IT-01 and MED-01
- apps/web/app/api/sessions/[id]/orders/medications/[orderId]/dispense/route.ts (new)
- apps/web/app/api/sessions/[id]/pickup/route.ts (new)
- apps/web/lib/pipeline/__tests__/wave19.test.ts (new, 60 tests)
- apps/web/lib/pipeline/__tests__/wave15.test.ts: the patient-view key allowlist now includes `pickup` (required by the contract; asserts `null` for a draft-only case)

## TESTS RUN + RESULTS
- `vitest run lib/pipeline/__tests__/wave19.test.ts`: 60/60 passed.
- Whole suite as one `vitest run`, tried twice: the worker crashed with vitest's own "Timeout calling onTaskUpdate" RPC error after the first file, and the remaining files did not run. The first try got 181/181 through (one file), the second 338/338 (one file). This is the vitest worker RPC and not a failing test. Other agents were running builds and tests on the same machine at the same time.
- So each of the 24 test files was run in its own vitest process: 1,934 passed, 0 failed.
  - clinical-redflags 180, llm-api 39, pipeline 21, safety 44, trace 7
  - wave10 76, wave11 131, wave12 117, wave13 26, wave14 14, wave15 338, wave16 87, wave17 31, wave19 60
  - wave2 37 (seed counts unchanged), wave3 38, wave4 232, wave5 114, wave7 47, wave8 181, wave9 90
  - components/ui 8, consult _guard 2, ops-data 14
- wave8 passes 181/181 but still prints the same unhandled RPC timeout at the end, on both runs. wave8 never touches orders, pickup or the seed.
- `tsc --noEmit -p apps/web`: 3 errors, all from the new `dispensed` status in UI-owned maps: `app/(orders)/_bits.tsx:32`, `app/(orders)/_bits.tsx:33`, `app/(pharmacy)/_orders.tsx:10`. No errors in my files.
- `eslint` on orders.ts, patientView.ts, pipeline.ts, seed.ts, trace.ts, wave19.test.ts, wave15.test.ts and both new routes: 0 problems. The packages/shared files are outside the eslint base path, so eslint skips them; tsc covers them.

## EVIDENCE
- wave19 covers:
  - every 409 and 400 path above;
  - the two-person rule, including staff id ↔ name and case or space variants;
  - each checklist item false, plus missing, extra, string and non-object checklists;
  - pickup preconditions: no orders, only cancelled orders, draft, submitted or verified siblings, re-call, call or collected after collected, and pickupReset;
  - alternatives filtering on a patient with a penicillin allergy, warfarin, simvastatin and a pregnancy. Of the candidates cefalexin, clarithromycin, metronidazole, atorvastatin, doxycycline, unknown and unspecified, only azithromycin is kept. A warfarin patient's NSAID interaction keeps only paracetamol;
  - patient view: stage by stage, with no drug, staff or note strings;
  - audit order and trace nodes, edges, th/it/en text and no PII;
  - metrics counts;
  - the seed stages and idempotency.
- Every refused write in wave19 is asserted atomic: session and audit are unchanged.

## ASSUMPTIONS
- `max_dose_risk` also blocks a candidate. It is the paracetamol same-ingredient form of duplicate therapy, so this only ever removes options.
- When allergy status is not recorded, `MR-ALLERGY-UNKNOWN` (kind `allergy_conflict`) fires for every hypothetical candidate. That alert then gets no alternatives, and neither does any other alert, because every candidate is unchecked. On purpose: allergies must be asked first.
- A return always stores a report (empty arrays when the fields are omitted), so the prescriber UI sees one shape. A verify validates the report fields but never stores them.
- Metrics count orders for toVerify and toDispense, and sessions (patients) for readyForPickup and collectedToday. "Today" is the UTC date, as in `sessionsToday`.
- Seed override text is explicit synthetic text: "Synthetic demo case: prescriber asks pharmacy to review this alert".

## RISKS
- Checks are still recomputed on verified orders (existing `refresh`). A new high alert that appears after verification (for example a newly recorded allergy) does not block dispense; the human `allergyRechecked` item is the gate. Blocking there would leave the order stuck, because a verified order cannot be returned, edited or cancelled.
- After `collected`, a new prescription in the same visit keeps `pickup.status = "collected"`, and `call` returns 409. That is the contract as written. See the open questions.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. UI owners: `OrderStatus` now includes `dispensed`. `tsc` fails in `apps/web/app/(orders)/_bits.tsx` (lines 32–33, status label/tone maps) and `apps/web/app/(pharmacy)/_orders.tsx` (line 10, tone map) until they add a `dispensed` entry. These files are outside my scope.
2. Should submitting a new order after `collected` also reset pickup (as it does for `ready`)? Today the patient keeps seeing "collected" and the new order can never be called.
3. Should a verified order have an escape path (return or recall to pharmacist 1) when a new high alert appears after verification?

## NEXT ACTION
UI owners add `dispensed` to the status maps and wire `/dispense`, `/pickup`, the report fields and `alert.alternatives` (copy: "options for prescriber review"). The orchestrator commits.
