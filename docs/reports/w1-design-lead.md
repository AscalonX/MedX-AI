# W1 report: Design lead (UI/UX)

## STATUS
done (all five deliverables). One blocking finding for whoever owns `apps/web/next.config.ts` (CR-D1 below).

## SUMMARY
I set the "Clinical paper" direction and turned it into tokens, CSS and working web primitives. The UI treats the model's output as marks on a clinical form: ink means the value is backed by a quote, pencil means it is unsupported, a blank line means it is missing, the highlighter links a value to its source sentence, a single strike marks a correction, and red is used only for urgency. There is no chat UI and no assistant persona.

- Palette: 7 working colours plus a highlighter. All text pairings pass WCAG AA.
- Type: Newsreader and Noto Serif Thai for the serif voice, IBM Plex Sans and Plex Sans Thai for data. Patients on mobile get Plex Sans Thai Looped.
- Motion: three easings and seven durations, no springs, and reduced motion is respected everywhere.
- All five signature interactions are specified step by step in DIRECTION.md section 6, and the web versions are built.

## FILES CHANGED
- `docs/design/DIRECTION.md` (new): concept, palette and contrast, type, grid, motion, the 6 signature interactions, iconography, ASCII wireframes (patient: welcome, intake, follow-up, red flag, status; clinician review; ops), copy tone, builder checklist.
- `packages/shared/src/tokens.ts` (new): `color`, `fontFamily` (web stacks plus mobile per-language family names), `mobileFont()`, `type` (with Thai line heights), `lineHeightPx()`, `space`, `layout`, `radius`, `shadow`, `duration`, `easing` (bezier tuples for CSS and Reanimated), `inkLevels`, `inkLevel()`.
- `apps/web/app/globals.css`: Tailwind v4 `@theme` mirroring the tokens, base layer (selection = highlighter, ink focus ring, caret, scrollbar, tabular numerals, Thai line height, no fake Thai italics), signature classes `.mx-mark`, `.mx-pencil`, `.mx-blank`, `.mx-morph`, `.mx-interrupt`, `.mx-struck`, and a reduced-motion override.
- `apps/web/app/layout.tsx`: fonts only (next/font/google: Newsreader, Noto Serif Thai, IBM Plex Sans, IBM Plex Sans Thai) and the title/description metadata.
- `apps/web/components/ui/` (new):
  - `Button` (primary / secondary / quiet / signal / onSignal; md / lg)
  - `Badge`
  - `Field` (label above, hint, error)
  - `EvidenceHighlight` plus `segments.ts`: the highlighter sweep, which drops any span whose offsets do not reproduce its quote
  - `InkConfidence`
  - `PencilField` plus `FieldValue`, which renders every `FieldStatus`
  - `RedFlagInterrupt`
  - `LangMorph`
  - `cx.ts`, `index.ts`, `ui.test.ts`

## TESTS RUN + RESULTS
- `cd apps/web && npx tsc --noEmit`: exit 0. I first deleted a stale `.next/types/validator.ts` that my temporary preview route had generated.
- `ui.test.ts` (vitest): 4/4 pass. The tests cover: segment merging and ordering, rejection of offsets that do not match the quote, `inkLevel` thresholds, and globals.css matching every colour token. Note that `npm test` does not pick this file up, because `apps/web/vitest.config.ts` only includes `lib/pipeline/__tests__` (see CR-D3). I ran it with a temporary include config, which I then removed.
- `impeccable detect --json` on `components/ui`, `globals.css` and `layout.tsx`: `[]` (no findings).
- Visual check: I added a temporary route `app/zz-design-preview`, ran `next dev --turbopack` and looked at 1440x900 in the browser pane. I then deleted the route.
  - The red-flag band pushes the summary down.
  - The highlighter moves from "mal di petto" to "stamattina" when Onset is selected.
  - The pencil, blank-line, ink-square and approved-badge states render correctly.
  - The Thai switch re-renders labels, band text and values, and the Thai serif and sans glyphs load.
  - No screenshot files were saved.

## EVIDENCE
- Contrast (computed, WCAG 2.x), all AA or better:
  - On sheet `#F7F6F1`: ink 15.1, inkSoft 8.1, graphite 5.9, signal 6.4.
  - On desk `#E3E1D7`: graphite 4.9.
  - Ink on highlighter 11.9. onSignal on signal 6.4.
  - Control border `ruleStrong` 3.7 on sheet (non-text, needs 3:1).
- next/font availability checked in the installed `font-data.json`: Newsreader (opsz and wght axes), Noto Serif Thai, IBM Plex Sans, IBM Plex Sans Thai and IBM Plex Sans Thai Looped all exist with a `thai` or `latin` subset as needed.

## ASSUMPTIONS
- **No interview possible.** I am a subagent and there was no way to ask questions, so the direction comes from the brief and PLAN.md only. Impeccable wants a `PRODUCT.md`, which I did not write because it is outside my folders.
- **Light theme only, on purpose.** The paper metaphor and the use scenes (lit waiting room, nurse station) support it, so there are no dark-mode tokens.
- **Paper colour.** The "warm off-white" is a greyer chart-paper tone (`#EEEDE5` and `#F7F6F1`) rather than the overused cream `#F4F1EA`. Red is a carmine `#B3121B`, not terracotta.
- **Translations need checking.** The patient strings in th and it in DIRECTION.md section 9 and in the component copy are drafts and need a native-speaker check. The patient red-flag text itself comes from `redflags.json`, which the Doctor owns.
- **Mobile font names are unverified.** The names in `tokens.fontFamily.mobile` (e.g. `Newsreader_500Medium`, `IBMPlexSansThaiLooped_400Regular`) follow expo-google-fonts naming but are not installed yet. The mobile builder should check them after `npx expo install`.

## RISKS
- **The web app breaks on its first runtime import of `@medx/shared`.** Under `next dev --turbopack`, any non-type import fails with `Module not found: Can't resolve '@medx/shared'`, because the package is symlinked from outside the Turbopack root. This hits any value import, including `redflags.json` and tokens. Type-only imports hide the problem until then. The fix is CR-D1. I confirmed it works with a temporary edit, then reverted it, and `git status` shows `next.config.ts` unchanged.
- **The `segments()` safety check only works if offsets are right.** It drops evidence whose offsets do not match the quote, so the pipeline must emit offsets into the redacted `Turn.text`. If it does not, no highlight shows at all, which fails safe.
- **The clinician grid is designed for 1280px and up.** I specified the drawer behaviour below that but have not built or tested it.

## OPEN QUESTIONS / CONTRACT CHANGE REQUESTS
- **CR-D1 (blocking, owner of `apps/web/next.config.ts`).** Add these lines; tested working:
  ```ts
  import path from "node:path";
  // inside nextConfig:
  turbopack: { root: path.join(__dirname, "../..") },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  ```
- **CR-D2 (orchestrator, `packages/shared/src/index.ts`).** Add `export * from "./tokens";`. Until then the components import `@medx/shared/src/tokens` directly.
- **CR-D3 (owner of `apps/web/vitest.config.ts`).** Add `"components/**/*.test.ts"` to `include` so `ui.test.ts` runs in `npm test`.
- **CR-D4 (mobile builder).** Run `npx expo install @expo-google-fonts/newsreader @expo-google-fonts/noto-serif-thai @expo-google-fonts/ibm-plex-sans @expo-google-fonts/ibm-plex-sans-thai-looped expo-haptics`.
- **CR-D5 (web, optional).** Install `@phosphor-icons/react`; DIRECTION.md section 7 has the icon rules. The primitives currently use no icons.
- **CR-D6 (owner of `apps/web/app/page.tsx`).** It is still the create-next-app template, using `font-mono`, `dark:` classes and the Next logo. Replace it with a landing route or a redirect.
- **Question for the Doctor.** Should "urgent" red flags interrupt the patient's screen too, or only "emergency" ones? The current spec interrupts the patient for any red-flag hit and shows the clinician the solid band for emergency and the tinted band for urgent.

## NEXT ACTION
- Wave 2 builders use `components/ui` and follow DIRECTION.md section 10.
- Clinician builder: the 3-column review screen, using `FieldValue`, `EvidenceHighlight`, `RedFlagInterrupt` and `LangMorph`.
- Mobile builder: the RN equivalents of 6c and 6e, using `mobileFont()` and `easing`.
- Before submit: run `impeccable-finish-reviewer` on the built screens, plus a check at 375px with reduced motion on.
- Also noted: a newer Impeccable skill (v4.6.0) is available. Updating means running `npx impeccable update` in a later session.
