/*
 * Motion helpers shared by MotionRuntime, CountUp and the tests (DIRECTION.md 5). Pure, no React, no DOM at import time.
 */

/**
 * What counts as urgent for motion: red-flag interrupts, emergency and high alerts, urgent counts. Urgent content and
 * everything inside it never animates, and a container holding it skips its own entrance.
 * Keep in step with the "Urgent stays still" block in app/globals.css (motion.test.ts checks both lists match).
 */
export const URGENT_SELECTORS = [
  '[role="alert"]',
  "[data-urgent]",
  ".mx-interrupt",
  ".bg-signal",
  ".bg-signal-gradient",
  ".bg-signal-tint",
  ".text-signal",
] as const;
export const URGENT_SELECTOR = URGENT_SELECTORS.join(", ");

/** Elements the reveal runtime watches. */
export const REVEAL_SELECTOR = ".mx-reveal";

/** True when the user asked for reduced motion, or the page was opened with ?motion=off (capture tools). */
export function motionOff(win: Pick<Window, "matchMedia" | "location"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win) return true;
  try {
    if (new URLSearchParams(win.location.search).get("motion") === "off") return true;
  } catch {
    /* no location: fall through */
  }
  return typeof win.matchMedia !== "function" || win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * cubic-bezier(x1, y1, x2, y2) as a function of time (0..1), solved like the browser does (Newton, then bisection).
 * Used so JS tweens (CountUp) land on exactly the same curve as the CSS (`glide` = 0.2, 0.8, 0.2, 1).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return t;
  };
  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sy(solve(t)));
}

/** The `glide` curve (globals.css --ease-glide). */
export const easeGlide = cubicBezier(0.2, 0.8, 0.2, 1);

const FIGURE_SPACE = " ";

/** One number inside a display string, e.g. "49,1" in "49,1%". */
interface NumberToken {
  start: number;
  end: number;
  value: number;
  decimals: number;
  decimalSep: "." | ",";
  groupSep: "" | "," | ".";
}

/**
 * Numbers inside a string as written, e.g. "13 to 59%" gives 13 and 59; "49,1%" gives 49.1 with a comma decimal;
 * "1,872" gives 1872 grouped by commas. A separator followed by exactly three digits groups thousands.
 */
export function numberTokens(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  const re = /\d{1,3}(?:([,.])\d{3})+(?:([.,])\d+)?|\d+(?:([.,])\d+)?/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const raw = m[0];
    const group = (m[1] ?? "") as NumberToken["groupSep"];
    const decWritten = m[2] ?? m[3];
    const dec = (decWritten ?? (group === "," ? "." : ",")) as "." | ",";
    const cut = decWritten ? raw.lastIndexOf(decWritten) : -1;
    const intPart = cut >= 0 ? raw.slice(0, cut) : raw;
    const fracPart = cut >= 0 ? raw.slice(cut + 1) : "";
    const digits = group ? intPart.split(group).join("") : intPart;
    const value = Number(`${digits}${fracPart ? `.${fracPart}` : ""}`);
    if (!Number.isFinite(value)) continue;
    out.push({ start: m.index, end: m.index + raw.length, value, decimals: fracPart.length, decimalSep: dec, groupSep: group });
  }
  return out;
}

function formatToken(n: number, tok: NumberToken, width: number): string {
  const fixed = n.toFixed(tok.decimals);
  const [i, f] = fixed.split(".") as [string, string?];
  const int = tok.groupSep ? i.replace(/\B(?=(\d{3})+(?!\d))/g, tok.groupSep) : i;
  const s = f ? `${int}${tok.decimalSep}${f}` : int;
  // Pad with figure spaces (the width of one tabular digit) so the string never changes width while it counts.
  return s.length < width ? FIGURE_SPACE.repeat(width - s.length) + s : s;
}

/**
 * The display string at tween progress `p` (0..1): every number counts from 0 to its written value, the words around
 * them stay. Widths are kept (figure-space padding), so with tabular figures nothing reflows. p = 1 returns `text`.
 */
export function countText(text: string, p: number): string {
  if (p >= 1) return text;
  const toks = numberTokens(text);
  if (!toks.length) return text;
  let out = "";
  let at = 0;
  for (const tok of toks) {
    out += text.slice(at, tok.start) + formatToken(tok.value * Math.max(0, p), tok, tok.end - tok.start);
    at = tok.end;
  }
  return out + text.slice(at);
}
