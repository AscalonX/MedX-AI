# W20 report: typography and motion (polish, design)

## STATUS
done. Everything in my scope is built and tested: the fonts, the motion system, the landing and `/demo` motion, the promo-first video with a walkthrough dialog, and DIRECTION.md v3.1. Each item has checks behind it.

Two things are not done here:
- **No live Next.js server.** This task forbids `next build`, `next dev` and `next start`. I checked the result in two other ways: server-rendered markup with the compiled CSS, and the real client components bundled with esbuild. Both ran in Playwright Chromium.
- **Queue rows do not stagger yet.** The utility exists (`.mx-stagger`), but the queue files belong to other owners. See OPEN QUESTIONS.

Nothing is committed.

## SUMMARY
1. **Fonts.**
   - Plus Jakarta Sans (Latin) and Noto Sans Thai (Thai) via `next/font/google` are now the only UI fonts on the web.
   - SCBXBeta2 is gone from `--font-sans`, `--font-display` and `--font-serif`. Its licence metadata reads "All rights reserved".
   - Thai fallback chain while Noto loads: Leelawadee UI, Thonburi, Noto Sans Thai UI, Tahoma.
   - The type scale is tuned for Jakarta:
     - body 15/1.6, lead 1.5, lead-lg 1.6, small 1.5;
     - tracking -0.02em (title) to -0.035em (hero);
     - hero line height 1.04;
     - `text-wrap: balance` on every heading utility and `pretty` on prose.
   - Data elements get `font-feature-settings: "tnum" 1, "lnum" 1`. Marketing prose returns to proportional figures through `.mx-marketing`.
2. **Motion system.** Tokens and utilities live in `globals.css`.
   - New tokens: `--ease-glide` (0.2, 0.8, 0.2, 1), `--ease-drift`, `--duration-enter` (360 ms), `--duration-reveal` (450 ms), `--mx-step` (70 ms) and `--mx-rise` (14px).
   - `--transition-duration-*` is now defined. This is a real bug fix: Tailwind v4 reads that namespace, so `duration-quick` and `duration-base` had been silently falling back to 150 ms across the whole app.
   - `@property` keeps delays from leaking into children.
   - Classes:
     - `.mx-enter`, `.mx-enter-pop`, `.mx-enter-child` and `.mx-d1` to `.mx-d8` (entrances);
     - `.mx-reveal`, `.mx-reveal-stagger` and `.mx-stagger` (reveals and list stagger);
     - page enter on `main#main-content`;
     - `.mx-lift` (translate, plus a shadow that fades in on `::before`) and `.mx-zoom`;
     - `.mx-press` (98% while held) and a focus ring that grows out from the edge;
     - a colour crossfade on `Badge`, `Pill` and `SegmentedControl`;
     - a skeleton shimmer moved by transform;
     - `.mx-check-*` (success tick draws itself), `.mx-toast` and `dialog.mx-dialog`.
   - New primitives:
     - `MotionRuntime`: one IntersectionObserver plus a page fade on client navigations, mounted in `layout.tsx`;
     - `Reveal` (works in server components), `PointerParallax`, `SuccessCheck` and `Toast`;
     - `CountUp`, rewritten on the exact `glide` curve, with the real value in server HTML, a check before paint and a tabular box;
     - `CountUpText` (counts "49.1%" or "13 to 59%" in place).
   - `motion.ts` holds the helpers.
   - Only transform and opacity animate. The documented exceptions are the tick stroke and the focus-ring offset.
   - Every new rule sits inside `prefers-reduced-motion: no-preference`. The global reduce rule now also zeroes animation delays. `?motion=off` does the same for capture tools.
3. **Urgent stays still** (owner rule).
   - `RedFlagInterrupt` is open in its first render: no `requestAnimationFrame`, no grow transition. The `.mx-interrupt` wrapper and `data-open` stay for the sign-in sheet's selector.
   - One CSS guard keeps every element that is urgent, or inside urgent content, static. Urgent means `role="alert"`, `data-urgent`, `.mx-interrupt` or a signal class.
   - A `:has()` guard drops motion on any entrance, reveal, stagger row, lift card, toast or page `<main>` that holds urgent content. Urgent content arriving mid-entrance snaps the container to its final state.
   - Changes into red are instant, and red counts never count up.
   - Page enter also steps aside for `.fixed` layers, such as the new sign-in sheet.
4. **Landing and /demo.**
   - Staggered hero entrance; the two-tone accent fades in a beat later.
   - 3D Fin pops in, floats and tilts, with pointer parallax on desktop (layers at different depths). The floating cards bob on their own periods and arrive in sequence.
   - Sections reveal on scroll.
   - Bento cards lift and their screenshot zooms. Persona cards lift.
   - Step cards draw a progress line after they land. Stat figures count up on view.
   - The sticky nav shrinks and its glass gets denser and blurrier on scroll (header height unchanged).
   - Anchors scroll smoothly. `data-scroll-behavior="smooth"` lets Next.js turn this off during route changes.
   - The video frame has a soft halo (`.mx-glow`).
   - `/demo` gets a header entrance, reveals and live counts that count up. The launcher card rises in.
5. **Video.**
   - `videoInfo()` picks the promo first: `/media/medx-promo.mp4` with `/media/medx-promo-poster.jpg` and an optional `.en.vtt`.
   - It falls back to the walkthrough `/media/medx-demo.mp4`, then to a poster-only state.
   - When the promo exists, "Watch the full product walkthrough" opens the walkthrough in a native modal `<dialog>` with its own player:
     - focus goes to the close button and comes back on close;
     - Escape, the close button or a click on the scrim close it;
     - the click that opens it starts the video, and closing pauses it.
   - Both players have controls, `playsInline` and `preload="metadata"`, and no autoplay attribute. The promo starts muted.
   - New copy in en/th/it. The promo is not on disk yet, so today the walkthrough is the primary video and the secondary button is hidden. Both are tested.
6. **DIRECTION.md v3.1.** Changes in sections 3 (type), 4 (the one glow), 5 (motion, rewritten: rules, tokens, utilities, marketing motion, capture-tool advice), 6c (instant red flag; mobile slide-up dropped), 6e, 6f, 6g, 10, 11, 12.7, 12.11 and 12.12.

## FILES CHANGED
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`: `MotionRuntime`, `data-scroll-behavior`.
- `apps/web/components/ui/`:
  - New: `motion.ts`, `MotionRuntime.tsx`, `Reveal.tsx`, `PointerParallax.tsx`, `SuccessCheck.tsx`, `Toast.tsx`, `motion.test.ts`.
  - Modified: `fonts.ts`, `index.ts`, `CountUp.tsx`, `Button.tsx`, `Card.tsx`, `Badge.tsx`, `SegmentedControl.tsx`, `GradientHero.tsx` (HeroAction), `BentoCard.tsx`, `PersonaCard.tsx`, `StepCard.tsx`, `StatStrip.tsx`, `FinStage.tsx`, `MarketingNav.tsx`, `VideoFrame.tsx`, `EmptyState.tsx`, `Receipt.tsx`, `RedFlagInterrupt.tsx`, `marketing.test.ts` (reveal assertion updated).
- `apps/web/app/_landing/`: `Landing.tsx`, `LandingVideo.tsx`, `data.ts`, `site.ts`, `copy.ts`, `landing.test.ts`.
- `apps/web/app/demo/DemoHub.tsx`, `apps/web/app/demo/[persona]/Launcher.tsx`.
- `docs/design/DIRECTION.md`.
- Evidence: `docs/reports/screens/w20-polish-design-*.png` (8 files) and `w20-polish-design-landing-reduced-1440.jpg`.
- Not touched: `AppShell.tsx`, which already shows as modified in git (excluded from my scope). Temporary preview files I put in `app/_landing/` were removed right after use.

## TESTS RUN + RESULTS
| Check | Result |
|---|---|
| Baseline before changes: `vitest run components/ui app/_landing` | 59/59 pass |
| `vitest run components/ui app/_landing` (final) | 74/74 pass, 4 files: landing 33 (+2), marketing 20, motion 13 (new), ui 8 |
| `vitest run` (whole web suite), run 1 | 2401/2402. 1 failure in `lib/pipeline/__tests__/trace.test.ts` "contains no raw PII" (not my scope). It passed alone, 7/7 |
| `vitest run` (whole web suite), run 2 | **2402/2402 pass, 50 files** |
| `tsc --noEmit -p .` | exit 0 |
| `eslint components/ui app/_landing app/demo app/(marketing) app/layout.tsx app/page.tsx` | exit 0, no warnings |
| Tailwind compile of `globals.css` (`@tailwindcss/postcss`, outside Next) | No warnings, 120,964 bytes. `.duration-quick` / `.duration-base` now generated; `@property`, `@supports selector(:has(*))` and the reveal rules present |

What the new `motion.test.ts` checks:
- The CSS urgent list equals `URGENT_SELECTORS`.
- All `mx-*` keyframes animate only transform and opacity.
- Every moving class is declared only inside no-preference.
- Reveals hide only with `data-motion="on"` and `data-reveal="wait"`.
- The red-flag band has no transition, and `RedFlagInterrupt` renders `data-open="true"` with no rAF, timer or state.
- `CountUp` and `CountUpText` render the real value on the server, and `countText` keeps the width.
- The cubic-bezier solver.
- `motionOff`.
- Fonts: no SCBX in the stack; `layout.tsx` mounts `MotionRuntime`.
- The type-scale bounds.

## EVIDENCE
Static preview method:
- The real server markup comes from `renderToStaticMarkup`.
- CSS: `globals.css` compiled with Tailwind.
- Fonts: local `@fontsource` copies of the same two families.
- The real `MotionRuntime` is bundled with esbuild.
- Playwright Chromium served the result from a throwaway local server (not Next).
- Nav scroll and parallax were emulated in that page. The real `MarketingNav`, `PointerParallax`, `CountUp` and `CountUpText` were checked separately as a React bundle.

Measured values:
- **Fonts loaded:** Plus Jakarta Sans 400/500/600/700/800 and Noto Sans Thai 400/500/600/700.
- **H1:** 76px, line height 79.04px (1.04), tracking -2.66px (-0.035em), weight 800, `text-wrap: balance`.
- **Hero subtitle:** 20px / 32px (1.6).
- **Thai H1:** line height 98.8px (1.3), tracking normal (0), Noto loaded.
- **Reveals:** 43 sections marked waiting at load and 2 on screen; **0 still waiting after scrolling**. Under React StrictMode (dev double mount) it was also 43, then 0.
- **Nav after scroll:** `matrix(0.985, 0, 0, 0.985, 0, -4)`.
- **Bento hover:** translate `0px -3px`, screenshot scale `1.035`, lifted shadow opacity 1.
- **Reduced motion:** `data-motion="off"`, 0 waiting, hero and float animations `none`, **0 elements at opacity 0**.
- **390px:** horizontal overflow 0px.
- **First frame of the app kit:**
  - red-flag opacity 1, animation none, transition 0s; band transition `none 0s`;
  - page fade off because the page holds an alert;
  - red badge transition 0s, teal badge 0.24s, calm button 0.14s, Acknowledge button (inside the alert) 0s;
  - stagger row 3 delayed 0.08s; skeleton `mx-shimmer`; tick `mx-check-draw`.
- **Client islands in a browser:**
  - `CountUp` 1872: about 301 just after mount, 1,637 at 250 ms, 1,872 at 1250 ms.
  - `CountUpText` "49.1%": " 9.9%", then "42.6%", then "49.1%" (figure-space padding keeps the width).
  - **Urgent count (inside `.text-signal`): "6" from the first sample.**
  - A figure below the fold stays at " 0 to  0%" until scrolled to, then reads "13 to 59%".
  - Parallax layer translate `-0.63px -1.55px`; nav `data-scrolled="true"`; 0 page errors.
  - Reduced motion: counts final at once and parallax unset.
- **Screenshots** (`docs/reports/screens/`): `w20-polish-design-hero-1440.png`, `-hero-entering-1440.png` (140 ms: the staggered entrance mid-way), `-features-1440.png` (lifted card, compact nav), `-steps-1440.png` (progress lines), `-why-1440.png`, `-hero-390.png`, `-hero-th-1440.png`, `-kit.png` (red flag, counts, rows, receipt, badges, toast, type samples) and `-landing-reduced-1440.jpg` (full page, reduced motion, nothing hidden).

## ASSUMPTIONS
- "Urgent" for motion means the existing markers: `role="alert"`, signal classes and `.mx-interrupt`, plus a new `data-urgent` opt-in. A red flag on the landing (the marketing red-flag card) is treated the same way: it never reveals, lifts or fades.
- The owner rule "urgent content appears instantly" supersedes DIRECTION 6c's grow animation, for the clinician card and for the patient mobile slide-up alike. I updated 6c.
- Looping ambient motion (float, shimmer, Fin's bob) and the 900 ms count-up tween fall outside the "150 to 450 ms" band, which I read as applying to transitions and entrances. This is written down in DIRECTION 5.1.
- When the promo exists but its poster does not, the promo plays with no poster. It never borrows the walkthrough's poster, which is a frame of another video.
- The Italian and Thai strings for the walkthrough dialog are mine. The page already marks th and it as native review pending.

## RISKS
- **No live Next render.** Every behaviour was checked in Chromium outside Next. Worth checking in the gate's `next build` and a click-through:
  - hydration of the islands inside the real app router;
  - Next's handling of `data-scroll-behavior`;
  - lightningcss minification of `@property` and `@supports selector()`.
- **Capture tools.** Landing sections below the fold stay hidden until scrolled, as they already did with the old scroll-driven reveal. Playwright full-page captures need one of: `reducedMotion: "reduce"`, `animations: "disabled"`, `?motion=off`, or a scroll first. `record-demo.mjs` already passes `animations: 'disabled'` for its stills.
- **Page enter on every app page** (360 ms fade and 8px rise). It is skipped when the page holds urgent content or a `.fixed` layer. A fixed element added mid-fade without the `.fixed` class would ride along for under 360 ms.
- **Line height.** Body line height 1.5 to 1.6 makes dense clinician tables slightly taller.
- **Browser support.** Browsers without `:has()` (Firefox before 121) get no page fade and no list stagger, by design, so the urgent guard can never be bypassed.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
1. **`packages/shared/src/tokens.ts` (orchestrator).**
   - The web `stack` string still names `--font-scbx`; please replace it with the stack now in `globals.css`.
   - Please add `easing.glide = [0.2, 0.8, 0.2, 1]`, `easing.drift = [0.45, 0, 0.55, 1]`, `duration.enter = 360`, `duration.reveal = 450` and `duration.step = 70`.
   - Note that `duration.interrupt` no longer drives the red flag.
2. **`apps/web/app/fonts/SCBXBeta2-*.otf`** are unused on the web and carry an "All rights reserved" licence. The orchestrator may delete them (outside my scope).
3. **Queue owners** (clinician `review/_queue.tsx`, pharmacy `_queue.tsx`, ops `Queue.tsx`): add `mx-stagger` to the queue `<ul>` to get the list stagger. Urgent rows already stay still. Use `Card interactive` for clickable cards. Mark any urgent element without a signal class with `data-urgent`.
4. **Ops owner.** `app/(ops)/components/CountUp.tsx` counts up the hero escalation number over 650 ms, and its red comes from a CSS-module class, so my guard cannot see it. Please show urgent counts at once, or use `components/ui` `CountUp` inside a `text-signal` element.
5. **Patient mobile builder.** DIRECTION 6c now says the red-flag view appears instantly, with no slide-up.
6. **Promo pipeline.** Drop `medx-promo.mp4` (and `-poster.jpg`, an optional `.en.vtt`) into `apps/web/public/media/` and rebuild; the landing is force-static. The walkthrough button then appears by itself.
7. **QA and video agents.** Use one of the capture options in RISKS for landing captures.
8. **AI engineer.** The transient failure of the trace "contains no raw PII" test in the first full run is worth a look; it passed alone and on the rerun.
9. **Logout** (owner request) is not in this scope, because `AppShell.tsx` is excluded. I assume another agent has it.

## NEXT ACTION
Orchestrator: merge, then run `next build` and a click-through, each with reduced motion on and off:
- `/`, `/th` and `/demo`;
- one clinician case with a red flag, to confirm it is static from the first frame;
- one pharmacy page with the sign-in sheet, to confirm no page fade while it shows.

Then apply contract requests 1 and 2.
