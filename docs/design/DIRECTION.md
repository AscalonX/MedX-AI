# MedX Bridge design direction: "Clinical paper"

Owner: Design lead. Status: v1, binding for wave 2 builders.
Tokens: `packages/shared/src/tokens.ts`. Web mapping: `apps/web/app/globals.css`. Web primitives: `apps/web/components/ui/`.
If this file and a screen disagree, this file wins. If this file and `CLAUDE.md` safety invariants disagree, `CLAUDE.md` wins.

## 1. Concept

MedX Bridge is a well-kept clinical form, not a chatbot. Every surface behaves like paper in a clinic: the patient fills in a sheet, the nurse reads the same sheet with a highlighter in hand, and the ops board is the ward whiteboard. The model never appears as a character. There is no assistant avatar, no typing dots, no "AI" label as decoration. What the model produced is shown as marks on the form, and the marks tell you how far to trust them:

| Mark | Means | Where the metaphor comes from |
|---|---|---|
| Ink | Backed by the patient's own words | A fact written in the chart |
| Pencil (graphite, dashed underline) | Model suggestion with no verified quote | A provisional note you would rub out |
| Blank form line | Not said yet | An empty box on a form |
| Highlighter | The exact sentence this value came from | The reviewer's marker on the source |
| Single strike + new value + initials | Clinician correction | How a chart is corrected: never erased |
| Red | Urgency, and only urgency | Triage colour |

Mood in words: quiet, exact, unhurried, trustworthy, a little tactile. Dense but calm, like a good discharge form. Nothing glows, nothing floats, nothing celebrates.

Design read: Operate mode for clinician review and ops (scan, decide, act); a calm Read/Operate mode for the patient (one question at a time, large type). Light theme only, on purpose: the use scenes are lit waiting rooms and nurse stations, and the paper metaphor depends on it.

What we refuse (owner bans plus our own): purple/blue gradients, glass, card grids, sparkle icons, emoji, chat bubbles, centered hero with 3 cards, default shadcn look, eyebrow labels above headings, ALL CAPS labels, coloured status dots, % confidence badges, progress rings, em dashes in UI copy, a green "success" colour (approval is an ink stamp, not green).

## 2. Palette

Seven working colours. Red is the only accent. Highlighter and graphite are functional marks with a single meaning each.

| Token | Hex | Role | Text contrast (WCAG 2.x) |
|---|---|---|---|
| `desk` | `#E3E1D7` | App background behind sheets (clinician, ops) | ink 12.5, inkSoft 6.7, graphite 4.9, signal 5.3 |
| `paper` | `#EEEDE5` | Page background (patient app) | ink 13.9, inkSoft 7.5, graphite 5.5, signal 5.9 |
| `sheet` | `#F7F6F1` | The form sheet: summary, transcript, tables, inputs | ink 15.1, inkSoft 8.1, graphite 5.9, signal 6.4 |
| `ink` | `#1C2026` | Primary text, primary button fill, approved stamp | sheet on ink 15.1 |
| `inkSoft` | `#464B53` | Labels, secondary text | see above |
| `graphite` | `#5C5F65` | Pencil: unsupported values, hints, low confidence | AA on desk, paper, sheet, highlighter (4.7) |
| `rule` | `#C9C6BB` | Hairline rules and dividers. Decorative, never the only boundary of a control | n/a |
| `ruleStrong` | `#827F77` | Input and control borders | 3.7 on sheet, 3.05 on desk (non-text 3:1 met) |
| `highlighter` | `#F2DE4B` | Evidence sweep. Text on it stays ink | ink on highlighter 11.9 |
| `signal` | `#B3121B` | Red flags, escalations, emergency rows, destructive confirm | onSignal on signal 6.4 |
| `signalTint` | `#F4DCD7` | Urgent (non-emergency) row and band background | ink on it 12.5, signal on it 5.3 |
| `onSignal` | `#F7F6F1` | Text and outlines on a signal fill | 6.4 |

Rules:
- Red is never decoration, never a brand colour, never a hover state. If a screen is red, something is urgent.
- Emergency = solid `signal` fill with `onSignal` text. Urgent = `signalTint` fill, 2px `signal` rule, ink text. Routine = no colour.
- No grey text below `graphite`. No opacity on text to fake hierarchy (it breaks contrast); use `inkSoft` or `graphite`.
- Shadows: one, `shadow.sheet` (0 1 2, warm), on the active sheet only. `sheetLifted` only for the transcript drawer on narrow screens.

## 3. Type

| Role | Latin (it, en) | Thai | Where |
|---|---|---|---|
| Serif (voice) | Newsreader (variable, opsz) | Noto Serif Thai | Questions to the patient, sheet titles, red-flag headline, patient code |
| Sans (data) | IBM Plex Sans | IBM Plex Sans Thai (web, clinician) / IBM Plex Sans Thai Looped (mobile, patient) | Everything else: field values, labels, tables, buttons |

Why these: Newsreader is a text serif cut for screens with optical sizes, so the same family works at 13px and 64px and its italic carries patient quotes. Noto Serif Thai is the looped, traditional Thai serif that matches its contrast. Plex Sans and Plex Sans Thai were drawn as one system, so mixed Thai and Latin lines share x-height and weight; Plex has true tabular figures. Patients get the looped Thai (มีหัว) because it is easier for older readers; clinicians get loopless Plex Sans Thai for density. Italian needs only the `latin` subset (à è é ì ò ù).

Loading:
- Web: `next/font/google` in `apps/web/app/layout.tsx`. Latin faces first in the stack; Thai faces load only the `thai` subset, so the browser falls back per glyph. Stacks are `--font-serif` and `--font-sans`.
- Mobile: `@expo-google-fonts/newsreader`, `noto-serif-thai`, `ibm-plex-sans`, `ibm-plex-sans-thai-looped` via `npx expo install` and `useFonts`. React Native has no per-glyph fallback between custom fonts, so pick the family per language with `mobileFont(role, lang, weight)` from tokens. Verify export names after install (e.g. `Newsreader_500Medium`) and correct `tokens.fontFamily.mobile` if any differ.

Scale (px, major third from 15). Latin line height / Thai line height:

| Token | Size | LH Latin | LH Thai | Use |
|---|---|---|---|---|
| `micro` | 12 | 1.4 | 1.6 | Badges, margin notes, rule IDs |
| `small` | 13 | 1.45 | 1.65 | Labels, table meta |
| `body` | 15 | 1.5 | 1.7 | Clinician and ops body, field values |
| `bodyPatient` / `lead` | 19 | 1.5 / 1.4 | 1.7 / 1.6 | Patient body and answers; clinician red-flag action |
| `title` | 24 | 1.25 | 1.5 | Sheet titles |
| `question` | 30 | 1.2 | 1.45 | The one question on the patient screen |
| `display` | 38 | 1.1 | 1.4 | Red-flag headline |
| `code` | 64 | 1.0 | 1.0 | Patient code `B-042` |

Rules: all numbers tabular and lining (set globally). Sentence case everywhere; no ALL CAPS. Weights: 400 and 500 only, 600 for the patient code. Thai: letter-spacing 0, never negative; never `line-height` below the Thai column. Measure 65 to 75ch for prose. Emphasis is weight, never colour.

## 4. Space, grid, shape

Space: 4px base (`space` 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64). Tight inside a group, double between groups, more above a heading than below.

Grids:
- Clinician: three columns `288px | minmax(560px, 1fr) | 400px`, 24px gutters, on `desk`. Below 1280px the transcript becomes a right drawer (sheetLifted) opened by selecting a field. Below 960px the queue collapses to a top select.
- Ops: 12 columns, max 1440px, 24px gutters.
- Patient: single column, 24px side margins, max measure 34em, bottom-anchored primary action, 48px minimum touch target.

Shape: paper corners. Sheets, tables, bands: radius 0. Controls (buttons, inputs, badges): radius 3. No pills, no 12 to 16px rounded cards, ever. Sheets are separated by the desk colour and one hairline, not by cards.

Rows: 40px for queue and table rows. Field rows on the summary are a two-column form: label column 160px (`small`, inkSoft), value column fluid, 1px `rule` under each group (not each row).

## 5. Motion language

Motion only answers an action or announces urgency. Nothing loops, nothing enters on scroll, no page-load choreography.

| Token | ms | Easing | What moves | Why |
|---|---|---|---|---|
| `quick` | 120 | pen | Hover, press (`translateY(1px)`), highlight fade-out | Feedback |
| `base` | 220 | pen | Row selection, drawer, status changes | State change |
| `morph` | 260 | pen | Language switch | Same meaning, new words |
| `scroll` | 360 | browser smooth | Transcript scrolls to evidence | Orientation before the mark |
| `sweep` | 520 | marker | Highlighter across one quote | Links value to source |
| `sweepStagger` | 140 | | Gap between quotes of one field | Read in order |
| `interrupt` | 420 | interrupt | Red-flag band / screen | Urgency, decisive |

Easings (cubic-bezier): `pen` 0.2, 0.8, 0.2, 1 (ink settling, the default). `marker` 0.55, 0.05, 0.25, 1 (nib lands, sweeps, lifts). `interrupt` 0.7, 0, 0.2, 1 (no bounce, no overshoot). Never spring or bounce anywhere: this is a medical tool. React Native: `Easing.bezier(...tokens.easing.pen)` with Reanimated `withTiming`.

Reduced motion (`prefers-reduced-motion: reduce`, RN `useReducedMotion()`): every duration becomes instant. The end state is always the same: highlights still appear, the red band still pushes, text still changes. Only the travel is removed.

## 6. Signature interactions (implement exactly)

### 6a. Highlighter sweep: summary field to the patient's sentence

Trigger: click or Enter/Space on a summary field row (the row is a `button` with `aria-controls` pointing at the transcript). Arrow Up/Down moves between rows.
1. The selected row gets a `sheet` background change to `paper` and a 2px ink outline on focus only. No coloured left border.
2. All previously active marks fade out (`quick`, linear).
3. The transcript scrolls the first quote of this field to vertical center (`scrollIntoView({block: "center", behavior: "smooth"})`, `auto` under reduced motion).
4. After `scroll` ms, each quote of the field sweeps left to right: `background-size` 0% to 100% over `sweep` ms with `marker` easing, the n-th quote delayed by `n * sweepStagger`. Multi-line quotes sweep per line simultaneously (`box-decoration-break: clone`).
5. The mark has chisel-tip ends (angled gradient, see `.mx-mark`), sits at 58% vertical position, covers 82% of the line height, and is `highlighter` at full strength. Text on it stays ink.
6. The mark stays until another field is selected or Escape is pressed.
7. Every other evidence quote in the transcript (used by some other field) shows as a dotted `ruleStrong` underline, so the reviewer sees which sentences the summary relies on.
8. Safety: a quote is marked only if `text.slice(start, end) === quote`. Otherwise it is dropped and the field is treated as having no evidence. Implementation: `segments()` in `apps/web/components/ui/segments.ts`, component `EvidenceHighlight`.
9. Screen readers: the transcript text uses `<mark>`; announce "Evidence, turn 3" via a polite live region owned by the page.

Mobile has no highlighter view (patients do not review). If the patient later views "What you told us", their own sentences are plain text.

### 6b. Unsupported = pencil, not ink

`status: "unsupported"` values render in `graphite`, weight 400, with a 1px dashed graphite underline offset 4px, and a margin note below in serif italic `micro`: "Not found in the patient's words. Check before use." (th/it/en in `PencilField`). They never get the ink confidence mark, are never bold, never appear in the printable/exported summary as fact, and the Approve-all action skips them: each needs its own Confirm, Edit, or Strike. Missing fields render as an empty form line (`.mx-blank`, 1px `ruleStrong` bottom border, 8em) plus "Not mentioned yet". Component: `FieldValue` switches on `FieldStatus` so every surface is identical.

### 6c. Red flag = full-bleed interrupt that pushes the summary away

Clinician web (`RedFlagInterrupt`): the band is the first row of the summary sheet, full sheet width, edge to edge. It opens by animating `grid-template-rows: 0fr` to `1fr` over `interrupt` ms, so the summary below is physically pushed down rather than covered. Content: serif `display` label (`hit.label`), `lead` action (`hit.action`), the patient's quote in serif italic, rule ID in `micro`. Emergency = `signal` fill; urgent = `signalTint` with 2px signal rules. `role="alert"`. It cannot be closed. "Acknowledge" (writes an audit event, owned by the page) collapses it to a one-line strip that remains for the session. The queue row for that session moves to the top with a solid signal badge.

Patient mobile: the intake screen is replaced, not overlaid. A full-screen `signal` view slides up from the bottom edge over `interrupt` ms (`translateY(100%)` to 0), pushing the question sheet up and out of view. Content, top-aligned, `onSignal` on signal: serif `display` instruction from `hit.patientMessage[lang]`, the patient code at `code` size, one line "Show this screen to the staff at the desk." No buttons that resume the intake; one quiet text button "I need help finding the desk" which shows the desk location text. No auto-dismiss, no timer, no sound. `accessibilityRole="alert"` and `AccessibilityInfo.announceForAccessibility`. Haptic: one `notificationAsync(Error)` if `expo-haptics` is installed (not yet a dependency).

### 6d. Confidence as ink density

`confidence` (0..1) maps to four ink levels (`inkLevel()` in tokens): <0.5 low, 0.5 moderate, 0.75 high, 0.9 very high. Two signals change together:
- Value text colour: graphite, inkSoft, ink, ink.
- A 12px square mark after the value: two graphite hatch strokes; four inkSoft strokes; four ink strokes cross-hatched; solid ink.
No numbers and no % anywhere in the UI. Accessible name: "Confidence: high" (localized). Only `supported` fields get the mark. Component: `InkConfidence`.

### 6e. Language switch morphs text in place

The language control is a three-option segmented control (`ไทย`, `Italiano`, `English`), each option labelled in its own language, radius 3, selected = ink fill. On switch, every localized string re-renders in place: the box does not move, the new text fades in from `opacity 0, blur(3px), letter-spacing +0.02em` to rest over `morph` ms with `pen`. No slide, no flip, no stagger. The first render never animates. Each node sets `lang` so the right font and screen-reader voice are used. Patient quotes and evidence are never translated in place; they stay in the patient's language with the translation shown beneath in `small` inkSoft. Component: `LangMorph`. Mobile: Reanimated `FadeIn.duration(260).easing(Easing.bezier(...pen))` keyed on language.

### 6f. Corrections and approval (supporting detail)

Edited: old value struck through once (`.mx-struck`), new value in ink, "Edited by clinician, <reviewer>". Approved: value in ink with an outline badge "Approved, <reviewer>". Nothing is ever deleted from view; the audit trail is visible on the sheet.

## 7. Iconography

Words first. An icon appears only where the action is universal and space is tight (close, back, send, microphone, external link), and always with an accessible label. Web: `@phosphor-icons/react`, weight `light` at 20px and `regular` at 16px (not yet installed; request below). Mobile: `expo-symbols` (SF Symbols, weight regular) with a text fallback on Android. No emoji, no sparkles, no robot, no stethoscope or heart illustrations, no icon inside a coloured circle.

## 8. Surface layouts

### 8.1 Patient app (Expo)

Welcome / language pick. Left-aligned, no logo lockup, no illustration. The three language options are the hero.

```
+--------------------------------------+
|  MedX Bridge                         |  serif title 24, ink, on paper
|                                      |
|  Tell us why you came in today.      |  serif question 30
|  A nurse will read it before your    |  bodyPatient 19, inkSoft
|  visit.                              |
|                                      |
|  ------------------------------------|  rule
|  ไทย                               > |  48px rows, each in its own language
|  ------------------------------------|  and font
|  Italiano                          > |
|  ------------------------------------|
|  English                           > |
|  ------------------------------------|
|                                      |
|  This does not replace a doctor. In  |  small, graphite
|  an emergency, go to the desk now.   |
+--------------------------------------+
```

Intake (first answer). Not a chat. One sheet with ruled lines; the patient writes on it.

```
+--------------------------------------+
|  B-042                     Italiano  |  code small inkSoft | language control
|                                      |
|  Che cosa la porta qui oggi?         |  serif question 30
|                                      |
|  ____________________________________|  ruled writing lines (rule colour,
|  Ho mal di petto da stamattina_______|  32px pitch), text bodyPatient,
|  ____________________________________|  caret ink. Multiline TextInput.
|  ____________________________________|
|                                      |
|  Write in your own words. Short is   |  small graphite hint
|  fine.                               |
|                                      |
|  [            Continue             ] |  primary, ink fill, 48px, bottom
+--------------------------------------+
```

Follow-up question. The previous answers collapse into a ledger at the top (the patient's own sentences, plain text, small, ruled), the new question is large below it. No bubbles, no left/right alignment, no avatars, no typing dots. While the next question loads, the question line shows a graphite blank line, not a spinner.

```
+--------------------------------------+
|  B-042                     Italiano  |
|  What you told us                    |  small inkSoft
|  ------------------------------------|
|  Ho mal di petto da stamattina.      |  small ink, each answer one ruled row
|  ------------------------------------|
|                                      |
|  Da quanto tempo ha questo dolore?   |  serif question 30, the one question
|                                      |
|  ____________________________________|  ruled lines
|  ____________________________________|
|                                      |
|  [ I don't know ]   [   Continue   ] |  secondary | primary
|                                      |  step count only if real: "2 of up to 5"
+--------------------------------------+
```

Red flag (see 6c). Replaces the intake entirely.

```
+======================================+  full-bleed signal #B3121B
|                                      |
|  Vada subito al banco                |  serif display 38, onSignal
|  dell'accettazione.                  |
|                                      |
|  Mostri questa schermata al          |  bodyPatient 19
|  personale.                          |
|                                      |
|  B-042                               |  code 64, serif semibold
|                                      |
|                                      |
|  Non so dove si trova il banco       |  quiet text button, underlined
+======================================+
```

Submitted / "a nurse will review this".

```
+--------------------------------------+
|                                      |
|  Your code                           |  small inkSoft
|  B-042                               |  code 64, serif, ink
|                                      |
|  A nurse will read your answers      |  serif title 24
|  before you are called.              |
|  ------------------------------------|
|  Sent            09:41               |  body, tabular, ink. Real states only:
|  Being reviewed  .                   |  sent / being reviewed / reviewed.
|  Reviewed        .                   |  pending = blank form line, done = time
|  ------------------------------------|
|  If you feel worse while you wait,   |  body ink
|  go to the desk now.                 |
+--------------------------------------+
```

### 8.2 Clinician review (web)

```
desk #E3E1D7
+----------------+--------------------------------------------+-------------------------------+
| Queue          | B-042   Italiano   09:41        [It|Th|En]  | Patient's words               |
| 288px, sheet   | sheet, shadow.sheet                        | sheet, 400px, scrolls alone   |
|----------------|============================================|-------------------------------|
| B-044  Emerg.  | Red flag: chest pain with sweating         | 09:38  Patient                |
|   chest pain   | Assess now. Notify doctor on duty.         | Ho [mal di petto] da          |
|----------------| Patient said: "sudo freddo"   RF-CHEST-01  |  stamattina e sudo freddo.    |
| B-042  Urgent  | [Acknowledge]                              |  ~~~~~~~~ (dotted: used)      |
|----------------|============================================|  I have chest pain since this |
| B-041  Review  | Chief complaint   chest pain            [#]| morning and I'm sweating.     |
| B-039  Needs   | Onset             this morning         [/]|  (translation, small inkSoft) |
|   human        | Duration          ____ Not mentioned yet   |                               |
| B-037  Approved| Severity          strong (pencil, dashed)  | 09:39  Question               |
|                |   Not found in the patient's words.        | Da quanto tempo...            |
| sorted by      | ----------------------------------------   |                               |
| urgency, then  | Medications       aspirin                  |                               |
| wait time      | Allergies         ____ Not mentioned yet   |                               |
|                |--------------------------------------------|                               |
|                | [Approve supported fields] [Edit] [Take    |                               |
|                |  over]                     Audit trail  v  |                               |
+----------------+--------------------------------------------+-------------------------------+
```

- Queue rows: 40px, code (tabular, medium), one-line chief complaint, status badge. Emergency rows: solid signal badge "Emergency"; urgent: signalTint row; needs-human: pencil badge "Needs human review". Selected row: ink 2px outline inset.
- The Approve button names exactly what it does: "Approve supported fields". Pencil fields need individual action.
- Needs-human (abstained) state: the summary column shows one sentence in serif title, "This intake needs a person to review it.", the reason in plain words, the transcript, and "Take over". No partial summary.
- Audit trail: a disclosure at the sheet foot; rows are `time  actor  action`, tabular, small.
- Loading: the form skeleton is the real form with blank lines, no shimmer.

### 8.3 Ops dashboard (web)

Not a hero-metric page. One sheet like a ward board: escalations first, then the queue, then the system ledger.

```
desk
+------------------------------------------------------------------------------------------+
| Today, Sunday 18 Oct                                    [It|Th|En]   sheet title, serif|
|==========================================================================================|
| Escalations (2)                                                          signal band row |
| B-044  Chest pain with sweating   RF-CHEST-01   09:38   not acknowledged 4 min   [Open]  |
| B-031  Pregnancy bleeding         RF-OB-02      08:12   acknowledged by Nurse K          |
|------------------------------------------------------------------------------------------|
| Queue by urgency                                                                         |
| Emergency  B-044                                                                         |
| Urgent     B-042  B-040                                                                  |
| Routine    B-041  B-039  B-038  B-036 ...            codes as tabular ink tokens, 40px   |
| Needs human  B-035                                   pencil style                        |
|------------------------------------------------------------------------------------------|
| Intakes today  37     Escalated  2     Auto-captured  (value)     Abstained  (value)     |
| Median review  (value)                     one ledger row, numbers tabular body 15     |
|------------------------------------------------------------------------------------------|
| Model latency                       Gemma (model) on AMD (hardware) via (provider)       |
|  ||  | ||| |  |||  ||   |  | ||   one tick per call, height = latency, p50 and p95     |
|  p50 ---------------  p95 - - - -   as labelled horizontal rules; failed calls in signal |
+------------------------------------------------------------------------------------------+
```

All numbers in wireframes are layout samples; real values come from `OpsMetrics`. Show `null` as a blank form line, never 0.

## 9. Copy tone

Calm, plain, short. Say what happens next. Never diagnose, never reassure falsely, never blame.

| Do | Don't |
|---|---|
| "A nurse will read this before your visit." | "Our AI will analyze your symptoms!" |
| "Please go to the front desk now." | "You may be having a heart attack." |
| "Not found in the patient's words. Check before use." | "Low confidence (42%)" |
| "This intake needs a person to review it." | "Oops! Something went wrong." |
| "Red flag: chest pain with sweating" (clinician) | "Possible MI detected" |

Rules:
- Patient copy: second person, one idea per sentence, Grade 6 reading level. Italian uses formal "Lei". Thai uses polite particles (ค่ะ/ครับ avoided in system text; use neutral polite "กรุณา").
- Clinician copy: terse, verbs first ("Assess now", "Approve supported fields"). Use "suggests for review", "flags for clinician". Never "diagnosis".
- Buttons name the action; the result names the same action ("Approve" then "Approved").
- No exclamation marks, no emoji, no em dashes, no "AI" in patient-facing text beyond the required research-prototype notice.
- Key patient strings (to be confirmed by native speakers before the demo):
  - th: "กรุณาไปที่เคาน์เตอร์ประชาสัมพันธ์ทันที แสดงหน้าจอนี้ให้เจ้าหน้าที่ดู" / "พยาบาลจะอ่านคำตอบของคุณก่อนเรียกตรวจ"
  - it: "Vada subito al banco dell'accettazione. Mostri questa schermata al personale." / "Un infermiere leggerà le sue risposte prima della visita."
  - en: "Please go to the front desk now. Show this screen to the staff." / "A nurse will read your answers before you are called."
  - Red-flag patient text itself comes from `redflags.json` `patientMessage` (Doctor owns it).

## 10. Builder checklist

- Use tokens and the `components/ui` primitives; no raw hex, no new colours, no new radii.
- Every localized string goes through `LangMorph` (web) or the keyed fade (mobile) and sets `lang`.
- Every summary value goes through `FieldValue`. Every transcript turn through `EvidenceHighlight`.
- Every state: loading (blank form lines), empty ("No intakes yet. New ones appear here."), error (says what failed and what to do), abstained.
- Keyboard: queue and field rows are buttons; visible ink focus ring; Escape clears the highlight.
- Test at 375px and 1440px, and with reduced motion on.
