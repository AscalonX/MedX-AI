# W17 report: Design lead, MedX logo system

## STATUS
done. Nothing committed.

## SUMMARY
**Chosen concept: "Echo X".** A medical plus rotated 45° into an X. Three arms are solid. The fourth (top right) is two concentric sound/echo arcs radiating from the centre: medicine plus listening, and a nod to Fin's echolocation. There is no red cross, heart-pulse line or stethoscope. It reads in one colour (ink and white versions included).

**Concept round.** I sketched three marks and rendered each at 16, 32, 64 and 160px, on light and on the gradient (`docs/design/logo/concepts.png`):
- **Wave X** (one stroke is a sine wave): muddy at 16px.
- **Fluke X** (two crossing curves): generic.
- **Echo X**: the clearest idea, and it holds down to 32px. Chosen.

**Iterations.**
1. Made the echo arcs concentric with the X centre, so the sound radiates from the cross.
2. Fixed the wordmark X, which was clipped by the viewBox. It is now sized from its true bounding box and set 4% larger than the caps, an optical correction for the open arm. Centred the mark in its tiles by its visual bounding box.
3. Added a small-size cut (heavier bars, one arc) for 24px and below, because at 16px the two arcs filled in. The favicon is now legible at 16px.

**Wordmark.** "Med" is SCBXBeta2 Bold converted to vector outlines at build time, with tightened kerning; the X is the mark itself (teal-to-ocean in colour). The lockup is the gradient tile (white mark) plus the wordmark. On the gradient it becomes a white tile with an ocean mark and a white wordmark.

## FILES CHANGED
- `docs/design/logo/`:
  - Sources: `build.py` (generator), `export.sh` (PNG export via headless Chrome).
  - Mark: `mark-{color,white,ink}.svg`, `mark-small-color.svg`, `mark-color-{16,32,64,256}.png`, `mark-white-256.png`.
  - Wordmark and lockup: `wordmark-{color,white,ink}.svg`, `lockup-{color,white,ink}.svg`.
  - App icon: `app-icon.svg`, `app-icon-rounded.svg`, `app-icon-1024.png`.
  - Favicon: `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon-180.png`.
  - Banner: `readme-banner.html`, `readme-banner.png` (1280x640: white lockup, "Every word, understood.", small Fin on the right; gradient stage with sea curves and bubbles, no radial glow).
  - Review images: `concepts.png`, `review-sheet.png`.
- `apps/web/components/ui/Logo.tsx` (new), `logoSvg.ts` (generated), `index.ts` (exports `Logo`), `AppShell.tsx` (sidebar uses `<Logo height={34} />` instead of the "M" tile).
- `apps/web/app/icon.svg` (new), `apps/web/app/favicon.ico` (replaced, 16 and 32), `apps/web/app/apple-icon.png` (new). These are Next file conventions: Next emits the `<link rel="icon">` (ico + svg) and `apple-touch-icon` tags itself, so `layout.tsx` needed no change.
- `docs/design/DIRECTION.md`: new §12 Logo (concept, files, clear space, minimum size, colour, don'ts).

## TESTS RUN + RESULTS
| Check | Result |
|---|---|
| `cd apps/web && npx tsc --noEmit` | exit 0 |
| `npx vitest run components/ui` | 8/8 pass |
| `cd apps/mobile && npx tsc --noEmit` | exit 0 |
| `curl /review` | page includes the favicon.ico, icon.svg and apple-touch-icon links; `/icon.svg` returns 200 `image/svg+xml` |

## EVIDENCE
- `docs/design/logo/review-sheet.png`: mark at 16, 32, 64 and 256px; tile; wordmark; lockups on light, gradient and ink.
- `docs/design/logo/readme-banner.png`.
- `docs/reports/screens/w17-appshell-logo.png`: the clinician sidebar with the new lockup.

## NEXT ACTION
- Mobile builder: wire `docs/design/logo/app-icon-1024.png` into `app.json` (`icon`, adaptive icon foreground or background), and use `lockup-*` where the app shows the "M" tile.
- Pitch: README top banner `docs/design/logo/readme-banner.png`; deck title can use `lockup-white.svg`.
