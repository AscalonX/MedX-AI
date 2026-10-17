# W3 Pharmacist web builder report

STATUS: done, pending live engine data. /pharmacy and /pharmacy/[id] work end to end against fixtures; live path is coded but untested (engine does not return medications / pharmacy-review yet).

## Files (all under apps/web/app/(pharmacy)/)
- `_fixtures.ts` 3 synthetic sessions (F-201 Italian, paracetamol x2 -> max_dose_risk + duplicate; F-202 Thai, penicillin allergy + Augmentin -> allergy_conflict high, unmatched herbal; F-203 English, warfarin + ibuprofen -> interaction high, allergies not stated, atorvastatin discontinued). Evidence offsets are computed from the text, so every quote verifies.
- `_lib.ts` labels, fetch, queue sort, `blockers()`, `buildQuestions()` (th/it/en), `applyReview()` (local stand-in for the endpoint), evidence selection.
- `_shell.tsx` provider + header (reviewer select "Pharmacist M. Bianchi" in localStorage `medx.pharmacist`, language toggle sharing `medx.lang`). Data layer: polls GET /api/sessions; sessions with `summary.medications` are used live, otherwise fixtures with a "Fixture data" badge. Fixture actions stay in browser memory; live actions POST /api/sessions/:id/pharmacy-review.
- `_queue.tsx`, `_workspace.tsx`, `pharmacy/layout.tsx`, `pharmacy/page.tsx`, `pharmacy/[id]/page.tsx`.

## What it does
- Queue: unhandled high alerts pinned first (signalTint + 2px signal rule, "N high" badge), then pending, in review, reconciled.
- Sheet: patient's words (own language, serif) -> generic and class -> dose / frequency / timing as form blanks. Marks: supported = ink with InkConfidence; unsupported = PencilField; unmatched = blank line plus "Identify" (free-text generic name, no search); edited = old value struck through plus "Edited by pharmacist, name"; verified = outline badge; discontinued = struck plus badge. Verify / Edit / Discontinue (two-step, never deletes).
- Click any med, allergy or alert -> EvidenceHighlight in the transcript (alert also marks its linked meds and allergies; linked rows get paper background). Arrow keys move between rows, Escape clears.
- Allergies: entries with reaction; "No known allergies" only when the allergies field is supported with a quote (quote shown); otherwise blank line "Not stated, ask the patient".
- Alerts column: severity, kind, message and action via LangMorph (th/it/en), source, linked meds; Acknowledge / Resolved / False alarm (note required for false alarm). Reviewed alerts stay with "by X, time, note".
- Questions for the patient: from unmatched meds, missing dose/frequency, unstated allergies, missing reaction, and unhandled alerts; patient language in serif plus clinician language beneath.
- Sign off: disabled with a visible "Blocked:" reason until every high alert is handled and no medicine is unmatched or unsupported (my addition: unsupported pencil meds also block). After sign-off the sheet is read only.
- Footer: provenance line, expandable audit list (live: audit from GET /api/sessions/:id; fixtures: local), disclaimer text.

## Tests
- `npx tsc --noEmit` in apps/web: clean (no errors in any folder at last run).
- `npx eslint 'app/(pharmacy)'`: clean.
- Browser (own tab): queue, all 3 fixtures, evidence highlight for an alert (quotes and linked rows), Identify + Acknowledge on F-202 (sign-off unblocked), language switch th/it/en, 1440 and 1024 layouts, 0 console errors, no unnamed controls (DOM check). No unit tests added; `applyReview`/`blockers` are pure and easy to cover if wanted.

## Evidence
docs/reports/screens/pharmacy-queue.png, pharmacy-th-penicillin-1440.png, pharmacy-evidence-highlight-1440.png, pharmacy-en-warfarin-1440.png, pharmacy-en-warfarin-1024.png.

## Risks
- Live path unverified: assumes GET /api/sessions returns full summaries with `medications` (it does for other fields) and POST returns the updated session or 2xx.
- docs/clinical/PHARMACY-SPEC.md did not exist when I finished, so the layout is not aligned to its "one screen" section; re-check when it lands.
- Fixture alert text and rule IDs are mine, not from medrules.json; the Doctor's file should replace them.
- Language setting `medx.lang` is shared with the clinician screen (same key).
- Contrast checked by token (DIRECTION table), not measured in the browser. Reduced motion handled by the global CSS and the house components.

## Contract requests
1. `MedicationEntry.previous?: { generic, dose, frequency }` (and `reviewerId`/`reviewedAt` per med) so strike-through and "verified by" survive reload; now strike-through is session-memory only and reviewer comes from the audit log.
2. Allergy review actions (`AllergyReviewAction`) in PharmacyReviewReq: allergies are read-only today.
3. A way to say "no known allergies" in the contract (now inferred from the `allergies` ExtractedField with evidence and an empty `allergies[]`).
4. Pharmacy-review audit payload shape: I read `payload.medActions`, `payload.alertActions`, `payload.complete`.

## Next
Wire to live when Codex lands medications and the endpoint; swap fixture alert copy for medrules.json messages; align with PHARMACY-SPEC.md.
