// MedX design tokens, v3 "Calm clinical banking" (owner decisions 17 Oct 2026, 15:00 and late evening).
// Spec: docs/design/DIRECTION.md (v3). Owner: Design lead.
// Plain numbers and strings only, so web (CSS vars in apps/web/app/globals.css) and React Native read the same values.
// v1 export names are kept so existing screens re-skin without edits; v1 role names are mapped onto v2 roles
// (desk = app background, sheet = white card, ink = text, signal = urgency red, ...).
// apps/web/components/ui/ui.test.ts fails if globals.css drifts from `color`.

import type { Lang } from "./types";

// ---------- Colour ----------
// Red (`signal`) is urgency only. Teal/ocean is the brand. Amber (`warn`) means "needs check".
// Contrast ratios (WCAG 2.x) in DIRECTION.md section 2; every text pairing below passes AA.
export const color = {
  // surfaces
  desk: "#EEF3F6", // app background (cool mist), under cards
  paper: "#F5F8FA", // quiet surface: selected rows, inset panels, patient page
  sheet: "#FFFFFF", // card
  muted: "#EDF1F5", // placeholder fill (missing values), empty tracks, skeletons
  // text
  ink: "#0F1E2E", // primary text (16.9:1 on card); also the dark marketing card surface
  inkRaised: "#173A63", // dark card gradient end (ink toward ocean); white text 11.5:1
  inkSoft: "#45566A", // secondary text, labels (7.5:1 on card)
  graphite: "#56657A", // hints, placeholders, timestamps (5.9:1 on card, 4.6:1 on highlighter)
  // lines
  rule: "#E3E9EF", // hairlines, card borders (decorative)
  ruleStrong: "#7D8C9E", // input borders, control outlines (3.4:1 on card)
  // brand
  teal: "#08716A", // brand text/icons on light surfaces; approved, edited (5.9:1 on card)
  ocean: "#1A5CBF", // links, "from patient's words", focus ring (6.3:1 on card)
  primaryFrom: "#0A8077", // gradient start (white text 4.8:1)
  primaryTo: "#1A5FC4", // gradient end (white text 6.0:1)
  onPrimary: "#FFFFFF",
  tealTint: "#E1F4F1", // approved chip, selected nav
  oceanTint: "#E5EEFB", // verified chip
  highlighter: "#D2E4FF", // evidence sweep (ocean marker); text on it stays ink (13.1:1)
  // states
  warn: "#8F4508", // "Needs check" text and dashed outline (6.9:1 on card)
  warnTint: "#FEF2D7",
  signal: "#BE1B2B", // urgency only: red flags, escalations, emergency (6.2:1 on card)
  signalDeep: "#9E1024", // red gradient end
  signalTint: "#FDEAEC", // urgent (non-emergency) background
  onSignal: "#FFFFFF", // text on red (6.2:1 / 8.2:1)
} as const;
export type ColorToken = keyof typeof color;

/** Gradients. Web: `linear-gradient(${angle}deg, ${from}, ${to})`. RN: expo-linear-gradient colors=[from,to]. */
export const gradient = {
  primary: { from: color.primaryFrom, to: color.primaryTo, angle: 135 }, // one hero card per screen
  signal: { from: "#C81E2C", to: color.signalDeep, angle: 135 }, // red-flag interrupt only
  ink: { from: color.ink, to: color.inkRaised, angle: 160 }, // marketing only: the one dark bento card and the safety band
} as const;

// ---------- Type ----------
// v3 (owner decision, 17 Oct 2026 late evening): the WEB uses Plus Jakarta Sans (Latin, Italian accents) with
// Noto Sans Thai for Thai, both from next/font/google (apps/web/components/ui/fonts.ts, vars --font-jakarta and
// --font-noto-thai). Both are variable fonts (Jakarta 200-800, Noto Sans Thai 100-900) and Jakarta has `tnum`.
// The stack falls back to SCBXBeta2 (--font-scbx) so pages render correctly before and after layout.tsx switches.
// MOBILE keeps SCBXBeta2 (three cuts: Light 300, Regular 400, Bold 700) until the mobile builder adopts the web fonts:
// expo-font registers the names below from apps/mobile/assets/fonts.
export const webFont = {
  latin: { family: "Plus Jakarta Sans", variable: "--font-jakarta", weights: [200, 800] },
  thai: { family: "Noto Sans Thai", variable: "--font-noto-thai", weights: [100, 900] },
} as const;
export const scbxFont = { light: "SCBXBeta2-Light", regular: "SCBXBeta2-Regular", bold: "SCBXBeta2-Bold" } as const;
const scbxWeights = { regular: scbxFont.regular, medium: scbxFont.regular, semibold: scbxFont.bold, bold: scbxFont.bold, light: scbxFont.light };
const scbxDisplay = { regular: scbxFont.bold, medium: scbxFont.bold, semibold: scbxFont.bold, bold: scbxFont.bold, light: scbxFont.light };
const stack = 'var(--font-jakarta, var(--font-scbx, system-ui)), var(--font-noto-thai, "Noto Sans Thai"), system-ui, -apple-system, "Segoe UI", sans-serif';

export const fontFamily = {
  web: { display: stack, serif: stack /* v1 alias */, sans: stack },
  /** expo-font names, identical for every language. `display` defaults to Bold. */
  mobile: {
    display: { th: scbxDisplay, it: scbxDisplay, en: scbxDisplay },
    serif: { th: scbxDisplay, it: scbxDisplay, en: scbxDisplay }, // v1 alias
    sans: { th: scbxWeights, it: scbxWeights, en: scbxWeights },
  },
} as const;

export type FontRole = "display" | "serif" | "sans";
export type FontWeightName = "light" | "regular" | "medium" | "semibold" | "bold";
export function mobileFont(role: FontRole, lang: Lang, weight: FontWeightName = "regular"): string {
  return fontFamily.mobile[role][lang][weight];
}

/** Type scale, px. lineHeight is a multiplier for Latin; Thai uses lineHeightThai. tracking in em. */
export const type = {
  micro: { size: 12, lineHeight: 1.4, lineHeightThai: 1.6, tracking: 0 },
  small: { size: 13, lineHeight: 1.45, lineHeightThai: 1.65, tracking: 0 },
  body: { size: 15, lineHeight: 1.5, lineHeightThai: 1.7, tracking: 0 },
  bodyPatient: { size: 18, lineHeight: 1.5, lineHeightThai: 1.7, tracking: 0 },
  lead: { size: 17, lineHeight: 1.45, lineHeightThai: 1.6, tracking: -0.005 },
  title: { size: 22, lineHeight: 1.25, lineHeightThai: 1.5, tracking: -0.015 },
  question: { size: 26, lineHeight: 1.2, lineHeightThai: 1.45, tracking: -0.02 },
  stat: { size: 32, lineHeight: 1.1, lineHeightThai: 1.3, tracking: -0.025 }, // big tabular numbers
  display: { size: 34, lineHeight: 1.1, lineHeightThai: 1.4, tracking: -0.025 },
  code: { size: 52, lineHeight: 1, lineHeightThai: 1, tracking: -0.03 }, // patient code, e.g. B-042
} as const;
export type TypeToken = keyof typeof type;

/**
 * Marketing type (landing "/" only). Fluid between `min` (390px viewport) and `max` (1440px). Web: CSS clamp() in
 * globals.css (`text-hero`, `text-h2`, `text-h3`, `text-lead-lg`, `text-eyebrow`). Headlines are 800, sentence case.
 */
export const marketingType = {
  hero: { min: 40, max: 76, lineHeight: 1.02, lineHeightThai: 1.3, tracking: -0.035 },
  h2: { min: 30, max: 48, lineHeight: 1.08, lineHeightThai: 1.35, tracking: -0.03 },
  h3: { min: 20, max: 24, lineHeight: 1.25, lineHeightThai: 1.5, tracking: -0.015 },
  leadLg: { min: 17, max: 20, lineHeight: 1.55, lineHeightThai: 1.7, tracking: 0 },
  eyebrow: { min: 13, max: 13, lineHeight: 1.2, lineHeightThai: 1.5, tracking: 0.01 },
} as const;

/** Use for any computed line height so Thai stacked vowels and tone marks never clip. */
export function lineHeightPx(token: TypeToken, lang: Lang): number {
  const t = type[token];
  return Math.round(t.size * (lang === "th" ? t.lineHeightThai : t.lineHeight));
}

// ---------- Space, grid, shape, elevation ----------
/** 4px base. 20/24/32 are marketing section rhythm (80/96/128). */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96, 32: 128 } as const;

export const layout = {
  shell: { sidebar: 248, topbar: 72, gutter: 24, maxWidth: 1440 },
  clinician: { queue: 300, transcript: 400, summaryMin: 560, gutter: 24 },
  ops: { columns: 12, gutter: 24, maxWidth: 1440 },
  patient: { sideMargin: 20, maxMeasure: 34, tabBar: 72, centreAction: 60 },
  hitTarget: 48,
  rowHeight: 48, // list rows in cards
  marketing: { maxWidth: 1200, gutter: 16, gutterWide: 32, sectionMin: 72, sectionMax: 136, nav: 64 },
} as const;

/** Soft shapes. Rule: cards 22, hero 28, inputs 14, buttons/chips/pills full. Marketing: bento 28, UI crops 16. */
export const radius = { none: 0, control: 14, card: 22, hero: 28, bento: 28, media: 16, pill: 999 } as const;

/** Diffuse, tinted (navy), offset down. Never black, never a glow. `sheet` names kept from v1. */
export const shadow = {
  sheet: { x: 0, y: 8, blur: 24, spread: -12, color: "rgba(15, 45, 80, 0.16)" }, // card
  sheetLifted: { x: 0, y: 18, blur: 40, spread: -16, color: "rgba(15, 45, 80, 0.24)" }, // drawer, popover, tab bar
  hero: { x: 0, y: 22, blur: 40, spread: -20, color: "rgba(26, 95, 196, 0.55)" }, // gradient hero
  hairline: { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(15, 45, 80, 0.06)" },
  float: { x: 0, y: 24, blur: 48, spread: -20, color: "rgba(15, 45, 80, 0.28)" }, // marketing floating UI cards
  ink: { x: 0, y: 30, blur: 60, spread: -30, color: "rgba(15, 30, 46, 0.6)" }, // dark marketing card
} as const;

// ---------- Motion ----------
export const duration = {
  instant: 0,
  quick: 140, // press, hover, chip state
  base: 240, // card and row state, drawer
  morph: 260, // language switch
  sweep: 520, // highlighter across one quote
  sweepStagger: 140,
  interrupt: 420, // red-flag arrival
  scroll: 360, // scroll to evidence before the sweep
} as const;

/** Cubic-bezier control points. Web: `cubic-bezier(${e.join(",")})`. RN: Easing.bezier(...e). */
export const easing = {
  pen: [0.22, 1, 0.36, 1], // default ease-out (v1 name kept)
  marker: [0.55, 0.05, 0.25, 1], // highlighter sweep
  interrupt: [0.7, 0, 0.2, 1], // red flag: decisive, no bounce
} as const satisfies Record<string, readonly [number, number, number, number]>;

// ---------- Confidence levels ----------
/** Field confidence (0..1) to a 4-step level. Shown as bars + word, never a percentage. */
export const inkLevels = [
  { level: 1, min: 0, label: { th: "ต่ำ", it: "bassa", en: "low" }, text: "inkSoft" },
  { level: 2, min: 0.5, label: { th: "ปานกลาง", it: "media", en: "moderate" }, text: "ink" },
  { level: 3, min: 0.75, label: { th: "สูง", it: "alta", en: "high" }, text: "ink" },
  { level: 4, min: 0.9, label: { th: "สูงมาก", it: "molto alta", en: "very high" }, text: "ink" },
] as const;
export type InkLevel = (typeof inkLevels)[number];
export const confidenceLevels = inkLevels;

export function inkLevel(confidence: number): InkLevel {
  let pick: InkLevel = inkLevels[0];
  for (const l of inkLevels) if (confidence >= l.min) pick = l;
  return pick;
}
export const confidenceLevel = inkLevel;
