# Follow-up review: resume an active patient visit

STATUS: done

## Summary

The follow-up application review found that Home's Start handler always reset
the patient session and created another one, even while the language selector
was locked for an active visit. This was identified in source; the destructive
pre-fix action was not exercised against the existing B-014 intake.

Home now displays the active code and a localized Resume visit action. The
action uses the existing status-to-screen mapping, so collecting, waiting,
human-review and escalated cases retain their proper destinations. It creates
a new session only when there is no active visit. A failed new-session request
also leaves the previous completed session available instead of clearing it
before the request succeeds. Explicit demo reset controls remain available.

## Files changed

- apps/mobile/src/app/index.tsx: active-visit resume and safer new-session start.
- apps/mobile/src/i18n.ts: Thai, Italian and English resume labels.
- apps/web/public/patient/index.html and three generated web bundles: rebuilt
  with scripts/build-patient-web.sh; obsolete hashed counterparts removed.
- This report and docs/reports/screens/2026-10-18-patient-resume/01-resume-home.jpg.

## Tests run and results

- Installed the locked mobile dependencies with npm ci --ignore-scripts.
- Mobile lint: passed, exit 0, no lint findings.
- Mobile TypeScript: tsc --noEmit passed, exit 0.
- Expo web export and publish into the Next public directory: passed, exit 0.
  The build emitted terminal color-variable warnings only.
- Existing patient quick-answer regression suite: **181 tests passed**, 29.27
  seconds, exit 0. AMD cases use an offline test transport, not live credentials.
- git diff --check: passed.

Logs: /private/tmp/medx-mobile-install.log, /private/tmp/medx-patient-lint.log,
/private/tmp/medx-patient-typecheck.log, /private/tmp/medx-patient-build.log and
/private/tmp/medx-patient-regressions.log.

The first sandboxed Expo lint attempt could not create ~/.expo for telemetry.
Rerunning with EXPO_NO_TELEMETRY=1 and EXPO_OFFLINE=1 passed without writing
there. No dependency versions or lockfile contents were changed.

## Evidence

Restarted the existing standalone Next build to copy in the rebuilt patient
assets. In the in-app browser, reloaded the existing Thai B-014 intake, navigated
Home, observed B-014 and the Thai Resume visit button, and pressed it. The app
returned to the original B-014 intake. The durable store contained 14 sessions
before and after, with B-014 still the latest code. No answers were submitted,
and no new session was created by the verification.

Screenshot: docs/reports/screens/2026-10-18-patient-resume/01-resume-home.jpg.
The server remains on 127.0.0.1:3000 with the production web build and new patient
export. Existing staff fixes remain present.

## Assumptions, risks and open questions

- The user's request continues the authorized application bug/UI work; the
  mobile ownership lane does not prevent this direct fix.
- All stored cases are synthetic. No real patient data or microphone was used.
- Browser verification exercised collecting status with Thai copy. Other
  statuses reuse the existing screenFor mapping but were not separately
  browser-tested in this task. New-session failure retention was inspected in
  source rather than tested by inducing a network failure.
- Native device/speech and deliberate offline/reconnect scenarios remain
  unverified. Live AMD inference still needs supplied credentials and a traced
  successful call. These are verification gaps, not claimed new defects.
- No clinical policy or API contract changed; no commit, push or deployment.

## Next action

Verify real AMD inference when credentials are available, then test physical
phone speech and offline recovery. No contract change requests.
