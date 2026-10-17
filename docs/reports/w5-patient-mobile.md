# W5 Patient mobile restyle ("calm clinical banking")

STATUS: done. Not committed. All W3/W4 behaviour and safety fixes kept.

## Changes
- Font: SCBXBeta2 Light/Regular/Bold for all languages, registered with expo-font under the exact names `SCBXBeta2-{Light,Regular,Bold}`. Plex/Newsreader/Noto loading and the four `@expo-google-fonts/*` packages removed. Fonts are chosen by a local helper in `src/components/ui.tsx` (not tokens' `mobileFont`, which still returns Plus Jakarta names in tokens.ts at the time of writing).
- `expo-linear-gradient` installed with `npx expo install`.
- New kit `src/components/ui.tsx`: T, Card (radius 22, soft navy shadow), GradientHero (teal to ocean, radius 28), Pill (gradient / white / quiet), Chip, Badge, Segmented (language), Page. All colours, radii, shadows from `@medx/shared` tokens.
- Home (`index.tsx`): greeting "Hello / Ciao / สวัสดี" + welcome line, language segmented control, GradientHero "Tell us what brings you in today" with white pill "Start" (creates the session in the selected language), privacy note card, "How it works" three small cards (Describe, A nurse reviews, You're called; numbered discs, no emoji), disclaimer. Session-create failure shows a warn card with "go to the desk" text and Try again.
- Intake (`intake.tsx`): code chip + "2 of up to 3" pill + thin progress bar; question as a large card; answer input card (radius 14, ocean focus ring); quick-answer chips (severity 0-10; onset/duration: since today / since yesterday / this week; allergies/medications/history: None) that fill the field, never auto-submit; gradient "Continue" pill; previous answers as a timeline of rounded cards (dot and connector, not chat bubbles). Ledger is still built from the redacted patient turns of `session.turns`; pending shows a neutral "Sending…" row. autoCorrect/spellCheck off.
- Red flag (`redflag.tsx`): full-bleed red gradient, white "!" disc, display text from patientMessage, big rounded white code card, "I'm at the desk" white pill that only changes the sub-line. No new-intake control for the patient; staff exit is still long-press the code 2 s + confirm. Tab bar is hidden on this screen.
- Done (`done.tsx`): gradient hero with big code and "A nurse will read your answers" (or "A nurse will talk to you directly" for needs_human), timeline card (Sent done; Being reviewed and Reviewed pending, no invented times), "What happens next" card.
- Tab bar (`components/tabbar.tsx`, mounted in `_layout.tsx`): Home / My visit / Help with a raised 60pt gradient centre "+" button (New intake). Centre: no session goes to Home; mid-intake goes back to the intake; finished session resets to Home; disabled while the session is escalated. New route `help.tsx` (desk instructions, code, 1669/112).
- Strings: `i18n.ts` extended (th/it/en).

## Tests
- `npx tsc --noEmit`: pass. `npx expo lint`: clean. `npx expo export --platform web`: builds.
- iOS Simulator, iPhone 17, Expo Go SDK 58, backend at localhost:3000 (mock model):
  - Italian: Home (Italiano) -> Inizia -> "Ho mal di testa da ieri sera" -> severity follow-up with 0-10 chips -> chip 7 -> pregnancy question with timeline of 2 cards -> allergies question with "Nessuno" chip -> Done with code B-021.
  - Thai home, then Thai-session red flag (English trigger phrase): red screen, tap "I'm at the desk" changes the sub-line, no tab bar, no exit; long-press code 3 s shows the staff confirm (cancelled).
- Screenshots (docs/reports/screens/): v2b-mobile-1-home-en, -2-intake-it, -3-followup-chips-it, -4-timeline-it, -5-done-it, -6-home-th, -7-redflag-th, -8-redflag-staff-confirm (.png).

## Risks / notes
- Thai keyboard input still not typed in the simulator (tool limitation); the Thai trigger used English text. Thai rendering in SCBXBeta2 verified on Home and the red-flag screen.
- Tab bar is a custom component, not Expo Router tabs; "My visit" routes to the screen for the current session state. Help tab not screenshotted.
- "How it works" cards and the tab bar overlap content at the bottom edge until scrolled (page has bottom padding; the Expo Go gear button in screenshots is a dev overlay).
- Italian pill reads "1 di max 3" to fit; the opening question is not numbered.
- The `!` in the red-flag disc and the check in Done are text glyphs (no icon library); swap for icons if the design lead supplies them.
- Name redaction gap in `apps/web/lib/pipeline/redact.ts` (capital "Sono Marco Rossi") from W4 is unchanged and still open for the AI engineer.
- Sending… state and the offline notice were not re-screenshotted after the restyle (same logic as before).
