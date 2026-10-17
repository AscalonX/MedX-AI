# W5 Pharmacist web restyle (DIRECTION v2)

STATUS: done. All behaviour and the W4 safety fixes are unchanged; only layout and styling were rebuilt. tsc and eslint clean.

- `/pharmacy`: inside `AppShell` (Pharmacist role active; role switch routes to /review and /ops), time-of-day greeting in th/it/en, reviewer select and language pill in the top bar. Three `StatTile`s (pending, high alerts plus red flags open in red only when above zero, reconciled today). Queue as rounded cards with count pills; red only for unhandled high alerts and unreviewed red flags, amber for "to check" and "needs human review".
- `/pharmacy/[id]`: `GradientHero` header (code, language, pharmacy status pill, medicines / allergies / alerts counts; counts show "-" when abstained). Medicines as a statement-style card list: round initial icon, patient's words as title, generic and class as subtitle, dose and frequency on the right, v2 state chip (From patient's words / Needs check / Unmatched / Verified / Edited / Discontinued). Pencil entries use the amber `mx-pencil` treatment across the whole row. Allergies card (same chips), alerts card (high red, moderate amber, handled neutral), "Questions for the patient" card in both languages, audit/provenance card with the rule-set statement. Sticky sign-off pill with the blocking reason in amber.
- Transcript is a sticky side card at 1600px and above, a drawer below (three columns were too tight at 1440). Highlighter unchanged.
- Red-flag band restyled as a read-only signal-tint card with link to /review/<id>.

## Verification
Browser, 1440x900: live B-016/B-017/B-018 (queue, B-017 detail with highlight, B-018 abstained panel) and fixtures via `?fixtures=1` (F-203 pencil entries and combined blockers, F-202 hero). Screens: docs/reports/screens/v2b-pharmacy-*.png.

## Notes
- During the pass a transient build error from the clinician folder (`./_morph` removed) broke the dev server for a few minutes; it resolved itself. Fixture screenshots taken in that window were retaken after.
- The v2 shell has no h1; I added an sr-only h1 per page.
- Font is whatever the design lead wires; I set none.
- The "clear a field" contract request from W4 (server rejects empty strings) is still open.
