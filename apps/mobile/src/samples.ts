// "Try saying" examples and the /patient deep link. Pure: no React Native imports (apps/web/app/patient-stamp.test.ts runs it in Node).
// Every example is a synthetic fixture sentence (DEMO_SAMPLES). A tapped example only fills the box: the patient still checks it and presses Send.
import { DEMO_SAMPLES, type DemoSample, type Lang } from "@medx/shared";

const LANGS: readonly Lang[] = ["en", "th", "it"];
export const asLang = (v: unknown): Lang | null => (LANGS.includes(v as Lang) ? (v as Lang) : null);

/** "it01", "IT-01", "it_01" and "demo-gold" all name the same example. */
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findSample(id: string | null | undefined): DemoSample | null {
  const k = id ? norm(id) : "";
  return k ? DEMO_SAMPLES.find((s) => norm(s.id) === k) ?? null : null;
}

/** The examples written in the session language (English: EN-01, EN-02, DEMO-GOLD; Italian: IT-01; Thai: TH-01, and TH-05, a red-flag example). */
export const samplesFor = (lang: Lang): readonly DemoSample[] => DEMO_SAMPLES.filter((s) => s.lang === lang);

export type Launch = { fresh: boolean; lang: Lang | null; sample: DemoSample | null };

/** Small query parser (no URLSearchParams: it is incomplete on some React Native runtimes). */
function query(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of search.replace(/^[?#]/, "").split("&")) {
    if (!part) continue;
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? "" : part.slice(i + 1);
    try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " ")); } catch { /* malformed: ignore this pair */ }
  }
  return out;
}

/**
 * /patient/?new=1&lang=it&sample=it01
 * - new=1: forget the stored session and start fresh.
 * - lang: the visit language (th | it | en). Invalid values are ignored.
 * - sample: one DEMO_SAMPLES id. It implies a fresh visit, and the example's own language wins over `lang`
 *   (an Italian sentence in an English session would make no sense).
 */
export function parseLaunch(search: string): Launch {
  const q = query(search);
  const sample = findSample(q.sample);
  return { fresh: q.new === "1" || !!sample, lang: sample?.lang ?? asLang(q.lang), sample };
}
