// MedX Bridge design tokens. "Clinical paper" direction: docs/design/DIRECTION.md.
// Owner: Design lead. Plain numbers and strings only, so web (CSS vars in
// apps/web/app/globals.css) and React Native (StyleSheet) read the same values.
// apps/web/components/ui/tokens-sync.test.ts fails if globals.css drifts from `color`.

import type { Lang } from "./types";

// ---------- Colour ----------
// One signal colour (urgency). Highlighter and graphite are functional marks, not accents.
// Contrast ratios (WCAG 2.x) are listed in DIRECTION.md; every text pairing below passes AA.
export const color = {
  desk: "#E3E1D7", // app background behind sheets (clinician, ops)
  paper: "#EEEDE5", // page background (patient app, plain pages)
  sheet: "#F7F6F1", // the form sheet: summary, transcript, tables
  ink: "#1C2026", // primary text, primary button fill, approved stamp (15.1:1 on sheet)
  inkSoft: "#464B53", // secondary text, labels (8.1:1 on sheet)
  graphite: "#5C5F65", // pencil: unsupported values, hints, low-confidence (5.9:1 on sheet, 4.9:1 on desk)
  rule: "#C9C6BB", // hairline form rules, dividers (decorative, non-text)
  ruleStrong: "#827F77", // input borders and control outlines (3.7:1 on sheet, >=3:1 non-text)
  highlighter: "#F2DE4B", // evidence sweep; text on it stays ink (11.9:1)
  signal: "#B3121B", // urgency only: red flags, escalations, emergency queue rows (6.4:1 on sheet)
  signalTint: "#F4DCD7", // background of urgent (non-emergency) rows; text on it stays ink
  onSignal: "#F7F6F1", // text on signal fill (6.4:1)
} as const;
export type ColorToken = keyof typeof color;

// ---------- Type ----------
// Web loads these through next/font/google (apps/web/app/layout.tsx) and exposes CSS vars.
// Native has no per-glyph fallback between custom fonts, so mobile picks the family per language.
export const fontFamily = {
  web: {
    serif: "var(--font-newsreader), var(--font-noto-serif-thai), Georgia, serif",
    sans: "var(--font-plex-sans), var(--font-plex-sans-thai), system-ui, sans-serif",
  },
  /** expo-google-fonts export names. Weights: regular 400, medium 500, semibold 600. */
  mobile: {
    serif: {
      th: { regular: "NotoSerifThai_400Regular", medium: "NotoSerifThai_500Medium", semibold: "NotoSerifThai_600SemiBold" },
      it: { regular: "Newsreader_400Regular", medium: "Newsreader_500Medium", semibold: "Newsreader_600SemiBold" },
      en: { regular: "Newsreader_400Regular", medium: "Newsreader_500Medium", semibold: "Newsreader_600SemiBold" },
    },
    sans: {
      // Looped Thai for patients: easier for older readers than loopless.
      th: { regular: "IBMPlexSansThaiLooped_400Regular", medium: "IBMPlexSansThaiLooped_500Medium", semibold: "IBMPlexSansThaiLooped_600SemiBold" },
      it: { regular: "IBMPlexSans_400Regular", medium: "IBMPlexSans_500Medium", semibold: "IBMPlexSans_600SemiBold" },
      en: { regular: "IBMPlexSans_400Regular", medium: "IBMPlexSans_500Medium", semibold: "IBMPlexSans_600SemiBold" },
    },
  },
} as const;

export type FontRole = "serif" | "sans";
export type FontWeightName = "regular" | "medium" | "semibold";
export function mobileFont(role: FontRole, lang: Lang, weight: FontWeightName = "regular"): string {
  return fontFamily.mobile[role][lang][weight];
}

/** Type scale, px. Major third (1.25) from 15. lineHeight is a multiplier for Latin; Thai uses lineHeightThai. */
export const type = {
  micro: { size: 12, lineHeight: 1.4, lineHeightThai: 1.6, tracking: 0.01 },
  small: { size: 13, lineHeight: 1.45, lineHeightThai: 1.65, tracking: 0 },
  body: { size: 15, lineHeight: 1.5, lineHeightThai: 1.7, tracking: 0 },
  bodyPatient: { size: 19, lineHeight: 1.5, lineHeightThai: 1.7, tracking: 0 },
  lead: { size: 19, lineHeight: 1.4, lineHeightThai: 1.6, tracking: -0.005 },
  title: { size: 24, lineHeight: 1.25, lineHeightThai: 1.5, tracking: -0.01 },
  question: { size: 30, lineHeight: 1.2, lineHeightThai: 1.45, tracking: -0.015 },
  display: { size: 38, lineHeight: 1.1, lineHeightThai: 1.4, tracking: -0.02 },
  code: { size: 64, lineHeight: 1, lineHeightThai: 1, tracking: -0.02 }, // patient code, e.g. B-042
} as const;
export type TypeToken = keyof typeof type;

/** Use for any computed line height so Thai stacked vowels and tone marks never clip. */
export function lineHeightPx(token: TypeToken, lang: Lang): number {
  const t = type[token];
  return Math.round(t.size * (lang === "th" ? t.lineHeightThai : t.lineHeight));
}

// ---------- Space, grid, shape ----------
/** 4px base. Index by name, never by raw number. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const layout = {
  clinician: { queue: 288, transcript: 400, summaryMin: 560, gutter: 24 },
  ops: { columns: 12, gutter: 24, maxWidth: 1440 },
  patient: { sideMargin: 24, maxMeasure: 34 /* em, Latin; Thai is ~ the same visual width */ },
  hitTarget: 48, // minimum touch target, patient app
  rowHeight: 40, // queue and table rows, clinician + ops
} as const;

/** Paper corners: sheets are square, controls are barely softened. No pills, no 12px cards. */
export const radius = { none: 0, control: 3 } as const;

/** Paper does not float: one shadow, for the active sheet only. */
export const shadow = {
  sheet: { x: 0, y: 1, blur: 2, color: "rgba(60, 52, 30, 0.10)" },
  sheetLifted: { x: 0, y: 6, blur: 18, color: "rgba(60, 52, 30, 0.14)" },
} as const;

// ---------- Motion ----------
/** Milliseconds. Every value has one job; see DIRECTION.md "Motion language". */
export const duration = {
  instant: 0,
  quick: 120, // hover, press, highlight fade-out
  base: 220, // panel and row state changes
  morph: 260, // language switch (out 100 + in 160)
  sweep: 520, // highlighter stroke across one quote
  sweepStagger: 140, // between quotes when a field has several
  interrupt: 420, // red-flag band / screen arriving
  scroll: 360, // transcript scroll to evidence before the sweep
} as const;

/** Cubic-bezier control points. Web: `cubic-bezier(${e.join(",")})`. RN: Easing.bezier(...e). */
export const easing = {
  pen: [0.2, 0.8, 0.2, 1], // ink settling: default ease-out for state changes
  marker: [0.55, 0.05, 0.25, 1], // highlighter: slow start as the nib lands, fast middle, soft lift
  interrupt: [0.7, 0, 0.2, 1], // red flag: decisive arrival, no bounce
} as const satisfies Record<string, readonly [number, number, number, number]>;

// ---------- Confidence -> ink density ----------
/** Field confidence (0..1) to ink level. Never shown as a percentage. */
export const inkLevels = [
  { level: 1, min: 0, label: { th: "ต่ำ", it: "bassa", en: "low" }, text: "graphite" },
  { level: 2, min: 0.5, label: { th: "ปานกลาง", it: "media", en: "moderate" }, text: "inkSoft" },
  { level: 3, min: 0.75, label: { th: "สูง", it: "alta", en: "high" }, text: "ink" },
  { level: 4, min: 0.9, label: { th: "สูงมาก", it: "molto alta", en: "very high" }, text: "ink" },
] as const;
export type InkLevel = (typeof inkLevels)[number];

export function inkLevel(confidence: number): InkLevel {
  let pick: InkLevel = inkLevels[0];
  for (const l of inkLevels) if (confidence >= l.min) pick = l;
  return pick;
}
