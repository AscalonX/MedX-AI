# W20 report: Design lead, v3 design system, 3D brand art, marketing primitives

## STATUS
partial. All three tasks are done (brand art, design system, DIRECTION.md v3), and the S-06 rules and tokens are in place. The one part not done is S-06's sign-off review of `/` and `/demo` at 1440px and 390px (`landing-*.png`). The landing page is not in the working tree yet (`app/page.tsx` is unchanged), and this task forbids `next dev`/`next start`. Nothing committed.

## SUMMARY
1. **Brand art.**
   - 18 owner-approved webp files copied to `apps/web/public/brand/` (692 KB, transparent): `fin3d-{wave,listening,thinking,happy,pointing}-{256,512}`, `fin-{wave,hello}-{256,512,1024}`, `mark-3d-{256,512}`.
   - The full set plus the 3D app-icon PNGs are copied to `docs/design/brand3d/`, with `review-sheet.png` showing every file on desk, card, the primary gradient and ink.
   - New `FinArt` component: next/image, explicit square size, aria-hidden unless `label` is given, `priority` only on request. A custom loader picks the 256, 512 or 1024 file by real pixel width, so no optimizer round trip is needed.
   - `Mascot` renders the 3D art from 96px (`MASCOT_3D_MIN`) and the vector drawing below. `GradientHero` and `EmptyState` therefore show the 3D Fin, and `GradientHero` still refuses Fin when `tone="signal"`.
   - `app/apple-icon.png` is now the 3D app icon (180). The vector favicon (`icon.svg`, `favicon.ico`) is unchanged.
2. **Design system.**
   - Fonts: Plus Jakarta Sans and Noto Sans Thai via `next/font/google`, in `components/ui/fonts.ts` (exports `fontVariables`).
   - `globals.css` reads `--font-jakarta` and `--font-noto-thai`, falling back to SCBXBeta2, so pages render the same before and after `layout.tsx` switches.
   - Weight map for variable fonts: 500, 600, 700 and 800 are real instances.
   - Marketing type scale: `text-hero` 40 to 76px, `text-h2` 30 to 48px, `text-h3`, `text-lead-lg`, `text-eyebrow`.
   - Rhythm and shape: `py-section`, `max-w-page`, `rounded-bento`, `rounded-media`.
   - Shadows: `float`, `nav`, `ink`, `button`, `hairline`.
   - Surfaces: `bg-mist`, `bg-ink-gradient`, `bg-halo`, `glass` (opaque fallback where blur is unsupported), `text-brand-gradient` and `-light` (plain text in forced-colours mode).
   - Motion: `.mx-reveal` (CSS scroll-driven, explicitly off under reduced motion) and `.mx-float`.
   - All tints are `color-mix` of tokens. The one new colour token is `inkRaised` `#173A63`, the ink gradient end, which is in `tokens.ts` and mirrored in CSS.
   - Every existing component API and class name is kept. Additions to existing components:
     - `Button`: `size="sm"` and `variant="onDark"`.
     - `ButtonLink` and `buttonClasses()`.
     - `Card`: `tone="glass" | "ink"`.
     - 31 Lucide icons.
     - A translucent `AppShell` sidebar.
   - New primitives: `Section`, `SectionHeader`, `Eyebrow`, `Accent`, `Chip`, `BentoGrid`, `BentoCard`, `BentoMedia` (with a `zoom`/`position` crop and neutral window dots), `StepList`, `StepCard` (the human step is teal), `PersonaGrid`, `PersonaCard`, `VideoFrame`, `StatStrip` (a source is required), `MarketingNav`, `Footer` (disclaimer required), `FinStage` and `FloatCard`.
3. **DIRECTION.md v3.**
   - New owner-decision block and §3 type rewritten for the new fonts.
   - Palette, shape, motion, icon and builder sections updated.
   - §11 gains "3D art" rules: the 96px switch; the 3D mark never on the primary gradient (it disappears there, as the review sheet shows); not on red, alerts or clinical content; never edit the art.
   - New §12 "Marketing surfaces" (S-06): Fin on `/` in the hero only with patient-side floating cards; the dark card on the ink token; bento rules (real UI crops, no generic icon cards); the video frame; the persona card; red only on the red-flag card; a sign-off checklist.
   - Logo moved to §13.
   - §1 and §6 safety states and interactions are unchanged.

## FILES CHANGED
- Brand art and icon:
  - `apps/web/public/brand/` (new, 18 webp).
  - `docs/design/brand3d/` (new: 19 webp, 4 app-icon PNGs, `review-sheet.png`).
  - `apps/web/app/apple-icon.png` (replaced).
- Styles and tokens:
  - `apps/web/app/globals.css`.
  - `packages/shared/src/tokens.ts`. Inside this task's scope. The changes are additive (`inkRaised`, `gradient.ink`, `webFont`, `marketingType`, space 20/24/32, `layout.marketing`, `radius.bento`/`media`, `shadow.float`/`ink`). The web stack string changed; `scbxFont` and `mobileFont` are unchanged.
- `apps/web/components/ui/`:
  - Modified: `AppShell.tsx`, `Button.tsx`, `Card.tsx`, `EmptyState.tsx`, `GradientHero.tsx`, `Icon.tsx`, `Logo.tsx` (comment), `Mascot.tsx`, `StatTile.tsx`, `index.ts`.
  - New: `FinArt.tsx`, `FinStage.tsx`, `fonts.ts`, `Section.tsx`, `Chip.tsx`, `BentoCard.tsx`, `StepCard.tsx`, `PersonaCard.tsx`, `VideoFrame.tsx`, `StatStrip.tsx`, `MarketingNav.tsx`, `Footer.tsx`, `marketing.test.ts`.
- `docs/design/DIRECTION.md` (v3).
- `docs/reports/screens/w20-design-kit-{1440,390}.png` and `-fold.png`.

## TESTS RUN + RESULTS
| Check | Result |
|---|---|
| `vitest run components/ui` | 28/28 pass (8 existing + 20 new in `marketing.test.ts`) |
| `vitest run` (whole suite, final run) | 2017 pass, 4 fail, 32 files. All 4 failures are `GET /api/health` in `llm-api.test.ts` and `wave8.test.ts` (`.json is not a function`). `app/api/health/route.ts` is modified in the working tree by its owner. An earlier run also showed one transient failure in a demo-seed test (`demo cases stay synthetic`), which passed on the next run |
| `tsc --noEmit -p .` | Exit 0 at one point mid-task. The final run shows errors only in other owners' files: `.next/types/app/api/health`, `app/api/cron/reset/route.ts`, and `llm-api`/`wave8` tests. None are in `components/ui` or `tokens.ts` |
| `eslint components/ui` | Exit 0, no warnings |

New tests in `marketing.test.ts`:
- Every file `FinArt` can request exists, `public/brand` holds only those files, and the total is under 3 MB.
- Loader mapping.
- Decorative versus labelled art.
- 3D from 96px and vector below, for all five poses.
- Fin refused on the red hero.
- `Section` labelling.
- Ink surfaces never red.
- Only `accent="signal"` adds red.
- `BentoMedia` alt and neutral window dots.
- The human step is teal.
- A persona card is one link.
- The video has controls and a poster, preload is metadata, and there is no autoplay.
- Stat sources and new-tab notes.
- Nav skip link, call to action and menu.
- The footer disclaimer.
- No hex value in `globals.css` that is not a token, and no raw hex in any `components/ui/*.tsx`.
- Reveal guarded by `prefers-reduced-motion: no-preference`.

## EVIDENCE
- **Visual check without `next dev`.**
  - Method: the new and existing primitives were rendered to static HTML (vitest + `react-dom/server`, from the scratchpad), Tailwind was compiled from `globals.css`, and the page was served locally and captured with Playwright.
  - The fonts were loaded from Google Fonts with the same CSS variables as `fonts.ts`.
  - The bento crops are existing screenshots (`docs/readme`, `docs/reports/screens`).
  - Screenshots: `docs/reports/screens/w20-design-kit-1440.png`, `w20-design-kit-390.png`, `w20-design-kit-1440-fold.png`, `w20-design-kit-390-fold.png`.
- **Measured in Playwright:**
  - `scrollWidth` 390 at a 390 viewport (no horizontal scroll).
  - h1 renders 76px at 1440 and 40px at 390.
  - `document.fonts.check` is true for Plus Jakarta Sans and Noto Sans Thai (Thai string).
  - 0 failed images after scroll-through. The only 404 is `/media/medx-demo.mp4`, which does not exist yet.
- **Reveal with motion on:**
  - All 26 `.mx-reveal` elements use `mx-reveal-in`.
  - In-view elements reach opacity 1, and below-fold ones wait.
  - Anchors land below the sticky nav.
- **Font facts (fontTools on the Google Fonts subsets):**
  - Jakarta `latin` has `tnum` and all 12 Italian accented vowels.
  - Noto Sans Thai `thai` covers 87/87 assigned Thai code points, with `mark` and `mkmk`.
- **Brand art:** `docs/design/brand3d/review-sheet.png`.
  - Finding: the 3D mark does not read on the primary gradient. This is now a rule in §11 and §12.4.

## ASSUMPTIONS
- `packages/shared/src/tokens.ts` is mine for this wave because the task scope lists it. CLAUDE.md marks `packages/shared` as orchestrator-only.
- Mobile keeps SCBXBeta2 for now. The owner's typography decision describes the web, and changing `mobileFont` would break the app until the fonts are bundled there.
- S-06's "Fin hero only on `/`" means no Fin in the final call to action either (unlike the reference). The final panel uses the primary gradient without the 3D mark.
- Eyebrows stay sentence case (DIRECTION bans ALL CAPS), unlike the reference's small caps.
- `FinStage` hides its third floating card below 640px to keep the phone hero calm.

## RISKS
- `next/font/google` downloads the fonts at build time. Vercel builds have network access; an offline Docker build would fail at `layout.tsx` once it imports `fonts.ts`.
- Scroll-driven reveal: a full-page screenshot taken without scrolling shows below-fold sections transparent. The video agent should scroll first or set Playwright `reducedMotion: "reduce"`, which disables the reveal.
- The seeded landing stills are full screens. In small bento cards they are only legible with `BentoMedia zoom`/`position` crops.
- `--shadow-sheet` and `--shadow-sheet-lifted` are a little softer and wider, and the weight map now has real 500/600/800. All existing pages re-skin, but I did not click through the app pages in a live browser this wave.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **`apps/web/app/layout.tsx` (landing builder).** One-line change: `import { fontVariables } from "@/components/ui/fonts";` and `<html lang="en" className={fontVariables}>`. The SCBX `localFont` can then be removed, or kept alongside (`className={`${fontVariables} ${scbx.variable}`}`) during the transition.
2. **S-06 sign-off still open.** Once `/` (and `/demo`, if built) exists and a server may run, run the checklist in DIRECTION §12.12 at 1440px and 390px and save `docs/reports/screens/landing-*.png`. I can do it in a follow-up dispatch.
3. **`apps/web/vitest.config.ts` (orchestrator).** It compiles TSX with the classic JSX runtime, so `marketing.test.ts` sets a global `React` through `vi.hoisted`. Adding `esbuild: { jsx: "automatic" }` would make that unnecessary.
4. **`apps/mobile/src/components/logo.tsx` (mobile builder).** The comment still cites "DIRECTION.md section 12"; the logo is now section 13. Optional: use `fin3d-*` at 96pt and up, and adopt Jakarta and Noto Sans Thai.
5. **PWA manifest.** The 3D 192/512 icons are in `docs/design/brand3d/` for whoever owns `app/manifest.ts`. I did not add a PNG `icon`, so the tab favicon stays vector.
6. **Video agent.** When capturing fresh `/landing/*.webp`, pick crops with no red UI except for the red-flag card (§12.6). For example, the ops still currently shows a red escalation count.

## NEXT ACTION
- Landing builder: apply the `layout.tsx` line, then build `/` from the §12 primitives, following §12.2 order and §12.3 to §12.10 rules.
- Design lead (follow-up): run the §12.12 sign-off on `/` and `/demo` at 1440px and 390px and save `landing-*.png`.
