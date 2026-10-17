# Wave 3 · Ops dashboard builder

## STATUS

done — `/ops` implemented; all three requested checks pass. Browser layout and interaction verification remains a limitation, documented below.

## SUMMARY

Built the head nurse / clinic manager board as one Clinical paper sheet: escalations, live queue, metric ledger, small SVG charts, and provider plate. The server page only renders the client dashboard. The client fetches `/api/sessions` and `/api/metrics` on mount and every 5 seconds, with manual retry, an 8-second request timeout, cleanup, overlap protection, and visible stale-snapshot handling.

Queue order is escalated → needs_human → awaiting_review → collecting → approved → taken_over. Emergency flags precede other escalations; otherwise older intakes come first. Every row links to `/review/<id>`. Flags retain rule IDs, explicit rule/model-suggested source labels, severity, and clinician acknowledgement state. No clinical state is changed from this dashboard.

Complaints use the selected clinician UI language and the house `FieldValue` renderer. Exact patient evidence offsets are rechecked before rendering a complaint as supported, edited, or approved; unverified values become unsupported pencil text. Abstained summaries show “Needs human review.” Deterministic flag state is never cleared locally.

The ledger displays every requested API metric, preserves genuine zero measurements, and renders null measurements as blank form lines. The provider plate shows the API's provider/model/hardware verbatim and clearly labels mock mode **MOCK — not AMD**. The status chart counts the returned sessions; the latency plot includes every recorded `summary.modelCalls` sample, grouped by step, with a common zero baseline and API p50/p95 reference rules. Zero latency stays at zero; failed calls have hollow marks, step failure counts, and exact results in the expandable call ledger. Carmine is reserved for escalations and urgent flags.

Local Thai, Italian, and English labels use `LangMorph`. House `Button`, `Badge`, and `FieldValue` components are reused. All styling uses existing palette, typography, shape, and motion tokens. CSS includes narrower layouts, contained table scrolling, and reduced-motion overrides.

## FILES CHANGED

- `apps/web/app/(ops)/ops/page.tsx` — simple server route and metadata.
- `apps/web/app/(ops)/components/OpsDashboard.tsx` — client board, language control, loading/error/stale states.
- `apps/web/app/(ops)/components/useOpsSnapshot.ts` — paired polling and request lifecycle.
- `apps/web/app/(ops)/components/Queue.tsx` — escalation band, clinical queue, evidence-safe complaints.
- `apps/web/app/(ops)/components/SystemLedger.tsx` — metrics and provider plate.
- `apps/web/app/(ops)/components/Charts.tsx` — SVG status distribution, latency ticks, recorded-call ledger.
- `apps/web/app/(ops)/i18n.ts` — local three-language label tables.
- `apps/web/app/(ops)/ops-data.ts` — ordering, evidence verification, response guards, waiting time, call extraction.
- `apps/web/app/(ops)/ops-data.test.ts` — 10 focused regression tests.
- `apps/web/app/(ops)/ops.module.css` — scoped Clinical paper layout.
- `docs/reports/w3-ops-dashboard.md` — this report.

No commits, installs, dependency changes, shared-contract changes, or edits outside the authorized paths were made by this task. Other team changes were present and left untouched.

## TESTS RUN + RESULTS

| Check | Final result |
|---|---|
| `cd apps/web && npx tsc --noEmit` | PASS, exit 0 |
| `cd apps/web && npx eslint 'app/(ops)'` | PASS, exit 0 |
| `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/ops` | PASS, HTTP 200 |
| `cd apps/web && npx vitest run 'app/(ops)/ops-data.test.ts'` | PASS, 10/10 tests, exit 0 |
| Ad hoc server-render assertions using installed React/TypeScript; no browser | PASS, 23 assertions across en/it/th, including empty queues, empty calls, null versus zero, mock disclosure, initial loading, model-source labels, and absence of NaN |
| Ad hoc polling harness with mocked hooks, fetch, and timers; no browser | PASS: 5-second scheduling, 8-second timeout, no-store requests, HTTP/schema error snapshot retention, recovery, overlap prevention, abort/interval cleanup, manual retry |
| Running API contract smoke check | PASS: both response guards accept live demo payloads; ordering, complaint evidence states, and call extraction execute successfully |

An intermediate project-wide TypeScript run encountered an incomplete concurrent pharmacy import. That external change resolved before the final run; the final requested TypeScript command passes without any pharmacy edits from this task.

## EVIDENCE

- Final check output: `TSC_EXIT=0`, `ESLINT_EXIT=0`, `VITEST_EXIT=0`, `OPS_HTTP=200`.
- Final regression run: 1 test file, 10 tests passed.
- Live API observation during verification: 12 sessions and 10 recorded model calls. Counts are a timestamped observation, not hardcoded UI values; other team members are using the demo server.
- Provider observed: `name: mock`, `model: deterministic-mock`, `hardware: mock`.
- Route HTML contains the initial loading state and Next client scripts. Loaded-data rendering was checked separately with server-render assertions.
- Screenshots: none. There was no connected browser. In-app browser creation returned “Browser is not available: iab”; native Chrome inspection was rejected with “Computer Use was not approved to use Google Chrome.” No further reason was supplied.

## ASSUMPTIONS

- The selected interface language is also the clinician language for localized complaints and flag labels; the session contract has no separate clinician-language preference.
- Waiting time means elapsed time since `createdAt`, measured at the last successful snapshot. The contract has no queue-entry or review-start timestamp. Approved and taken-over intakes show a blank waiting-time line.
- Bangkok time is used for the sheet date and last-update time. “Sessions today” and other aggregates remain exactly API-reported, including the API's day boundary and definitions.
- A missing flag source defaults to rule, per the contract; `MODEL-` IDs are labelled model-suggested defensively.
- The seed data is synthetic, as specified. This is a read-only operations surface and stores no patient text in browser persistence.

## RISKS

- Actual rendering at 1440px, 1024px, and 375px, browser language-button interactions, focus behavior, and the operating system's reduced-motion setting were not visually verified because browser access was unavailable/rejected. Responsive CSS and reduced-motion handling are implemented, not claimed as visually tested.
- Polling and error behavior passed an isolated mocked harness, not an end-to-end browser test. The 23 render assertions do not verify hydration or CSS layout.
- The two API reads are concurrent but are not a transactional server snapshot. During another user's write, the metrics and queue can briefly describe adjacent states.
- Latency samples are limited to the model calls retained in each returned session's current summary. The dashboard does not reconstruct overwritten summaries from audit history.
- Thai and Italian copy should receive native-speaker review before public demonstration.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS

- No contract change is required for this implementation.
- For a future operational definition of “time waiting,” add explicit queue-entry and review-start/completion timestamps rather than inferring them from intake creation or generic updates.

## NEXT ACTION

Open `/ops` in an authorized browser for the desktop/narrow-width, language-toggle, keyboard, polling/error-recovery, and reduced-motion visual smoke check. Continue using the existing server; no additional server is needed.
