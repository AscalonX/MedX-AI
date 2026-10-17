# W13 report: Design lead, mascot changed from elephant (Mali) to dolphin (Fin)

## STATUS
done. Nothing committed.

## SUMMARY
- **Name: Fin.** It is short and easy to say in Thai, Italian and English. In Thai, "ฟิน" is also everyday slang for "delighted", which suits a friendly helper. I found no clearly better name.
- **Design.** Fin is a chubby baby dolphin floating upright in a 3/4 view: snout left, dorsal fin and tail flukes right.
  - Body in the teal-to-ocean gradient with a soft radial sheen, plus a minty belly and snout underside.
  - Big kind eyes, pink blush, a gentle smile along the snout, and a blowhole detail.
  - A stethoscope around the neck, with the chest piece held by the front fin. No cross or emblem.
- **Same 5 poses, same API.**
  - `wave`: back fin raised.
  - `listening`: three echo arcs from the melon (forehead).
  - `thinking`: upward glance plus rising bubbles.
  - `happy`: closed eyes, open smile, small bubbles, no sparkles.
  - `pointing`: back fin extended.
- **Iterations.** I reviewed renders at 240, 120 and 48px and changed it three times:
  - rounder fins instead of wedges, so the wave fin no longer reads as a second dorsal fin;
  - a shorter snout with a pale underside;
  - the stethoscope moved down so it does not read as a mouth;
  - the chest piece drawn above the fin;
  - warmer cheeks.
- **On teal gradients** (hero cards, cover), Fin gets a white sticker outline plus a soft light disc. Without it the teal dolphin disappeared into the teal background.
- **Exports unchanged.** `mascot.ts` keeps every export name and shape, and adds `MASCOT_NAME = "Fin"`. The web `Mascot`, `GradientHero`, `EmptyState` and the mobile mascot component compile and render with no API changes.

## FILES CHANGED
- `packages/shared/src/mascot.ts`: dolphin data (layers, gradients `fin-*`, colours), `MASCOT_NAME`, aria label "Fin, the MedX dolphin".
- `docs/design/mascot/`:
  - `fin-{wave,listening,thinking,happy,pointing}.svg` (new); `mali-*.svg` removed.
  - `build.mjs` (writes `fin-*`), `preview.html`, `preview.png`, `preview-web.png`.
- `apps/web/components/ui/Mascot.tsx`: doc comment; CSS hooks renamed `mali-*` to `mascot-*`.
- `apps/web/components/ui/GradientHero.tsx`: white sticker outline and the mascot moved slightly down. `EmptyState.tsx`: comment only.
- `apps/web/app/globals.css`: keyframes and classes renamed `mascot-*`; blink and wave origins retuned for the dolphin.
- `apps/mobile/src/components/mascot.tsx`: doc comment only (Mali changed to Fin).
- `pitch/cover/cover-v3.html`, `cover-v3.png`, `cover-v3-square.png`: "Hi, I'm Fin.", `fin-wave.svg`, sticker outline, glow.
- `docs/design/DIRECTION.md` §11: rewritten for Fin (name, story, look, poses table). The rules are unchanged: never on red-flag, alert, error or clinical-content screens, and never as a chat avatar.

## TESTS RUN + RESULTS
| Check | Result |
|---|---|
| `cd apps/web && npx vitest run components/ui` | 8/8 pass (the mascot test covers all 5 poses: gradient references resolve, no NaN in paths) |
| `cd apps/web && npx tsc --noEmit` | exit 0 |
| `cd apps/mobile && npx tsc --noEmit` | exit 0 |
| `grep -rIl Mali apps pitch README.md docs/design` | only the history line in DIRECTION.md and the built Expo web bundle `apps/web/public/patient/_expo/.../__common-*.js` (a stale build) |

## EVIDENCE
- `docs/design/mascot/preview.png`: 5 poses at 240, 120 (on gradient) and 48px.
- `docs/design/mascot/preview-web.png`: web hero with `wave`, empty states with `pointing` and `happy`. Rendered through a temporary route that I then deleted.
- `pitch/cover/cover-v3.png` (1600x900) and `pitch/cover/cover-v3-square.png` (1080x1080).

## RISKS
- The prebuilt patient web bundle in `apps/web/public/patient/` still contains the elephant until the mobile builder re-exports it (`expo export -p web`).
- I checked the mobile component: it uses only a whole-body bob and sway, so it needs no retuning. I updated one comment there (ears to echo arcs).

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
None. The exported API is unchanged.

## NEXT ACTION
- Mobile builder: rebuild the patient web export, and check Fin on the home, voice and done screens. Never on the red-flag screen.
- Pitch lead: swap the cover and the deck mascot to Fin.

---

## Addendum: billboard cover v4

**Chosen headline:** "MedX" with "Every word, understood." I picked it over "Speak your language. Be understood." because it is shorter (3 words against 5), still reads at thumbnail size, and covers both the voice feature and the "every field points back to the patient's words" promise.

**Every word on the image (12):**
- "MedX"
- "Every word, understood."
- "Thai · Italiano · English"
- "Gemma on AMD"
- "“chest pain”"

**Layout.**
- **Background:** a rich teal-to-ocean gradient stage. Depth comes from two large soft translucent circles, three layered sea-wave curves at the bottom and a few bubbles. No spotlight glow, no sparkles.
- **Focal group (right):**
  - Fin, waving, about 48% of the height, with a white sticker outline and no ground shadow. It is generated by `pitch/cover/img/build-fin.mjs` from the shared mascot data.
  - One phone, tilted 7°, showing the real patient app home. That screenshot is a fresh render of `/patient/` at 375x812 @3x, already showing Fin: `pitch/cover/img/patient-home-fin.png`.
  - One floating card: the highlighted quote “chest pain”, the ocean quote icon and the teal check, to hint at the evidence link.
- **Left:** the huge white wordmark and headline over generous negative space.
- **Bottom left:** the two chips.

**Files.**
- `pitch/cover/cover-v4.html` is the single source; append `#square` to the URL for the square layout.
- Renders: `pitch/cover/cover-v4.png` (1600x900) and `pitch/cover/cover-v4-square.png` (1080x1080).
- 400px thumbnail check: `docs/reports/screens/cover-v4-thumbs-400.png`. The wordmark, headline and Fin all still read.
- v3 is kept unchanged.

**Iterations (all at full size and at 400px).**
1. First layout.
2. Fixed the quote card wrapping onto two lines and running off the right edge, and the square layout's phone overlapping the "Gemma on AMD" chip. Moved Fin and the card.
3. Switched all shadows to neutral black, because the design detector flagged the navy-tinted shadows as a glow.

**Detector.** One remaining finding is suppressed, scoped to this file: `side-tab` on the quote's bottom underline. That underline is the evidence-highlighter signature from DIRECTION.md 6a, not a card side accent.

**Claims.** Nothing beyond the claim boundary: no diagnosis wording, no numbers.
