# W8 Pharmacist UX fixes (from w7-ux-audit items 13-17 and shared items affecting pharmacy)

STATUS: done; tsc and eslint clean for app/(pharmacy). Verified in the browser on live B-009 (Thai, reconciled), B-011 (abstained) and the queue.

- 13 Queue: white rows; urgency is the red icon disc plus a red chip ("N red flags", "N high"); amber chip for "to check" and "needs human review". Acknowledged red flags show neutral "N red flags, reviewed" (item 17); medicines are pluralised.
- 14 Dose: the patient's words are shown as-is with an "Original language: ไทย" chip when the patient language differs from the clinician language. Nothing is machine-translated (the contract has no translated dose; if it adds one it can sit above the original). Empty values are a visible "Not stated" text chip, not a blank pill.
- 15 Abstained: plain reason from a local map (`ABSTAIN` in `_lib.ts`; `lib/pipeline/messages.ts` did not exist, swap when it lands), a "Read the patient's words" primary button, an "Open clinician review" link and a line telling the pharmacist to ask the patient directly. Not done: a "checked by hand" sign-off with a note, because the contract has no field for it.
- 16 Alert help line under the buttons (acknowledge / resolved / false alarm), localized.
- Localisation: all chrome (queue, hero labels, forms, chips, transcript headings, audit toggle, questions' reasons, announcements) in th/it/en; times via `Intl.DateTimeFormat(lang, 24h)`, durations localized; `lang` on both page roots and on `<html>` (set from the shell). No em dashes in the folder.
- Sign-off success: teal receipt card (role=status) with who, localized date and time, and what was reconciled (medicines verified/edited/discontinued, allergies or stated NKA, alerts by action); the sticky bar disappears once reconciled.

Screens: docs/reports/screens/v4-pharmacy-queue.png, v4-pharmacy-abstained-next-steps.png, v4-pharmacy-receipt-original-language.png.

Not verified in the browser: th and it renderings of the new strings (wording is mine, not native-reviewed); focus handling after sign-off (the receipt is announced via role=status, focus is not moved).

## Final fix wave (w9 review items 3, 10, 12, 16, 17, 18)
- #3 Abstained summaries keep recorded deterministic alerts: a "Safety alerts (rules)" card with a note that extracted medicines are hidden (linked medicine names are not shown), hero alert count and queue counts unchanged, high alerts still block sign-off with the abstention reason. Verified live on B-011 (abstained, MR-INT-01 high).
- #10 Shell: polling is single-flight and suspended while a mutation runs; the generation counter is bumped at the start and at the end of every POST, so a GET that raced it cannot overwrite the result; failure refetches before controls unlock. Workspace audit refetches after each action.
- #12 Unsupported complaint in the queue now reads "Unverified: ..." (visible plus sr-only), localized.
- #16 Transcript drawer: trigger buttons carry aria-expanded and aria-controls; opening by button moves focus to Close, Close or Escape returns focus to the trigger; selecting a row opens the drawer without stealing focus. Checked in the browser.
- #17 Receipt signer and time come from the completed pharmacy_review audit event (`signOffEvent`), not `session.updatedAt`.
- #18 `auditLine(e, lang)` localized for th/it/en.
- Server 409 reasons are shown verbatim after a localized "Server refused" prefix; client blockers now cover abstention, unreviewed red flags, high alerts, unmatched/unsupported meds and unverified allergies.
- Stopped medicines: an alert whose linked medicine is discontinued or has "stopped" in its timing shows an amber "Patient says this medicine was stopped: confirm" note, independent of the engine's appended text.
- Not verified in the browser: the server-side 409 for red flags and allergies, and the stopped-medicine note against engine output (no live example existed). Screen: docs/reports/screens/v5-pharmacy-abstained-safety-alerts.png.
