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
