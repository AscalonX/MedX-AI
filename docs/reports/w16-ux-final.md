# W16 final UX audit: the video story, end to end

STATUS: done. Read-only on product code.
Sat 17 Oct 2026, 21:30 to 21:45 ICT. Setup: `localhost:3000`, mock provider, after the reset to 11 seeded cases.
Browser sizes: web at 1440, patient app at `/patient/` at 375x812. English first, then a Thai red-flag pass.
Script followed: `pitch/VIDEO-SCRIPT.md` v3.

Data I created (please reset before recording):
- **B-012 (English):** sore throat, fever and a penicillin allergy. Walked through nurse consult, vitals (NEWS2 8, triage 2 confirmed), doctor consult and signed note. The Augmentin order was overridden, returned, then cancelled; an azithromycin order was submitted and verified.
- **B-013 (Thai):** red flag.

## Verdict per step

| # | Step (script time) | Verdict | One line |
|---|---|---|---|
| 1 | Patient types or speaks (0:15) | PASS-WITH-FIXES | One-tap chips work, and the "Waiting for a nurse" status is honest. Typed only; I did not test the microphone. Under the mock model, an English "sore throat and fever" is not recognised, so the app asks "What is the main problem?" again. |
| 2 | Nurse consult (0:40) | PASS-WITH-FIXES | The consent gate, the P/C speaker toggle, typed fallback lines and "Rule out" popups all work. But **Allergies stays "Not mentioned yet"** although the patient said "allergic to penicillin". There is no next-step link to vitals. |
| 3 | Vitals and triage confirm (0:55) | PASS | NEWS2 8 gives "Suggested triage level 2". The nurse confirms, and a confirmation card appears. |
| 4 | Doctor consult, considerations, note sign (1:05) | **FAIL** | The signed note reads **"[NAME_1]. Bianchi"**. The note lists 12 considerations for a 1-day sore throat, including lung cancer, TB and Stevens-Johnson syndrome. Each reads "Consider for clinician review: Consider…". |
| 5 | Orders: Augmentin, alert, override, submit (1:35) | PASS-WITH-FIXES | The red "High: allergy conflict" shows with the patient's quote, and Submit unlocks only after a reason. But **the header reads "Nurse A. Rossi" on the Orders page** (the role resets), and the nurse role can fill in and submit prescriptions. |
| 6 | Pharmacist return with note (1:55) | PASS-WITH-FIXES | Return-with-note works. The record shows "Returned to [NAME_1]. Bianchi by Pharmacist M. Bianchi" (the redaction bug, and both roles share a surname). The High alert is amber here but red in Orders. The dose alert is titled "Dose outside usual range" when the dose was simply not checked. |
| 7 | Doctor edit and resubmit (2:05) | **FAIL** | **"Edit and resubmit" re-sent the unchanged Augmentin order at once.** The doctor could not edit, and the pharmacist note disappeared. I had to cancel and write a new order. Neither the queue nor the case page shows that an order was returned. |
| 8 | Pharmacist verify (2:15) | PASS-WITH-FIXES | Verify works and shows a "Verified" chip. The card then jumps below the cancelled order, with no receipt and no name. |
| 9 | Ops overview (2:35) | PASS | "What needs you now: 2", "Mock model (not AMD)", "Not measured on mock". Polish only. |
| 10 | Thai red flag (2:20) | PASS | The phone shows the full-screen red view, code B-013 and Thai copy, with no mascot. The nurse sees the red interrupt, the highlighted Thai quote, the gloss and a single Acknowledge. "Model-suggested, confirm" does not appear on mock, so it needs the AMD run. |
| — | Mascot placement | PASS | Fin appears only on the landing hero, the patient home hero and the patient done screen (routine case). It is absent from the red-flag screen and all clinician pages. |
| — | Language (TH/IT) | PASS-WITH-FIXES | Thai renders on the new vitals and consult pages, and `<html lang>` follows the UI language. P2 leftovers: stored English consideration text, the "English" language chip, and ACVPU labels clipped in Thai. |
| — | Accessibility basics | PASS-WITH-FIXES | The new forms have labelled inputs, a skip link and `aria-live` suggestions. Focus falls to `<body>` after sign, submit and verify. The consult's typed-line input has no accessible name. There are 40 "Edit" buttons with no unique names. |

## Ranked fix list

### P0 (breaks the video)

1. **`lib/pipeline` · clinician names are redacted to "[NAME_1]".**
   - **Where:** `pipeline.ts:178` and `:199` call `redact(reviewerId)`. The same happens for the note signer, the prescriber and "Returned to …".
   - **What:** "Dr. M. Bianchi" becomes "[NAME_1]. Bianchi" on the signed-note receipt, the prescription card, the pharmacy queue and the return banner.
   - **Fix:** do not redact staff IDs that come from the fixed staff list. Redact patient text only.
   - **Screens:** `final-p0-signed-note-name-redacted.png`, `final-p0-returned-to-NAME1-same-surname.png`.
2. **`app/(orders)` · "Edit and resubmit" resubmits without editing.**
   - **Where:** `_lib.ts:109` and the matching handler.
   - **What:** one click put the same Augmentin 625 mg order back to "Submitted, waiting for pharmacist", and the pharmacist's note vanished. The script needs the doctor to change to a safe drug.
   - **Fix:** this button should open the order in the form, pre-filled with the pharmacist note visible; Submit then sends the edited order. Or rename it "Resubmit unchanged" and make "Edit" the primary action.
   - **Screen:** `final-p0-edit-and-resubmit-resent-unchanged.png`.
3. **`components/ui` AppShell and `app/(orders)` · the role resets to Nurse on Orders and Vitals.**
   - **What:** after switching to Doctor on the case page, clicking "Orders" opens the page as "Nurse A. Rossi". The `(orders)` route group re-initialises the role. Switching role from the Pharmacy page also lands on `/review` as Nurse.
   - **Fix:** persist the role (and the signed-in person) in storage or the URL across route groups, like the language. Make the prescribing form read-only for Nurse.
   - **Screen:** `final-p0-orders-role-reset-to-nurse.png`.

### P1 (judges will notice)

4. **`lib/pipeline` · the summary "Allergies" field ignores the structured allergy list.**
   - **What:** the patient said "allergic to penicillin, it gives me a rash". Pharmacy and Orders know it (`summary.allergies` = penicillin, supported), but the summary field says "Not mentioned yet. Required and not known."
   - **Fix:** fill the field from the supported allergy entries.
   - **Screen:** `final-p1-allergies-missing-but-said.png`.
5. **`lib/pipeline` (consider rules) · considerations fire on single keywords.** "Fever", "cough" and "rash" trigger 12 considerations, including lung cancer (smoker over 40), TB, agranulocytosis on carbimazole and SJS/TEN. This patient is 34 with no such history, and the rash is the allergy history.
   - The Orders page then lists "Lumbar puncture" as considered.
   - On camera this reads as alarmist and undercuts "fixed curated list".
   - **Fix:** honour each rule's qualifiers (age, smoker, drug), or cap the list at the top 3 by evidence.
6. **`app/(clinician)` consult · consideration copy and controls.**
   - "Consider" chip + "Consider for clinician review: Consider sepsis" says "consider" three times. Use the chip plus "Sepsis".
   - Each card repeats "AI suggestion for clinician judgement, not a diagnosis" under a "Rule" chip. Saying "AI" contradicts the script ("from a fixed rule list"). Use one header line: "Rule-based, for clinician judgement. Not a diagnosis."
   - The Considerations panel shows "Asked / Dismiss". "Keep in note" exists only in the note. Put "Keep in note" on the panel cards.
   - **Screen:** `final-p1-considerations-asked-consider-consider.png`.
7. **`app/(clinician)` consult · the signed note and what comes next.**
   - After signing, the card still says "Draft visit note" with the amber "Draft for clinician review" banner. It should read "Visit note, signed".
   - The receipt's only button is "Next case B-001". Add "Write orders" (the next beat in the script).
   - "Presenting complaint" dumps raw lines such as "Patient report: No". Show only the patient's turns that carry a complaint.
8. **`app/(clinician)` · the doctor cannot see a returned order.** No badge appears on the queue row or case page. The script says "doctor view shows Returned by pharmacist". Add a "Returned by pharmacist" chip on the queue row and the case hero, linking to Orders.
9. **`app/(pharmacy)` · the same alert looks different and is mislabelled.**
   - "High: allergy conflict" is amber in Pharmacy but red in Orders. Use the same red for High everywhere.
   - The `dose_range` label "Dose outside usual range" (`_lib.ts:50`) is shown for MR-DOSE-UNCHECKED, whose body says "Dose not checked". Use "Dose not checked".
   - The queue row shows "Prescriber override · 1 to check" and hides the High allergy alert.
   - **Screen:** `final-p1-pharmacy-high-alert-amber-dose-outside-range.png`.
10. **Staff list (`(pharmacy)/_lib.ts` and `(clinician)/review/_lib.ts`) · "Dr. M. Bianchi" and "Pharmacist M. Bianchi" share a name.** On screen it looks as if the same person prescribed, returned and verified. Rename the pharmacist (for example "Pharmacist S. Chaiyo").
11. **`lib/pipeline` (`mock.ts`) · English complaint coverage.** With English now the primary language, "sore throat" and "fever" are not recognised, so the patient is asked the main-problem question again. Add English `sore throat` and `fever` patterns, or record the patient line with a recognised phrase.

### P2 (polish, if time)

- **`app/(clinician)` consult:**
  - No "Next: vitals" link after the nurse consult.
  - Consent text appears twice (checkbox label and paragraph).
  - The typed-line input has no accessible name.
  - Announcements end in "?.".
  - Toggling "Keep in note" makes the page scroll jump.
- **`lib/pipeline` `consult.ts:207`:** nurse-typed lines are saved as `inputMode: 'voice'`, so the transcript labels them "Spoken (speech-to-text)". This is untrue.
- **Case page:** does not show the confirmed triage level or the NEWS2 score.
- **`app/(orders)`:**
  - The page title is "Vitals and orders" on both pages.
  - "Dose not checked — verify…" uses a banned dash.
  - "Cancel order" has no confirmation.
- **Vitals:**
  - ACVPU pills are clipped at the card edge, worse in Thai.
  - The previous-vitals table has no ACVPU or O2 column.
  - Radio names are "no" and "yes".
- **`app/(pharmacy)`:**
  - The verified card drops below the cancelled one.
  - "medrules 1.1" shows as raw text.
  - The reconciliation cards say "No medicines mentioned" and "No alerts" while a high-alert prescription sits above them.
- **`app/(ops)`:**
  - The greeting says "Good afternoon" at 21:42 while other pages say "Good evening".
  - While loading it shows "Last updated No measurement ICT".
  - Triage level and order status do not reach the board.
- **`apps/mobile`:**
  - The patient web build keeps `<html lang="en">` in Thai.
  - Earlier stale-session P0: not reproduced. The red flag persisted correctly and "New intake" cleared it.

## Remaining P0/P1, one line each
- P0 · lib/pipeline · clinician names redacted to "[NAME_1]. Bianchi" (signer, prescriber, return banner).
- P0 · app/(orders) · "Edit and resubmit" resends the unchanged order; the doctor cannot switch drugs.
- P0 · components/ui + app/(orders) · role resets to Nurse on Orders and Vitals and on cross-surface switches; the nurse can prescribe.
- P1 · lib/pipeline · Allergies field says "Not mentioned yet" although penicillin is captured.
- P1 · lib/pipeline · considerations over-fire (lung cancer, TB, SJS for a 1-day sore throat).
- P1 · app/(clinician) · "Consider… Consider" copy; "AI suggestion" on rule items; no "Keep in note" on panel cards.
- P1 · app/(clinician) · the signed note still says "Draft"; after signing it offers "Next case" instead of "Write orders"; raw "Patient report: No".
- P1 · app/(clinician) · no "Returned by pharmacist" signal for the doctor.
- P1 · app/(pharmacy) · High is amber here but red in Orders; "Dose outside usual range" is wrong for an unchecked dose; the queue hides the High alert.
- P1 · staff fixtures · doctor and pharmacist both named M. Bianchi.
- P1 · lib/pipeline mock · English "sore throat" and "fever" not recognised.
