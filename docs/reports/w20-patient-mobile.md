# w20 · Patient mobile: English default, refreshed brand, "Try saying", deep link, seen by staff, export freshness stamp

## STATUS
done. Every acceptance point of M-08 and of my part of S-04 is met in my scope. The engine's share of S-04 (patientView.ts and its allowlist test) was already in the tree, and its tests pass. Mobile tsc, eslint and `expo lint` are clean. `scripts/build-patient-web.sh` rebuilt `/patient` and now writes `source.sha`. The new `apps/web/app/patient-stamp.test.ts` passes 11/11. A headless-Chrome check of the real export against a scripted mock API passed 48/48. Nothing is committed: the orchestrator handles git.

## SUMMARY
- **English by default.** First launch is English (the store default stays `en`). The language control now lists English first (English, ไทย, Italiano), and Thai and Italian are still one tap away. The selected tab now carries `aria-selected`; react-native-web was not emitting it from `accessibilityState`. The Help and Language tabs in the tab bar get the same fix.
- **Synthetic-data notice.** The Home card now leads with "Synthetic data only. Do not enter real patient information." (in it and th too), next to a teal info icon. The privacy text below it no longer repeats "Demo with made-up cases".
- **"Try saying" examples (M-08).**
  - What it shows: the first question lists the `DEMO_SAMPLES` written in the visit language. English shows EN-01, EN-02 and DEMO-GOLD, Italian shows IT-01 and Thai shows TH-05. Each one is labelled "Synthetic example".
  - What a tap does: it fills the answer box and nothing more. A confirm step appears ("Check this example before you send it." plus the existing "Check the words…" line) with **Send** and **Clear**. Nothing goes to the server until the patient presses Send, and the turn is sent as `inputMode: "text"`.
  - When it shows: only while the box is empty and no voice capture is running. Fin is therefore never on screen with the examples: the vector "thinking" and "listening" Fin only appear while busy or listening, and those states hide the list.
  - The Thai red-flag example: it is styled for urgency (signal-red border, red tint, alert icon) and labelled "ตัวอย่างสมมติ สัญญาณอันตราย" ("synthetic example, red flag").
  - Answer box: it now grows with its text, up to 320 pt, and then scrolls. Before, a filled example was clipped and the patient could not read all of what they were asked to check.
- **Deep link.**
  - Effect: `/patient/?new=1&lang=it&sample=it01` forgets any stored visit, creates a new Italian session and opens the first question with the IT-01 sentence filled in. Nothing is sent.
  - Matching: sample ids are matched loosely (`it01`, `IT-01`, `it_01`).
  - Language rules: a sample implies a fresh visit, and its own language wins over `lang`. `?lang=` alone picks the language only when no visit is stored. Invalid values are ignored.
  - Failure: if creating the session fails (offline or 429), Home shows Start as usual, and the example waits for the first answer box of a visit in its language.
  - Code: the parsing is a pure module, `apps/mobile/src/samples.ts`.
- **Seen by staff (S-04, mobile part).**
  - `api.ts` allowlists one boolean, `seenByStaff` (`x.seenByStaff === true`, so older servers and stored copies read false).
  - `done.tsx` lights steps 2 and 3 from it:
    - "Waiting for a nurse" becomes "Seen by the care team" (done), and "Reviewed" is done, with the time this phone first saw it.
    - Title: "The care team has seen your answers."
    - Note: "Please wait to be called."
    - The needs-human warning card hides once staff have seen the case.
  - Polling keeps the w19 behaviour: one 4 s single-flight poll until `pickup.status === "collected"`, then it stops.
- **Brand refresh.**
  - `Mascot` renders the owner-approved 3D Fin (`fin3d-<pose>-512.webp` via expo-image) from 96 pt, the same threshold as the web `MASCOT_3D_MIN`, and keeps the vector drawing below that. The Home hero (132 pt wave) and the Done hero (100 pt happy) show the 3D art. The vector Fin stays in intake busy and listening (72 pt). There is no Fin on the red-flag screen or next to the red-flag example.
  - Expo icon, iOS icon, Android adaptive foreground and splash now come from `app-icon-3d-1024.png`:
    - the adaptive foreground scales the icon to exactly the 72/108 visible area, so masks never clip the mark;
    - the splash uses the icon with app-icon corner rounding, 128 pt on white;
    - only scaling and corner rounding were applied; the art was not edited.
  - The web favicon stays vector (DIRECTION 11: never 3D as a favicon).
  - Logo comment updated to DIRECTION section 13.
- **Export freshness stamp (M-08).**
  - What it is: `build-patient-web.sh` hashes the sources before running `expo export` and writes `apps/web/public/patient/source.sha`.
  - Algorithm: a sha256 over every file under `apps/mobile/src` and `packages/shared/src`, with dotfiles skipped, repo-relative POSIX paths sorted, and per file `path\n`, then the bytes with CRLF turned into LF, then `\n`. The script comment documents this.
  - The test: `patient-stamp.test.ts` recomputes the hash and fails with "the /patient export is stale: run bash scripts/build-patient-web.sh".

## FILES CHANGED
- `apps/mobile/src/samples.ts` (new): findSample, samplesFor, parseLaunch. Pure; imports only `@medx/shared`.
- `apps/mobile/src/store.tsx`: deep-link launch (fresh, lang, sample), a one-shot `prefill`, and session creation for `?sample=`; English default kept.
- `apps/mobile/src/app/intake.tsx`: "Try saying" list (`Samples`), example confirm-before-send (Send/Clear), prefill applied during render, answer box that grows with its text.
- `apps/mobile/src/app/done.tsx`: `seenByStaff` lights steps 2 and 3, adds the seen title and note, and hides the needs-human card once seen.
- `apps/mobile/src/app/index.tsx`: synthetic-data notice card.
- `apps/mobile/src/api.ts`: `PatientView.seenByStaff` in the allowlist.
- `apps/mobile/src/i18n.ts`: 11 new keys per language (en, it, th), privacy text de-duplicated.
- `apps/mobile/src/components/mascot.tsx`: 3D art from 96 pt (`MASCOT_3D_MIN`, `variant`).
- `apps/mobile/src/components/ui.tsx`: English-first language control, `aria-selected`.
- `apps/mobile/src/components/tabbar.tsx`: `aria-selected`.
- `apps/mobile/src/components/icons.tsx`: `Info` icon.
- `apps/mobile/src/components/logo.tsx`: comment only (section 13).
- `apps/mobile/app.json`: icon, ios.icon, android.adaptiveIcon and splash point to the 3D art.
- `apps/mobile/assets/brand/`:
  - `icon-3d.png`: a copy of app-icon-3d-1024.png.
  - `adaptive-foreground-3d.png` and `splash-3d.png`: generated by a scratchpad PIL script (scaling and corner rounding only).
  - `fin3d/fin3d-{wave,listening,thinking,happy,pointing}-512.webp`: copied unchanged from brand-out.
- `scripts/build-patient-web.sh`: writes `source.sha`.
- `apps/web/app/patient-stamp.test.ts` (new): 11 tests.
- `apps/web/public/patient/**`: regenerated by the script, never hand-edited.
  - New bundles: `entry-24ce6bee…`, `__common-4a8ae2de…`, `_layout-7f4668b7…`, `done-e88a5d9f…`, `index-b3ee01ef…` and `intake-66dae3c9…`.
  - New assets: `assets/assets/brand/fin3d/*.webp`, plus `source.sha`.
  - Old hashed bundles deleted; `index.html` updated.
- `docs/reports/screens/w20-patient-*.png`: 10 evidence screenshots.
- `docs/reports/w20-patient-mobile.md`: this report.

## TESTS RUN + RESULTS
All exit codes are from commands I ran.

**Mobile (`apps/mobile`)**
- Baseline before edits: `tsc --noEmit -p .` exit 0; `eslint src` exit 0.
- First lint after the prefill change: 1 error, `react-hooks/set-state-in-effect` (setState inside an effect). I fixed it by adjusting state during render plus clearing the store copy in an effect.
- Final: `tsc --noEmit -p .` exit 0, `eslint .` exit 0, `npx expo lint` exit 0.
- `npx expo config --type public` resolves `icon-3d.png`, `adaptive-foreground-3d.png` (bg #0A8077) and `splash-3d.png` (128, #FFFFFF).

**Export build**
- `bash scripts/build-patient-web.sh`, run twice, exit 0 both times.
- The last run printed `patient web build -> …/apps/web/public/patient (2.5M)` and `source.sha aee495c325376962c3e46ab766fea09fca5514e00da65579132f93b35ef7b721`. It produced 9 web bundles and 26 assets, including the 5 fin3d webp.

**`apps/web/app/patient-stamp.test.ts`**
- First attempt: the suite failed to load with `TSConfckParseError: failed to resolve "extends":"expo/tsconfig.base"`, because Vite cannot load files under apps/mobile directly. The test now transpiles the real `samples.ts` with TypeScript.
- Before the rebuild: 9 passed, 2 failed, both expected ("source.sha is missing", "export bundles lack 'Synthetic data only…'"). This shows the stamp test catches a stale export.
- After the rebuild: **11/11 passed**.
- Negative check: with source.sha overwritten by 64 zeros, the test failed with "the /patient export is stale…". I then restored the file byte for byte.
- Mock provider, through the real `POST /api/sessions` and `POST /turns` routes with `x-medx-client: patient`:
  - EN-01, EN-02 and DEMO-GOLD each reach `awaiting_review` with `chief_complaint` and `onset` supported.
  - IT-01 does the same.
  - TH-05 reaches `escalated` with redFlags.

**Other vitest (`apps/web`)**
- `vitest run app/patient-stamp.test.ts lib/pipeline/__tests__/{patient-seen,wave15,wave19,contracts}.test.ts`: 5 files, **429/429 passed**.
- `vitest run` (whole suite): 41/42 files, **2265/2266 tests**, 71.7 s. The single failure is `llm-api.test.ts > HTTP contracts and CORS > returns health metadata…`. It is the known failure from the platform agent's in-progress `/api/health` change, already reported by the engine and design agents, and is not in my files.

**Static checks (`apps/web`)**
- `tsc --noEmit -p .`: 5 error lines, all in `app/(pharmacy)/_lib.ts` and `app/(pharmacy)/_orders.tsx` (another builder's in-progress work). There are none in `patient-stamp.test.ts` or in `apps/mobile/src/samples.ts`, which is type-checked through `typeof import`.
- `eslint app/patient-stamp.test.ts`: exit 0.

**Headless browser check of the export**
- Setup: `playwright-core@1.56.1` installed in the session scratchpad (not the repo), driving system Chrome headless at 390x844 @2x. A Node server served the **real** `apps/web/public/patient` at `/patient` with a scripted mock API. The mock leaks `triage.secretNurse`, a drug name, `calledBy` and a note on purpose.
- Run history:
  - Run 1: 36/38. A4 was a real accessibility gap (no `aria-selected` on the language tabs), now fixed. The other failure was a test selector (strict mode).
  - Run 2: 43/45, before rebuilding with the a11y fix. The other failure (D4) was a test artifact: the Thai question is a substring of the Home hero title.
  - After the fixes and rebuild: **48/48**, twice. The second run only added a wait before the red-flag capture.

## EVIDENCE
**Browser checks (48/48)**
- **First launch:** the Home greeting is English, `<html lang="en">`, the notice is visible, the tabs read "English | ไทย | Italiano" with `aria-selected=true` on English, and the 3D wave Fin is loaded (naturalWidth > 0).
- **English examples:** 3 cards labelled "Synthetic example", with no Fin image on screen.
  - Tapping fills the exact EN-01 sentence.
  - The confirm text is shown, and the box shows the whole sentence (scrollHeight 215 = clientHeight 215).
  - **0 turns were sent in 1.5 s before Send.**
  - After Send, the turn text equals EN-01 with `inputMode: "text"`.
- **Done screen:** "Waiting for a nurse" is active.
  - Setting `seenByStaff: true` with no status change (the scripted v3 journey) shows "The care team has seen your answers.", "Seen by the care team" and "Reviewed", and removes "Waiting for a nurse". The 3D happy Fin is in the hero.
  - Pickup then goes preparing, ready (counter 2), collected through polling.
  - **0 polls in the 9 s after collected.**
  - localStorage holds `"seenByStaff":true` and none of secretNurse, amoxicillin, the note or calledBy. The page never rendered the drug or the note.
- **Deep link `/patient/?new=1&lang=it&sample=it01`:**
  - The Italian question opens with `<html lang="it">`, one Italian session is created, and the IT-01 sentence is fully visible (186 = 186).
  - **Nothing was auto-sent in 2 s.**
  - Invia leads to Done with turn = IT-01.
  - A reload restores the same visit, with no second session.
- **Thai, `?new=1&lang=th`:** Home and the notice are in Thai. There is one example labelled "ตัวอย่างสมมติ สัญญาณอันตราย", with border `rgb(190, 27, 43)` (signal #BE1B2B) and no Fin. After Send the red-flag screen shows, with no Fin. No page errors.

**Screenshots** (`docs/reports/screens/`):
- `w20-patient-home-en.png`
- `w20-patient-intake-try-saying-en.png`
- `w20-patient-intake-example-filled-en.png`
- `w20-patient-done-waiting-en.png`
- `w20-patient-done-seen-en.png`
- `w20-patient-done-collected-en.png`
- `w20-patient-deeplink-it01.png`
- `w20-patient-intake-try-saying-th-redflag.png`
- `w20-patient-intake-example-filled-th-redflag.png`
- `w20-patient-redflag-th05.png`

**Hashes**
- Export stamp: `aee495c325376962c3e46ab766fea09fca5514e00da65579132f93b35ef7b721`.
- The export grew from 2.2 MB (w19) to 2.5 MB, mostly expo-image plus 5 × ~36 KB webp.

## ASSUMPTIONS
- **Example confirm.** "The patient still presses Send, and confirm-before-send stays" is implemented as the voice-style confirm step (Send/Clear) for examples. Typed answers keep the Continue button.
- **Example list visibility.** The list shows only while the answer box is empty, so it never competes with the patient's own words, and Clear brings it back.
- **A sample implies a fresh visit.** `?sample=` alone starts a fresh visit, and the example's language wins over `lang`. An Italian sentence in an English session would be wrong.
- **Deep link creates a session.** `?sample=` creates the session on load, so the visitor lands on the filled question (one POST per link open). `?new=1` alone still stops on Home.
- **Seen-by-staff wording.** "Seen by the care team" and "The care team has seen your answers." are generic on purpose. `seenByStaff` can come from a nurse (approval or triage) or a doctor (signed note), and the phone must not say who.
- **Answer box height.** It is estimated at 0.5 em per character from the measured width, which is deterministic on web and native. I did not use `onContentSizeChange`: with the React Compiler memoising the handler, react-native-web does not re-measure a value that is set by code. The estimate errs tall, especially in Thai, where combining marks count as characters: about 2 blank lines in the TH-05 screenshot.

## RISKS
- **The stamp goes stale on any later edit.** Any edit to `packages/shared/src/**` or `apps/mobile/src/**` after my build (hash `aee495c3…`) makes `patient-stamp.test.ts` fail until `bash scripts/build-patient-web.sh` is re-run. This is by design (M-08), but other w20 agents still editing shared files will trip it. The export must be rebuilt as the last step before the commit.
- **Native not built.** The icon, adaptive icon and splash are validated only by `expo config`. Native iOS and Android were not built this wave. The same mobile code ran on the web export.
- **Deep link is web only.** It reads `window.location.search`; native `medx://` links are not parsed.
- **Mobile fonts unchanged.** Mobile still uses SCBXBeta2, not Plus Jakarta Sans and Noto Sans Thai. This was optional and is not done; adopting them needs `@expo-google-fonts/*` installs.
- **Pre-existing observation (outside my scope).** `POST /api/sessions` returns the full session object even with `x-medx-client: patient`. The phone whitelists it client-side (`toPatient`), and a new session holds no clinical data.
- **Old brand files kept.** `assets/brand/{icon,adaptive-foreground,splash-mark}.png` are now unused; I kept them as vector-derived fallbacks.
- **Untracked expo-router PNGs.** `public/patient/assets/node_modules/expo-router/assets/*.png` is still ignored by the root `.gitignore`. This predates this wave; those PNGs are only used by expo-router's error and sitemap screens.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- No contract change needed. The app uses `PatientSessionView.seenByStaff?` and `DEMO_SAMPLES` exactly as exported.
- **Landing builder.** "Try saying" chips and persona or QR links can point at `/patient/?new=1&lang=<en|th|it>&sample=<DEMO_SAMPLES id>`. Ids are case- and punctuation-insensitive, for example `it01`. Use `/patient/?new=1&lang=en` for a plain fresh English visit.
- **Orchestrator (optional).** If `apps/web/vitest.config.ts` gets an `esbuild.tsconfigRaw` or similar, the test could import `samples.ts` directly instead of transpiling it.

## NEXT ACTION
- **Orchestrator:**
  - After all w20 edits to `packages/shared/src` and `apps/mobile/src` are in, run `bash scripts/build-patient-web.sh`, then `vitest run app/patient-stamp.test.ts`.
  - Commit `apps/mobile/**`, the regenerated `apps/web/public/patient/**` (including the deletions of the old hashed bundles and the new `source.sha`), `scripts/build-patient-web.sh`, `apps/web/app/patient-stamp.test.ts` and the screenshots in the same push.
- **Video agent:** the phone stills can reuse `w20-patient-*.png`. The red-flag screen slides in over about 300 ms, so wait for it, or use reduced motion, before capturing.
