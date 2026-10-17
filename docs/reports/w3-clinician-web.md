# W3 clinician web builder report

STATUS: done, all states verified against the running dev server. Nothing committed.

## FILES
New (all under `apps/web/app/(clinician)/review/`): `layout.tsx`, `page.tsx`, `[id]/page.tsx`, `_shell.tsx` (top bar, reviewer and language state, queue, 5 s polling), `_workspace.tsx` (summary sheet, red-flag review, actions, audit drawer, provenance, transcript), `_lib.ts` (API calls, labels, ordering), `_morph.tsx`.
Replaced: `apps/web/app/page.tsx` (entry sheet). This report. Screens: `docs/reports/screens/clinician-01-escalated.png`, `-02-awaiting-review.png`, `-03-approved.png`, `-03-needs-human-taken-over.png`.
No dependencies added. `components/ui`, pipeline, api and shared untouched.

## TESTS
- `cd apps/web && npx tsc --noEmit`: clean.
- `npx eslint 'app/(clinician)' app/page.tsx`: clean.
- Manual in the Browser pane at 1440 and 1024 against the seeded sessions (see EVIDENCE). No unit tests added (UI only; logic is thin).

## EVIDENCE
- Escalated (B-001 suicide, B-011 Thai chest pain, B-013): full-bleed interrupt pushes the sheet down, per-flag Rule / "Model-suggested, confirm" badge, Acknowledge and Mark false alarm. Band Acknowledge collapsed both flags of B-011 to the one-line strip. False alarm requires a note (server rule) and the flag stays listed as "Marked false alarm by Nurse A. Rossi, 02:38 PM. Note: ...".
- Awaiting review (B-003, B-004): fields in SPEC order with ink confidence squares, "Patient wrote:" original, required marker. Click or ArrowUp/Down selects a row, scrolls the transcript and sweeps the exact quote; other used quotes are dotted; Escape clears; live region announces "Evidence, turn N" or "No evidence quote". Edit gave struck old value + "Edited by clinician, Nurse A. Rossi" (reviewer taken from the audit log). Approve supported fields approved 6 fields; status flipped to Approved in queue.
- Needs human (B-005): serif sentence "This intake needs a person to review it.", reason in words, no values, Take over (with optional reason) then "Taken over by Nurse A. Rossi", audit drawer lists system and clinician events.
- Approved (B-004, B-008): "Approved, <reviewer>" stamps, ink badge in queue.
- Model-screen banner, pencil field and model-sourced flag: no seeded session has these, so I patched `fetch` in the page (red_flags call ok:false, an unsupported severity, a `source:"model"` urgent hit). Banner "Model safety screen unavailable. Rules still active.", pencil value with the margin note, "Confirm as written / Edit / Reject", and the "Model-suggested, confirm" badge all rendered. Not covered by a real session.
- Thai (B-011): Thai font per glyph, labels/flags switch via LangMorph, quotes not slanted. Italian switch checked via `lang` attributes.
- 1024 wide: queue 288 + sheet; transcript becomes a right drawer ("Patient's words" button, Close, Escape). Below 960 the queue is a top select (CSS only, not exercised in the pane).
- Reduced motion: handled by the global rule in globals.css; not toggled in the pane.

## RISKS
- Demo data was mutated during testing and persists in `apps/web/.data/store.json`: B-003 severity edited to "4/105/10" (typo, mine), B-004 approved, B-005 taken over, B-011 flags acknowledged, plus a test session B-013 (chest pain, one flag marked false alarm). Delete the store file and re-seed before judging if a clean queue is wanted.
- Edit writes the same string into th/it/en (server behaviour), so a clinician edit does not translate.
- Struck-through previous value is held only in page state; after a reload an edited field shows no old value (API does not return it).
- Approving is disabled until every red flag is acknowledged or marked false alarm (my safety guard, not in the spec).
- "Confirm as written" on a pencil field sends an `edit` with the same value, so the field becomes Edited rather than Approved.
- Escalated sessions have no extracted fields (pipeline stops), so required fields show "not captured" even if the patient wrote them (B-001 wrote age and allergies).
- Safari-style engines do not focus buttons on click; I focus the row in the click handler so arrow keys work.

## OPEN QUESTIONS
1. LangMorph (components/ui, design lead): it reads `mounted.current` during render, so any parent re-render replays the ink-in on unchanged text (labels blinked on every state change). I wrapped it in `_morph.tsx` (memo on content). Fix at source: animate only when text or lang change.
2. RedFlagInterrupt has one band-wide Acknowledge and no per-flag controls or source label. I added a "Red flag review" strip under the band for per-flag Acknowledge, Mark false alarm, and rule vs model source. Collapsed band says "Acknowledged" even when all flags were marked false alarm.
3. Copy: I used "Model-suggested, confirm" and "Mock model, not AMD" (no em dash, per DIRECTION section 1) instead of the dashes in the brief.
4. Clinician UI chrome (buttons, banners) is English only; field labels, group titles, flag text and values follow the th/it/en toggle. Thai and Italian labels in `_lib.ts` need native-speaker review.
5. Transcript has no translation under patient sentences (turns carry no translation in the contract).
6. Reviewer selector is a local stand-in (3 fixed names in localStorage), not authentication.

## NEXT
Clear and re-seed demo data; native check of th/it labels; fix LangMorph at source; decide if the Approve-after-acknowledge guard should stay; consider a seeded session with an unsupported field and a model red flag so the pencil and model-source states are demonstrable without patching.
