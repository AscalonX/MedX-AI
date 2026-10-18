import { Noto_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";

/*
 * Web typefaces, v3.1 (owner decisions 17 and 18 Oct 2026; DIRECTION.md section 3). The ONLY UI fonts on the web.
 * Plus Jakarta Sans sets Latin and Italian (all accented vowels, has `tnum` and `lnum`); Noto Sans Thai sets Thai (all
 * 87 assigned code points, mark/mkmk stacking). Both are variable fonts: one file per subset covers every weight the
 * UI uses (400 body, 500 quiet emphasis, 600 controls, 700 headings and values, 800 display), all real instances.
 * Self-hosted by next/font at build time (no request to Google at runtime).
 *
 * Wired in apps/web/app/layout.tsx:
 *   import { fontVariables } from "@/components/ui/fonts";
 *   <html lang="en" className={fontVariables}>
 * globals.css builds --font-sans / --font-display from --font-jakarta and --font-noto-thai.
 *
 * Kept out of components/ui/index.ts on purpose: next/font only runs inside the Next compiler, so importing it from
 * the barrel would break unit tests and any non-Next consumer of the kit.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
  // Metric-matched local fallback while the file loads, so text does not reflow when Jakarta arrives.
  adjustFontFallback: true,
});

export const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-thai",
  display: "swap",
  // Thai glyphs only: Latin always comes from Jakarta, so the metric-adjusted Arial fallback is not needed here.
  adjustFontFallback: false,
  // Most first views are English; the browser fetches the Thai file on the first Thai glyph.
  preload: false,
});

/** Class names that expose both CSS variables. Put on <html>. */
export const fontVariables = `${jakarta.variable} ${notoThai.variable}`;
