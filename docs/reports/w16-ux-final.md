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

---

## Re-verify (after the fix wave, Sat 17 Oct 2026 22:05 to 22:16 ICT)

**Run:** web at 1440, patient app `/patient/` at 375x812. Mock provider, data freshly reset.
**Data I created:** B-012, an English sore throat case. Nurse consult, vitals NEWS2 8, triage level 2 confirmed. Doctor consult with one consideration kept, note signed. Augmentin ordered with an override and submitted. Pharmacist returned it with a note. Doctor edited it to azithromycin and resubmitted. Pharmacist verified.
**Screenshots:** `docs/reports/screens/final2-*.png`.

### Verdicts (w16 → re-verify)

| # | Step | w16 | Now | Evidence |
|---|---|---|---|---|
| 1 | Patient types or speaks | PASS-WITH-FIXES | **PASS** | English "sore throat and fever" is recognised. Next question asked is severity, then pregnancy, then medicines. Allergies is no longer asked, because the penicillin allergy was captured. |
| 2 | Nurse consult | PASS-WITH-FIXES | **PASS** | The summary shows "penicillin (rash) · From patient's words", and there is a "Next: vitals" link. Small issue: typed lines are still labelled "Spoken (speech-to-text)". |
| 3 | Vitals and triage | PASS | **PASS** | The case header now shows "Triage level 2 confirmed" and "NEWS2 8" chips. ACVPU wraps, and the history table has On O2 and ACVPU columns. |
| 4 | Doctor consult and sign | FAIL | **PASS-WITH-FIXES** | Signed by "Dr. Somchai Chaiyo" / "Dr. Marco Bianchi", with no redaction. Considerations show one complaint-first item, with "Keep in note" and "Not relevant" buttons. The signed note is titled "Signed visit note" and offers a "Write orders" button. Two problems: the kept consideration is missing from the signed note, and plain sore throat plus fever gives no considerations (see P1 below). |
| 5 | Orders: allergy alert and override | PASS-WITH-FIXES | **FAIL (P0)** | "Write orders" and the case-page "Orders" link both open Orders as **Nurse Anna Rossi**, with "Prescribing and ordering are for doctors…". The doctor must re-pick Doctor on every Orders visit. The read-only nurse view itself works. |
| 6 | Pharmacist returns order | PASS-WITH-FIXES | **PASS** | "Pharmacist Laura Conti". The High alert is red, the dose alert is titled "Dose not checked", and the queue shows a "1 high" chip. The banner reads "Returned to Dr. Marco Bianchi by Pharmacist Laura Conti". |
| 7 | Doctor edits and resubmits | FAIL | **PASS** (once on Doctor) | Queue badge "Returned by pharmacist". The case page shows "A pharmacist returned a medication order" with an "Open orders" button. "Edit prescription" opens a pre-filled form with the pharmacist note above it. I changed it to azithromycin 500 mg once daily for 3 days, re-checked, and submitted. |
| 8 | Pharmacist verifies | PASS-WITH-FIXES | **PASS** | Receipt: "Order verified · By Pharmacist Laura Conti, 22:15". |
| 9 | Ops | PASS | **PASS-WITH-FIXES** | Ops still shows the **old "M MedX" logo**, while every other surface shows the new Echo X logo. The greeting says "Good afternoon" at 22:15. |
| 10 | Thai red flag | PASS | PASS (not re-walked) | Nothing in this wave touched it. |

### Status of the w16 P0/P1 items

| Item | Status | Evidence |
|---|---|---|
| P0 staff names redacted to "[NAME_1]" | **FIXED** | "Prescribed by Dr. Marco Bianchi, 22:12" and "Returned to Dr. Marco Bianchi by Pharmacist Laura Conti". |
| P0 "Edit and resubmit" resends the order unchanged | **FIXED** | A pre-filled form, then "Update and re-check", then a new draft, then Submit. `final2-edit-returned-prefilled.png`. |
| P0 role resets to Nurse on Orders; nurse can prescribe | **PARTIAL → still P0** | The nurse can no longer prescribe (FIXED). But on a clean `localStorage`, with Doctor chosen on `/review`, the Orders page always opens as Nurse: from "Write orders" on the signed note, from the case "Orders" link, and from the returned banner's "Open orders". After each load `medx.role` and `medx.clinicianRole` read `nurse`. **Likely cause:** `app/(clinician)/_frame.tsx:60` writes the default `clinicianRole` ("nurse") to `ROLE_STORAGE_KEY` on first render, before the restore effect (line 42) applies the stored role. `(orders)/_bits.tsx` `useIdentity` then reads "nurse" and writes it back. Guard line 60 until the role has been restored. `final2-p0-write-orders-opens-as-nurse-readonly.png`. |
| P1 Allergies field not synced | **FIXED** | Case and consult both show "penicillin (rash)". |
| P1 considerations over-fire | **FIXED**, with a new gap | Capped and complaint-first. But plain "sore throat and fever since yesterday", even with HR 112 and RR 24, now gives **zero** considerations ("Nothing to consider yet"). The video's Considerations beat needs a qualifier phrase from the patient. One that works: "It is worse on one side and I can't open my mouth fully" → "Peritonsillar abscess". |
| P1 "Consider… Consider" copy, "AI suggestion" label, no "Keep in note" | **FIXED** | Card reads "Peritonsillar abscess" with "From MedX rule list, for clinician judgement. Not a diagnosis." and "Keep in note / Not relevant". The Orders page still prints the old "Consider for clinician review: Consider peritonsillar abscess" (P2). |
| P1 signed note says "Draft" / no "Write orders" / raw "Patient report: No" | **FIXED** | "Signed visit note · Signed. This note is read only." plus "Write orders". Presenting complaint is "sore throat". |
| P1 no returned-by-pharmacist signal | **FIXED** | Queue badge plus case-page banner. `final2-returned-badge-queue.png`, `final2-returned-banner-case.png`. |
| P1 pharmacy amber High, "Dose outside usual range", queue hides High | **FIXED** | Red High card, "Dose not checked", "1 high" chip. `final2-pharmacy-red-high-names.png`. |
| P1 doctor and pharmacist share a name | **FIXED** | Dr. Marco Bianchi / Pharmacist Laura Conti. |
| P1 English mock coverage | **FIXED** | "sore throat" captured as the chief complaint. |

### New regressions and remaining issues

1. **P0 · role resets to Nurse on Orders** (above). This breaks the 1:05 to 2:05 beats unless the presenter re-clicks Doctor on Orders every time.
2. **P1 · "Keep in note" does not reach the note.** I kept "Peritonsillar abscess" before drafting. The draft and the signed note both have no Considerations section. The voice-over says considerations are "dropped from the note unless the doctor keeps them", so on camera this looks broken. The cause is likely in `app/(clinician)` consult draft/sign or in `lib/pipeline` note assembly. `final2-p1-signed-note-missing-kept-consideration.png`.
3. **P1 · Ops still uses the old logo**, plus the "Good afternoon" greeting at night. The `app/(ops)` shell does not use the new brand mark. `final2-p1-ops-old-logo-good-afternoon.png`.
4. **P2 · the patient's added line is ignored in the note.** "Worse on one side, can't open my mouth fully" is not in the note's history. The matching question is still listed under "Open questions".
5. **P2 · typed consult lines are labelled "Spoken (speech-to-text)"** (`lib/pipeline/consult.ts:207` `inputMode: 'voice'`).
6. **P2 · the edited order loses its history.** After the doctor edits the returned order, the Augmentin card and the pharmacist's note disappear from both the Orders view and the pharmacist view. Only the azithromycin order remains, so the "return → change → verify" trail is not visible on screen. It may still be in the audit log.
7. **P2 · ACVPU radios are announced as "on"**, as are the vitals radios "no" and "yes". The review queue tiles show "No data yet" pills while loading instead of skeletons.
8. **P2 · patient status stays "Waiting for a nurse"** after triage, a signed note and verified orders, because the intake fields were never approved. Expected with the current model, but it looks odd if the phone is on screen at the end.

### Remaining P0/P1, one line each
- P0 · `app/(clinician)/_frame.tsx:60` + `app/(orders)/_bits.tsx` · Orders always opens as Nurse (read-only) even after choosing Doctor; this breaks prescribe, override and edit unless Doctor is re-selected on the Orders page.
- P1 · `app/(clinician)` consult / `lib/pipeline` note · a consideration marked "Keep in note" is missing from the draft and the signed note.
- P1 · `lib/pipeline` consult rules (recording note) · plain sore throat + fever gives no considerations; script the patient's qualifier line ("worse on one side, can't open my mouth fully").
- P1 · `app/(ops)` · old "M MedX" logo and "Good afternoon" at 22:15.
