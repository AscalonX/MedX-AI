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

/** Fixed media paths (wave 20 FIXED PATHS). The screen-recorded product walkthrough. */
export const VIDEO_PATH = "/media/medx-demo.mp4";
export const VIDEO_POSTER_PATH = "/media/medx-demo-poster.jpg";
/** WebVTT captions, used when one of these files exists next to the video. */
export const VIDEO_TRACK_PATHS = ["/media/medx-demo.en.vtt", "/media/medx-demo.vtt"] as const;
/**
 * The cinematic promo (owner request, wave 20): the primary "MedX in 60 seconds" video when it exists. Without it the
 * walkthrough above takes its place, and without either the section shows the poster-only state.
 */
export const PROMO_PATH = "/media/medx-promo.mp4";
export const PROMO_POSTER_PATH = "/media/medx-promo-poster.jpg";
export const PROMO_TRACK_PATHS = ["/media/medx-promo.en.vtt", "/media/medx-promo.vtt"] as const;

/** Fill "{name}" placeholders. Unknown names stay as written so a missing value is visible in review. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}
