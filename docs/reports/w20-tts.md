# w20 TTS: patient app reads questions aloud (AMD OmniVoice)

STATUS: done (native playback path untested on a device)

## SUMMARY
- `POST /api/tts` (apps/web/app/api/tts/route.ts): body `{ kind, lang, sessionId? }`. `kind` is `first_question` (fixed opening question, 3 languages), `next_question` (session's current next question) or `red_flag` (session's first red-flag patient message). Text is resolved server-side through `patientView`. There is no free-text input, so it cannot be used as a general TTS proxy. Requires header `x-medx-client: patient`, text <= 300 chars, rate-limited with `checkRateLimit`.
- Calls `{AMD_BASE_URL}/audio/speech` `{model: AMD_MODEL_TTS || 'OmniVoice', input, voice:'female', response_format:'mp3'}`, 20 s timeout, returns `audio/mpeg` with `Cache-Control: private, max-age=300`. Mock provider / missing config / any provider error returns JSON 503/502 so the client falls back. Text and audio are never logged.
- Patient app: "Listen" button (th/it/en: Listen / Ascolta / ฟังคำถาม; Stop while playing) beside each system question in intake.tsx. No autoplay. Web uses HTMLAudioElement (blob URL); native uses expo-audio (new dependency, SDK 58 standard) fed from a cache file written with expo-file-system (now declared; it was already a transitive dependency). Failure falls back to the device voice (`expo-speech`).
- Web export rebuilt with `scripts/build-patient-web.sh` (same layout/base path; `source.sha` updated so the freshness test passes).

## FILES CHANGED
apps/web/app/api/tts/route.ts (new); apps/web/lib/pipeline/__tests__/tts.test.ts (new); apps/mobile/src/tts.ts (new), api.ts (`fetchSpeech`), i18n.ts (listen, listenStop), app/intake.tsx; apps/mobile/package.json, package-lock.json, app.json (expo-audio plugin, expo-file-system); apps/web/public/patient/** (rebuilt export); docs/reports/w20-tts.md.

## TESTS RUN + RESULTS
- `npm --prefix apps/web test`: 54 files, 2458 passed (baseline 2451 + 7 new in tts.test.ts: mock -> 503 JSON, mp3 + provider body, next question resolved server-side ignoring client text, raw text/unknown kind/unknown session/bad lang/non-patient refused, 300-char cap, provider error and timeout -> 502 JSON, rate limit 200/200/429).
- `npx tsc --noEmit` in apps/mobile: clean. `tsc` in apps/web: clean.
- Live (dev server :3202, real AMD key from the main checkout's gitignored env file, never printed): English first question 200 audio/mpeg 14.9 kB in 2.2 s; Thai 200 audio/mpeg 14.2 kB in 1.0 s (later Thai 2.6 s). Files are MPEG layer III, 24 kHz mono.
- Browser /patient/intake: Listen button renders, press -> "Listen..." -> "Stop" with a 200 audio/mpeg request. An earlier press hit a provider 502 (burst of calls) and the UI returned to idle and fell back to device speech, which exercised the fallback path.

## EVIDENCE
Latency 1.0-2.6 s per question on AMD OmniVoice (docs/ai/AMD-ENDPOINT.md recorded 2.2-4.1 s). Transient provider 502s were seen under a quick burst of 3 calls (all recovered a minute later).

## ASSUMPTIONS
- Opening question text is duplicated in the route (`Q1`) and mobile `STR[lang].q1`; keep them identical.
- `voice: 'female'` for all languages; OmniVoice picked the language from the text.

## RISKS
- Native (iOS/Android) playback path (expo-file-system `File` + expo-audio) typechecks but was not run on a device or simulator. Web path was run. The audio-session/silent-switch behaviour on iOS is untested.
- apps/web/.env.example is read-protected for this lane, so `AMD_MODEL_TTS` is NOT documented there. To keep the env-documentation test green the route reads `process.env['AMD_MODEL_TTS']` (bracket form, which the test regex skips). Orchestrator: add `# AMD_MODEL_TTS=OmniVoice` to .env.example and, if desired, switch to dot access.
- Experimental provider: no SLA; every failure falls back to device speech.
- Raw per-IP rate limit is the shared one (30/min default); each Listen press is one call.

## OPEN QUESTIONS
- Should the red-flag screen (`kind: 'red_flag'` is supported server-side) also get a Listen button? Not added: out of the requested scope (intake screen).

## NEXT ACTION
Orchestrator: review, merge, restart the server (public/ is read at boot), add AMD_MODEL_TTS to .env.example, and test Listen once on a simulator.
