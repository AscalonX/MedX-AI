# W8 UX re-audit (after the w7 fix wave)

STATUS: done. Read-only on product code.
Auditor: UX / user-journey auditor, Sat 17 Oct 2026, ~16:35 to 16:50 ICT.
Environment: `localhost:3000`, restarted, 11 seeded cases. `/api/health` reports `mock / deterministic-mock`.
Patient app: `/patient/` at 375x812. Web: 1440, 1280 and 1024.
Baseline: `docs/reports/w7-ux-audit.md`, commits `9b1bb34`..`5535704`.

**Data I created, for the orchestrator's reset:**
- B-012: Italian headache, approved.
- B-013: Thai chest pain; red flag acknowledged and taken over.
- B-014: abandoned start with no turns.
- B-009 pharmacy reconciliation: signed off.

## 1. Verdicts (w7 → w8)

| Journey | w7 | w8 | Why |
|---|---|---|---|
| J1 Italian tourist, phone → review → ops | FAIL | **PASS-WITH-FIXES** | Chip answers now reach the summary, including "Nessuno" → "no known allergies". Questions use formal Lei, and one tap on a chip submits. The "2 required fields left" hint jumps to each field. The receipt and the patient's live "Letto" tick both work. The remaining P1 is below: the receipt appears off-screen. |
| J2 Thai buried chest pain | PASS-WITH-FIXES | **PASS-WITH-FIXES** | Tab title becomes "(1) New emergency · MedX Bridge". There is now one Acknowledge, with gloss tags, the stop reason shown once, and the reason kept after take over. The red flag survives a reload. New P0: the saved patient state outlives a server reset (below). |
| J3 Pharmacist | PASS-WITH-FIXES | **PASS** | Queue rows are white. There is help text for the alert actions and a sign-off receipt. B-011 now explains itself in plain words and offers next actions. Only P2 polish is left. |
| J4 Head nurse /ops | PASS-WITH-FIXES | **PASS** | The hero says "What needs you now: 2 escalations not acknowledged" with an "Open oldest" button. Latency tiles say "Not measured on mock" and the ledger says hardware "No measurement". Red-flag rows show the flag instead of "Not mentioned yet". |
| J5 Language switching | PASS-WITH-FIXES | **PASS** | All chrome is translated, times are 24-hour, and the Italian buttons now read "Visto, confermo" / "Gestisco io". The shell wrapper carries `lang="th"`, so the `:lang(th)` CSS applies. Only P2 leftovers remain. |
| J6 Responsive | PASS | **PASS** | No horizontal scroll at 1440, 1280 or 1024. At 1280 the 5 ops tiles fit in one row. At 1024 they wrap 2+2+1, which is acceptable. |
| J7 Keyboard / screen reader / contrast | PASS-WITH-FIXES | **PASS** | There is a skip link. Each segmented control is now one tab stop with arrow keys. Approve, Acknowledge and Take over announce via `aria-live` and move focus to the case header. Chips announce "7 su 10". The focus ring on the selected "All" filter is still white on white (P2). |

## 2. W7 P0/P1 status

| # | w7 item | Status | Evidence |
|---|---|---|---|
| 1 | P0 "Nessuno" chip lost | **FIXED** | B-012 Allergies shows "no known allergies · From patient's words · Patient wrote: Nessuno". |
| 2 | Italian "tu" | **FIXED** | "Quanto è forte il dolore", "Potrebbe essere incinta?", "Ha allergie a farmaci o alimenti?" |
| 3 | Abandoned sessions in queues | **FIXED** | B-014 (Start, then abandoned) does not appear in `/review`. |
| 4 | Approval has no moment | **PARTIAL** | The hint "2 required fields left: Medications, Age", the jump links and the "Intake approved · B-012" receipt all work. But when the last *edit* completes approval, the page stays scrolled at that row, so the receipt is off-screen and focus falls to `<body>`. See `reaudit-p1-receipt-offscreen-after-last-edit.png`. |
| 5 | Three Acknowledge buttons | **FIXED** | One "Acknowledge" button. Per-rule buttons are labelled "Mark RF-CHEST-0x as false alarm". |
| 6 | No gloss for Thai/Italian | **FIXED** (as specified) | The transcript shows "“แน่นหน้าอก” → Red flag: …" and "“da ieri” → Onset: since yesterday". |
| 7 | Dev QR placeholder | **FIXED** | A real QR code to `<origin>/patient/` plus an "Open patient app" button. |
| 8 | Audit trail missing model | **FIXED** | Repeats collapse to "Summary generated ×2", with a chip "deterministic-mock · 0 ms". Actors are capitalised. |
| 9 | Focus lost after actions | **PARTIAL** | Fixed for Approve, Acknowledge and Take over: focus goes to the header with a polite announcement. Not fixed for edit-completes-approval or pharmacy sign-off: focus goes to `<body>`. |
| 13 | Pharmacy pink rows | **FIXED** | White rows with a red icon and red chip. |
| 14 | B-009 dose/timing | **PARTIAL** | The blank pill now reads "Timing: Not stated". But "เช้า-เย็น" (morning and evening) sits right next to it, so the two contradict each other. The dose is still Thai only, now tagged "Original language: ไทย". Downgraded to P2 because the pharmacy segment is optional in the script. |
| 15 | B-011 dead end | **FIXED** | Plain copy, plus "Read the patient's words" and "Open clinician review" buttons. |
| 18 | Ops hero | **FIXED** | "What needs you now: 2 escalations not acknowledged", with "Open oldest". |
| 19 | Mock honesty | **FIXED** | "Mock model (not AMD)", hardware "No measurement", latency "Not measured on mock", no dashes in copy. |
| 20 | Ops red-flag rows | **FIXED** | Rows read "Red flags: Chest pain with sweating…". |
| 22 | UI language not on `lang` | **FIXED** (functionally) | The shell `<div lang="th">` wraps the page. `<html lang>` stays `en`, which is P2. |
| 23 | TH/IT chrome leftovers | **FIXED** | Role switch ("Infermiere / Medico / Farmacista / Gestione"), disclaimer, 24-hour times, "Visto, confermo", "รับทราบ". |
| 24 | Nav differs per surface | **PARTIAL** | Clinician and ops now share "Home / Review queue / Pharmacy / Ops". Pharmacy still shows only "Reconciliation queue". |
| 27 | Patient status static | **FIXED** | After approval in `/review`, the phone ticked Inviato 16:39 → In revisione → Letto 16:40 within about 6 s. Copy: "Un infermiere la chiamerà." See `reaudit-patient-letto-live.png`. |
| 28 | Red flag lost on reload | **FIXED**, but see new P0 | Reloading `/patient/` returns to `/patient/redflag` with the code B-013. |

P2 items from w7 that I verified:
- **Fixed:** stop reason shown once (#10), take over keeps the red-flag reason (#11), queue copy and sentence case (#12), alert help text (#16), "1 medicine" (#17), tile grid at 1280 (#21), skip link and roving focus (#26), one-tap chips plus Sì / No / Non so (#29), chip labels (#30).
- **Not fixed:** focus ring on the selected pill (#25).

## 3. New pieces, judged

| Piece | Verdict |
|---|---|
| "N required fields left" hint | Good: clear and verb-first. Each name is a button that scrolls the row to the centre and focuses it. Small issue: the row's "Fill in" button sits under the sticky action bar until you scroll a little. |
| Approval receipt | Looks right. A teal receipt replaces the gradient hero: "Intake approved · B-012 · Nurse A. Rossi, 16:40 · 7 fields approved", with "Next case" and "Review queue". The problems are that it is off-screen on the edit path (P1) and that "7 fields approved" counts 2 clinician edits as approvals. |
| Scan-to-try QR on `/` | Good. The QR encodes `window.location.origin`, so when it is filmed on `localhost` a judge's phone cannot open it. Film it from the LAN or hosted URL. |
| Emergency slide-in and tab title | Works: the title changed to "(1) New emergency · MedX Bridge" within one poll. Because the queue sorts oldest first, the new row lands third (under B-001 and B-002) and its 420 ms ring is easy to miss on camera. |
| Ops "What needs you now" | Passes the 5-second test. The red number sits on a white card inside the gradient, and "Open oldest" goes to B-001. |
| Pharmacy receipt | Good. "Reconciliation signed off by Pharmacist M. Bianchi, 16:42 · 1 medicine: 0 verified…", scrolled into view. It has no "Next case" button, and focus goes to `<body>` (P2). |
| Patient live status | Strong demo moment. Honesty nit (P2): "In revisione" ticks as soon as the patient sends, with the line "Un infermiere sta leggendo le sue risposte", before any nurse has opened the case. |
| Language switch and `lang` | Works per surface. But the language choice is not shared across surfaces: I set Thai on `/ops`, and `/review` was still English (P2). |

## 4. New regressions

1. **P0 (recording risk) · `apps/mobile/src/store.tsx` and `_layout.tsx:16`: saved patient state is never checked against the server.**
   - **What I saw:** opening `/patient/` after the restart and reset sent me straight to a full-screen red flag with code **B-214**. `GET /api/sessions/dad45479…` returns **404**.
   - **No way out:** the only button, "ฉันอยู่ที่เคาน์เตอร์แล้ว" (I'm at the desk), just changes the text. Only clearing `localStorage` (`medx.patient.v1`) frees the phone.
   - **Same lock after the Thai take:** after recording the Thai red-flag segment, the phone stays locked to that red flag. The Italian segment then cannot start on the same browser without clearing site data.
   - **Fix:** on restore, `GET` the session. On 404, clear the stored state and go Home. Otherwise refresh the stored status. Also add a demo escape, e.g. `/patient/?new=1`, that clears the stored state.
   - **Workaround for tomorrow:** clear site data for the recording browser before every take.
   - Screen: `reaudit-p0-stale-redflag-after-reset.png`.
2. **P1 · `review/_workspace.tsx`: the receipt is off-screen when the last field edit completes approval.** This is the common live path: the patient app stops after 3 questions, so the nurse fills Age and Medications by hand. After saving the last edit, the view stays on that row with no visible change and focus goes to `<body>`.
   - **Fix:** when the status changes to `approved`, scroll the receipt into view (`scrollIntoView({block:"start"})`) and focus it. The same move is already used for the jump links.
   - Screen: `reaudit-p1-receipt-offscreen-after-last-edit.png`.

New P2 issues:
- "Take over intake" stays enabled on an approved intake; the engine now returns 409.
- Audit lines show raw keys: "approve chief_complaint, approve pregnancy_status".
- The Italian blocked reason "Prima prenda in carico il segnale." does not match the button "Visto, confermo".
- Thai role pill "การดำเนินงาน" and Italian nav item "Coda di revisione" wrap to two lines.
- The patient web build keeps `<html lang="en">` while the UI is Thai.
- A thin scrollbar artifact appears beside the pharmacy sidebar nav item.
- "Median review time 0 s" (from seeded instant approvals).
- "Next case" from a taken-over case points to B-008, which is already approved.

## 5. Remaining fixes worth doing before the recording

1. **P0 · mobile:** check the saved session on restore (404 → clear), plus a `?new=1` escape. About 15 min. If skipped, clear site data before every take.
2. **P1 · clinician:** scroll and focus the receipt when the status changes to approved. About 10 min.
3. **P2, optional, cheap:** disable "Take over intake" when approved; write the Italian blocked reason as "Prima confermi il segnale."; change the patient "In revisione" line to "In attesa dell'infermiere" until a nurse opens the case.
