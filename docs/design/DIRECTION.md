# MedX Bridge design direction v2: "Calm clinical banking"

Owner: Design lead. Status: v2, binding from wave 4.
Tokens: `packages/shared/src/tokens.ts`. Web mapping: `apps/web/app/globals.css`. Web primitives: `apps/web/components/ui/`.
If this file and a screen disagree, this file wins. If this file and `CLAUDE.md` safety invariants disagree, `CLAUDE.md` wins.

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
| `ink` | `#0F1E2E` | Primary text, big numbers | |
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

Gradients (`tokens.gradient`): `primary` 135deg `#0A8077` to `#1A5FC4`, with one soft white radial at the bottom-right corner (decoration only, never under body text). `signal` 135deg `#C81E2C` to `#9E1024`, for red flags only.

Rules:
- **One gradient hero per screen.** Everything else is a white card. The primary button is the only other gradient.
- **Red is urgency only.** Emergency is the red gradient with white text. Urgent is `signalTint` with a red ring and red icon. Never red for errors in forms (use `signal` text only for a field error message, which is a "stop" signal), never for hover, never for decoration.
- **Amber means "needs a human check".** Use it only for unverified values and blocked actions.
- **Teal means "done by a clinician"** (approved, edited, signed off). Ocean means "comes from the patient's words".

## 3. Type

| Role | Latin (it, en) | Thai (web) | Thai (mobile, patient) |
|---|---|---|---|
| Display and UI | Plus Jakarta Sans 400 to 800 | Anuphan | IBM Plex Sans Thai Looped |

Why these:
- **Plus Jakarta Sans** is a modern geometric grotesk with open counters and friendly round forms, and it is the reference app's face. It has true tabular figures (`tnum`), and `latin` covers Italian accents (à è é ì ò ù).
- **Anuphan** (Cadson Demak) is a loopless modern Thai with the same geometric construction and x-height feel as Jakarta, so mixed Thai/Latin lines sit level. Web Thai clinicians read it fast.
- **On mobile, patients get looped Thai (มีหัว), IBM Plex Sans Thai Looped**, because looped forms are easier for older and less-practised readers. It is already installed.
- Tabular, lining numerals are set globally. Big numbers use `stat` (32px, weight 800).

Loading:
- **Web:** `next/font/google` in `layout.tsx` (`--font-jakarta`, `--font-anuphan`, thai subset only).
- **Mobile:** per language via `mobileFont(role, lang, weight)`. React Native cannot fall back per glyph.
  - Needs `npx expo install @expo-google-fonts/plus-jakarta-sans`.
  - Load `PlusJakartaSans_400Regular` through `800ExtraBold` plus `IBMPlexSansThaiLooped_700Bold`.
  - Until then Latin text falls back to the system font.
- **Roles:** `display` is new; `serif` is kept as an alias of `display` so v1 calls compile.

Scale (px; line height Latin / Thai):

| Token | Size | LH | Weight | Use |
|---|---|---|---|---|
| `micro` | 12 | 1.4 / 1.6 | 600 in chips | Chips, meta |
| `small` | 13 | 1.45 / 1.65 | 400 to 600 | Labels, table meta |
| `body` | 15 | 1.5 / 1.7 | 400; values 600 | Clinician body |
| `lead` | 17 | 1.45 / 1.6 | 500 to 700 | Card titles, red-flag action |
| `bodyPatient` | 18 | 1.5 / 1.7 | 400 | Patient body |
| `title` | 22 | 1.25 / 1.5 | 700 to 800 | Screen titles, hero title, greeting name |
| `question` | 26 | 1.2 / 1.45 | 700 | The one patient question |
| `stat` | 32 | 1.1 / 1.3 | 800 | Big numbers |
| `display` | 34 | 1.1 / 1.4 | 800 | Red-flag screen (mobile) |
| `code` | 52 | 1.0 | 800 | Patient code B-042 |

Rules: sentence case; no ALL CAPS. Negative tracking on Latin headings only; Thai tracking is always 0. Thai never gets italics (the CSS forces normal).

## 4. Shape, elevation, spacing, grid

Radii: `control` 14 (inputs), `card` 22, `hero` 28, `pill` 999 (buttons, chips, segmented controls, nav items, avatars). Squares are only for icons in a rounded square (brand mark, 12px).

Elevation (diffuse, navy-tinted, offset down, never black, never a glow):

| Token | Value | Use |
|---|---|---|
| `hairline` | 0 1 2 rgba(15,45,80,.06) | Under borders |
| `sheet` (card) | 0 1 2 .06 + 0 8 24 -12 rgba(15,45,80,.16) | Every card |
| `sheetLifted` | 0 18 40 -16 rgba(15,45,80,.24) | Hover lift, drawer, mobile tab bar |
| `hero` | 0 22 40 -20 rgba(26,95,196,.55) | Gradient hero, primary button (smaller) |
| `signal` | 0 22 40 -20 rgba(158,16,36,.55) | Red-flag card |

Cards have a 1px `rule` border at 70% plus the `sheet` shadow. Any element that already uses the `shadow-sheet` class becomes a 22px-radius card automatically.

Space: 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Card padding is 20. The gap between cards is 16 on mobile and 24 on web.

Grid:
- **Web shell:** sidebar 248 | content (max 1440).
- **Clinician content:** queue 300 | summary min 560 | transcript 400, gutter 24.
- **Ops:** 12 columns.
- **Mobile:** single column, 20pt side margin, a 72pt bottom tab bar with a 60pt raised centre action.

## 5. Motion

Smooth micro-motion that answers the user. Nothing loops except the loading skeleton shimmer (static under reduced motion).

| Token | ms | Easing | What |
|---|---|---|---|
| `quick` | 140 | pen | Press (`scale .97`), hover colour, chip change |
| `base` | 240 | pen | Segmented thumb, nav active, card hover lift (`translateY(-2px)` + `sheetLifted`) |
| `morph` | 260 | pen | Language switch: fade + 3px blur + 2px rise |
| `scroll` | 360 | browser | Transcript scrolls to the evidence |
| `sweep` | 520 | marker | Highlighter sweep |
| `interrupt` | 420 | interrupt | Red-flag card grows in and pushes content |

Easings: `pen` (0.22, 1, 0.36, 1), an out-quint and the default. `marker` (0.55, 0.05, 0.25, 1). `interrupt` (0.7, 0, 0.2, 1). No springs or bounces on clinical content.

Reduced motion: every duration becomes instant; end states are identical.

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
1. A red gradient card (radius 22, signal shadow) grows at the top of its container by animating `grid-template-rows: 0fr` to `1fr` over `interrupt`. It pushes the summary down; it does not overlay it.
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
1. A full-screen red gradient view slides up over `interrupt` and pushes the intake away.
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

On change, text morphs in place: opacity 0, blur 3px, 2px down, settling over `morph`. The box never moves.

`LangMorph` fix (wave 4): it animates only nodes born from a real text or language change. Parent re-renders and polling no longer replay it. The clinician `_morph.tsx` memo wrapper can be removed.

Patient quotes are never translated in place.

## 7. Icons

Lucide geometry, 24 grid, 1.75 stroke, round caps, `currentColor`, 16 to 22px. Icons always come with a text label, except close/back, which get an aria-label.
- **Now:** `components/ui/Icon.tsx` ships the needed glyphs as inline SVG (paths from Lucide, ISC licence): check, circle-check, triangle-alert, quote, pencil, circle-minus, globe, clipboard-list, user, pill, activity, bell, inbox, chevron-right, clock, home, mic.
- **If `lucide-react` is approved:** swap `Icon` to it (same names).
- **Mobile:** `lucide-react-native` (needs `react-native-svg`), or the Material Symbols package already installed, at the same visual weight.

Banned: emoji, sparkles, robot or brain icons, stethoscope illustrations, icons inside gradient blobs.

## 8. Layouts

### 8.1 Patient mobile (Expo)

Home and welcome:
```
+--------------------------------------+
| [M] MedX Bridge              ( TH )  |  brand mark + language pill
|                                      |
| Good morning                         |  small inkSoft
| Welcome                              |  title 22, 800
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
| | B-042         | | ~ 15 min       | |  stat 32, 800, tabular (real data only)
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
| Vada subito al banco                 |  display 34, 800, white
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
| [M] MedX Bridge  |  Good afternoon                    (TH|IT|EN)  (AR)         |
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

Calm, plain, friendly, short. Say what happens next. Never diagnose, never reassure falsely. Greetings are time-of-day only ("Good morning"), never chatty. Clinician copy is verb-first ("Approve supported fields", "Assess now"). No exclamation marks, no emoji, no em dashes. Italian uses formal "Lei"; Thai uses neutral polite "กรุณา".
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

New primitives: `Card`, `CardHeader`, `GradientHero`, `HeroAction`, `StatTile`, `SegmentedControl`, `Pill`, `AppShell`, `Avatar`, `EmptyState`, `Icon`.

Checklist:
- Use tokens and primitives only; no raw hex.
- Use one gradient hero per screen.
- Every state must be built: loading (skeleton), empty (`EmptyState`), error (says what failed and what to do), abstained.
- Keyboard: visible ocean focus ring; Escape clears the highlight.
- Test at 375px and 1440px, and with reduced motion.
