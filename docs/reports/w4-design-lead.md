# W4 report: Design lead, v2 redesign "Calm clinical banking"

## STATUS
done for web. The mobile app needs one font install before its Latin text looks right (see "Install requests"). Nothing is committed.

## SUMMARY
I replaced the "Clinical paper" look with a modern banking-app look, following the owner's decision and the reference u-talk-ten.vercel.app.
- I studied the reference live. It uses Plus Jakarta Sans and Noto Sans Thai, 22px cards, a purple gradient hero, diffuse tinted shadows and pill controls.
- Look: mist background with soft teal and ocean tints, white cards (radius 22) with diffuse navy shadows, and one teal-to-ocean gradient hero per screen.
- Controls: pill buttons and chips with icons, big bold tabular numbers, and a single sans font (Plus Jakarta Sans, with Anuphan for Thai on web and IBM Plex Sans Thai Looped for patients on mobile).
- What did not change: red is still reserved for urgency, and the five safety states stay distinct by colour, shape, icon and words (section 1 of DIRECTION.md). The highlighter, red-flag interrupt and language morph are kept and restyled.
- I kept every v1 token name, CSS variable and utility name and gave them new values. The existing /review, /pharmacy and /ops screens therefore re-skinned with no edits to their code.
- I fixed the LangMorph replay bug at its source.

## FILES CHANGED
- `docs/design/DIRECTION.md`: v2, replacing v1, with a "v1 superseded" note. It covers:
  - concept and the safety-state table;
  - palette with contrast numbers, type, radii and elevation, motion, icons;
  - mobile, app-shell, review and ops wireframes;
  - copy tone and the v1 compatibility map.
- `packages/shared/src/tokens.ts`: v2 values with the same export names and shape. Additions are listed below.
- `apps/web/app/globals.css`: v2 `@theme` with the same variable names plus new ones. Also new gradient, card and hero utilities, the v2 `.mx-*` classes, a skeleton shimmer, and an extra rule that gives `.shadow-sheet` elements the card radius.
- `apps/web/app/layout.tsx`: fonts are now Plus Jakarta Sans (latin, latin-ext, normal and italic) and Anuphan (thai subset).
- `apps/web/components/ui/` restyled, with every prop API identical:
  - Button: gradient pill. Added an optional `icon` prop.
  - Badge: pill chips. Added `teal` and `ocean` tones and an optional `icon`.
  - Field.
  - EvidenceHighlight: class changes only.
  - InkConfidence: four rising bars.
  - PencilField and FieldValue: the new state mapping.
  - RedFlagInterrupt: red gradient card.
  - LangMorph: bug fixed.
- `apps/web/components/ui/` new: `Icon` (Lucide paths, inline SVG), `Card` and `CardHeader`, `GradientHero` and `HeroAction`, `StatTile`, `SegmentedControl` and `Pill`, `AppShell`, `Avatar`, `EmptyState`. `index.ts` exports all of them.
- `docs/reports/screens/v2-review.png` (escalated B-013), `v2-review-awaiting.png` (B-003, which shows the verified, missing and edited states), `v2-pharmacy.png`, `v2-ops.png`.

Token additions: colours `muted`, `teal`, `ocean`, `primaryFrom`, `primaryTo`, `onPrimary`, `tealTint`, `oceanTint`, `warn`, `warnTint`, `signalDeep`; `gradient`; type `stat`; font role `display` and weight `bold`; radius `card`, `hero` and `pill`; shadow `hero` and `hairline`; `layout.shell`; aliases `confidenceLevel` and `confidenceLevels`.

## TESTS RUN + RESULTS
- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/mobile && npx tsc --noEmit`: exit 0.
- `npx vitest run components/ui`: 4/4 pass, including the check that globals.css matches every colour token.
- `impeccable detect --json` on `components/ui` and `globals.css`: `[]` (no findings).
- Screenshots: taken with headless Chrome at 1440x1000 against the running dev server on :3000.

## EVIDENCE
- **Contrast (WCAG 2.x, computed):**
  - White on the gradient stops: 4.8 (`#0A8077`) and 6.0 (`#1A5FC4`).
  - White on red: 6.2 and 8.2.
  - On cards: ink 16.9, inkSoft 7.5, graphite 5.9, teal 5.9, ocean 6.3, warn 6.9, signal 6.2.
  - On the app background, graphite is 5.3. On tints, every text token is at least 5.0.
  - The input border `ruleStrong` is 3.4.
- **Re-skin worked without builder edits.** v2-review-awaiting shows: verified values with the "From patient's words" chip and bars; missing values as grey pills; an edited value with the teal "Edited by clinician, Nurse A. Rossi" chip; the gradient pill "Approve supported fields (7)"; and the segmented language pill.

## ASSUMPTIONS
- The coordinator suggested teal `#0FB5A6`. White on it is only 2.6:1, so the gradient runs from teal `#0A8077` (4.8) to ocean `#1A5FC4` (6.0) to keep white text AA.
- Thai fonts differ by surface on purpose: Anuphan on web for clinicians (fast to scan, matches Jakarta), looped Plex on mobile for patients.
- Light theme only, unchanged from v1.

## RISKS
- **Ops escalation rows are solid red.** `ops.module.css` paints whole escalation rows red, which now reads very heavy. DIRECTION.md 8.4 asks for white rows with a red chip. The ops builder needs to change their CSS; I did not touch their file.
- **Builder-owned details still use v1 choices.**
  - A 2px ink outline on the selected queue row.
  - "Collecting" is shown with the amber `pencil` badge, but amber should mean "needs check". Use `outline` or `ocean`.
  - Headings render at weight 400 to 500 because builders set `font-medium`.
  These are small fixes when they adopt `AppShell`, `Card` and `GradientHero`.
- **Mobile fonts.** Mobile still loads Plex Sans and Newsreader, but the tokens now name Plus Jakarta Sans for Latin. Until it is installed, Latin text falls back to the system font: no crash, but the look is off. Thai keeps working because Plex Thai Looped is loaded, except weight 700, which falls back to 600.
- **Icons are hand-maintained SVG.** Inline Lucide paths are fine for the demo; `lucide-react` would be cleaner.

## Install requests (need approval)
1. `apps/mobile`: `npx expo install @expo-google-fonts/plus-jakarta-sans expo-linear-gradient`. Jakarta is required for the v2 type. The gradient package is needed for the hero and red-flag screens in React Native.
2. `apps/web` (optional): `lucide-react`. `Icon.tsx` already uses Lucide names, so it is a drop-in swap.
3. `apps/mobile` (optional): `lucide-react-native` + `react-native-svg`. The Material Symbols package that is already installed is the fallback.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Clinician builder:** remove the `_morph.tsx` memo wrapper; LangMorph no longer replays on re-render. Optionally wrap pages in `AppShell`.
- **Ops builder:** turn escalation rows into white rows with a red `Badge tone="signal"`, add a `GradientHero` summary and use `StatTile` for the ledger.
- **Mobile builder:**
  - after the installs, load the Jakarta weights 400 to 800 and `IBMPlexSansThaiLooped_700Bold`;
  - build the home screen with the hero card and tab bar, and use answer cards instead of ruled lines;
  - make the red-flag screen use the red gradient, per DIRECTION.md 8.1.

## NEXT ACTION
Builders adopt `AppShell`, `GradientHero`, `Card` and `StatTile` per DIRECTION.md section 8. Then run `impeccable-finish-reviewer` on the three web screens and the mobile flow at 375px and 1440px, with reduced motion on.

---

## Addendum: SCBXBeta2 single typeface (owner decision)

STATUS: done. Nothing committed.

- **Web.** `apps/web/app/layout.tsx` now uses `next/font/local` with SCBXBeta2 Light 300, Regular 400 and Bold 700 (`--font-scbx`). The fallback stack is system-ui, -apple-system, Segoe UI, Noto Sans Thai, sans-serif. Plus Jakarta Sans and Anuphan are removed.
- **Weights.** `globals.css` maps Tailwind weights onto the three real cuts (medium = 400; semibold, bold and extrabold = 700), so the browser never synthesises a weight. All three font stacks point to `--font-scbx`. The Thai line-height and no-italic rules are unchanged.
- **Tokens.** `tokens.ts` adds a new `scbxFont` export (`SCBXBeta2-Light`, `-Regular`, `-Bold`). `mobileFont(role, lang, weight)` now returns these names for every language.
  - `FontWeightName` gains `light`.
  - In `sans`, medium maps to Regular and semibold to Bold. `display` defaults to Bold.
- **DIRECTION.md.** Section 3 is rewritten for one family with weights by role. Light is only for large secondary text.
- **Coverage, checked with fontTools on all three cuts:**
  - all 87 assigned Thai code points;
  - all 12 Italian accented vowels;
  - GPOS `kern`, `mark` and `mkmk`.
- **Numerals.** The font has no `tnum` feature, so digits are proportional (digit advance widths vary from 412 to 676 units in Light) and `tabular-nums` does nothing. Single big numbers such as StatTile and the patient code look fine. Tables and live timers should right-align number columns with a fixed width; DIRECTION.md section 3 says so.
- **Tests.**
  - `apps/web`: `npx tsc --noEmit` exits 0.
  - `apps/mobile`: `npx tsc --noEmit` exits 0.
- **Screens.** Saved to `docs/reports/screens/`:
  - `v2-font-review.png` (B-003: verified, missing and edited states);
  - `v2-font-review-escalated.png` (B-013);
  - `v2-font-ops.png`.
- **Mobile builder.** Register the fonts with expo-font in `_layout.tsx` using exactly these keys, then drop the Plex and Newsreader loads:

  ```ts
  "SCBXBeta2-Light": require("../../assets/fonts/SCBXBeta2-Light.otf"),
  "SCBXBeta2-Regular": require("../../assets/fonts/SCBXBeta2-Regular.otf"),
  "SCBXBeta2-Bold": require("../../assets/fonts/SCBXBeta2-Bold.otf"),
  ```

  Until then, mobile text falls back to the system font. `expo-linear-gradient` is approved; plus-jakarta and lucide are not needed.
