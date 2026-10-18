# w20 · Patient polish: brand fonts, calm motion, "Start a new visit"

## STATUS
done. All four task points are done in my scope (apps/mobile/**, apps/web/public/patient/**, scripts/build-patient-web.sh).
- Static checks on the mobile app pass: `tsc --noEmit`, `eslint .` and `npx expo lint` all exit 0.
- The `/patient` export was rebuilt as the last build step. `apps/web` `vitest run app/patient-stamp.test.ts` passes 11/11.
- A headless-Chrome check of that export against a scripted mock API passed 53/53. The tested build and the shipped export are byte-identical (`diff -rq`).

Nothing is committed: the orchestrator handles git.

## SUMMARY
**1. Fonts: Plus Jakarta Sans and Noto Sans Thai, SCBXBeta2 removed**
- **Files.** Seven OFL font files sit in `apps/mobile/assets/fonts`, with the two OFL licence texts beside them.
  - Plus Jakarta Sans 400, 600, 700 and 800 come from `@expo-google-fonts/plus-jakarta-sans` 0.4.2. I cut them with fontTools to the Google Fonts "latin" range and kept every layout feature, so `tnum` and all Italian accents remain. The four files total 157 KB instead of 379 KB.
  - Noto Sans Thai 400, 600 and 700 come unchanged from `@expo-google-fonts/noto-sans-thai` 0.4.2 (143 KB). They also contain Latin glyphs, so a code or "MedX" inside Thai text stays in one face.
- **No npm package added.** The fonts would have been emitted under `assets/node_modules/`, which `.gitignore` and `.vercelignore` both exclude. They would have silently disappeared from the deploy.
- **Loaded before the first frame.** `_layout.tsx` calls `useFonts(FONT_FILES)` and renders nothing until it finishes. A font failure still never blocks the patient: the font stacks fall back to the system face.
- **Extra step on web.** Chrome left one face it had already fetched (Noto Sans Thai 600) marked "unloaded" after expo-font rewrote its `<style>`. So the layout loads each family by name once more, which resolves from cache in about 0 ms, with a 2.5 s cap.
- **New `src/fonts.ts`.** `fontFor(lang, weight)` returns one registered face on native. On web it returns a real stack (Latin face then Thai face, or the reverse for Thai).
- **Weights follow DIRECTION section 3.**
  - 400: body text and the answer box.
  - 600: buttons, chips, tab labels, eyebrows and badges.
  - 700: headings and values.
  - 800: the big Home and Help headlines.
- **Text rules.** Thai tracking is now always 0, as DIRECTION requires. Codes and the "stat" numbers use tabular figures.
- **SCBXBeta2 is gone from the patient app.** The three `.otf` files are deleted and nothing in `apps/mobile/src` uses `scbxFont` or `mobileFont` any more.

**2. Motion (react-native-reanimated 4.7.1, already installed; no new dependency)**
New `src/components/motion.tsx`:
- **Live reduce-motion setting.** `useReduceMotion()` starts from Reanimated's value at startup, so the first frame is already right. It then follows `AccessibilityInfo` `reduceMotionChanged` through `useSyncExternalStore`.
- **Screen entrance.** Every `Page` fades in with a 6 pt rise over 280 ms. The Home and Done hero cards get a separate soft entrance (14 pt rise, 420 ms). Fin fades in after the hero, then floats.
- **Fin float.** This is the existing 3.2 s idle bob. The 3D art now lifts 5 pt and tilts by ±1 degree. With reduced motion Fin rests exactly upright and still.
- **Press feedback.** `Press` sinks the control to scale .97 over 140 ms (`quick`) and eases back over 240 ms. It is used on pills, chips (.94), the language control, tab items, the centre button (.92) and the "Try saying" examples (.98).
- **Language control.** The white thumb slides to the chosen language over 240 ms (`base`). On a language change, the greeting, hero text and cards fade in with a 2 pt rise over 260 ms (`morph`, DIRECTION 6e).
- **Step progress.**
  - The intake bar grows with `scaleX` from the previous step to the current one over 360 ms. Before, it was a jump in width.
  - The Done timeline now has a rail under each step that fills top-down with `scaleY` once the step is done, with a stagger. The checks still zoom in.
- **Calm status highlights.** `Highlight` never runs on the first render and sits behind the content, so it never delays it.
  - When "seen by the care team" or any other status changes, a teal tint washes the timeline card once: 200 ms in, 450 ms out.
  - When "ready at the counter" or any other pickup status changes, one teal ring grows 2% and fades.
  - The hero title cross-fades inside a stable live region, so screen readers still announce the change.
- **Loading shimmer.** A soft shimmer runs across the "sending" bar next to the thinking Fin. It is the only other loop and is static with reduced motion.
- **Level bars.** The voice level bars now scale with a transform instead of changing their height.
- **Urgent content is instant and still.**
  - The red-flag screen no longer slides in: the 420 ms slide was removed, it has no entering animation and no animated styles, and its button does not move when pressed.
  - The red-flag "Try saying" example does not move when pressed.
  - The error and needs-human cards appear at once.
- **Rules held.** Only transform and opacity animate. Transitions run 150 to 450 ms.

**Reanimated pitfall found and avoided (web).** An entering animation that is not a stock preset (for example a preset with `withInitialValues`) ends with Reanimated pinning the element: `position: absolute` plus a fixed top, left, width and height (`setElementPosition` in `scheduleAnimationCleanup`). Later re-layout then overlaps. On the first run, a language switch put the info card on top of the hero. `Enter` is therefore a small shared-value hook, not a layout animation.

**3. "Start a new visit"**
- **Where it appears.** A card on Home and Help, shown only when a visit is stored and it is not a red-flag visit, opens a confirm sheet. The sheet is one shared component, a `Modal` rendered once in the root layout.
- **What the sheet says.** It explains that this clears the visit from this phone only and that the care team keeps what was already sent. It shows the code ("Write it down if you still need it").
- **Medicine still waiting.** If medicine is still being prepared or waiting at the counter, the sheet adds an amber note: this phone will stop telling the patient, so they should show their code at the pharmacy.
- **Buttons.** "Clear and start again" and "Keep my visit". Escape, the Android back button or a tap on the backdrop keeps the visit.
- **What confirm does.** `startOver()` clears the session, the prefill and read-aloud. It writes `{session: null, lang}` to storage at once, returns Home and announces "This phone is ready for a new visit." The language is kept.
- **Copy.** Written in en, it and th (11 keys per language). The Italian uses the formal "Lei" form, like the existing strings.
- **Related changes.**
  - Home with a stored visit now says "Your visit is open" with "Open my visit". Before, the hero "Start" silently discarded a stored visit and created a new one.
  - The tab-bar "+" asks through the sheet for a finished visit instead of clearing it at once. With medicine waiting it still opens the visit, as before.
  - The staff long-press on the logo now calls `startOver()`.

**4. Rebuild.** `bash scripts/build-patient-web.sh` was the last build step: exit 0, 2.7 MB, `source.sha ff395a79faad7db13bdd2cfbf22cbbd9f4cfb57c9506d90abbc257997f002681`. Then `vitest run app/patient-stamp.test.ts` passed 11/11.

## FILES CHANGED
- `apps/mobile/src/fonts.ts` (new): `FONT_FILES` and `fontFor()`.
- `apps/mobile/src/components/motion.tsx` (new): useReduceMotion, Enter, Press, Highlight, ProgressBar, Rail, Shimmer.
- `apps/mobile/src/components/newvisit.tsx` (new): NewVisitCard, NewVisitSheet, canStartOver.
- `apps/mobile/src/components/ui.tsx`:
  - `T` uses the new fonts (Thai tracking 0, tabular figures for codes).
  - Pill and Chip use `Press`; Pill has a `still` option.
  - New `Eyebrow` chip.
  - The language control has a sliding thumb.
  - `Page` gets the entrance, an `enter={false}` option and soft static brand-colour radial tints in the top corners.
- `apps/mobile/src/components/mascot.tsx`: float through the live reduce-motion setting; the 3D art lifts 5 pt with a ±1 degree tilt; still Fin is upright.
- `apps/mobile/src/components/mic.tsx`: live reduce-motion setting; level bars use `scaleY`.
- `apps/mobile/src/components/tabbar.tsx`: `Press` feedback; "+" goes through the sheet.
- `apps/mobile/src/components/icons.tsx`: `Refresh` and `Chevron` icons.
- `apps/mobile/src/app/_layout.tsx`: new fonts and the web face check; renders `NewVisitSheet`.
- `apps/mobile/src/app/index.tsx`: eyebrow plus two-tone 800 headline ("Welcome to" in ink, "MedX" in ocean); hero entrance; language morph; the "Open my visit" and new-visit card; last step of "How it works" marked as the human step.
- `apps/mobile/src/app/help.tsx`: 800 headline, new-visit card. No Fin here, because the screen lists emergency numbers.
- `apps/mobile/src/app/done.tsx`: hero entrance, title cross-fade, timeline rails, wash and ring highlights. The pickup card is no longer remounted on each status change.
- `apps/mobile/src/app/intake.tsx`: answer-box font, progress `scaleX`, shimmer, question morph, example press feedback (the red-flag example stays still).
- `apps/mobile/src/app/redflag.tsx`: slide removed; static page and button.
- `apps/mobile/src/store.tsx`: `newVisit`, `askNewVisit`, `closeNewVisit`, `startOver`.
- `apps/mobile/src/i18n.ts`: 11 new keys per language (en, it, th).
- `apps/mobile/assets/fonts/`:
  - added `PlusJakartaSans-Latin-{400,600,700,800}.ttf`, `NotoSansThai-{400,600,700}.ttf`, `OFL-PlusJakartaSans.txt` and `OFL-NotoSansThai.txt`;
  - deleted `SCBXBeta2-{Light,Regular,Bold}.otf`.
- `apps/web/public/patient/**`: regenerated by the script, never edited by hand.
  - New hashed bundles: `entry-bf28b1bb…`, `__common-be6e2f50…`, `_layout-c6c6d9c7…`, `done-41b042cf…`, `index-140f81e7…`, `intake-f2a9dcdc…`, `help-a4180a36…`, `redflag-84884bfa…`.
  - `assets/assets/fonts/*.ttf` replaces the SCBX `.otf` files.
  - `source.sha` updated.
- `docs/reports/screens/w20-polish-*.png`: 11 screenshots.
- `docs/reports/w20-patient-polish.md`: this report.
- Not changed: `scripts/build-patient-web.sh`, `app.json`. expo-font loads bundled fonts without a config plugin.

## TESTS RUN + RESULTS
All exit codes are from commands I ran.

**Mobile (`apps/mobile`)**
- `./node_modules/.bin/tsc --noEmit -p .`: exit 0, run after every change set (final included).
- `./node_modules/.bin/eslint .`: exit 0 (final).
- `npx expo lint`: exit 0.

**Export**
- Test exports went to the scratchpad through `PATIENT_OUT=…`, four times.
- The final `bash scripts/build-patient-web.sh` into `apps/web/public/patient`: exit 0, 9 web bundles, 2,668,713 bytes.
- `diff -rq` between the final test export and `apps/web/public/patient`: IDENTICAL.

**`apps/web`:** `./node_modules/.bin/vitest run app/patient-stamp.test.ts`: 1 file, **11/11 passed**.

**Headless browser check**
- Setup: playwright-core 1.56.1 from the session scratchpad, driving system Chrome at 390x844 @2x, against the real export and a mock `/api/sessions` (create, turns, get).
- Run history:
  - Run 1 found the real bug above: the info card was pinned over the hero after a language switch, and Playwright reported the Start button covered. It also showed the unloaded Thai 600 face.
  - Runs 2 to 5 were the fixes plus harness corrections: RNW renders headers as `h1`; computed `font-family` has no quotes; a restored visit routes to Done by design; expo-image styles its own `<img>` absolutely; RNW's ScrollView keeps an identity `translateZ(0)`; static disabled and 0.92 opacities are not motion.
  - Final run: **53/53 passed** (results JSON in the scratchpad, `w20pp-shots/w20-polish-results.json`).

## EVIDENCE
The browser checks below all come from the final 53/53 run.

**Fonts**
- All 7 faces are loaded before first render, and no SCBX face or `.otf` file is requested.
- Computed font-family on each surface:
  - Home headline: `PlusJakartaSans_800ExtraBold, NotoSansThai_700Bold, system-ui, sans-serif`;
  - Thai headline: `NotoSansThai_700Bold, …`, with letter-spacing `normal`;
  - Italian hero: `PlusJakartaSans_700Bold`;
  - answer box: `PlusJakartaSans_400Regular`.
- "MedX" renders in rgb(26, 92, 191), which is ocean #1A5CBF.

**Motion**
- **Entrance.** About 30 ms after the first paint, elements are caught mid-entrance (for example opacity 0.851 with translateY 2.08 px). All are settled within 700 ms. No CSS layout animations are left over and no element is pinned.
- **Fin.** Its transform changes over time, for example `translateY(-5px) rotate(1deg)` then `translateY(-1.93px) rotate(-0.23deg)`.
- **Language thumb.** x position: 24, then 117.3 at 60 ms, then 138 at 560 ms.
- **Press.** An example card reads `scale(0.98)` while held. The red-flag example stays at `none`.
- **Progress bar.** It reads `scaleX(0.2457)`, then `scaleX(0.333333)`.
- **Done timeline.** The rail under the done step reads `scaleY(1)`. There is no highlight on the first render.
  - The seen-by-staff wash peaks at opacity 1.00, then returns to 0.
  - The "ready at the counter" ring peaks at 1.00.

**Red flag**
- No animation is running and nothing is mid-fade when it appears.
- Neither the heading nor any of its ancestors has a non-identity transform, opacity below 1 or an inline animated style.
- The heading box is the same at first sight and 700 ms later: {x 20, y 84, w 350, h 48} both times.
- There is no Fin and no tab bar.

**Reduced motion** (`reducedMotion: reduce`)
- Nothing is mid-fade on Home or in the sheet.
- Fin reads `translateY(0px) rotate(0deg)` both times.
- The thumb jumps from 24 to 252 at once.
- The rail is already filled on the first frame.
- A status change shows no wash (opacity 0), and the Done screen runs no animations.

**Start a new visit**
- No card appears without a stored visit.
- With medicine still waiting: Home shows "Your visit is open" and "Open my visit". The sheet opens as a dialog with "Your code is B‑0xx" and the medicine warning. "Keep my visit" keeps the stored visit. The tab "+" opens the visit with no sheet.
- With medicine collected: "+" opens the sheet, and confirm leaves storage at `{"session":null,"lang":"en"}`. Home then shows Start and no card.
- In Thai: the card shows on Help, Escape closes the sheet, and confirm clears the visit with `<html lang="th">`.

**Errors:** no page errors and no console errors across the run.

**Screenshots** (`docs/reports/screens/`):
- `w20-polish-home-en.png`
- `w20-polish-home-th.png`
- `w20-polish-home-it.png`
- `w20-polish-intake-en.png`
- `w20-polish-done-seen-en.png`
- `w20-polish-done-ready-en.png`
- `w20-polish-sheet-pickup-en.png`
- `w20-polish-help-th.png`
- `w20-polish-sheet-th.png`
- `w20-polish-redflag-th.png`
- `w20-polish-done-reduced-en.png`

**Sizes**
- Fonts: 299,508 bytes in total (157 KB Jakarta, 143 KB Thai). The SCBX files were about 107 KB.
- Export: 2.5 MB before, 2.7 MB now.

## ASSUMPTIONS
- **Red flag is instant.** "Red-flag screen stays instant and static" and the wave rule "appear instantly" win over DIRECTION 6c step 1 ("slides up over `interrupt`"). I removed that 420 ms slide.
- **Loops.** The 150 to 450 ms limit applies to transitions. The two loops DIRECTION section 5 allows keep their slow periods: Fin's 3.2 s bob, and the 1.4 s shimmer, which only runs while sending. Both stop completely with reduced motion.
- **Language on reset.** "Start a new visit" keeps the chosen language. The next person can switch on Home, where the control is unlocked once the visit is cleared.
- **Home "Start".** Home "Start" no longer replaces a stored visit; clearing goes through the sheet. This means a tap can never lose a visit, or the counter call for medicine still on its way.
- **No light cut.** There is no 300 weight on the phone. The `light` prop maps to 400 for legibility at arm's length.
- **Subsetting.** Cutting Jakarta to the Google "latin" range is allowed by the OFL (no Reserved Font Name is declared). Characters outside the range, such as U+2011, fall back per glyph. U+2011 is also missing from the full original font.

## RISKS
- **The stamp goes stale on any later edit.** An edit to `apps/mobile/src/**` or `packages/shared/src/**` after my build (sha `ff395a79…`) makes `patient-stamp.test.ts` fail until `bash scripts/build-patient-web.sh` is re-run. Other w20 agents editing `packages/shared` will trip it.
- **Native not built.** iOS and Android were not built this wave. Font registration (expo-font with local `.ttf` files), `transformOrigin` and the shared-value animations were verified on the web export only.
- **Hidden tabs.** Entrances are driven by requestAnimationFrame. In a background tab, content waits at its start state until the tab is visible, then completes.
- **Docs out of date.** `packages/shared/src/tokens.ts` (`scbxFont`, `fontFamily.mobile`, `mobileFont()`) and DIRECTION sections 3 and 6c still describe SCBX on mobile and the red-flag slide. The code no longer uses them; see the contract change requests below.
- **Video and stills.** Phone stills captured before this build show the old SCBX type and the old Home.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Orchestrator (`packages/shared/src/tokens.ts`):** point `fontFamily.mobile` and `mobileFont()` at the new expo-font names (`PlusJakartaSans_400Regular / _600SemiBold / _700Bold / _800ExtraBold`, `NotoSansThai_400Regular / _600SemiBold / _700Bold`, mapped as in `apps/mobile/src/fonts.ts`). Update the comment that says mobile keeps SCBXBeta2. Nothing in the patient app depends on this change.
- **Design lead (DIRECTION.md):**
  - Section 3, "Mobile: unchanged for now": mobile now uses Jakarta and Noto Sans Thai.
  - Section 6c, patient step 1: the red-flag view now appears instantly with no slide.
  - Section 5 could note the Reanimated web pitfall: use only stock presets or shared values for entering animations.

## NEXT ACTION
- **Orchestrator:**
  - After the last w20 edits to `packages/shared/src` or `apps/mobile/src`, re-run `bash scripts/build-patient-web.sh` and `vitest run app/patient-stamp.test.ts`.
  - Commit together: `apps/mobile/**` (including the three deleted SCBX `.otf` files and the new fonts), the regenerated `apps/web/public/patient/**` (old hashed bundles deleted, new ones added), `docs/reports/screens/w20-polish-*.png` and this report.
- **Video agent (optional):** recapture the phone stills from this build. With reduced motion, everything is at its end state on the first frame.
