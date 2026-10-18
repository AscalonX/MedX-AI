# MedX design direction v3: "Calm clinical banking"

Owner: Design lead. Status: v3.1, binding from wave 20 (v2 was binding from wave 4).
Tokens: `packages/shared/src/tokens.ts`. Web mapping: `apps/web/app/globals.css`. Web primitives: `apps/web/components/ui/`.
If this file and a screen disagree, this file wins. If this file and `CLAUDE.md` safety invariants disagree, `CLAUDE.md` wins.

> **v3 (owner decisions, Sat 17 Oct 2026, late evening).** Nothing in sections 1 and 6 (safety states, red-flag interrupt, highlighter) changed. What changed:
> 1. **Polish, same brand.** "Calm clinical banking" stays: teal `#0A8077` to ocean `#1A5FC4`, Fin the dolphin, the Echo X logo. The look follows the owner's reference site (U-Talk) more closely: mist background with soft radial tints, big two-tone headlines, white rounded cards with soft shadows, one dark gradient feature card, pill chips, a translucent sticky nav.
> 2. **Typography (web).** Plus Jakarta Sans (Latin, Italian) with Noto Sans Thai (Thai), via `next/font/google`, replace SCBXBeta2 on the web. The logo keeps its outlined vector wordmark. Mobile keeps SCBXBeta2 until the mobile builder adopts the web fonts (section 3).
> 3. **3D brand art.** Owner-approved 3D Fin poses, a large detailed hero Fin, a 3D mark and a 3D app icon. 3D at 96px and up; vector below and for favicons (section 11).
> 4. **English first.** All content defaults to English. Thai and Italian stay one toggle away. Language controls list EN first on marketing pages.
> 5. **Marketing landing at `/`.** New section 12 sets the rules for it. The logo section moved from 12 to 13.

> **v3.1 (owner request, Sun 18 Oct 2026, about 02:45: "make the font and front end beautiful, add beautiful animations").**
> 1. **Type.** Plus Jakarta Sans and Noto Sans Thai are now the *only* UI fonts on the web. SCBXBeta2 left the CSS stack (its licence metadata reads "All rights reserved"). Body text runs at 1.6, display headings tighten to -0.02 to -0.035em, data uses tabular figures (section 3).
> 2. **Motion system.** Tokens, utilities and primitives for entrances, scroll reveals, list stagger, page enter, hover lift, press, colour crossfade, skeleton shimmer, success tick, count up, toasts and the marketing hero (section 5).
> 3. **Urgent stays still.** Red-flag interrupts, emergency alerts and high alerts appear instantly and never move. The red-flag card no longer grows in (sections 5 and 6c).
> 4. **Video.** The primary landing video is the cinematic promo when it exists; the screen-recorded walkthrough opens from a secondary action in a dialog (section 12.7).

> **v1 superseded.** v1 "Clinical paper" (paper, ink, serif) was replaced on 17 Oct 2026, 15:00 by owner decision: a modern banking-app look (reference u-talk-ten.vercel.app), teal to ocean primary. What carries over from v1 is the meaning: red only for urgency, five honest safety states, the highlighter link to the patient's sentence, the red-flag interrupt that pushes content away, and the language morph. v1 token and utility names are kept and remapped so v1 screens re-skin without code changes (section 10).

## 1. Concept

A calm, friendly health app with the polish of a good banking app. You see where you stand at a glance: big clear numbers, one bold card that says what to do next, soft white cards for everything else. The model never appears as a character. There are no chat bubbles for clinical content, no avatar for "the AI", no sparkles. Model output is shown as **values with a provenance chip**, so trust is always visible:

| State (`FieldStatus`) | Looks like | Means |
|---|---|---|
| `supported` | Bold value + ocean chip "From patient's words" (quote icon) + confidence bars | Backed by a verified quote |
| `unsupported` | Softer value in a dashed amber outline on amber tint + amber chip "Needs check" (alert icon) + amber note | Model value, no quote. Never shown as fact |
| `missing` | Grey placeholder pill "Not mentioned yet" (minus icon) | Patient has not said it |
| `edited` | Old value struck through in grey, new bold value + teal chip "Edited by clinician, <name>" (pencil icon) | Clinician changed it |
| `approved` | Bold value + teal chip "Approved, <name>" (check icon) | Clinician confirmed it |
| Red flag | Red gradient card, white text, alert icon | Urgent. Red means this and nothing else |

The states differ in colour **and** shape **and** icon **and** words, so they still read correctly in greyscale and for colour-blind users.

Mood: calm, bright, competent, kind. Rounded but not toy-like. One moment of colour per screen.

Still banned: emoji UI, sparkle icons, AI-assistant chat bubbles for clinical content, a generic stock hero with 3 feature cards, red as decoration, % confidence badges, coloured status dots without words, em dashes in UI copy.

## 2. Palette

| Token | Hex | Role | Contrast (WCAG 2.x) |
|---|---|---|---|
| `desk` | `#EEF3F6` | App background (cool mist). Body adds two faint radial tints (teal top left, ocean bottom right) | ink 15.1, inkSoft 6.7, graphite 5.3 |
| `paper` | `#F5F8FA` | Quiet surface: selected rows, inset panels, patient page | ink 15.8, graphite 5.6 |
| `sheet` | `#FFFFFF` | Card | ink 16.9, inkSoft 7.5, graphite 5.9 |
| `muted` | `#EDF1F5` | Missing placeholder, segmented track, skeleton | graphite 5.2 |
| `ink` | `#0F1E2E` | Primary text, big numbers; the dark marketing surface (section 12) | white 16.9 |
| `inkRaised` | `#173A63` | End of the ink gradient (ink toward ocean). Marketing only | white 11.5 |
| `inkSoft` | `#45566A` | Labels, secondary text | 7.5 on card |
| `graphite` | `#56657A` | Hints, timestamps, placeholders | 5.9 on card, 4.6 on highlighter |
| `rule` | `#E3E9EF` | Hairlines, card borders (decorative) | n/a |
| `ruleStrong` | `#7D8C9E` | Input borders | 3.4 on card (non-text 3:1) |
| `primaryFrom` | `#0A8077` | Gradient start (teal) | white 4.8 |
| `primaryTo` | `#1A5FC4` | Gradient end (ocean) | white 6.0 |
| `teal` | `#08716A` | Brand text and icons; approved, edited, active nav | 5.9 on card, 5.1 on tealTint |
| `ocean` | `#1A5CBF` | Links, focus ring, "From patient's words", confidence bars | 6.3 on card, 5.4 on oceanTint |
| `tealTint` | `#E1F4F1` | Approved and edited chips, active nav | |
| `oceanTint` | `#E5EEFB` | Verified chip, empty-state icon disc | |
| `highlighter` | `#D2E4FF` | Evidence sweep (ocean marker); text stays ink | ink 13.1 |
| `warn` | `#8F4508` | "Needs check" text, dashed outline | 6.9 on card, 6.3 on warnTint |
| `warnTint` | `#FEF2D7` | Needs-check background | |
| `signal` | `#BE1B2B` | Urgency only | 6.2 on card, white on it 6.2 |
| `signalDeep` | `#9E1024` | Red gradient end | white 8.2 |
| `signalTint` | `#FDEAEC` | Urgent (non-emergency) background | signal 5.4 |
| `onPrimary` / `onSignal` | `#FFFFFF` | Text on gradients | see stops |

Gradients (`tokens.gradient`):
- `primary` 135deg `#0A8077` to `#1A5FC4`, with one soft white radial at the bottom-right corner (decoration only, never under body text).
- `signal` 135deg `#C81E2C` to `#9E1024`, for red flags only.
- `ink` 160deg `ink` to `inkRaised`, with faint ocean and teal radials (`bg-ink-gradient`). Marketing only: the one dark bento card and the safety band (section 12). Never in the app, never with red.

Marketing tints are mixes of these tokens (`color-mix`), never new hex values:
- `bg-mist`: desk with teal, ocean and oceanTint radials (the marketing page background).
- `bg-halo`: a white to oceanTint disc behind Fin.
- `glass`: 72% white with an 18px backdrop blur; 96% white where blur is unsupported.
- `text-brand-gradient`: teal to ocean text for the second tone of a headline (large text only, 4.3:1 on desk). `text-brand-gradient-light` is the same on ink. Both fall back to plain text in forced-colours mode.

`marketing.test.ts` fails if `globals.css` holds a hex value that is not a token, or if a design-system component contains a raw hex colour.

Rules:
- **One gradient hero per screen.** Everything else is a white card. The primary button is the only other gradient.
- **Red is urgency only.** Emergency is the red gradient with white text. Urgent is `signalTint` with a red ring and red icon. Never red for errors in forms (use `signal` text only for a field error message, which is a "stop" signal), never for hover, never for decoration.
- **Amber means "needs a human check".** Use it only for unverified values and blocked actions.
- **Teal means "done by a clinician"** (approved, edited, signed off). Ocean means "comes from the patient's words".

## 3. Type

**Web (v3): Plus Jakarta Sans + Noto Sans Thai** (owner decision, 17 Oct 2026, late evening).
- **Plus Jakarta Sans** sets Latin and Italian. Checked with fontTools on the Google Fonts `latin` subset: all 12 Italian accented vowels (à è é ì ò ù and capitals) and the `tnum` feature (tabular figures) are present.
- **Noto Sans Thai** sets Thai. Checked on the `thai` subset: all 87 assigned Thai code points (U+0E01 to U+0E5B) and `mark`/`mkmk` positioning for stacked vowels and tone marks.
- Both are **variable fonts** (Jakarta 200 to 800, Noto Sans Thai 100 to 900), so every weight below is a real instance; the browser never synthesises one.

Loading:
- **Web:** `apps/web/components/ui/fonts.ts` calls `next/font/google` and exports `fontVariables` (`--font-jakarta`, `--font-noto-thai`). `layout.tsx` puts it on `<html>`. The files are self-hosted at build time (no request to Google at runtime). Jakarta has a metric-matched local fallback, so text does not reflow when it arrives. Noto Sans Thai is not preloaded (most first views are English); it loads on the first Thai glyph.
- **v3.1: these are the only UI fonts on the web.** The CSS stack is `var(--font-jakarta), var(--font-noto-thai), "Leelawadee UI", Thonburi, "Noto Sans Thai UI", Tahoma, system-ui, sans-serif`. The platform Thai faces only cover the moment before Noto Sans Thai loads. SCBXBeta2 is no longer in the stack: its licence metadata reads "All rights reserved". The unused `apps/web/app/fonts/SCBXBeta2-*.otf` files can be deleted; that call belongs to the orchestrator, because the folder is outside the design lead's scope.
- **Mobile:** unchanged for now. SCBXBeta2 through expo-font (`"SCBXBeta2-Light"`, `"SCBXBeta2-Regular"`, `"SCBXBeta2-Bold"`); `mobileFont(role, lang, weight)` returns these names. The mobile builder may move to the Expo Google Fonts packages for both families later; tokens keep both (`webFont`, `scbxFont`).
- `serif` and `display` remain aliases of the sans so earlier calls compile.
- The logo wordmark stays outlined vector paths (section 13), so it never depends on a font.

Weights (Tailwind):

| Class | Weight | Use |
|---|---|---|
| `font-light` | 300 | Large secondary text only (17px and up) |
| `font-normal` | 400 | Body, labels, inputs |
| `font-medium` | 500 | Quiet emphasis, unverified values (`.mx-pencil`) |
| `font-semibold` | 600 | Buttons, chips, nav, eyebrows |
| `font-bold` | 700 | Headings, values, card titles |
| `font-extrabold` | 800 | Big numbers, marketing headlines |

Numerals (v3.1):
- **The app is data first.** Every page uses tabular, lining figures (set on `<html>`), so counters, times and tables never shift when digits change.
- **Data elements** spell out the OpenType features: `table`, `time`, `code`, `kbd`, `output`, `.tabular-nums` and `[data-numeric]` get `"tnum" 1, "lnum" 1`.
- **Marketing prose** returns to proportional figures. Pages with `.mx-marketing` on their root (the landing, `/demo`) and the marketing headlines (`.text-hero`, `.text-h2`, `.text-h3`) do this. Counting numbers stay tabular.

App scale (px; line height Latin / Thai). Sizes are unchanged from v2. Line heights and tracking were tuned in v3.1 for Jakarta: text runs at 1.5 to 1.6, and headings tighten as they grow.

| Token | Size | LH | Weight, tracking | Use |
|---|---|---|---|---|
| `micro` | 12 | 1.45 / 1.6 | 600 in chips | Chips, meta |
| `small` | 13 | 1.5 / 1.65 | 400 or 600 | Labels, table meta |
| `body` | 15 | 1.6 / 1.7 | 400; values 700 | Clinician body |
| `lead` | 17 | 1.5 / 1.6 | 400 or 700 | Card titles, red-flag action |
| `bodyPatient` | 18 | 1.6 / 1.7 | 400 | Patient body |
| `title` | 22 | 1.25 / 1.5 | 700, -0.02em | Screen titles, hero title, greeting name |
| `question` | 26 | 1.2 / 1.45 | 700, -0.022em | The one patient question |
| `stat` | 32 | 1.1 / 1.3 | 800, -0.03em | Big numbers |
| `display` | 34 | 1.1 / 1.4 | 700, -0.03em | Red-flag screen (mobile) |
| `code` | 52 | 1.0 | 700, -0.03em | Patient code B-042 |

Marketing scale (`tokens.marketingType`; fluid between a 390px and a 1440px viewport):

| Utility | Size | LH Latin / Thai | Weight, tracking | Use |
|---|---|---|---|---|
| `text-hero` | 40 to 76 | 1.04 / 1.3 | 800, -0.035em | The page H1 only |
| `text-h2` | 30 to 48 | 1.08 / 1.35 | 800, -0.03em | Section titles |
| `text-h3` | 20 to 24 | 1.25 / 1.5 | 700, -0.02em | Card and step titles |
| `text-lead-lg` | 17 to 20 | 1.6 / 1.7 | 400 | Hero and section subtitles |
| `text-eyebrow` | 13 | 1.2 / 1.5 | 600, +0.01em | Eyebrow chips |

Hierarchy is set by weight before size: 400 for reading, 600 for things you press, 700 for names of things, 800 for the one number or headline that matters. Headings (`h1` to `h3`, `text-title` and every display utility) use `text-wrap: balance`. Paragraphs, list items and captions use `pretty`.

Rules: sentence case; no ALL CAPS (eyebrows too). Negative tracking on Latin headings only; Thai tracking is always 0 (the CSS forces it). Thai never gets italics (the CSS forces normal).

## 4. Shape, elevation, spacing, grid

Radii: `control` 14 (inputs), `card` 22, `hero` 28, `pill` 999 (buttons, chips, segmented controls, nav items, avatars). Marketing adds `bento` 28 (bento cards, the ink band, the video frame) and `media` 16 (screenshot crops). Squares are only for icons in a rounded square (brand mark, bento and step icons, 16px corner).

Elevation (diffuse, navy-tinted, offset down, never black, never a glow; the one exception is the soft halo behind the landing video frame, `.mx-glow`, section 12.7):

| Token | Value | Use |
|---|---|---|
| `hairline` | 0 1 2 rgba(15,45,80,.06) | Under borders |
| `sheet` (card) | 0 1 2 .06 + 0 8 24 -12 rgba(15,45,80,.16) | Every card |
| `sheetLifted` | 0 18 40 -16 rgba(15,45,80,.24) | Hover lift, drawer, mobile tab bar |
| `hero` | 0 22 40 -20 rgba(26,95,196,.55) | Gradient hero, primary button (smaller) |
| `signal` | 0 22 40 -20 rgba(158,16,36,.55) | Red-flag card |
| `button` | inset 0 1 0 white 22% + 0 10 20 -10 rgba(26,95,196,.75) | Primary gradient button (soft top highlight) |
| `float` | 0 24 48 -20 rgba(15,45,80,.28) | Marketing floating cards, the video frame |
| `nav` | 0 12 32 -20 rgba(15,45,80,.3) | Sticky marketing nav |
| `ink` | 0 30 60 -30 rgba(15,30,46,.6) | The dark marketing card and band |

Cards have a 1px `rule` border at 70% plus the `sheet` shadow. Any element that already uses the `shadow-sheet` class becomes a 22px-radius card automatically.

Space: 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, plus 80, 96 and 128 for marketing). Card padding is 20 (bento 24 to 28). The gap between cards is 16 on mobile and 24 on web.

Marketing rhythm: sections use `py-section` (`clamp(56px, 7vw, 104px)` top and bottom) inside a `max-w-page` (1200px) column with a 16px gutter on phones and 32px from 640px. Anchor jumps land below the sticky nav (`scroll-padding-top: 88px`).

Grid:
- **Web shell:** sidebar 248 | content (max 1440).
- **Clinician content:** queue 300 | summary min 560 | transcript 400, gutter 24.
- **Ops:** 12 columns.
- **Mobile:** single column, 20pt side margin, a 72pt bottom tab bar with a 60pt raised centre action.
- **Marketing (`/`):** 1200px column; bento 3 columns from 1024px, 2 from 640px, 1 below.

## 5. Motion

Calm, premium motion that answers the user and never performs. v3.1 (owner request, 18 Oct 2026) adds a full motion system: tokens and utilities in `globals.css`, primitives in `components/ui`, and one runtime (`MotionRuntime`, mounted in `app/layout.tsx`).

### 5.1 Rules (every motion follows them)
1. **Only transform and opacity animate.** This includes the `translate` and `scale` properties. Shadows fade in on a pseudo-element; they never animate `box-shadow`. Nothing that moves changes its box, so there is no layout shift: reveals start from a transform, never from height. Two documented exceptions: the success tick draws its stroke (`stroke-dashoffset`), and the focus ring grows its `outline-offset` from 0 to 2px.
2. **Durations 150 to 450 ms on `glide`.** Longer motions are slow ambient loops only (the hero float, the skeleton shimmer, Fin's bob) and the count-up tween (900 ms, section 6g).
3. **Reduced motion means no motion at all.** Every new class is declared only inside `@media (prefers-reduced-motion: no-preference)`. A global rule also zeroes durations and delays, so nothing waits hidden. `?motion=off` does the same for capture tools: `MotionRuntime` sets `data-motion="off"` on `<html>`. Nothing is ever hidden under reduced motion.
4. **Content is visible without JS.** Scroll reveals hide only what the runtime has marked as waiting. Counts render the real number on the server.
5. **Urgent stays still** (owner rule, wave 20). Red-flag interrupts, emergency alerts and high alerts appear instantly and never move:
   - **What counts as urgent:** `role="alert"`, `data-urgent`, `.mx-interrupt`, `.bg-signal`, `.bg-signal-gradient`, `.bg-signal-tint`, `.text-signal`. The list is `URGENT_SELECTORS` in `components/ui/motion.ts`, and `motion.test.ts` checks it matches the CSS.
   - Urgent elements and everything inside them get `animation: none; transition: none`.
   - Any entrance, reveal, stagger row, lift card, toast or page `<main>` that holds urgent content drops its own motion. This uses `:has()`, so if urgent content arrives mid-entrance, the container snaps to its final state in that frame.
   - Badges change into red instantly. A red count never counts up (`CountUp` checks for an urgent ancestor before paint).
   - Never put Fin, a toast or a decorative motion next to urgent content.

### 5.2 Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-glide` (`ease-glide`) | cubic-bezier(0.2, 0.8, 0.2, 1) | Entrances, reveals, lifts, crossfades. JS uses the same curve (`easeGlide`) |
| `--ease-pen` (`ease-pen`) | (0.22, 1, 0.36, 1) | Hover colour, language morph |
| `--ease-drift` | (0.45, 0, 0.55, 1) | Ambient loops (float, shimmer) |
| `--ease-marker`, `--ease-interrupt` | unchanged | Highlighter sweep; `interrupt` is no longer used for the red flag |
| `quick` | 140 ms | Press, hover colour, focus ring |
| `base` | 240 ms | Card lift, chip and status crossfade, segmented thumb, nav compaction |
| `morph` | 260 ms | Language switch |
| `enter` | 360 ms | Page enter, list rows, toasts, dialogs |
| `reveal` | 450 ms | Scroll reveal, hero entrance, success tick |
| `--mx-step` | 70 ms | Stagger step between siblings (`.mx-d1` to `.mx-d8`) |
| `--mx-rise` | 14px | Reveal and entrance travel (list rows use 8px) |

`duration-quick`, `duration-base`, `duration-morph`, `duration-enter` and `duration-reveal` are real Tailwind classes, because the theme defines `--transition-duration-*`. Before v3.1, `duration-quick` and `duration-base` silently fell back to Tailwind's default 150 ms.

### 5.3 Utilities and primitives

| What | How | Notes |
|---|---|---|
| Enter on mount | `.mx-enter` (fade + 14px rise), `.mx-enter-pop` (fade + scale 0.96), `.mx-enter-child` (the direct child enters), delays `.mx-d1` to `.mx-d8` | CSS only; plays on first paint. Hero lines, `Receipt`, `EmptyState`, the `/demo` header |
| Scroll reveal | `.mx-reveal`, or `<Reveal>` (`stagger`, `delay`) | `MotionRuntime` uses one IntersectionObserver. An element below the fold at load gets `data-reveal="wait"` (hidden) and fades up as it enters. Anything on screen or above stays as is, so nothing blinks. Elements entering together stagger 70 ms apart (capped at five steps) |
| List stagger | `.mx-stagger` on the list | Direct children rise 8px, 40 ms apart, on mount (the first ten, then together). Only where `:has()` works, so the urgent guard can always stop it. Use on lists with a stable order; a row React moves in the DOM replays its entrance |
| Page enter | Automatic on `main#main-content` | Fade + 8px rise over 360 ms. CSS on the first load; Web Animations on client navigations. Off on marketing pages (`data-page-motion="off"`), when the page holds urgent content, and when it holds a `.fixed` layer (the sign-in sheet) |
| Hover lift | `.mx-lift` (Card `interactive`, `BentoCard`, `PersonaCard`) | Rises 3px (`translate`). The lifted shadow fades in on `::before`. Pointer devices only. A utility transition list on the same element must include `translate` |
| Image zoom | `.mx-zoom` inside a lifted card | `scale` 1.035 over 450 ms; composes with `BentoMedia`'s crop zoom |
| Press | `.mx-press` (`buttonClasses`, `HeroAction`, segmented control, filter pill) | Dips to `scale(0.98)` while held. No dip and no hover lift under reduced motion |
| Focus ring | All interactive elements | The outline grows out from the edge (offset 0 to 2px, 140 ms). It never changes colour or width |
| Colour crossfade | `Badge`, `Pill`, `SegmentedControl` | 240 ms on background, text and border. A change into red is instant |
| Skeleton | `.mx-skeleton` | A light band sweeps across, moved by transform on `::after` (1.5 s loop). A plain muted block under reduced motion |
| Success tick | `<SuccessCheck>` (inside `Receipt`) | The disc pops in (360 ms), then the tick draws itself (450 ms, 120 ms delay) |
| Count up | `<CountUp value>`, `<CountUpText text>` | Section 6g |
| Toast | `<Toast>`, `.mx-toast` | Slides up 12px and fades in (360 ms). Calm news only ("Saved"); never red flags, alerts or errors |
| Dialog | `dialog.mx-dialog` | The panel pops in over a fading scrim (360 ms) |
| Language morph | `LangMorph`, `.mx-morph` | Fade + 2px settle over 260 ms (v3.1: the blur is gone) |

### 5.4 Marketing motion (`/` and `/demo`; never in the app)
- **Hero entrance:** the eyebrow, headline, subtitle, calls to action and trust chips rise in 70 ms apart. The headline's accent fades in a beat after its first line (opacity only, because it is inline). 3D Fin pops in; the patient-side cards arrive after Fin (300, 420 and 540 ms).
- **Fin:** a slow float with a slight tilt (12px, plus or minus 1.2 degrees, 4.2 s alternate). The floating cards bob on their own periods (6.4, 7.2 and 8 s), so they never move in step.
- **Pointer parallax** (`PointerParallax`, desktop mouse only, 1024px and up, only while on screen): the halo, Fin and cards drift on `translate` at different depths. Fin moves with the pointer; the cards move against it, up to 20px.
- **Sections:** headers, bento cards, step cards, persona cards, the stat strip and the video reveal on scroll.
- **Step cards:** a progress line along the top edge of each card draws left to right just after the card lands (`.mx-draw`), so a row reads 1, 2, 3.
- **Stat strip:** each written figure counts up once when it comes on screen ("49.1%", "13 to 59%").
- **Sticky nav:** once the page scrolls 12px, the pill shrinks to 98.5% and lifts 4px, and a denser, blurrier glass layer with the nav shadow fades in. The header keeps its height.
- **Anchor links** scroll smoothly (`html:has(.mx-marketing)`). `data-scroll-behavior="smooth"` on `<html>` lets Next.js turn this off during route changes.
- **Video frame:** a soft teal-to-ocean halo (`.mx-glow`, static).
- **Screenshot and video tools:** run with `reducedMotion: "reduce"`, Playwright's `animations: "disabled"`, or `?motion=off`, or scroll the page first. Otherwise sections below the fold are still waiting to reveal.

## 6. Signature interactions (implement exactly)

### 6a. Highlighter: summary value to the patient's sentence
Selecting a field row (click, or Enter/Space; arrows move between rows) works as follows:
1. Old marks fade out over `quick`.
2. The transcript scrolls the first quote to the vertical centre.
3. After `scroll` ms, each quote sweeps left to right in `highlighter` with a 2px ocean underline, over `sweep` ms using `marker`. Quotes are staggered by `sweepStagger` (140 ms).
4. The mark has 6px radius and stays until another field is selected or Escape is pressed.
5. Evidence used by other fields shows a dotted ocean underline.
6. Safety: a quote is marked only if `text.slice(start,end) === quote` (`segments()`).

Component: `EvidenceHighlight`, with an unchanged API.

### 6b. Safety states
Use `FieldValue` for every summary value; never style a status by hand. The table in section 1 is normative.
- `unsupported` values are excluded from "Approve supported fields" and from exports.
- `PencilField` is the unverified renderer (the name is kept from v1).

### 6c. Red-flag interrupt
**Clinician web (`RedFlagInterrupt`, API unchanged):**
1. A red gradient card (radius 22, signal shadow) at the top of its container. It pushes the summary down; it does not overlay it. **v3.1: it is there from the first frame.** It no longer grows in, fades or waits a frame (owner rule, wave 20: urgent content appears instantly and stays still, section 5.1). The `.mx-interrupt` grid wrapper and `data-open` stay, so existing selectors keep working; they no longer transition.
2. Content:
   - a white alert icon in a translucent circle;
   - a small "Red flag" label;
   - the `title` bold label;
   - the `lead` action;
   - the patient quote in a translucent pill;
   - the rule ID.
3. "Acknowledge" is a white outline pill. Afterwards the card collapses to a one-line red strip that stays for the session. The card cannot be dismissed.
4. Urgent (not emergency) uses the `signalTint` card with a red ring and red icon disc.

**Patient mobile:**
1. A full-screen red gradient view replaces the intake. v3.1: it appears instantly, with no slide-up (same owner rule). The patient mobile builder should drop any slide-up.
2. Top-aligned on the view:
   - a white alert icon disc;
   - `display` text from `patientMessage[lang]`;
   - the patient code in a white card (`code`, ink, so staff can read it at arm's length);
   - "Show this screen to the staff at the desk."
3. One quiet white text button for desk directions.
4. No way back into the intake. No timer. One haptic `notificationAsync(Error)`.

### 6d. Confidence
Four rising bars (3px wide, 6.5 to 14px tall, pill ends) after a `supported` value:
- filled bars are ocean;
- empty bars are `rule`;
- level 1 (low) fills one bar in amber and softens the value text to inkSoft.

Never a number or %. The accessible name is "Confidence: high". API is unchanged (`InkConfidence`, `inkLevel()`, alias `confidenceLevel()`).

### 6e. Language switch
The language control is a `SegmentedControl` pill: muted track, white raised thumb, labels in their own language (ไทย, Italiano/IT, English/EN).

On change, text morphs in place: opacity 0 and 2px down, settling over `morph` (v3.1: no blur, so only opacity and transform animate). The box never moves. It is static under reduced motion and inside urgent content.

`LangMorph` fix (wave 4): it animates only nodes born from a real text or language change. Parent re-renders and polling no longer replay it. The clinician `_morph.tsx` memo wrapper can be removed.

Patient quotes are never translated in place.

### 6f. Receipts (approval and sign-off)
Use `Receipt` when the status reaches `approved` (clinician) or after a pharmacy sign-off:
- **Header:** a teal check disc (`SuccessCheck`: the disc pops in, then the tick draws itself) and the title, e.g. "Intake approved". The card rises in on arrival (static under reduced motion).
- **Rows:** label/value pairs on a quiet inset, e.g. "Approved by: Nurse A. Rossi", "Time: 15:28", "Fields: 7, 4 from patient's words, 3 edited".
- **Footer:** the next action, e.g. a primary "Next case".

The receipt is a polite `role="status"` region and takes focus when it appears, so focus never drops to `<body>`.

### 6g. Counting numbers (ops)
Use `CountUp` for number tiles. It counts from 0 when it first mounts on the client and from the previous value on each change. It runs on the exact `glide` curve over about 900 ms. `startOnView` waits until the number is on screen (marketing pages).
- **The server HTML always shows the real number,** so no-JS and the first paint are true. A hydrated number that is already visible does not flash back to zero.
- **Instant under reduced motion and inside urgent content.** A red escalation count shows its real value from the first frame; the check runs before paint.
- Screen readers hear only the final value.
- The number is tabular and sits in a box as wide as the final number: 1ch per digit plus about 0.32em per separator. It follows the surrounding alignment, so nothing beside it moves.
- `CountUpText` does the same for a written figure such as "49.1%" or "13 to 59%". Every number in the string counts, and the words stay. Figure spaces keep the width constant. It is used by `StatStrip`.
- The ops dashboard has its own `CountUp` (`app/(ops)/components/CountUp.tsx`, owned by ops). Its urgent hero count should follow the same rule.

### 6h. Shell accessibility
- **`AppShell` language:** sets `document.documentElement.lang` and `lang` on the shell root to the UI language, so the `:lang(th)` rules (line height, tracking, no italics) and screen-reader voices follow the toggle.
- **`AppShell` chrome text:** role names, language and nav labels, the skip link and the disclaimer are localized from `shellLabels[lang]`. Pages can override any string with `labels`.
- **Skip link:** "Skip to content" jumps to `#main-content`.
- **`SegmentedControl`:** a real radiogroup with one tab stop. Arrow keys, Home and End move the selection.
- **Focus ring:** every focusable primitive shows a 2px ocean ring with a 2px offset, in every state.
- **`RedFlagInterrupt`:**
  - it is `role="alert"` until acknowledged, then a polite `role="status"` strip;
  - after Acknowledge, focus moves to the strip;
  - Italian button: "Visto, confermo" (not "Preso in carico", which is too close to "Prendi in carico", Take over);
  - Thai button: "รับทราบ"; the done state stays "รับทราบแล้ว".

## 7. Icons

Lucide geometry, 24 grid, 1.75 stroke, round caps, `currentColor`, 16 to 22px. Icons always come with a text label, except close/back, which get an aria-label.
- **Now:** `components/ui/Icon.tsx` ships the needed glyphs as inline SVG (paths from Lucide, ISC licence): check, circle-check, triangle-alert, quote, pencil, circle-minus, globe, clipboard-list, user, pill, activity, bell, inbox, chevron-right, clock, home, mic.
- **v3 additions (marketing):** arrow-right, arrow-up-right, chevron-down, play, circle-play, shield-check, languages, audio-lines, smartphone, monitor, file-text, file-check, list-checks, route, scroll-text, users, user-check, package-check, megaphone, gauge, thermometer, rotate-ccw, search, lock, cpu, qr-code, info, book-open, external-link, menu, x.
- **If `lucide-react` is approved:** swap `Icon` to it (same names).
- **Mobile:** `lucide-react-native` (needs `react-native-svg`), or the Material Symbols package already installed, at the same visual weight.

Banned: emoji, sparkles, robot or brain icons, stethoscope illustrations, icons inside gradient blobs.

## 8. Layouts

### 8.1 Patient mobile (Expo)

Home and welcome:
```
+--------------------------------------+
| [M] MedX              ( TH )  |  brand mark + language pill
|                                      |
| Good morning                         |  small inkSoft
| Welcome                              |  title 22, Bold
|                                      |
| +----------------------------------+ |  GRADIENT HERO (teal -> ocean), radius 28
| | Tell us what brings you in       | |  title, white
| | A nurse reads it before your     | |  body, white 90%
| | visit.                           | |
| | ( mic  Start )                   | |  white pill, ocean text
| +----------------------------------+ |
|                                      |
| +---------------+ +----------------+ |  two white cards
| | Your code     | | Wait           | |  small inkSoft
| | B-042         | | ~ 15 min       | |  stat 32, Bold (real data only)
| +---------------+ +----------------+ |
|                                      |
| This does not replace a doctor. In   |  small graphite
| an emergency go to the desk now.     |
|--------------------------------------|
|  Home     Visit    (+)    Help   Me  |  tab bar 72pt, white, sheetLifted,
|                    raised             |  centre 60pt gradient circle (Start/Answer)
+--------------------------------------+
```

Intake and follow-up (answer cards, not chat bubbles):
```
+--------------------------------------+
| <  Question 2 of up to 5     ( IT )  |  progress as words, thin ocean bar under
|                                      |
| Da quanto tempo ha questo dolore?    |  question 26, 700
|                                      |
| +----------------------------------+ |  white answer card, radius 22
| | [ text field, 3 lines           ]| |  input radius 14, ocean focus ring
| | ( mic )                          | |
| +----------------------------------+ |
| ( Da stamattina ) ( 1-2 giorni )     |  quick-answer pills (only if the question
| ( Non so )                           |  offers options)
|                                      |
| What you told us                     |  small inkSoft
| +----------------------------------+ |  one white card, rows (not bubbles):
| | Ho mal di petto da stamattina. > | |  the patient's own sentences, tap to edit
| +----------------------------------+ |
|                                      |
| [          Continue            ]     |  primary gradient pill, 48pt
+--------------------------------------+
```

Red flag (see 6c):
```
+======================================+  red gradient, full screen
| (!)                                  |  white icon disc
| Vada subito al banco                 |  display 34, Bold, white
| dell'accettazione.                   |
| Mostri questa schermata al personale.|  bodyPatient, white
| +----------------------------------+ |
| |  B-042                           | |  white card, code 52 ink
| +----------------------------------+ |
| Dove si trova il banco?              |  quiet white underlined text button
+======================================+
```

Status ("a nurse will review this"):
```
+--------------------------------------+
| +----------------------------------+ |  GRADIENT HERO
| | Your code                        | |
| | B-042                            | |  code 52, white
| | A nurse will read your answers   | |
| +----------------------------------+ |
| +----------------------------------+ |  white card, timeline rows:
| | (v) Sent              09:41      | |  teal check disc + time (tabular)
| | ( ) Being reviewed               | |  muted ring (pending)
| | ( ) Reviewed                     | |
| +----------------------------------+ |
| If you feel worse while you wait,    |
| go to the desk now.                  |
+--------------------------------------+
```

### 8.2 Web app shell (`AppShell`)
```
+------------------+-------------------------------------------------------------+
| [M] MedX  |  Good afternoon                    (TH|IT|EN)  (AR)         |
|                  |  Nurse A. Rossi                    language pill  avatar    |
| (Nurse|Doctor|   |                                                             |
|  Pharm|Ops)      |  +--------------------------------------------------------+ |
|                  |  | GRADIENT HERO: "3 intakes need you now"  (Open next)   | |
| (o) Queue     6  |  +--------------------------------------------------------+ |
|  o  Pharmacy     |  page content: white cards                                  |
|  o  Ops          |                                                             |
|                  |                                                             |
| Research         |                                                             |
| prototype ...    |                                                             |
+------------------+-------------------------------------------------------------+
```
- Sidebar: brand mark, a role `SegmentedControl` (Nurse/Doctor/Pharmacist/Ops), and pill nav items. The active item is `tealTint` with teal text. A red count appears only for urgent items.
- Top bar: greeting, bold name, language pill, avatar (initials on gradient).
- Below 1024px the sidebar stacks on top and the nav scrolls horizontally.

### 8.3 Clinician review
```
| Queue card              | Summary card                               | Patient's words card      |
| (All)(Urgent 2)(Review) | [RED FLAG CARD pushes down when present]  | 09:38 Patient  IT         |
| B-044 Emergency  4 min  | B-042  Italiano  ( Urgent )                | Ho [mal di petto] da ...  |
| B-042 Urgent     9 min  | Chief complaint  chest pain [From words] ll| translation, small        |
| B-041 Review    12 min  | Severity  [strong] (Needs check)           |                           |
|  rows 48px, selected =  | Duration  (- Not mentioned yet)            |                           |
|  paper + ocean ring     | ( Approve supported fields ) ( Take over ) |                           |
```
The queue hero is optional. On this screen the red-flag card is the bold element when present; otherwise there is no gradient hero (the primary button carries the brand).

### 8.4 Ops dashboard
```
| GRADIENT HERO: "6 escalations today, 2 not acknowledged"  (Open oldest)              |
| [StatTile Intakes 37] [StatTile Escalated 6 (red)] [Auto-captured ..] [Median review]|
| Escalations card: rows on white, red Emergency chip, "Open intake" ocean link         |
| Queue by urgency card | Model latency card (Gemma on AMD): per-call ticks, p50/p95    |
```
Escalation rows must be white rows with a red chip, not full red rows. Full red is reserved for the single interrupt.

All numbers in wireframes are layout samples; real values come from the API. A null shows as a placeholder pill, never 0.

## 9. Copy tone

Calm, plain, friendly, short. Say what happens next. Never diagnose, never reassure falsely. Greetings are time-of-day only ("Good morning"), never chatty. Clinician copy is verb-first ("Approve supported fields", "Assess now"). No exclamation marks, no emoji. **No em dashes (—) or en dashes (–) anywhere in UI copy**: use a comma, a full stop or a colon, and a plain hyphen for ranges ("1-2 days"). `components/ui/ui.test.ts` fails if a design-system component contains either character. Badges read "Mock, not AMD", never "MOCK — not AMD". Times use `Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false })`. Italian uses formal "Lei"; Thai uses neutral polite "กรุณา".
- **Patient keys:** "Tell us what brings you in" / "Raccontaci perché è qui oggi" / "บอกเราว่าวันนี้มาด้วยอาการอะไร". A native check is still pending.
- **Red-flag patient text:** comes from `redflags.json` (Doctor).

## 10. Builder checklist and v1 compatibility

v1 names now mean:
- `bg-desk`: app background.
- `bg-sheet`: white card.
- `bg-paper`: quiet surface.
- `text-ink`, `text-ink-soft`, `text-graphite`: text levels.
- `border-rule`: hairline.
- `bg-signal*`: urgency.
- `font-serif`: the display sans.
- `shadow-sheet`: a card, now with a 22 radius.
- `rounded-control`: 14.
- `.mx-*` classes: v2 looks.

New utilities: `bg-primary-gradient`, `bg-signal-gradient`, `rounded-card`, `rounded-hero`, `text-stat`, `bg-teal-tint`, `bg-ocean-tint`, `bg-warn-tint`, `text-teal`, `text-ocean`, `text-warn`, `bg-muted`, `shadow-hero`, and `.mx-skeleton`.

New primitives: `Card`, `CardHeader`, `GradientHero`, `HeroAction`, `StatTile`, `SegmentedControl`, `Pill`, `AppShell`, `Avatar`, `EmptyState`, `Icon`, `Receipt`, `CountUp`.

v3 additions. Every v2 API and class name still works, so every page re-skins without edits.
- **Utilities:** `bg-mist`, `bg-ink-gradient`, `bg-halo`, `glass`, `text-brand-gradient`, `text-brand-gradient-light`, `text-hero`, `text-h2`, `text-h3`, `text-lead-lg`, `text-eyebrow`, `rounded-bento`, `rounded-media`, `py-section`, `max-w-page`, `shadow-hairline`, `shadow-float`, `shadow-nav`, `shadow-ink`, `shadow-button`, `.mx-reveal`, `.mx-float`, `.mx-media`.
- **Existing primitives, new options:**
  - `Button` gains `size="sm"` and `variant="onDark"`; `ButtonLink` and `buttonClasses()` give links the same look.
  - `Card` gains `tone="glass" | "ink"` (marketing only).
  - `Mascot` switches to the 3D art at 96px (`variant` forces one or the other); `GradientHero` and `EmptyState` therefore show the 3D Fin.
  - `AppShell`'s sidebar is translucent (`glass`).
- **Brand art:** `FinArt` (section 11), `FinStage` and `FloatCard` (landing hero, section 12).
- **Marketing primitives (section 12):** `Section`, `SectionHeader`, `Eyebrow`, `Accent`, `Chip`, `BentoGrid`, `BentoCard`, `BentoMedia`, `StepList`, `StepCard`, `PersonaGrid`, `PersonaCard`, `VideoFrame`, `StatStrip`, `MarketingNav`, `Footer`.
- **Fonts:** `components/ui/fonts.ts`, imported by `layout.tsx` only (not from the barrel, because `next/font` runs only inside the Next compiler).

v3.1 additions (motion, section 5):
- **Primitives:** `Reveal`, `PointerParallax`, `SuccessCheck`, `Toast`, `CountUpText`. `MotionRuntime` is imported by `layout.tsx` only.
- **Helpers:** `motion.ts` with `URGENT_SELECTOR`, `motionOff()`, `cubicBezier()`, `easeGlide`, `countText()`.
- **Classes:** `.mx-enter`, `.mx-enter-pop`, `.mx-enter-child`, `.mx-d1` to `.mx-d8`, `.mx-reveal-stagger`, `.mx-stagger`, `.mx-lift` (`.mx-lift-ink`), `.mx-zoom`, `.mx-press`, `.mx-draw`, `.mx-depth`, `.mx-fin-float`, `.mx-nav-pill`, `.mx-glow`, `.mx-toast`, `.mx-dialog`, `.mx-marketing`, `data-page-motion="off"`, `data-urgent`.
- **Tailwind:** `ease-glide`, plus `duration-enter` and `duration-reveal`. `duration-quick` and `duration-base` now actually apply.
- **For builders:**
  - Add `mx-stagger` to queue lists.
  - Use `Card interactive` for clickable rows.
  - Mark any urgent element that does not use a signal class with `data-urgent`.
  - Never animate red.

Checklist:
- Use tokens and primitives only; no raw hex.
- Use one gradient hero per screen.
- Every state must be built: loading (skeleton), empty (`EmptyState`), error (says what failed and what to do), abstained.
- Keyboard: visible ocean focus ring; Escape clears the highlight.
- Test at 375px (390px for marketing) and 1440px, and with reduced motion.

## 11. Mascot: Fin

Owner decisions:
- 17 Oct 2026: the product has a mascot.
- Later the same day: the elephant (Mali) was replaced by a dolphin.

The mascot is called **Fin**: short, and easy to say in Thai (ฟิน, which also means "delighted" in Thai slang), Italian and English.

Why a dolphin:
- **Echolocation.** Dolphins hear what others miss, like our voice intake and the red flags caught inside ordinary sentences.
- **Helpers.** Dolphins are known for helping people, and Fin is a helper, never the decider.
- **Colour.** Teal-to-ocean is literally sea colour.
- **Home waters.** Dolphins live in both the Andaman Sea and the Mediterranean, which matches our Thai and Italian patients.

What Fin looks like:
- A chubby baby dolphin floating upright in a 3/4 view, snout to the left, dorsal fin and tail flukes to the right.
- Body in the teal-to-ocean gradient with a soft sheen, a minty white belly and snout underside.
- Big kind eyes, pink blush and a gentle smile along the snout.
- A small stethoscope around the neck, with the chest piece held by the front fin.
- No cross, no red cross, no cap, no emblem.

Fin is **a helper, not a clinician**. Fin never gives advice, never speaks clinical content, and is never a chat avatar.

**Source of truth.**
- Path data and colours: `packages/shared/src/mascot.ts`, exported from `@medx/shared` (`MASCOT_NAME`, `mascotPoses`, `mascotGradients`, `MASCOT_VIEWBOX`, `mascotSvg`). Plain SVG paths in a 200x200 viewBox, identical on web and React Native.
- Web component: `components/ui/Mascot.tsx`.
- Mobile component: `apps/mobile/src/components/mascot.tsx`.
- Static files: `docs/design/mascot/fin-<pose>.svg`, generated by `node docs/design/mascot/build.mjs`.
- Preview: `docs/design/mascot/preview.png`.

**3D art (v3, owner-approved, 17 Oct 2026 late evening).** Original character renders of Fin and the mark. Sources and a review copy: `docs/design/brand3d/` (`review-sheet.png` shows every file on desk, card, the primary gradient and ink). Served files: `apps/web/public/brand/` (webp with transparency, 18 files, 692 KB).

| Art (`FinArt art=`) | Files | Use |
|---|---|---|
| `wave`, `listening`, `thinking`, `happy`, `pointing` | `fin3d-<pose>-256.webp`, `-512.webp` | The same five poses as the vector set, at 96px and up: `GradientHero`, `EmptyState`, patient done and voice states |
| `hero-hello`, `hero-wave` | `fin-hello-*.webp`, `fin-wave-*.webp` (256, 512, 1024) | The large detailed Fin for the landing hero (`FinStage`) and covers, 240px and up |
| `mark` | `mark-3d-256.webp`, `-512.webp` | The 3D Echo X for large light or ink moments. Never on the primary gradient (it disappears there, see the review sheet) and never as the logo |
| App icon | `docs/design/brand3d/app-icon-3d-{180,192,512,1024}.png` | `apps/web/app/apple-icon.png` (180). Home-screen and store icons. Never as a favicon |

Rules:
- **Switch at 96px.** `Mascot` renders the 3D art from 96px (`MASCOT_3D_MIN`) and the vector drawing below. Favicons, the tab icon and anything under 96px stay vector (`icon.svg`, `favicon.ico`, `mark-small-color.svg`).
- **Component:** `FinArt` (next/image with a fixed size and a loader that picks the 256, 512 or 1024 file, so there is no optimizer round trip). Decorative by default (empty alt, `aria-hidden`); pass `label` only when the art carries meaning. `priority` only for the landing hero.
- **On the primary gradient** Fin always sits on the soft light disc (`GradientHero` does this) so the blue body separates from the blue gradient.
- **Never** on red, next to an alert, a red badge, a "Needs check" chip or an error, inside clinical content, or as a chat avatar. Everything under "Where Fin must never appear" applies to the 3D art too.
- **Do not edit the art** (no recolouring, cropping into the body, added props, speech bubbles or sparkles). New poses go through the owner.
- **Mobile:** the patient app may use the same `fin3d-*` files at 96pt and up (mobile builder, `apps/mobile/assets`), and keeps the vector `mascot.tsx` below that.

**Poses.** The API is unchanged.

| Pose | Looks like | Use |
|---|---|---|
| `wave` | Back fin raised, waving | Hello: landing hero, patient home hero, cover |
| `listening` | Echo arcs from the melon (forehead) | Voice input idle and listening states |
| `thinking` | Upward glance plus rising bubbles | Loading while the next question is prepared (non-urgent waits only) |
| `happy` | Closed happy eyes, open smile, a few bubbles (no sparkles) | Done states such as "Your answers were sent" or "All reviewed" |
| `pointing` | Back fin points to the side | Empty states and "ask the nurse at the desk" hints |

**Where Fin may appear.**
- On the marketing landing `/`: in the hero only (`FinStage`, section 12).
- Inside the primary `GradientHero` (`mascot="wave"`), on the bottom-right edge with a soft light disc behind it; one hero per screen.
- In `EmptyState` (`mascot="pointing"` or `"happy"`).
- On the patient app's home, voice and done screens.
- On the cover and in the deck.

**Where Fin must never appear.**
- On any red-flag or emergency screen.
- Next to an alert, red badge, interaction warning or "Needs check" chip.
- In error states, consent text or legal copy.
- Inside clinical content such as summaries, transcripts or orders.
- `GradientHero` refuses the mascot when `tone="signal"`.

**Size.** Vector 48 to 95px (48px minimum); 3D from 96px. Typical sizes are 112px in empty states, about 176px in heroes, 240px on the cover and 320 to 420px in the landing hero.

**Motion.** A subtle idle bob (3.2 s); the vector drawing also blinks every 4.8 s, waves in `wave` and pulses the echo arcs or bubbles. On the landing hero, Fin floats with a slight tilt and drifts with the pointer on desktop (`FinStage`, section 5.4). Everything is static under reduced motion.

**Accessibility.** Fin is decorative by default (`aria-hidden`). Pass `label` only when Fin carries meaning on its own.

**Builder guide.**
- Landing page `/`: `<FinStage art="hero-hello" cards={[...]} />` in the hero (section 12).
- App heroes: `<GradientHero mascot="wave" ... />`.
- Empty states: `<EmptyState mascot="pointing" | "happy" ... />`.
- React Native: render `mascotPoses[pose]` with `react-native-svg`, prefixing gradient ids per instance.

## 12. Marketing surfaces

Owner decision (17 Oct 2026, late evening): a marketing landing at `/` in the reference's structure, then the live demo through persona cards. This section covers `/` and any marketing page (for example `/demo` if it is built). App screens keep sections 1 to 11. Primitives: `components/ui` (section 10). Copy is MedX's own; never copy the reference's text.

### 12.1 Claim boundary on marketing pages
- Words: "supports clinicians", "suggests for review", "flags for clinician", "decision support". Never "diagnoses", "triages", "decides", "AI doctor", "replaces".
- Every page shows "Synthetic data only" above the fold (a trust chip) and the full disclaimer in the `Footer` (research prototype, supports clinicians, synthetic data only, not a medical device).
- Model and hardware claims come from `/api/health` at runtime: show the model label it returns. Never write "runs on AMD" unless health says the provider is AMD.
- The built-with strip says "Built with" (AMD Developer Hackathon ACT III, Gemma, Next.js, Expo) as text. Never "partners", never third-party logos.

### 12.2 Page order
Sticky nav, hero, built-with strip, "MedX in 60 seconds" video, How it works (+ "Try saying" phrases in English, Thai and Italian), features bento, Safety by design, Why (sourced numbers), Try a role (persona cards), phone and web one record (QR to `/patient`), under the hood, limitations, final call to action, footer.

### 12.3 Fin on `/`: hero only
- Fin appears **once** on `/`: the large 3D hero art in `FinStage` (`hero-hello` or `hero-wave`), on the halo disc with faint echo rings.
- Around Fin float up to three `FloatCard`s, and they are **patient-side real UI only**: the language choice, a non-urgent question ("How long have you had it?"), "Fin is listening", the patient code and "answers sent", a pickup counter. The third card hides below 640px.
- Never next to Fin: a red flag, an urgent symptom quote, an alert, a "Needs check" chip, a clinical summary, an order, a diagnosis-like label, or a chat bubble.
- No Fin in the bento, the video section, the safety band, the stats, the personas, the final call to action or the footer. The subtitle may name Fin as the helper who listens while people decide.

### 12.4 Surfaces
- Page background: `bg-mist`. Content: white cards (`Card`, `BentoCard`, `StepCard`, `PersonaCard`) with the sheet shadow and a hairline.
- **Dark surfaces are on the ink token only** (`bg-ink-gradient`, `tone="ink"`): exactly one bento card (the lead feature) and the Safety by design band. Nothing else is dark. Never red on ink, never ink in the app.
- **Primary gradient:** primary buttons and, optionally, the final call-to-action panel (white text, `variant="onDark"` button). One gradient panel per page. The 3D mark never sits on it.
- **Glass:** the sticky nav, floating cards, the video frame and chip variants only.

### 12.5 Bento grid
- `BentoGrid` (1, 2, 3 columns) with `BentoCard`s. Wide cards span 2 (`cols={2}`) and may put the media on the right.
- **Every card shows the real product:** a `BentoMedia` crop of a real screen from `/landing/*.webp` (`hero-consult`, `nurse-case`, `consult`, `orders`, `pharmacy-verify`, `pharmacy-dispense`, `patient-pickup`, `ops`, `trace`), or real UI rendered by the page. The icon is a small label next to the eyebrow, never the content.
- **No generic icon cards**, no stock photos, no illustrations, no Fin.
- Crops show one panel at a legible size: pick the region with `position` and enlarge with `zoom` (1 to 3); text in a crop should render at about 11px or more. `alt` says what the screen shows. `chrome` adds neutral grey window dots, never red, amber and green traffic lights.
- The lead `tone="ink"` card is the voice intake (patient side). It carries one ink-toned crop (`tone="ink"` on `BentoMedia`).

### 12.6 Red stays on the red-flag card
- Red (`signal`) appears on `/` **only** on the red-flag feature card: `accent="signal"` gives it a red icon disc and red eyebrow, and its crop may show the red-flag interrupt.
- Nowhere else: not in the nav, buttons, chips, stats, steps, personas, video frame, safety band, numbers or decoration. Crops for other cards are chosen (with `position`/`zoom`) so that no red UI shows, for example the ops card crops away the red escalation count.
- Amber stays "needs a human check" and teal stays "done by a person", as in the app.

### 12.7 Video frame
- **Primary video (v3.1, owner request):** the cinematic promo `/media/medx-promo.mp4` with `/media/medx-promo-poster.jpg`. A separate pipeline produces it.
  - If the promo is missing, the screen-recorded walkthrough `/media/medx-demo.mp4` (poster `/media/medx-demo-poster.jpg`) takes its place.
  - If neither exists, the section shows a poster-only state and never a broken player.
  - The landing is static, so a new file appears on the next build.
- **"Watch the full product walkthrough":** a secondary button under the promo. It opens the walkthrough in a native modal `<dialog>`:
  - focus moves to its close button and returns when it closes;
  - Escape, the close button or a click on the scrim close it;
  - the page behind is inert.

  The click that opens it starts that video, and closing it pauses it. The button is shown only when the promo exists (otherwise the walkthrough is already the primary).
- Both players: native controls, `preload="metadata"`, `playsInline`, **no autoplay attribute**, never sound without a click (the primary starts muted until "Play with sound"). `title` is the accessible name ("MedX in 60 seconds"). Captions go in `tracks` (WebVTT) when available (`medx-promo.en.vtt`, `medx-demo.en.vtt`).
- Glass frame, `rounded-bento`, a dark 16:9 stage, the float shadow. Max width 1040px. Nothing overlays the video (no Fin, no play badge that hides the controls).
- A soft teal-to-ocean halo sits behind the frame (`.mx-glow`): static, marketing only, and the one glow in the system.

### 12.8 How it works
- `StepList` of `StepCard`s with a big faint step number. **The last step is always the human** (`human`, `humanLabel` "A person decides"): teal ring, teal icon tile, teal chip. It is never the dark card and never red.
- "Try saying" phrases are `Chip`s with the quote icon and `lang` set (`en`, `th`, `it`), non-urgent examples only.

### 12.9 Persona card
- `PersonaGrid` of `PersonaCard`s, one per entry in `DEMO_PERSONAS` (six roles).
- The whole card is **one link** into the demo as that person; the patient persona uses `hardNav` to `/patient/`.
- Initials (or a role icon) on the brand gradient, a synthetic name, the role in teal, one line on what they do, a "Phone" or "Web" tag, an arrow in an ocean disc. `cta` gives screen readers "Open the demo as this person".
- No photos, no Fin, no red, no urgency.

### 12.10 Numbers, chips, nav, footer
- **Why:** `StatStrip` with published research numbers from the README only, each with its source (linked where possible). Never demo counts, never red.
- **Chips:** `Chip` for trust chips, "Try saying", built-with and under-the-hood lists. Statuses still use `Badge`; filters still use `Pill`.
- **Nav:** `MarketingNav`: vector logo, How it works, Features, Safety, Try a role, the EN/ไทย/IT toggle (EN first) and one primary call to action, "Try the demo". It includes the skip link to `#main-content`.
- **Footer:** `Footer` with the full disclaimer (required) and the hackathon note.

### 12.11 Type, copy and motion
- One `text-hero` H1 per page, two-tone with one `Accent` span. Section titles are `text-h2` with at most one `Accent` each. Sentence case, no em or en dashes, no exclamation marks, no emoji.
- Motion follows section 5.4: hero entrance, Fin float and parallax, card bob, scroll reveals, bento lift with screenshot zoom, step progress lines, stat count-up, persona lift, the compacting nav, smooth anchors and the video halo. Calm, never busy. All of it is off under reduced motion, and none of it touches the red-flag card.

### 12.12 Responsive and sign-off checklist (`/` and `/demo`, at 1440px and 390px)
1. No horizontal scroll at 390px; the nav fits (logo, call to action, menu).
2. Fin appears once, in the hero, with patient-side cards only (12.3).
3. Red appears only on the red-flag card (12.6).
4. Exactly one ink bento card plus the safety band; no other dark surface (12.4).
5. Every bento card shows real UI with alt text (12.5).
6. The video has controls, a poster and no autoplay (12.7).
7. The last step is the human, in teal (12.8).
8. Persona cards are single links with synthetic names (12.9).
9. "Synthetic data only" is above the fold and the footer disclaimer is present (12.1).
10. Thai toggle: Noto Sans Thai renders, Thai headings use the taller line height and no negative tracking.
11. Reduced motion: no reveal, no float, no parallax, no count-up; nothing is hidden.
12. Motion is calm: the hero settles in under a second, sections reveal once, the red-flag card never moves, and the video's walkthrough dialog opens and closes from the keyboard (12.7).

Screenshots of the review go to `docs/reports/screens/landing-*.png`.

## 13. Logo: MedX "Echo X"

(Section 12 in v2.)

**Concept.** A medical plus turned 45° into an X. Three arms are solid. The fourth (top right) becomes two sound/echo arcs radiating from the centre. The mark says medicine and listening at once, and the echo arcs nod to Fin's echolocation. I chose it over "Wave X" (a sine stroke, muddy at small sizes) and "Fluke X" (a curved X, too generic); see `docs/design/logo/concepts.png`. There is no red cross, no heart-pulse line and no stethoscope.

**Files.** All in `docs/design/logo/`; all vector, with no font dependency.
- **Generator:** `build.py` regenerates every SVG and `apps/web/components/ui/logoSvg.ts`. It converts the "Med" letters from SCBXBeta2 Bold to outlines with custom kerning; the X is the mark itself.
- **PNG exports:** `export.sh`.

| Asset | Files |
|---|---|
| Mark | `mark-color.svg` (teal-to-ocean), `mark-white.svg`, `mark-ink.svg`; `mark-small-color.svg` (small-size cut: heavier bars, one arc) |
| Wordmark | `wordmark-{color,white,ink}.svg` ("Med" in ink or white, X = mark) |
| Lockup | `lockup-{color,white,ink}.svg` (gradient tile + wordmark). On gradient or dark, use `white` (white tile, ocean mark) |
| App icon | `app-icon.svg`, `app-icon-1024.png` (full-bleed gradient square; iOS/Android apply the corner mask); `app-icon-rounded.svg` for slides |
| Favicon | `favicon.svg`, `favicon-16.png`, `favicon-32.png` (also wired to `apps/web/app/icon.svg` and `favicon.ico`; both stay vector in v3) |
| Apple touch icon | v3: `apps/web/app/apple-icon.png` is the 3D app icon (`docs/design/brand3d/app-icon-3d-180.png`). The vector `apple-touch-icon-180.png` stays as the flat alternative |
| Banner | `readme-banner.html`, `readme-banner.png` (1280x640) |
| Review sheets | `review-sheet.png` |

**Web.** `<Logo />` (lockup or mark, color or white) in `components/ui`. `AppShell` uses it in the sidebar.

**Clear space.** Keep at least the width of one bar of the X clear on every side. In practice:
- around the lockup: 25% of the tile height;
- around the mark: 15% of its size.

**Minimum size.**
- Lockup: 24px tall on screen (tile 24px).
- Mark: 16px, using the small cut (`favicon.svg` / `mark-small-color.svg`) at 24px and below.

**Colour.**
- Full colour on light surfaces (`desk`, `paper`, white).
- White on the teal-to-ocean gradient, on photos, or on ink.
- Ink mono for single-colour print.
- Never red. Never on the red-flag or signal gradient.

**Don'ts.**
- Don't rotate the mark back into a plus. Don't add a cross or a heart line.
- Don't recolour the arcs separately from the bars.
- Don't set "MedX" in a live font instead of the outlined wordmark.
- Don't stretch the logo, add effects or glows, or outline it.
- Don't put the full-colour logo on the gradient (use white).
- Don't place Fin overlapping the logo.
- Don't use the 3D mark (`FinArt art="mark"`) as the logo, in the nav, in the footer or below 96px; the logo is always the vector lockup or mark.
