# Wave 5 · Ops dashboard builder

STATUS: done

## SUMMARY

Restyled `/ops` to the v2 banking direction: shared AppShell with Ops active, role navigation, localized head-nurse greeting and avatar, Bangkok date, one teal-to-ocean hero, five StatTiles, white escalation cards with red accents, transaction-style queue, and rounded SVG chart bars. SCBXBeta2 is inherited through the shared CSS variables; no font families or colours are hardcoded.

The hero shows API sessions today, escalations, awaiting review, median review time, and the honest provider pill. The system card retains exact provider/model/hardware details. Pharmacy alerts count recorded `summary.medAlerts` entries without a review, tolerating absent arrays. Acknowledgements have a teal check pill; false alarms and pending reviews retain explicit labels. All added copy has TH/IT/EN translations.

The polling hook, 5-second refresh interval, manual refresh/retry, stale snapshot warning, queue ordering, exact evidence verification, abstention gating, and recorded-call ledger remain intact. Loading, empty, error, and reduced-motion states are included.

## FILES CHANGED

- `apps/web/app/(ops)/components/OpsDashboard.tsx`
- `apps/web/app/(ops)/components/SystemLedger.tsx`
- `apps/web/app/(ops)/components/Queue.tsx`
- `apps/web/app/(ops)/components/Charts.tsx`
- `apps/web/app/(ops)/ops.module.css`
- `apps/web/app/(ops)/i18n.ts`
- `docs/reports/w5-ops-dashboard.md`

## TESTS RUN + RESULTS

From `apps/web`:

- `npx tsc --noEmit`: PASS, exit 0.
- `npx eslint 'app/(ops)'`: PASS, exit 0.
- `npx vitest run 'app/(ops)/ops-data.test.ts'`: PASS, 10 tests in 1 file.
- `curl -s -o /dev/null -w '%{http_code}' localhost:3000/ops`: PASS, HTTP 200.
- Scoped `git diff --check`: PASS, no whitespace errors.

## EVIDENCE

- Server-rendered `/ops` HTML contains the AppShell brand, Good afternoon greeting, selected role control, and loading state; page title is `Clinic operations | MedX Bridge`.
- Read-only live API check returned 23 sessions, 23 sessions today, 7 escalated sessions, 3 awaiting review, and 2 medication alerts without review. Provider was `mock`; these are snapshot counts and may change with concurrent work.
- `useOpsSnapshot.ts` has zero diff bytes; existing evidence/order/validation tests all pass.
- Browser screenshot review was attempted but unavailable: no browser integration was listed, and native Chrome access returned `Computer Use was not approved to use Google Chrome`. No screenshots were captured for this wave.
- Edits were limited to the permitted OPS subtree and this report. No commits, installs, or server starts were performed.

## ASSUMPTIONS

- Hero awaiting-review count is the API's `byStatus.awaiting_review`, separately from escalated and needs-human sessions.
- Pharmacy open means no `review` entry, as requested; any recorded review action excludes that alert.
- Shared AppShell supplies Avatar and SegmentedControl. Nurse and Doctor role choices navigate to the existing `/review` route; Pharmacist navigates to `/pharmacy`.
- User-requested SCBXBeta2 CSS variables take precedence over older font names still mentioned in DIRECTION.md v2.

## RISKS

- Visual inspection at 375px/1440px, interactive language switching, and reduced-motion rendering were not verified in a browser because Chrome access was denied. Responsive CSS and inherited language controls compile and lint successfully.
- Concurrent agents may change shared primitives or global styles after these checks.
- The external visual reference could not be opened by the web tool; implementation follows the owner's explicit visual requirements and local DIRECTION.md v2.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

None.

## NEXT ACTION

Design lead: visually review `/ops` at 375px and 1440px and exercise TH/IT/EN when browser access is available.
