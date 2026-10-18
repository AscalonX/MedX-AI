# W20 report: Pharmacy + Ops builder (restyle, S-02, S-03, C-03, C-04)

## STATUS
done for my scope (`apps/web/app/(pharmacy)/`, `apps/web/app/(ops)/`), with two verification gaps stated below. The C-03 Playwright visibility check and a live-browser click-through were not run, because this task forbids `next dev`/`start`. The visual evidence comes from static renders of the real components (see EVIDENCE). Nothing is committed.

## SUMMARY
**Pharmacy restyle (behaviour and safety copy kept)**
- **Queue (`/pharmacy`)**
  - One gradient hero says what to do next ("5 prescriptions to verify", then dispense, call, or a calm line), with an "Open next" link.
  - The hero holds five stage tiles: To verify, To dispense, To call, Ready for pickup, Collected today. Each tile opens its stage below.
  - The queue card has the Prescriptions / Reconciliation tabs, stage pills with counts, the stage hint and white rows.
  - `?stage=verify|dispense|call|ready|collected` opens a stage directly; the ops flow tiles use it.
  - Fin appears only in an empty stage on a calm screen: no high alert, red flag or re-check in the queue (DIRECTION section 11).
- **Case page, order card**
  - A step tracker: 1 Verify, 2 Pick and final check, 3 Pickup. Each step shows done (teal check), now (ocean) or waiting (muted), plus returned (dashed amber) and cancelled. Each state has words and an icon, never colour alone.
  - The verify/return form with its report and options for prescriber review is unchanged.
  - The six-item dispense checklist with the two-person block is unchanged.
- **Case page, pickup card**
  - Follows gate decisions (a) and (b).
  - Shows a "New pickup cycle" chip when earlier medicines were collected.
  - Shows a line saying drafts do not block the call.
- **Engine follow-ups from w20-engine.md**
  - "Re-check needed": an amber badge in the queue row and on the order card, an amber panel naming the new alerts, and a collapsible "Earlier first-pharmacist records" list from `pharmacistHistory`.
  - `order_recheck` audit lines.
  - The local fixture mirrors `canCall`/`applyPickup` now follow decisions (a) and (b): drafts do not block; submitted, returned and verified orders block; at least one dispensed order of this cycle is needed (earlier cycles come from the `pickup_collected` audit).
  - `applyDispense` refuses a re-check with the server's exact words.
- **English default:** kept, and `medx.lang` is restored.
- **Page title:** now "Pharmacy | MedX".

**S-02 (pharmacy `auditLine`)**
- Rewritten as a `Record<AuditType, …>`, so a new AuditType fails to compile until it has words.
- Every line ends with the actor: "by <staff name>", "by the system" or "by the patient", in each language.
- Key fields:
  - triage level, with the suggested level when it differs;
  - drug generic and dose, from the session's orders (optional `ctx` argument) or from the payload;
  - override count;
  - verifier;
  - counter;
  - report counts;
  - re-check rule and earlier verifier;
  - pickup order counts;
  - redaction count.
- Free-text notes and reasons are never put on a line.
- The audit panel now uses it with the session's orders.
- The clinician builder's `audit-labels.test.ts` also iterates the pharmacy `auditLine`; it passes (74/74).

**S-03 (ops)**
- New `PharmacyFlow`, replacing `PharmacyPipeline`: a "Pharmacy flow" strip of four tiles. The values are exactly `metrics.pharmacy` (toVerify, toDispense, readyForPickup, collectedToday), and each tile is a link to `/pharmacy?stage=…`. The strip now sits right under the hero, and the "Called to the counter" list follows it.
- `Queue.tsx` gains a Triage column:
  - "Level N" with "Confirmed by <nurse>" (teal: a clinician decided it, never red);
  - "Not confirmed" with "Suggested level N, for nurse review";
  - or "No triage yet".
  - It reads the session through `triageView` in `ops-data.ts`, which never invents a level.
- `highAlertsOpen` also counts high checks on orders waiting for pharmacist 1 (`submitted`, re-checks included). A prescriber override does not close a check until a pharmacist acts. Orders are read defensively. New tests are in `ops-data.test.ts`.
- `OpsDashboard` restores `medx.lang` on mount and writes it only on an explicit choice.
- `OpsShell`:
  - Home links to `/demo`;
  - the sidebar is translucent like AppShell;
  - `DemoGuide` is mounted with the dashboard's polled rows and the ops staff name.
- `DemoGuide` is also mounted in `(pharmacy)/_shell.tsx`, with the live rows and the pharmacist on screen. A persona applied from the guide switches the reviewer.

**C-03:** The pharmacy queue poll (`_shell.tsx`), the case audit poll (`_workspace.tsx`) and `useOpsSnapshot.ts` now use the shared `startVisiblePolling` (`app/_shared/visiblePolling.ts`):
- no request while the tab is hidden;
- an immediate poll when it becomes visible;
- a tab opened in the background waits until it is shown.

**C-04:**
- **Code search:** a patient-code search field on the pharmacy queue uses the shared `matchesCode`. "B-012", "12", "012" and "b012" all find only B-012. It filters both tabs, with a no-match empty state and a clear button.
- **New arrivals:** a session that newly enters the pharmacy queue (it now has medicines or orders) after the first successful load gets a one-time highlight for 4 s: an ocean ring plus a "New" chip. Rows with a high alert or red flag are excluded.

## FILES CHANGED
Pharmacy (`apps/web/app/(pharmacy)/`):
- `_lib.ts`: auditLine/auditActor/AuditCtx, pickup cycle mirror (`sentOrders`, `blockingOrders`, `collectedOrderIds`, `newlyDispensed`, `canCall(s, collected?)`, `applyPickup(…, collected?)`), `isRecheck`, re-check refusal in `applyDispense`, new chrome strings.
- `_shell.tsx`: visibility polling, fixture pickup cycle, new-arrival tracking, DemoGuide, nav label.
- `_queue.tsx`: rewritten (hero with stage tiles, `?stage=`, code search, reconciliation list).
- `_orders.tsx`: OrderSteps, RecheckPanel, PharmacistHistory, pickup decisions (a) and (b), PrescriptionQueue now takes props (entries, stage, query).
- `_workspace.tsx`: visibility-paused audit poll, `collected` set from the audit, audit panel with the drug context.
- `pharmacy/layout.tsx`: title.
- Tests: `pharmacy-lib.test.ts` (+3 tests), `pharmacy-live.test.ts` (+1 test and audit assertions), `pharmacy-audit.test.ts` (new, 5 tests).

Ops (`apps/web/app/(ops)/`):
- `components/OpsDashboard.tsx`: language, layout order, flow strip, identity.
- `components/OpsShell.tsx`: `/demo`, DemoGuide, glass sidebar.
- `components/Queue.tsx`: `TriageCell`.
- `components/useOpsSnapshot.ts`: C-03.
- `components/PharmacyFlow.tsx`: new. `components/PharmacyPipeline.tsx` is deleted.
- `ops-data.ts`: `highAlertsOpen`, `triageView`.
- `ops-data.test.ts`: +2 tests.
- `i18n.ts`: flow and triage strings; removed unused pipeline strings.
- `ops.module.css`: glass sidebar, flow tiles, triage column, responsive rules.

Report and evidence:
- `docs/reports/w20-pharmacy-ops.md` (this file).
- `docs/reports/screens/w20-pharmops-*.png` (10 files).

## TESTS RUN + RESULTS
All commands were run from `apps/web`.

| Command | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` | exit 0 (whole app, final run) |
| `./node_modules/.bin/eslint "app/(pharmacy)" "app/(ops)"` | exit 0, no output |
| `./node_modules/.bin/vitest run "app/(pharmacy)" "app/(ops)"` | 4 files, 37/37 pass |
| `./node_modules/.bin/vitest run "app/(clinician)/review/audit-labels.test.ts"` | 74/74 pass. This includes "pharmacy audit labels (S-02)": every AuditType in en, th and it, with actor, key fields and no free text |
| `./node_modules/.bin/vitest run` (whole suite, final) | 45 files, 2335 pass, 1 fail. The failure is `lib/pipeline/__tests__/llm-api.test.ts:102` (old `/api/health` body), the known platform item. It is not in my scope |
| C-03 Playwright visibility check | NOT RUN (no dev server allowed). The shared helper's `app/_shared/shared.test.ts` covers "no call for 60 s while hidden, immediate poll when shown" with an injected environment |

What the new tests prove:
- **Live routes** (`pharmacy-live.test.ts`, mock provider):
  - The real audit trail of a return, verify, dispense, call and collect visit reads as words in all three languages. One line is exactly "Second pharmacist did the final check and dispensed: paracetamol 500 mg, verified by Pharmacist Laura Conti, 6 of 6 checks, by Pharmacist Nattaya Wong".
  - A penicillin allergy stated after amoxicillin was verified makes the order `isRecheck`. It moves from the dispense stage to the verify stage, and the local mirror's dispense refusal equals the server's 409 message word for word.
- **Mirror** (`pharmacy-lib.test.ts`):
  - Drafts do not block; returned, submitted and verified do.
  - An earlier-cycle collected order alone gives "No newly dispensed medicines to collect".
  - A new dispensed order allows the call again.
- **Ops** (`ops-data.test.ts`):
  - `highAlertsOpen` counts 1 reconciliation alert plus the high checks on two submitted orders (one with an override, one a re-check). Verified, returned, dispensed, draft and cancelled orders are not counted, and malformed orders neither throw nor count.
  - `triageView` returns confirmed, suggested or none, and rejects level 9.

## EVIDENCE
**Method.** Static render harness, scratchpad only:
- esbuild bundles the real components, with stubs only for `next/link`, `next/navigation`, `next/image` and `useOpsSnapshot` (a synthetic snapshot);
- `react-dom/server` renders them;
- Tailwind is compiled from the real `globals.css`, scanning the real sources;
- Playwright Chromium captures with reduced motion.

Effects do not run in a static render, so CountUp numbers show 0 there. The data is fixtures plus two synthetic variants: F-208 re-check and F-209 new pickup cycle.

**Screenshots**, all in `docs/reports/screens/`:
- `w20-pharmops-pharmacy-queue-en-1440.png`, `-390.png`, `w20-pharmops-pharmacy-queue-th-1440.png`
- `w20-pharmops-pharmacy-case-recheck-en-1440.png`
- `w20-pharmops-pharmacy-case-dispense-en-1440.png`, `w20-pharmops-pharmacy-case-twoperson-en-1440.png`
- `w20-pharmops-pharmacy-case-newcycle-en-1440.png`
- `w20-pharmops-pharmacy-case-verify-en-390.png`
- `w20-pharmops-ops-en-1440.png`, `-390.png`

**Measured in Playwright:**
- `scrollWidth` equals the viewport for all 12 captures (390 at 390, 1440 at 1440): no horizontal scroll.
- 0 failed requests.

**Checked in the rendered HTML:**
- Ops: the flow links are `/pharmacy?stage=verify|dispense|ready|collected`, and Home is `href="/demo"`. "Level 1", "Suggested level 4, for nurse review" and "No triage yet" are present.
- Pharmacy: "New pickup cycle" with "Earlier medicines were collected. This call covers 1 new order."; "Earlier first-pharmacist records (1)"; "A second pharmacist must dispense"; "Six-item final check".

**Harness scripts** (in `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-OneDrive---Mahidol-University-Documents-GitHub-MedX-AI\86cd279c-cfbf-45d5-a5d2-57cf5ffc9ebd\scratchpad\w20-pharmops\`): `build.mjs`, `entry.tsx`, `shot.cjs`, `final-report.json`.

## ASSUMPTIONS
- **Open high alert, for ops.** "Open" means not yet reviewed by a pharmacist:
  - reconciliation alerts without a review;
  - high checks on `submitted` orders, overrides included.

  Returned orders were reviewed by a pharmacist and are not counted.
- **Triage colour.** A confirmed triage level is teal ("done by a clinician") at every level, including 1. Red stays for red flags and high alerts, and escalated rows already carry the red chip.
- **"New".** For the pharmacy, "new" means newly in the pharmacy queue (it now has medicines or orders), not newly created. The baseline is the first successful load, so a failed first fetch does not flash every row.
- **Shared helpers.** I use the shared `app/_shared/visiblePolling.ts`, `codeSearch.ts` and `DemoGuide.tsx`, which another builder created this wave for exactly this ("shared by the clinician and pharmacy queues"), instead of local copies, so both queues behave the same.
- **Ops Home.** Home in OpsShell keeps the label "Home" and points to `/demo` (the persona hub), as the acceptance says.

## RISKS
- **Earlier pickup cycles in the queue.** The queue rows (GET `/api/sessions`) carry no audit, so they cannot tell earlier-cycle dispensed orders apart. In the rare case "collected → new order submitted → order cancelled", the patient appears under "To call" in the queue, and the server refuses with "No newly dispensed medicines to collect". The case page has the audit and disables Call correctly.
- **No live click-through.** The restyled pages have not been clicked through in a live browser this wave. Interactive states (stage switching, search typing, the 4 s highlight, DemoGuide with a stored persona) are covered by code review and unit tests, not by a live run.
- **In-flight shared files.** The imports depend on another builder's `app/_shared/*`. Earlier in the wave `DemoGuide.tsx` and `demoGuide.ts` collided by case on Windows. That is resolved now (`demoPersona.ts`), and the final tsc run is exit 0. A future rename would break my five imports.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Engine/orchestrator (optional contract).** Add `pickupCallable?: boolean` or `collectedOrderIds?: string[]` to `SessionListItem`, so the queue's "To call" stage is exact across pickup cycles (see RISKS).
2. **CR-18 (orchestrator, shared i18n).** Still not done: the pickup strings and "Options for prescriber review" remain local in `(pharmacy)/_orders.tsx`. Once shared keys exist in `packages/shared`, I can switch to them.
3. **Platform/AI engineer.** `llm-api.test.ts:102` still expects the old health body. It is the only failing test in the suite.
4. **Design lead.** Please review:
   - the hero stage tiles (`bg-white/12` tiles on the gradient);
   - the teal triage chip for level 1;
   - the "Pharmacy flow" tile treatment at 390px (two columns, link words visually hidden on phones, kept for screen readers).
5. **Native speakers.** The new Thai and Italian strings need review: audit lines, re-check, steps, pickup cycle, search, triage.
6. **Clinician builder (shared owner).** Consider moving the "fresh arrival" highlight into `app/_shared`, so the pharmacy and clinician queues share one implementation. The pharmacy uses its own ring plus a "New" chip, because `cl-enter` is defined inline in `(clinician)/_frame.tsx`.

## NEXT ACTION
- Orchestrator:
  - run `next build` and the whole suite on the merged tree;
  - click through `/pharmacy` and `/ops` live: stage tiles, `?stage=` links from ops, search "12", a re-check case via `/api/demo/start`, and DemoGuide with a stored persona;
  - run the C-03 Playwright check (visibility override, 60 s, no `/api/sessions` or `/api/metrics` requests).
- Video agent: the fresh `/landing/pharmacy-*.webp` crops can come from the restyled pages. The order step tracker and dispense checklist crop well.
