# w19 · Ops dashboard + trace + clinician queue builder

## STATUS
done

## SUMMARY
The two-stage pharmacy flow (pharmacist 1 verifies, pharmacist 2 dispenses and calls the patient) now shows up on every surface in my scope. All of it reads the engine contract (`metrics.pharmacy`, `session.pickup`, order statuses, `pharmacist.report`, trace `pharmacist_action` nodes). No clinical logic changed.

1. **Ops (`/ops`)**: a new "Pharmacy pipeline" section sits after the queue. It has four numbered tiles from `metrics.pharmacy`: To verify (pharmacist 1), To dispense (pharmacist 2), Ready for pickup, Collected today. Units are pluralised (order/orders, patient/patients). The labels say what is counted, that "today" means the server's UTC date, and that only counts are shown. If the metrics API leaves the block out, the section shows "No measurement" rather than zeros. If the block is malformed, the snapshot is rejected and the dashboard's existing visible fetch error appears. A "Called to the counter" list comes from `session.pickup` (status `ready`, longest wait first) and shows only the patient code, counter, call time (ICT), time waiting, and a link to `/pharmacy/:id`. It never shows drug names, staff ids or notes.
2. **Trace (`/review/:id/trace`)**:
   - `pharmacist_action` nodes (verify, return, dispense, call, re-call, collected) show the engine's localized labels and details.
   - They keep the human styling but carry a pill icon and the role name "Pharmacist" on the node, in the list view and in the step panel.
   - Edge labels sent as English tokens ("second check", "orders", "escalated", "medications", "no clearing") are translated into th/it, and unknown labels pass through unchanged.
   - JSON export works as before. The blob URL is now revoked 1 s after the click instead of straight away, because some browsers cancel the download otherwise.
   - The offline fixture graph now includes the pharmacy chain, so it matches the route.
3. **Clinician queue and case header (`/review`, `/review/:id`)**: a new neutral `PharmacyChip` (outline tone, never red or teal) shows one of: "Pharmacy: to verify", "Pharmacy: to dispense", "Pharmacy: dispensed, patient not called", "Ready for pickup" (with the counter if one was set), or "Medicines collected". It appears:
   - in queue rows (the chip row now wraps);
   - in the case header, both the hero and the plain card;
   - in the approved receipt card.

   Stage rule: a submitted order wins over a verified one, and either wins over pickup state. "Dispensed, patient not called" follows the engine's call rule: every non-cancelled order is dispensed, so a draft or returned order blocks it.

   The returned-order banner now shows the pharmacist's report: the flagged checks of that order, plus "Options for prescriber review, not a prescription: …".

   The audit trail now has lines for: order sent to pharmacy (including "pickup call withdrawn" when `pickupReset`), pharmacist 1 verified or returned, pharmacist 2 dispensed after the final double check, patient called or called again, medicines collected, and order cancelled. Cancellations are logged as `order_drafted` + `action: "cancel"`. These lines contain no drug names or notes.
4. **Home (`/`)**:
   - A new "One visit, one record" card shows five steps: Patient → Nurse → Doctor → Pharmacist 1 (verify, can return with a report and options for prescriber review) → Pharmacist 2 (picks, final double check, calls the patient to collect).
   - It ends with the line "Rules and models suggest; a person decides at every step."
   - The doctor step says "considerations (not a diagnosis)".
   - A fourth stat tile, "Medicines ready for pickup", reads from `metrics.pharmacy`.
   - Every stat tile now has a localized empty label; it used to be hard-coded English "No data yet".

## FILES CHANGED
- `apps/web/app/(ops)/components/PharmacyPipeline.tsx` (new)
- `apps/web/app/(ops)/components/OpsDashboard.tsx`
- `apps/web/app/(ops)/ops-data.ts` (`pharmacyStages`, `readyForPickup`, `isMetrics` validates the optional `pharmacy` block)
- `apps/web/app/(ops)/i18n.ts`
- `apps/web/app/(ops)/ops.module.css`
- `apps/web/app/(ops)/ops-data.test.ts`
- `apps/web/app/(trace)/_graph.ts` (`edgeLabel`)
- `apps/web/app/(trace)/_fixture.ts`
- `apps/web/app/(trace)/_graph.test.ts` (new)
- `apps/web/app/(trace)/review/[id]/trace/_trace.tsx`
- `apps/web/app/(clinician)/review/_stage.ts` (new: `pharmacyStage`, `returnReport`)
- `apps/web/app/(clinician)/review/_stage.test.ts` (new)
- `apps/web/app/(clinician)/review/_queue.tsx` (`PharmacyChip`)
- `apps/web/app/(clinician)/review/_workspace.tsx`
- `apps/web/app/(clinician)/review/_lib.ts` (`auditLine` pharmacy cases)
- `apps/web/app/(clinician)/review/_i18n.ts`
- `apps/web/app/page.tsx`
- `docs/reports/w19-ops-trace.md` (this file)

## TESTS RUN + RESULTS
All commands were run from `apps/web`.
- `./node_modules/.bin/tsc --noEmit -p .`: exit 0, no errors. One mid-task run showed one error in `app/(pharmacy)/_workspace.tsx` (outside my scope, being edited by another agent); the next run was clean, with 0 errors in total.
- `./node_modules/.bin/eslint "app/(ops)" "app/(trace)" "app/(clinician)" app/page.tsx`: exit 0, no output.
- `./node_modules/.bin/vitest run app components`: 6 files, 39 tests, all passed. My new or extended tests:
  - `app/(ops)/ops-data.test.ts`: 16 tests, including 2 new ones (pharmacy block valid / absent / malformed; pickup list ordering and that it never contains staff names).
  - `app/(trace)/_graph.test.ts`: 4 new tests. They run the real `deriveTrace` on a synthetic verify → dispense → call → collected audit, then check the layout:
    - each step sits one column further right;
    - all labels exist in en, th and it;
    - the dispense detail and the localized "second check" edge are correct;
    - the human count is right;
    - the JSON export round-trips with no staff or drug names;
    - the fixture layers are right;
    - edge labels pass through when unknown.
  - `app/(clinician)/review/_stage.test.ts`: 5 new tests (stage precedence; draft or returned blocks "not called"; collected-then-resubmitted; return report parsing).
- SSR smoke render: a throwaway `.test.tsx` with a scratchpad vitest config (PostCSS bypassed), rendering `PharmacyPipeline` (en/th/it, plus the missing block) and `PharmacyChip` with `react-dom/server`. 5 of 5 passed. The temp test file was deleted afterwards.

## EVIDENCE
- Smoke render text (en): "Pharmacy pipeline … 1 To verify … Pharmacist 1 checks the prescription 2 To dispense … 3 Ready for pickup … 4 Collected today … Called to the counter 1 … B-007 Counter 2 Called 16:00 · 5 min Open in pharmacy". Numbers render as 0 on the server because `CountUp` animates from 0 on mount.
- When `pharmacy` is missing: "No measurement · The metrics API did not report pharmacy counts."
- Chip HTML: `bg-sheet text-ink-soft ring-1 ring-inset ring-rule` (outline tone, no signal class) and "Pronto per il ritiro, sportello 2".
- Checked about 458 added lines for em/en dashes and emoji: 0 hits.
- No screenshots: the task did not allow `next dev` or `next build`.

## ASSUMPTIONS
- Ops reads the pharmacy block from `/api/metrics` only. It never computes the counts in the browser, so an older server shows "No measurement" instead of guessed numbers.
- When a case has both a pickup and new pharmacy work (collected, then a new order submitted), the clinician chip shows the active work ("to verify"). The patient view (engine) keeps showing `pickup` while it is present.
- The ops pickup list links to `/pharmacy/:id`. That route exists and is owned by the pharmacist web builder.

## RISKS
- No visual check in a real browser. Layout is backed by tsc, lint, the SSR smoke render and existing patterns, but long Thai or Italian labels in the 160 px trace nodes and the narrow queue column have not been seen on screen. The chip text truncates, and node labels are clamped to 2 lines.
- `metrics.pharmacy.collectedToday` uses the server's UTC date. Between 00:00 and 07:00 ICT, "today" still means the previous UTC day. The label says so.
- The th/it strings need a native-speaker review.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- AI engineer, `apps/web/lib/pipeline/trace.ts`: the English detail for pharmacist 1 reads "Order verify" / "Order return" (from `Order ${action}`). Suggest "Order verified" / "Order returned" to match the th/it text. This file is outside my scope, so I did not change it.
- Optional, engine: count "Collected today" on the Asia/Bangkok day to match the ICT clock on `/ops`. If that changes, update the `pharmacyPipelineNote` copy.
- No shared contract changes needed.

## NEXT ACTION
Orchestrator: run one `next dev` pass of `/`, `/ops`, `/review`, `/review/:id` and `/review/:id/trace` on a seeded case with dispense and pickup, at 375 px and at desktop width, and capture screenshots.
