# W6 Patient mobile polish

STATUS: done. Not committed. tsc, expo lint, `expo export --platform web` all pass.

## Changes
1. Tab bar symmetric: Home, My visit, (raised +), Help, Language. Language is only active before an intake starts (the session language is fixed on the server); during a session it is greyed. Tab bar still hidden on the red-flag screen; the + is disabled while a session is escalated.
2. "How it works" is now one card with a vertical numbered list (title + description wrap freely). Nothing truncated in th/it/en.
3. Fonts come from tokens' `mobileFont("sans", lang, weight)` and `scbxFont` (local helper dropped).
4. Inline SVG icons (`src/components/icons.tsx`, react-native-svg via `npx expo install`): alert (red-flag disc), check (Done), plus, and tab icons (home, visit, help, globe). All decorative (hidden from screen readers; labels sit on the parent control).
5. Thai typed input verified end to end (see below).
6. Dev gear hidden: see demo command.
7. Web hosting under `/patient`: `experiments.baseUrl = "/patient"` in app.json. `src/api.ts`: base URL = `EXPO_PUBLIC_API_URL` if set, else `""` (same origin) on web and `http://localhost:3000` on native.

## Demo recording command (no Expo gear, production JS)
```
cd apps/mobile
npx expo start --no-dev --minify --port 8081
# then open Expo Go with the FAB disabled:
xcrun simctl openurl booted "exp://127.0.0.1:8081?__expo_disable_fab=1&__expo_disable_onboarding=1"
```
Backend must be running at http://localhost:3000. The gear and dev menu are gone in this mode.

## Web under /patient (for the orchestrator)
- Build: `cd apps/mobile && npx expo export --platform web --output-dir <dir>/patient` (leave EXPO_PUBLIC_API_URL unset so the app calls same-origin `/api/...`). Assets and scripts are prefixed `/patient/`.
- Copy the output into `apps/web/public/patient/` (Next serves `public/patient/index.html` only at `/patient/index.html`, so add a rewrite `/patient` and `/patient/:path*` to `/patient/index.html`; the app is a single-page export (`web.output: "single"`), so deep links such as `/patient/intake` also need that rewrite).
- Checked: served from a static server at `/patient/` the app loads, fonts load, API calls go to the configured base.

## Verification
- iOS Simulator (production-style run, no gear): home with symmetric tab bar and icons (`v2c-mobile-1-home-tabs.png`); Thai home and Thai intake screens checked live.
- Thai typing: the simulator tool cannot insert Thai (clipboard paste is ignored and `simctl pbcopy` does not surface a Paste menu on this iOS 27 runtime). Verified instead on the web build in the browser pane (same React code, mobile viewport 375x812), typing into the real answer field:
  - Thai red flag: "เจ็บหน้าอกมาก เหงื่อออกเต็มตัว" -> red screen B-025 with Thai message (`v2c-mobile-3-redflag-th-typed-web.jpg`).
  - Thai routine: "ปวดหัวมา 2 วัน" -> Thai follow-up "อาการเริ่มเมื่อไรคะ" with Thai chips (since today / since yesterday / this week), progress "1 จากไม่เกิน 3", ledger card with the redacted text (`v2c-mobile-4-thai-routine-web.jpg`).
- Not re-captured natively after the icon change: red-flag disc and Done check icon (seen on web only); Help tab.

## Risks / notes
- `form_input` sets the value programmatically, so this is not a keyboard-level IME test; a real Thai keyboard on a device is still untested.
- The Language tab does not switch language mid-intake by design.
- Name-redaction gap in `apps/web/lib/pipeline/redact.ts` (capital "Sono Marco Rossi") is still open for the AI engineer.
- `@expo-google-fonts/*` packages were removed in W5; the font files live in `apps/mobile/assets/fonts`.
