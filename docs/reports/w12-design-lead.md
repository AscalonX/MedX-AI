# W12 report: Design lead, mascot "Mali" and cover v3

## STATUS
done. Nothing committed.

## SUMMARY
- **Mascot.** Mali is a baby elephant in the teal-to-ocean gradient, with a minty belly, pink inner ears, big kind eyes, and a stethoscope whose chest piece the trunk holds. There is no cross or emblem.
  - Five poses: `wave`, `listening`, `thinking`, `happy`, `pointing`.
  - Built as hand-authored SVG with soft shading (linear body and ear gradients, a radial sheen, belly and chin shadows) in one shared data file that web and React Native both render.
  - I reviewed renders at 240, 120 and 48px and iterated three times: added per-ear gradients, a lighter outlined trunk so it reads as an elephant, bigger eyes, warmer cheeks, and toned-down shadows.
- **Web.**
  - `Mascot` component: decorative by default; idle bob, blink, wave and pulse, all static under reduced motion.
  - `GradientHero` gains `mascot` (Mali stands on the bottom-right edge with a light disc behind for contrast; refused when `tone="signal"`).
  - `EmptyState` gains `mascot`.
- **Cover v3, a "how it works" composition.**
  - A light mist stage with a faint four-petal and diamond pattern (low-contrast ocean tint, our palette), the MedX Bridge wordmark in SCBXBeta2, the tagline, and two badges.
  - A gradient hero card with Mali waving: "Hi, I'm Mali. Tell us what brings you in, in your own language."
  - Four numbered steps joined by dotted connectors, each with a real app screenshot:
    1. Patient speaks: phone, voice listening.
    2. Nurse checks every source: live summary with "From patient's words" chips.
    3. Doctor orders, checked: penicillin allergy conflict.
    4. Pharmacist verifies: interaction alerts.
  - Both 1600x900 and 1080x1080 versions come from one HTML source.
  - I reviewed and fixed both renders: tagline overlap, caption/connector collisions, phone overlapping the footer, tighter crops, and the square footer.
- **Not used:** no generative image tool. The cover uses the same SVG Mali, so everything is ours and consistent.

## FILES CHANGED
- `packages/shared/src/mascot.ts` (new): poses, layers, gradients, colours, `ellipsePath()`, `mascotSvg()`.
- `docs/design/mascot/`:
  - `build.mjs`: generates the SVGs and the preview from mascot.ts.
  - `mali-wave.svg`, `mali-listening.svg`, `mali-thinking.svg`, `mali-happy.svg`, `mali-pointing.svg`.
  - `preview.html`, `preview.png`, `preview-web.png`.
- `apps/web/components/ui/Mascot.tsx` (new); `GradientHero.tsx` and `EmptyState.tsx` (new optional `mascot` prop); `index.ts` (exports `Mascot`); `ui.test.ts` (mascot test).
- `apps/web/app/globals.css`: Mali idle keyframes.
- `pitch/cover/cover-v3.html` (new), `pitch/cover/cover-v3.png` (1600x900), `pitch/cover/cover-v3-square.png` (1080x1080).
- `docs/design/DIRECTION.md`: new section 11 Mascot (poses, where allowed, where forbidden, sizes, motion, accessibility, builder and React Native guide).
- `.impeccable/config.json`: one scoped ignore for `clipped-overflow-container` on `pitch/cover/cover-v3.html`. The frames clip screenshot crops on purpose; it is a static image with no popovers.

## TESTS RUN + RESULTS
| Check | Result |
|---|---|
| `cd apps/web && npx vitest run components/ui` | 8/8 pass, incl. new mascot test (every pose renders, every gradient reference resolves, no NaN in paths) |
| `cd apps/mobile && npx tsc --noEmit` | exit 0 |
| `cd apps/web && npx tsc --noEmit` | exit 2, one error, not mine (below) |

The web error is in `lib/pipeline/triage.ts:8`, the AI engineer's in-progress vitals rules: the JSON-to-`VitalRuleFile` type does not match, because `severity` is inferred as `string`. My files are clean.

## EVIDENCE (look at these)
- Mascot poses at 240, 120 and 48px: `docs/design/mascot/preview.png`.
- Web placements (hero with Mali waving, empty states with pointing and happy, hero with listening): `docs/design/mascot/preview-web.png`. Rendered through a temporary route that I then deleted.
- Covers: `pitch/cover/cover-v3.png`, `pitch/cover/cover-v3-square.png`.
- Screenshots used on the cover: `docs/reports/screens/v3-mobile-voice-5-listening-ios.png`, `v6-consult-nurse.png`, `v7-orders.png`, `v7-pharmacy-prescriptions-card.png`.

## ASSUMPTIONS
- Badge text is "Thai · Italiano · English", as the brief wrote it.
- Step 3 uses the orders screen, which the doctor uses, although the screenshot is signed in as Nurse A. Rossi. If that matters, re-shoot it signed in as Dr. M. Bianchi.
- The cover screenshots include real red "High" alerts. That is legitimate urgency inside the product, and Mali is not placed next to them.

## RISKS
- Mali is hand-drawn vector art, not a 3D render. It is polished at app sizes but flatter than the reference panda. A generated 3D render for the deck could be added later; the SVG stays the source of truth.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **Orchestrator:** optionally add `export * from "./mascot"` to `packages/shared/src/index.ts`. Components import `@medx/shared/src/mascot` until then.
- **Landing builder:** add `mascot="wave"` to the landing `GradientHero` in `app/page.tsx`.
- **Mobile builder:** render Mali with `react-native-svg` from `mascotPoses` (guide in DIRECTION.md 11): `wave` on home, `listening` on voice, `happy` on done. Never on the red-flag screen.

## NEXT ACTION
Builders place Mali per DIRECTION.md 11. Pitch lead swaps the deck cover to `cover-v3.png` and uses `cover-v3-square.png` for the team profile.
