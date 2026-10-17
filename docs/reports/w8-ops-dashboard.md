# Wave 7 ops audit fixes, Wave 8 handoff

## STATUS
partial: ops implementation complete; the requested full-project TypeScript check is blocked by three errors in a concurrently edited pipeline test outside the allowed scope. Browser verification is unavailable in this session.

## SUMMARY
- Fixed ops audit items 18, 19, 20 and 21, plus the ops portions of cross-surface items 3, 22, 23, 24, 25 and 26.
- Hero answers what needs attention now: pending escalation intake count, red only when positive, and an Open oldest pill linking directly to the oldest pending intake. Awaiting review, pharmacy high alerts open and sessions today are secondary hero tiles.
- Counts animate once on load over 650 ms; reduced-motion preference skips animation and changing that preference cancels an active animation. Hero counts expose the final value to assistive technology throughout animation.
- Red-flag labels replace the missing chief-complaint message. Flags remain visible with their source, severity and review status.
- Mock disclosure is localized from the English copy "Mock model (not AMD)". Both latency tiles and the latency chart show "Not measured on mock" in the selected language. Mock calls are excluded from non-mock latency plots.
- Provider, model and hardware come from /api/health rather than the metrics provider configuration. Missing hardware uses the existing accessible blank placeholder. A legacy dash sentinel is treated as missing, and a conflicting mock AMD hardware claim is withheld. Valid hardware strings are preserved verbatim.
- Empty sessions without patient text are hidden behind a localized Show N empty toggle. Escalations and sessions containing any red flag or medication alert remain visible even if the patient turn is missing. Revealed empty rows say No complaint yet.
- Uses the new pipeline abstainMessage helper; no raw abstention reason is rendered. The message also appears when an abstained intake has red flags.
- Ops-owned shell provides TH/IT/EN role labels, disclaimer, nav, language label, skip link and other chrome. Root has lang. Both segmented controls use a single tab stop and arrow/Home/End navigation. Focus indicators use ocean tokens with a sheet offset.
- Navigation follows Home / Review queue / Pharmacy / Ops. Layout uses five metric columns at 1280px and above; tablets use two columns with the final tile spanning the row. Narrow layouts retain auto-fit columns.

## FILES CHANGED
All implementation changes are inside apps/web/app/(ops):
- components/OpsDashboard.tsx
- components/Queue.tsx
- components/SystemLedger.tsx
- components/Charts.tsx
- components/useOpsSnapshot.ts
- components/CountUp.tsx (new)
- components/OpsShell.tsx (new)
- ops-data.ts
- ops-data.test.ts
- i18n.ts
- ops.module.css

Report: docs/reports/w8-ops-dashboard.md.
No commits, installs or server restarts performed. Concurrent edits outside these paths belong to other work and were left untouched.

## TESTS RUN + RESULTS
From apps/web, using existing local binaries:
- ./node_modules/.bin/tsc --noEmit --incremental false: exit 2. Only three diagnostics, all in lib/pipeline/__tests__/wave8.test.ts at 143:32, 150:32 and 157:25. TS2339: json does not exist on Promise<Response>. No ops diagnostics. This file is outside the authorized edit scope.
- ./node_modules/.bin/eslint 'app/(ops)': exit 0, no diagnostics.
- ./node_modules/.bin/vitest run 'app/(ops)/ops-data.test.ts': exit 0, 14 tests passed. Added coverage for pending intake deduplication and oldest ordering, reviewed flags, incomplete escalations, hiding empty sessions without hiding safety flags, high-only pharmacy counts and health hardware honesty.
- curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3000/ops: HTTP 200.
- Live /api/sessions, /api/metrics and /api/health responses validated using the actual transpiled ops-data validators: all three passed.
- git diff --check scoped to apps/web/app/(ops): exit 0.
- Literal em dash scan across ops source: zero files matched. API dash sentinels do not render as text.
- Browser check attempted through computer-use: in-app browser unavailable; browser inventory empty. No viewport, screenshot or keyboard-runtime result is claimed.

## EVIDENCE
Live API observation during final validation, 17 October 2026:
- Session list: 181 intakes. Metrics sessions today: 250. These are independent API values; the dashboard does not replace either with an invented matching total.
- Pending escalation intakes: 44.
- Oldest pending review link: /review/2bce6b78-84e4-486e-af5f-89f304436363.
- Awaiting review: 11.
- Pharmacy high alerts without review: 2.
- Empty sessions hidden in this snapshot: 0; synthetic unit cases exercise the hiding rule.
- Health provider: mock; model: deterministic-mock; hardware: a single legacy dash sentinel. Rendered hardware is a localized accessible missing-data placeholder, with no AMD claim.
- Screenshots: none captured because no browser was connected.

## ASSUMPTIONS
- A pending escalation is an escalated intake with at least one flag lacking a review. An escalation with no flags or no summary remains pending as a fail-closed measure. Multiple pending flags count as one intake.
- Both acknowledge and false_alarm are completed flag reviews; neither removes the underlying API escalation from the escalation list.
- A pharmacy alert is open until it has a pharmacist review; only severity high contributes to the headline count.
- Blank patient text is treated as no patient answer. Safety flags override empty-session hiding.
- Actual API median review measurements remain displayed, including a measured zero; null measurements remain placeholders.

## RISKS
- Full-project TypeScript is not clean because of the three out-of-scope pipeline test errors listed above.
- Responsive behavior, count animation, keyboard movement and language switching are implemented but not browser-verified in this environment.
- The ops-owned localized shell mirrors shared shell styling. A future shared localization API should replace the local shell to prevent visual drift.
- The current health endpoint sends a dash placeholder rather than descriptive mock hardware. The dashboard treats that value as missing to honor the no-em-dash requirement.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- Pipeline owner: await the async health response in the three failing wave8 test assertions, then rerun full tsc.
- Pipeline owner: return an honest descriptive hardware string for mock if hardware should be visible. The dashboard already consumes the health hardware property.
- Shared UI owner: expose localized shell labels and accessible roving segmented controls so the ops-local shell can eventually be removed.
- No shared contract files were edited.

## NEXT ACTION
Resolve the pipeline test errors outside this role's scope, rerun tsc, and verify /ops visually at 375, 1024, 1280 and 1440px with TH/IT/EN and reduced motion. All requested ops implementation changes are ready for that review.
