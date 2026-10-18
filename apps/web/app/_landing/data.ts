import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { DEMO_SAMPLES, type DemoSample, type RedFlagHit } from "@medx/shared";
import medrules from "@medx/shared/src/medrules.json";
import redflags from "@medx/shared/src/redflags.json";
import { color } from "@medx/shared/src/tokens";
import { checkRedFlags } from "../../lib/pipeline/redflags";
import { PATIENT_PATH, PROMO_PATH, PROMO_POSTER_PATH, PROMO_TRACK_PATHS, SITE_URL, VIDEO_PATH, VIDEO_POSTER_PATH, VIDEO_TRACK_PATHS } from "./site";

/*
 * Build-time facts for the landing (server only; the pages are statically rendered).
 * Every number on the page is counted from the rule files, never typed in copy.
 */

const PUBLIC_DIR = join(process.cwd(), "public");

/** Counts read from the deterministic rule files (packages/shared). */
export const RULE_COUNTS = {
  rules: redflags.rules.length,
  drugs: medrules.drugs.length,
  interactions: medrules.interactions.length,
  doses: medrules.drugs.filter((d) => "doseRange" in d && d.doseRange).length,
};

// ---------- "Try saying" and the red-flag example ----------

/** A synthetic first patient turn, copied verbatim from data/cases. */
export type TrySample = Pick<DemoSample, "id" | "lang" | "text" | "label">;

/**
 * Non-urgent "Try saying" phrases in English, Thai and Italian (DIRECTION.md 12.8), all from DEMO_SAMPLES, so every chip's
 * ?sample= id resolves in the patient app (apps/mobile/src/samples.ts findSample). A phrase the deterministic red-flag
 * rules would escalate is never shown here: it belongs on the red-flag card only.
 */
export const TRY_SAYING: TrySample[] = (() => {
  const pick = (id: string): TrySample | undefined => DEMO_SAMPLES.find((s) => s.id === id);
  const list = [pick("EN-01"), pick("TH-01"), pick("IT-01"), pick("DEMO-GOLD"), pick("EN-02")].filter((s): s is TrySample => Boolean(s));
  return list.filter((s) => checkRedFlags(s.text).length === 0);
})();

/** The red-flag example: the synthetic sample flagged `redFlag`, with the real rule hits computed at build time. */
export const RED_FLAG_EXAMPLE: { sample: DemoSample; hit: RedFlagHit; quotes: string[] } | null = (() => {
  const sample = DEMO_SAMPLES.find((s) => s.redFlag);
  if (!sample) return null;
  const order = { emergency: 0, urgent: 1 } as Record<string, number>;
  const hits = checkRedFlags(sample.text).sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  const hit = hits[0];
  if (!hit) return null;
  const quotes = [...new Set(hits.flatMap((h) => h.evidence.map((e) => e.quote)).filter((q) => q && sample.text.includes(q)))];
  return { sample, hit, quotes };
})();

/** Split `text` into plain and highlighted parts for the given quotes (first occurrence of each, no overlaps). */
export function highlightParts(text: string, quotes: string[]): { text: string; mark: boolean }[] {
  const ranges = quotes
    .map((q) => ({ start: text.indexOf(q), end: text.indexOf(q) + q.length }))
    .filter((r) => r.start >= 0 && r.end > r.start)
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else acc.push({ ...r });
      return acc;
    }, []);
  const parts: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: text.slice(at, r.start), mark: false });
    parts.push({ text: text.slice(r.start, r.end), mark: true });
    at = r.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false });
  return parts;
}

/** A short excerpt for a chip: whole words up to `max` characters, with an ellipsis when cut. */
export function excerpt(text: string, max = 64): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

// ---------- Screen crops (public/landing/*.webp) ----------

export type LandingStill =
  | "patient-voice"
  | "hero-consult"
  | "nurse-case"
  | "consult"
  | "orders"
  | "pharmacy-verify"
  | "pharmacy-dispense"
  | "patient-pickup"
  | "ops"
  | "trace";

/** Width and height of a WebP file from its header (VP8, VP8L or VP8X), or null if it is not a WebP. */
export function webpSize(buf: Uint8Array): { w: number; h: number } | null {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * A still's URL and display aspect. The aspect follows the real file (so a fresh capture under the same name keeps
 * its proportions) within the card's allowed range; object-fit cover crops anything outside it from `position`.
 */
export function still(name: LandingStill, range: [min: number, max: number], fallback: number): { src: string; aspect: string } {
  let ratio = fallback;
  try {
    const size = webpSize(readFileSync(join(PUBLIC_DIR, "landing", `${name}.webp`)));
    if (size && size.w > 0 && size.h > 0) ratio = size.w / size.h;
  } catch {
    /* missing file: keep the fallback aspect; the image itself then 404s visibly in review */
  }
  const clamped = Math.min(range[1], Math.max(range[0], ratio));
  return { src: `/landing/${name}.webp`, aspect: `${Math.round(clamped * 1000)} / 1000` };
}

// ---------- Product video ----------

/** True when an MP4 has a sound track: a `hdlr` box whose handler type is `soun`. */
export function hasAudioTrack(buf: Uint8Array): boolean {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = b.indexOf("hdlr"); i !== -1; i = b.indexOf("hdlr", i + 4)) {
    if (b.toString("ascii", i + 12, i + 16) === "soun") return true;
  }
  return false;
}

/** One published video file with what sits next to it. */
export interface VideoSource {
  src: string;
  poster: string | null;
  track: string | null;
  audio: boolean;
}

export interface VideoInfo {
  /** The primary player: the promo when it exists, else the walkthrough, else null (poster-only state). */
  src: string | null;
  poster: string | null;
  track: string | null;
  audio: boolean;
  kind: "promo" | "walkthrough" | null;
  /** The screen-recorded walkthrough, offered under the promo ("Watch the full product walkthrough"). Null when the
   * walkthrough is already the primary video or does not exist. */
  walkthrough: VideoSource | null;
}

function videoSource(publicDir: string, video: string, poster: string, tracks: readonly string[]): VideoSource | null {
  const at = (p: string) => join(publicDir, p.replace(/^\//, ""));
  if (!existsSync(at(video))) return null;
  let audio = false;
  try {
    audio = hasAudioTrack(readFileSync(at(video)));
  } catch {
    audio = false;
  }
  return { src: video, poster: existsSync(at(poster)) ? poster : null, track: tracks.find((p) => existsSync(at(p))) ?? null, audio };
}

/**
 * What exists under public/media at build time (the landing is static). The promo (/media/medx-promo.mp4) is the
 * primary video when present, with the walkthrough (/media/medx-demo.mp4) as the secondary action; without the promo
 * the walkthrough is the primary; without either the section shows a poster-only state, never a broken player.
 */
export function videoInfo(publicDir = PUBLIC_DIR): VideoInfo {
  const promo = videoSource(publicDir, PROMO_PATH, PROMO_POSTER_PATH, PROMO_TRACK_PATHS);
  const demo = videoSource(publicDir, VIDEO_PATH, VIDEO_POSTER_PATH, VIDEO_TRACK_PATHS);
  const primary = promo ?? demo;
  if (!primary) {
    const at = (p: string) => join(publicDir, p.replace(/^\//, ""));
    const poster = [PROMO_POSTER_PATH, VIDEO_POSTER_PATH].find((p) => existsSync(at(p))) ?? null;
    return { src: null, poster, track: null, audio: false, kind: null, walkthrough: null };
  }
  return { ...primary, kind: promo ? "promo" : "walkthrough", walkthrough: promo && demo ? demo : null };
}

// ---------- Patient QR ----------

/** Absolute URL of the patient app on the deployed site. */
export const PATIENT_URL = `${SITE_URL}${PATIENT_PATH}`;

/**
 * Inline SVG QR code for the patient app, in brand ink on white (tokens only). Synchronous (QRCode.create), so the
 * landing stays a plain server component rendered at build time. One path; crisp at any size.
 */
export function patientQrSvg(url = PATIENT_URL): string | null {
  try {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
    const margin = 1;
    const size = modules.size + margin * 2;
    let d = "";
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
      `<rect width="${size}" height="${size}" fill="${color.sheet}"/><path fill="${color.ink}" d="${d}"/></svg>`
    );
  } catch {
    return null;
  }
}
