# w20 · Clinician web builder (queue, case, consult, vitals, orders, trace)

## STATUS
partial. Every routed item (M-06, S-01, S-02, C-03, C-04, C-05) is implemented in my scope and covered by unit tests. tsc, eslint and the vitest files for my folders are clean. Two things are still open:
- The two Playwright acceptance checks (M-06 nurse then doctor sign-off, C-03 polling paused for 60 s while the tab is hidden) were not run.
- Nothing was clicked through in a live browser.

This task does not allow `next dev`, `next start` or `next build`. Nothing is committed.

## SUMMARY
- **M-06 approved case keeps its actions.**
  - The approved receipt now has a stage row, a triage row and every case action: Start history taking or Start consult (by role), Vitals, Orders, Case trace, Queue and Next case.
  - The consult link appears for every status the engine accepts consult lines in: awaiting_review, needs_human, escalated and approved. It is hidden while the patient is still answering (collecting) and after a takeover.
  - The same action set is on all three header variants: hero, red-flag card and receipt.
- **M-06 frame.**
  - Home now links to `/demo`, and `"demo"` is in the active union (`FrameActive = "home" | "demo" | "review"`; `"home"` is kept for `app/page.tsx`).
  - I removed the frame's duplicate skip link and duplicate `#main-content` id. AppShell already provides both, localized.
- **M-06 demo guide bar.** New `app/_shared/DemoGuide.tsx`, shown on clinician case pages.
  - It renders only when localStorage `medx.demo.persona` holds a persona id. JSON `{id}` also works.
  - It reads "You are <staff name> · Next: <step>". The step comes from the case's server `stage` (shared `journeyStage`), the role on screen, and two cases: the patient is still answering, or an order came back from the pharmacy.
  - It has a "Switch persona" link to `/demo`.
  - "Reset my demo case" sends `POST /api/demo/start {stage: persona.stage}` and stores `medx.demo.case`. It then applies the persona's role and staff name and goes to that persona's page: nurse `/review/<id>`, doctor `/review/<id>/consult?mode=doctor`, pharmacist `/pharmacy/<id>`, ops `/ops`. A 429 or 404 shows a plain message.
  - Neutral ocean styling: no Fin, no red. Every storage access is in try/catch (`app/_shared/demoPersona.ts`).
- **S-01 journey stage.**
  - `StageChip` (icon plus word, neutral outline, `data-stage`) is on queue rows, the case header, the receipt, and the shared header of consult, vitals, orders and trace.
  - It uses `JOURNEY_STAGE_LABELS`, made more precise from the record: "Dispensed, patient not called", and "Ready to collect, counter N".
  - `sortQueue` keeps escalated cases first (emergency before urgent). Every other status group is ordered by confirmed triage level (most urgent first; unconfirmed last), then by wait time.
  - Queue rows also show a "Triage N" chip, so the order explains itself.
  - Vitals: after triage is confirmed, the receipt has "Ready for doctor". It calls `setClinicianRole("doctor")`, which writes `medx.clinicianRole` and `medx.role`, then opens `/review/<id>/consult?mode=doctor`. It also offers "Start history taking". Navigation only, no API call.
- **S-02 audit labels.** The clinician `auditLine(e, lang, ctx?)` labels every AuditType in en, th and it. It never returns an empty string or a raw type name.
  - Key fields: triage level and suggested level; drug generic (from the case's orders by orderId); override count; verifiedBy; pickup counter; red-flag rule ids; vitals (HR, BP, RR, T, SpO2); note-signing counts; the consult rule id.
  - Free text (notes, reasons, report notes, patient words) never appears.
  - `auditRow` returns `{who, text}`, and the case audit panel shows the actor beside every line.
  - Fixed: red_flag lines read `ruleIds`, the field the engine writes; they used to read `ruleId`. pii_redacted now sums the `{type,count}` entries.
- **C-03 polling.**
  - New `startVisiblePolling` / `useVisiblePolling` (`app/_shared/visiblePolling.ts`). While the tab is hidden, no timer runs and nothing is fetched. When the tab is shown again, it fetches at once and restarts the interval.
  - Used by the review Shell (queue, 5 s), the case workspace (5 s), the consult (4 s), the frame's own rows on vitals, orders and trace (15 s), and the guide's fallback fetch (20 s).
- **C-04 code search.**
  - The clinician queue has a search field. "B-012", "b012", "012" or "12" finds only B-012, never B-112 or B-120. The search looks through every case and ignores the filters and the empty-case toggle.
  - A newly arrived non-escalated case gets one ocean ring pulse and a "New" chip for 6 s. Escalations keep the red slide-in.
  - `matchesCode` is in `app/_shared/codeSearch.ts` for the pharmacy queue.
- **C-05 investigations.** A sent investigation shows "Sent (no lab system in this prototype)" in en, th and it, in a neutral chip. It no longer shows "Submitted, waiting for pharmacist" or any verified or result state. The section adds one line saying no results come back, and the audit line says the same.
- **Restyle (design system v3).**
  - New shared `CaseHeader` with `CaseNav` pill tabs (Case, Consult, Vitals, Orders, Case trace; `aria-current`). The header also shows the code chip, the patient language and the stage chip. It is used by consult, vitals, orders and trace.
  - The queue page has a title and lead.
  - Every link button uses `buttonClasses()`; the hand-written inline pill and shadow strings are gone.
  - Removed the double padding on vitals and orders.
  - Every colour is a token: the `rgba` values in the keyframes became `color-mix` of `--color-signal` and `--color-ocean`.
  - Vitals history values are localized: Yes/No, and ACVPU words instead of raw enum values.
  - Orders now show "Re-check needed" on a submitted order that has `recheck`, and an `order_recheck` row in the order timeline.
  - Writes are gated by the shared `WRITE_ROLES`: vitals and triage for nurses, orders for doctors, consult sign for doctors. Each blocked control shows a reason, and the server's 403 message still shows if one comes back.
  - English stays the default. Thai and Italian work through the toggle.

## FILES CHANGED
Modified:
- `apps/web/app/(clinician)/_frame.tsx`
- `apps/web/app/(clinician)/review/_shell.tsx`, `_lib.ts`, `_i18n.ts`, `_queue.tsx`, `_stage.ts`, `_workspace.tsx`, `page.tsx`
- `apps/web/app/(clinician)/review/[id]/consult/_consult.tsx`, `_c18n.ts`
- `apps/web/app/(orders)/_bits.tsx`, `_lib.ts`
- `apps/web/app/(orders)/review/[id]/orders/_orders.tsx`, `_meds.tsx`
- `apps/web/app/(orders)/review/[id]/vitals/_vitals.tsx`
- `apps/web/app/(trace)/review/[id]/trace/_trace.tsx`

New:
- `apps/web/app/_shared/DemoGuide.tsx`, `demoPersona.ts`, `visiblePolling.ts`, `codeSearch.ts`, `caseEvents.ts`, `StageChip.tsx`, `CaseHeader.tsx`
- Tests: `apps/web/app/_shared/shared.test.ts`, `apps/web/app/(clinician)/review/audit-labels.test.ts`, `apps/web/app/(clinician)/review/queue.test.ts`

## TESTS RUN + RESULTS
All commands were run from `apps/web`.

| Command | Result |
|---|---|
| `vitest run "app/(clinician)" "app/(orders)" "app/(trace)" app/_shared` | 7 files, 112/112 pass (15 existing + 97 new) |
| `vitest run "app/(clinician)/review/audit-labels.test.ts"` | 74/74. For each of the 23 AUDIT_TYPES, in en, th and it: clinician lines with key fields, the actor and no free text; the empty-payload case; the pharmacy `auditLine` half |
| `vitest run` (whole suite, final) | 45 files, 2335 pass, 1 fail. The failure is `llm-api.test.ts > returns health metadata…`, the known `/api/health` shape change by the platform agent (also reported in w20-engine and w20-design-lead), not my code |
| `tsc --noEmit -p .` | exit 0 (final run). An earlier run showed errors only in `app/(ops)` files that another agent was editing |
| `eslint "app/(clinician)" "app/(orders)" "app/(trace)" "app/_shared"` | exit 0, no warnings |
| Playwright M-06 / C-03 checks | not run (no server allowed) |

## EVIDENCE
- **Polling (fake document, fake timers).**
  - Visible: 1 call at once, 4 calls after 15 s.
  - Hidden: 0 calls and 0 timers over 60 s.
  - Shown again: 1 call at once, then every 5 s.
  - A tab opened in the background makes 0 calls until it is shown.
  - Repeated visibility events never leave two intervals running.
- **Queue order test.** Input of 10 cases → `B-015, B-014 | B-012, B-013, B-011, B-010 | B-016, B-017 | B-019, B-018`:
  - escalated: emergency, then urgent;
  - awaiting: level 1, then level 3 (older first), then unconfirmed;
  - needs human: level 2, then unconfirmed;
  - approved: level 2, then level 4.
- **Sample audit lines (en).**
  - "Medication order sent to pharmacy: amoxicillin, override reasons: 2"
  - "Pharmacist 2 dispensed amoxicillin after the final double check (verified by Pharmacist Laura Conti)"
  - "Patient called to collect medicines at counter 3"
  - "Triage level 2 confirmed (suggested 3)"
  - "Vitals recorded: HR 104, BP 128/82, T 38.4 °C, SpO2 97%. Suggested triage level 3"
  - "Investigation sent: Full blood count (no lab system in this prototype)"
- **Server render check.** Run from a scratch vitest config outside the repo, using react-dom/server.
  - `CaseNav` renders 5 tab links, `aria-current="page"` on the active tab, and the consult href `?mode=doctor`.
  - `StageChip` renders `data-stage="nurse_done"` with the word "Ready for doctor", and in Italian "Pronto per il ritiro, sportello 2".
  - The investigation badge renders "Sent (no lab system in this prototype)" and the Thai string.
- No screenshots: no server could run.

## ASSUMPTIONS
- **Persona storage.**
  - `medx.demo.persona` holds a `DemoPersonaId`; JSON `{id}` is also accepted.
  - The visitor's own case is stored as JSON in `medx.demo.case` `{id, code, personaId}`.
  - `applyDemoPersona(id)` in `app/_shared/demoPersona.ts` is the one helper the landing page should call on a persona card.
- **Whose name the guide shows.** It names the identity on screen (the frame's role and reviewer), because every write is attributed to that person. The persona only decides the reset stage and the default name.
- **Triage sort.** It applies inside every non-escalated status group, not only awaiting_review and needs_human. It changes order only and never hides a case.
- **Ready for doctor.** It shows when triage is confirmed and the suggestion is not more urgent; otherwise the re-confirm form comes first. A doctor at the `triaged` stage gets the guide step "Start the consult…", because the handover changes no record.
- **Audit text.**
  - The case audit panel now names the drug generic. The w19 rule "status words only" is replaced by S-02.
  - Notes, reasons and report text are still excluded. Option generics from a return report are listed, because they are dictionary names, not free text.
- **Stage on case pages outside the review Shell.** Vitals, orders and trace get the stage from `GET /api/sessions` rows. The frame polls these every 15 s while the tab is visible, and again on an in-page write event (`medx:case-changed`).

## RISKS
- **Untested in a browser.** Nothing was clicked through: the receipt actions, the guide reset, the `:has()` height fit for the workspace under the guide bar, and the queue search focus and Escape. Possible layout issues at 390px, for example action pills wrapping in the hero.
- **`/demo` must exist.** Home and "Switch persona" link there. If the landing builder does not ship `/demo`, both 404.
- **Extra list request.** Vitals, orders and trace now poll the full `/api/sessions` list every 15 s while visible, for the stage chip and the urgent count. That is fine for 150 demo sessions; it is a cost on a large store.
- **Pharmacy half of the S-02 test.** It imports `app/(pharmacy)/_lib.ts` (another owner) and asserts only the acceptance minimums. A later edit there that breaks those minimums fails my test, which is intended.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **Landing builder.**
   - Call `applyDemoPersona(persona.id)` from `app/_shared/demoPersona.ts` on each persona card. After `POST /api/demo/start`, call `writeDemoCase({id, code, personaId})`, then navigate with `demoHref(persona, id)`.
   - Ship `/demo`. If `/demo` renders inside `ClinicianFrame`, pass `active="demo"`.
2. **Pharmacist web builder.**
   - Add `<DemoGuide lang role="pharmacist" userName={reviewer} />` to the pharmacy shell. It fetches its own rows, slowly, only while the tab is visible.
   - Use `useVisiblePolling` (C-03) and `matchesCode` (C-04) from `app/_shared/`.
3. **Ops builder.** Use `startVisiblePolling` / `useVisiblePolling` in `useOpsSnapshot.ts` for C-03.
4. **Design lead / orchestrator.**
   - AppShell's language control lists TH, IT, EN; DIRECTION says EN first on marketing pages only, so I left it.
   - A Playwright pass is still needed for M-06 (nurse persona approves all on the golden case, then the doctor persona opens consult `?mode=doctor` and signs) and for C-03 (`page.evaluate` visibility override: no `/api/sessions` or `/api/metrics` request for 60 s, then one at once on visible).
5. **Doctor.** Review the Thai and Italian wording of the guide steps, the case tabs, the audit lines and "Sent (no lab system in this prototype)".

## NEXT ACTION
Orchestrator:
- Merge.
- Run `next build`, then the M-06 and C-03 Playwright checks against a running server.
- Re-dispatch the design lead for the 1440px and 390px look of `/review`, `/review/<id>`, `/review/<id>/consult`, `/vitals`, `/orders` and `/trace`.
