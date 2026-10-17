# W8 Patient mobile: UX fix wave

STATUS: done. Not committed. tsc, expo lint, web export pass. `scripts/build-patient-web.sh` re-run: `/patient` refreshed (apps/web/public/patient).

## Fixed (from docs/reports/w7-ux-audit.md, mobile items 27 to 30)
- 27 Live status: Done polls `GET /api/sessions/:id` every 4 s until a nurse has reviewed. Steps: Sent (time) -> In review (active ring + "A nurse is reading your answers now.") -> Reviewed (time from the review/takeover audit event) + "A nurse will call you." Hero title switches to "A nurse has reviewed your answers." (th/it/en, Lei). Check discs zoom in over 240 ms (instant with reduced motion), one light haptic on every status change, each row has an accessibility label, the title is a polite live region. Polling stops once approved or taken over. If a poll returns `escalated` the app jumps to the red-flag screen.
- 28 Persistence: `{session, lang}` stored under `medx.patient.v1` (AsyncStorage on native via `npx expo install @react-native-async-storage/async-storage`; localStorage on web). On start the stored session is restored and routed (`screenFor`): escalated always goes to the red-flag screen in the stored language, even offline; other sessions refresh from the API first. A fresh session with no answers now routes to the intake (it previously looped between intake and done: found on the simulator).
- 29 Chips: tap submits at once. Added Yes / No / Not sure chips (th/it/en) for `pregnancy_status`. Severity, onset/duration and None chips unchanged but one tap.
- 30 Chip semantics: removed the radiogroup; each chip sets `aria-label` and the severity chip reads "7 out of 10" / "7 su 10" / "7 จาก 10".
- Copy: all patient strings reviewed: Italian uses Lei, Thai has no ค่ะ/ครับ, no em dashes in `src/i18n.ts`. The "tu" follow-up questions come from `apps/web/lib/pipeline/templates.ts` (not mine; audit item 2). P0 #1 (chips not understood by the mock extractor, `lib/pipeline/mock.ts`) is also backend: the new Yes/No/Sì/Non so/ใช่ chips need the same check there.

## Evidence (docs/reports/screens/)
- Web, `localhost:3000/patient`, 375x812 own tab: Italian run with one-tap chips -> Done "In revisione" active (`v4-mobile-1-done-reviewing-it.jpg`); approving B-163 through `POST /api/sessions/:id/review` made the phone tick to all three steps with times within one poll (`v4-mobile-2-done-reviewed-it.jpg`).
- Thai chest pain on web -> red flag B-214; navigating to `/patient/` (refresh/back) returned to the red-flag screen in Thai (`v4-mobile-3-redflag-restored-th.jpg`).
- iOS dev build (rebuilt for AsyncStorage): started an intake, killed and relaunched the app, it restored session B-251 on the intake screen (`v4-mobile-4-restored-after-relaunch-ios.png`).

## Notes / risks
- "Reviewed by Nurse A. Rossi": the API exposes only a reviewer id, not a display name, so the phone says "A nurse has reviewed your answers" with the time. Add a reviewer display name to the contract if the name is wanted.
- The haptic and the check animation were not observed visually on a recorded take (web has no haptic; iOS Done was not driven through approval).
- The native iOS Done polling path was not walked end to end; the same code was exercised on web.
- The nurse approved via the API for the demo of live status; the clinician UI button does the same call.
- Restored sessions are not cleared when the clinic resets demo data (`/api/demo/reset`): a stale id falls back to the stored copy; start a new intake to clear.
- Name-redaction gap in apps/web/lib/pipeline/redact.ts (capital "Sono Marco Rossi") still open for the AI engineer.

## Addendum: re-audit P0 fix (restore validation)
- `src/store.tsx`: the stored session is never trusted. On start it calls `GET /api/sessions/:id` (retry once after 1.5 s on a network error). 404, or no answer after the retry: the stored session is cleared, language kept, patient goes Home. Found: routed by the SERVER status (escalated to red flag, approved/taken_over/awaiting_review to Done with live status, collecting to intake). `api.getSession` now throws with `status`.
- Escape hatches: web `/patient/?new=1` clears the stored session (language kept); native/web staff long-press (2 s) on the logo on Home. The red-flag screen still has no patient exit while the server session is escalated; the existing staff long-press on the code remains.
- P2: step 2 reads "Waiting for a nurse" / "In attesa di un infermiere" / "รอพยาบาล" with "Your answers are waiting for a nurse." (no claim that a nurse is reading); it becomes "Reviewed" only when the server status is approved or taken_over.
- Verified on web 375x812 (own tab): escalated Thai session reloads to the red flag (server confirms); after editing localStorage to a random uuid and reloading `/patient/redflag`, the app landed on Home in Thai (`v4-mobile-5-stale-id-goes-home.jpg`). `scripts/build-patient-web.sh` re-run. tsc and expo lint clean. Native long-press on the logo not exercised.
- Trade-off per the coordinator: an escalated patient who is offline at relaunch (no answer after the retry) goes Home instead of seeing the stored red flag.

## Addendum 2: offline restore (safety correction)
Only a definitive 404 clears the stored session. If the server cannot be reached after the retry, the stored session is kept and routed by its stored status; an `offline` flag shows "Offline: showing your last instruction." on the red-flag screen (th/it/en) and "Offline: showing your last saved screen." on intake and Done. So an escalated patient offline at relaunch still sees the red flag. tsc and expo lint clean, `/patient` rebuilt. Offline path not exercised in a browser (server stayed up; code path covers non-404 failures).

## Addendum 3: final fix wave (Codex review #4 to #9, #14; clinical MF-1, MF-5)
- #4 `store.tsx`: Home Start and the language control are disabled until hydration `ready`. Starting or resetting an intake sets a `touched` flag, so a pending restore never overwrites it. New `update(session)` applies a server copy only if its id is still the active session.
- #5 `intake.tsx`: each submit has a generation and the session id; a response is applied (and navigated) only if the screen is still mounted, the generation matches and the session is still active (`update`). Old sessions are never resurrected.
- #6 `api.ts`: client timeout 45 s (server 40 s). Each answer carries `clientTurnId` (uuid); Retry with the same text reuses the same id so the server dedupes. On timeout the app GETs the session and applies it if the answer is already stored, before offering Retry. NOTE: the already-running dev server rejected `clientTurnId` ("Unknown request property") until it restarted; after the restart it is accepted. Check the deployed server runs the current route.
- #7 `voice.ts`: unmount aborts recognition, clears timers and bumps a generation so a permission prompt answered late cannot start recording; `reset` also invalidates.
- #8 `index.tsx`: while a session is active (not approved or taken over) the language control is locked, with "Language is set for this visit." (th/it/en). The staff long-press on the logo or `?new=1` unlocks.
- #9 + MF-1 `redflag.tsx`: "I'm at the desk" now shows "Show this screen to the staff now. If no one is helping you, tell any member of staff straight away." (th/it/en, no claim a nurse is coming). The emergency-number text from the rule message stays.
- MF-5: Home privacy card adds "If you use the microphone, your voice is processed by your phone's speech service (Apple or Google)." (th/it/en); `app.json` mic and speech strings name Apple or Google speech recognition.
- #14 `done.tsx`: completion polling is single-flight (next poll scheduled after the previous settles) and cancelled on unmount.
- Verified on web 375x812: privacy sentence present (Italian), language locked after Start with the lock note and disabled control, `clientTurnId` in the POST body, Thai red flag then "I'm at the desk" shows the new line and the emergency line. tsc and expo lint clean; `/patient` rebuilt. Not exercised: the timeout-reconcile path, native voice cancel, native build (app.json strings change needs `expo run:ios` to take effect).
