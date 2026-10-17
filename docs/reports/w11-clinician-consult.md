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

## Mali and role-aware identity
- Landing hero uses `mascot="wave"` (`screens/v8-landing-mali.png`); the empty queue state uses `mascot="pointing"`. No mascot on red-flag, alert, error, consult suggestion, considerations or note areas.
- The "Signed in as" selector follows the role: nurse names in nurse mode, doctors (Dr. M. Bianchi, Dr. S. Chaiyo) in doctor mode; switching role moves the identity to the first name of the new list. Verified in doctor-mode consult: options are the two doctors and the note signer uses the selected doctor.

## Safety must-fixes (MF-2, MF-3, MF-10)
- MF-3: sign, draft, turn and suggestion writes never fall back to fixtures and never show "Note signed" on failure. The server reason is shown ("Not saved: Every red flag requires clinician review before signing") and the note stays editable. Fixture mode (GET failure only) disables Sign with an explanation. Verified live on an escalated case by invoking the sign handler past the disabled button: 409 shown, no receipt.
- MF-2 (UI side): each consideration line has "Keep in note" (default off) and a "Will be dropped" chip; copy is "Considerations are dropped at signing unless you keep them."; kept lines are sent as unchanged-text edits at sign. The server still has to drop unkept lines (consult.ts), otherwise the note keeps them.
- MF-10: a consent checkbox (en/th/it, EN wording from the review) gates the mic per session (sessionStorage); ticking it posts one clinician line "Consent noted: patient told this conversation is transcribed." through the existing turn route as the audit trail. The privacy line now uses the review's vendor-cloud wording. Typed lines are not gated. Verified: mic disabled before, enabled after, consent line in the transcript.
- Red-flag note lines have no Edit control.

## Final UX audit fixes (w16)
- Role and identity persistence: the frame uses `STAFF` / `staffFor` / `ROLE_STORAGE_KEY` / `reviewerStorageKey` from `packages/shared/src/staff.ts`; the role is stored on change (also `medx.clinicianRole` for nurse/doctor), the identity is remembered per role and validated against the staff list. Verified: Doctor + Dr. Somchai Chaiyo survive a visit to /pharmacy and back to /review. Orders, pharmacy and ops shells must read the same keys to share it (they do not write them).
- Considerations: the condition shows once ("Consider for clinician review: Consider sepsis" becomes "Sepsis" under the Consider chip); rule items say "From MedX rule list, for clinician judgement. Not a diagnosis.", model items keep the AI wording; panel buttons are "Keep in note" (stays visible as "Kept in note", status asked because the contract has no keep status) and "Not relevant"; kept suggestions are matched to note lines by text. Not seen live (the mock produced no considerations for my test case).
- Signed note: title "Signed visit note", teal read-only banner instead of the amber draft banner, no edit/redraft/sign controls, receipt primary "Write orders" (to /review/[id]/orders) and secondary "Next case". Verified live.
- Returned by pharmacist: queue chip and a case-page banner with the pharmacist's note and an "Open orders" link when any medication order has status returned. Verified live on B-004 (Thai UI).
- Also: consult header "Next: vitals" link for nurses; announcements no longer end in "?.". Not done: confirmed triage/NEWS2 on the case page, "Presenting complaint" raw lines (server data), and the doubled consent paragraph.

## Leftovers (triage on case page, consent paragraph, ops role keys)
- Case header shows the triage state with a link to Vitals: "Triage level N confirmed" (or "Suggested level N, not confirmed"), "NEWS2 n", and a red-tint "Suggested level N is more urgent: re-confirm" when the suggestion is more urgent than the confirmed level. Verified on B-012 (level 2 confirmed, NEWS2 8); the re-confirm warning was not triggered live.
- Consult: the duplicated privacy paragraph is removed; the consent checkbox text carries the wording.
- Ops (`OpsDashboard.tsx` only): writes `medx.role=ops` and the ops identity (`medx.reviewer.ops`) on load, and writes the chosen role (and `medx.clinicianRole` for nurse/doctor) before navigating. Verified: ops stored role ops, switching to Doctor landed on /review with Doctor selected and Dr. Somchai Chaiyo kept. The ops header still shows the localized "head nurse" label, not the staff name.

## Re-verify fixes (role P0, ops shell, typed label)
- P0 root cause: `ClinicianFrame` wrote the default "nurse" to `medx.role` on mount before restoring, and Orders read it back. New `app/_shared/useStaffRole.ts` (`useStaffRole`, `readClinicianRole`, `writeClinicianRole`, `greetingFor`): restore first, write only on an explicit choice; `medx.role` holds the latest explicit choice on any surface, `medx.clinicianRole` remembers the last nurse/doctor so pharmacy or ops (which write "pharmacist"/"ops") cannot erase it. `ClinicianFrame` uses it and exposes `restored`; Orders' `useIdentity` (`app/(orders)/_bits.tsx`) no longer reads or writes storage and takes role and person from the frame.
- Verified live from empty storage: Doctor on /review, then the case Orders URL shows Doctor selected, Dr. Marco Bianchi, no read-only note; storage holds only the two explicit keys. After /ops (role ops) the clinician role stays doctor. Pharmacy still writes `medx.role=pharmacist` on mount, which is safe now but is the same pattern; it should call `writeClinicianRole`-style logic only on explicit choices (not in my files).
- Ops shell: house `Logo` replaces the old "M MedX" tile; greeting follows local time (verified "Good evening" at 22:xx).
- Typed lines: consult lines carry their entry mode ("Typed" for the box, "Spoken" for speech) in the consult transcript and the request now includes `inputMode`; the server still stores consult turns as voice (`consult.ts:217`), so the case-page transcript will keep saying Spoken for typed lines until the engine honours `inputMode`.
- Not done: radio accessible names (vitals/ACVPU are in another folder); kept-considerations check waits for docs/reports/w18-engine.md, which has not appeared yet.
