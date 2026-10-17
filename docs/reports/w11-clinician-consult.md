# W11 clinician consult assistant

Status: built, type-checked and unit-tested, NOT verified in the browser (see Blocker). Not committed.

## Routes and files (app/(clinician))
- `/review/[id]/consult?mode=nurse|doctor`: `review/[id]/consult/{page,_consult,_c18n,_fixture,_speech,_guard}.ts(x)`. Entry button "Start history taking" (nurse) / "Start consult" (doctor) on the case header; the AppShell role switch changes the mode (frame now exposes `clinicianRole`).
- Listening: Web Speech API (continuous, interim results, en-US / th-TH / it-IT by speaker), big mic toggle with "Listening" state and live interim text, Patient / Clinician speaker toggle (hotkeys P and C), typed-line fallback always available, privacy line as specified. Each final utterance posts `consult/turns` with a `clientTurnId`.
- Live transcript with speaker chips and the evidence highlighter (suggestion or note line selected); live summary strip of required fields with FieldValue chips.
- Suggestions: top 3 open question cards (Ask next / Rule out with red accent, source chip, why, evidence quote, Asked / Dismiss), cl-enter slide (reduced-motion flattened globally), new cards announced via `aria-live`, red flags wrap the page in the existing RedFlagInterrupt.
- Design decision applied: popups hold questions only. "Consider" items are filtered in one place (`_guard.ts`: doctor mode AND kind consider) into a separate doctor-only "Considerations" panel (max 4, rules first) with the permanent label "AI suggestion for clinician judgement, not a diagnosis" (comma instead of the em dash, per DIRECTION). Test: `npx vitest run _guard` (2 passing).
- Doctor mode: Draft visit note (sections in spec order, evidence quote on hover/focus plus transcript highlight, unsupported lines in needs-check style, inline edit, considerations marked "Keep in note", dropped at signing unless kept), disclaimer always visible, Sign note blocked with a reason while red flags are unreviewed, teal receipt with Next case.
- Typed fixture (`_fixture.ts`) takes over when the consult routes do not answer, shown with a "fixture" badge. Keyword logic only; its summary strip uses a small keyword overlay.

## Blocker
From about 20:00 the dev server on :3000 returned 500 for every page and API route (including /favicon.ico and /api/health) while the Codex backend was mid-change, so I could not open the consult page, drive it with the typed fallback, or take v6-consult-nurse.png and v6-consult-doctor.png. I tried to start a private copy of the app on another port to verify; that was denied, so I stopped. Web Speech was also never exercised (the embedded browser may lack it). tsc and eslint are clean for app/(clinician) and app/page.tsx; the only tsc errors are in app/(pharmacy) and lib/pipeline/consult.ts (severity "high" not a RedFlagSeverity), which are not mine.

## Open
- Verify live once :3000 recovers, then take the two screenshots.
- Considerations kept at signing are sent as `edits` with unchanged text; the backend should turn those lines into `clinician` lines.
- Nurse cannot sign: the note panel is doctor-only, per CONSULT-SPEC.
- th/it copy needs native review.

## Verification (after :3000 recovered)
- Ran against the real consult routes (no fixture badge; GET/POST consult, turns, suggestions, note all answered). On B-003 via the typed fallback: patient and clinician lines posted with P/C hotkeys, the chest-pain line fired two red flags (banner above the page) and rule_out cards; the clinician question "Does the pain go to your arm?" showed as Clinician and the matching suggestion went to asked; doctor mode: Considerations panel present (empty for this case), Draft note produced all 7 sections, Sign was disabled with "Acknowledge the red flag before signing.", and after acknowledging, Sign note produced the teal receipt with Next case.
- No contract mismatches found. Cosmetic: the draft note lists many "not stated" needs-check lines (duration, location, associated symptoms, history) that come from the backend; and the escalation rule_out cards repeat the red-flag banner.
- Screenshots: `docs/reports/screens/v6-consult-nurse.png`, `v6-consult-doctor.png` (headless Chrome, full page).
- Case header now links "Vitals" (nurse) and "Orders" (doctor) to `/review/[id]/vitals` and `/orders`.
- Not exercised: Web Speech (the pane has no usable microphone). Note: the shared browser pane is driven by several agents; I worked in my own background tab.
