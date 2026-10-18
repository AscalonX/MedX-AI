import type { Lang } from "@medx/shared";

/**
 * Public origin of the deployed site (owner decision 5: https://medx.areazeroai.com).
 * NEXT_PUBLIC_SITE_URL overrides it (inlined at build time), e.g. for a preview deployment.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://medx.areazeroai.com").replace(/\/+$/, "");

/** The patient app (Expo web export served from public/patient). */
export const PATIENT_PATH = "/patient/";

/** Landing page per language. English is the default at "/" (owner decision 3). */
export const LANDING_PATHS: Record<Lang, string> = { en: "/", th: "/th", it: "/it" };

/** localStorage key every web surface reads for the UI language (clinician, pharmacy, ops). */
export const LANG_STORAGE_KEY = "medx.lang";

/**
 * Media paths. /media is cached for a year (next.config.ts), so every new cut ships under a new name; the earlier silent
 * cuts (/media/medx-demo.mp4, /media/medx-promo.mp4) stay in place for the links that describe them.
 * The screen-recorded product walkthrough, narrated in English (owner request, Sun 18 Oct; about 2 min 15 s).
 */
export const VIDEO_PATH = "/media/medx-demo-narrated.mp4";
export const VIDEO_POSTER_PATH = "/media/medx-demo-narrated-poster.jpg";
/** WebVTT captions of the narration, used when one of these files exists next to the video. */
export const VIDEO_TRACK_PATHS = ["/media/medx-demo-narrated.en.vtt"] as const;
/**
 * The cinematic promo with the English voice-over (60 s): the primary "MedX in 60 seconds" video when it exists.
 * Without it the walkthrough above takes its place, and without either the section shows the poster-only state.
 * The poster is the same picture as the silent promo's.
 */
export const PROMO_PATH = "/media/medx-promo-voice.mp4";
export const PROMO_POSTER_PATH = "/media/medx-promo-poster.jpg";
export const PROMO_TRACK_PATHS = ["/media/medx-promo-voice.en.vtt"] as const;

/** Fill "{name}" placeholders. Unknown names stay as written so a missing value is visible in review. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}
