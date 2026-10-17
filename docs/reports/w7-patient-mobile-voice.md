# W7 Patient mobile: voice agent

STATUS: done. Not committed. tsc, expo lint, `expo export --platform web` pass. Native dev build compiled and ran in the iOS Simulator.

## What was built
- Mic button on the intake answer card (`src/components/mic.tsx`): 72pt teal to ocean gradient circle, pulsing ring scaled by input level while listening, 7 live level bars. Reduced motion: no pulse, bars stay at rest.
- `src/voice.ts` (`useVoice`): `expo-speech-recognition` (SDK 58, v58.0.0). Locale from session language: th-TH / it-IT / en-US. Interim results shown live in the answer field (read-only while listening); stops on silence (engine) or on tap. Permission denied, unavailable engine and "heard nothing" each show a calm message and leave typing available; a 2 s watchdog after Stop prevents getting stuck on "Listening" (iOS did not emit `end` when nothing was heard; found and fixed in the simulator).
- Confirm before sending: after listening the transcript lands in the editable field with "Is this what you said? Check the words and fix any mistake before sending." and two buttons, Send and Try again. Nothing is sent automatically. Send posts `inputMode: "voice"` (typed answers post `"text"`; an edited voice answer stays `"voice"`). Verified server-side: turn stored with `inputMode: voice`.
- Read aloud: speaker toggle (SVG icon, switch role) on the question card using `expo-speech` in the session language. Default off until the patient taps the mic (voice mode), then on; toggling off stops speech and is remembered. Red-flag message is read once, slowly, if the toggle is on.
- Accessibility: voice optional, text field always there, live caption always visible, 44pt+ targets, VoiceOver labels and live region, reduced-motion respected.
- Config: `expo-speech-recognition` plugin in app.json with mic and speech-recognition usage descriptions. `ios/` and `android/` are already ignored by apps/mobile/.gitignore. `inputMode` added to `addTurn()` in `src/api.ts`.

## Verification
- Native dev build: `npx expo run:ios --device "iPhone 17"` (needed `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods in this shell). App installed as dev.medx.bridge. The real iOS permission prompts appeared (speech recognition, then microphone, with our texts); after Allow the real recogniser started (listening state, pulsing ring) and, with no audio in the simulator, recovered to the "We did not hear anything" message after Stop.
- Speech content could not be spoken into the simulator, so the flow with text was driven with a test-only transcript injector: `EXPO_PUBLIC_VOICE_FAKE=1` makes the mic "hear" a scripted sentence per language. Used in the iOS dev build (listening -> confirm) and in the web build at 375x812 (listening -> confirm -> Send -> next question; stored as `inputMode: voice`). Never set this flag for a real demo.
- Real Web Speech API path (Chrome/Safari microphone) and Thai/Italian recognition quality are not tested; on-device speech content and TTS audio could not be heard here (speaker toggle state shown only).
- Screenshots (docs/reports/screens/): v3-mobile-voice-1-idle-web, -2-listening-web, -3-confirm-web (.jpg); -4-idle-ios, -5-listening-ios, -6-confirm-ios, -7-permission-ios, -8-real-listening-ios, -9-nospeech-ios (.png).

## Demo recording command
Backend running at http://localhost:3000, then:
```
cd apps/mobile
npx expo run:ios --device "iPhone 17"          # first time only, builds the dev client (ios/ is git-ignored)
npx expo start --dev-client --no-dev --minify --port 8081
xcrun simctl openurl booted "dev.medx.bridge://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1"
```
Grant microphone and speech permissions once. For a scripted take without speaking, start Metro with `EXPO_PUBLIC_VOICE_FAKE=1` in front. Web demo: build as in W6 and open `/patient/` in Chrome (Web Speech API, needs mic permission and HTTPS or localhost).

## Risks
- Apple speech recognition sends audio to Apple (shown in the iOS prompt); Thai and Italian support depends on the OS. Synthetic data only; the privacy note on Home applies.
- ASR can mishear: mitigated by mandatory confirm and editable text; the clinician sees `inputMode: voice` on the turn.
- On the simulator the Mac microphone is used; none was available to us.
- Name-redaction gap in apps/web/lib/pipeline/redact.ts (capital "Sono Marco Rossi") is still open for the AI engineer.
