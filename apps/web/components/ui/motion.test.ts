import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RedFlagHit } from "@medx/shared";
import { BentoCard, BentoMedia } from "./BentoCard";
import { buttonClasses } from "./Button";
import { Card } from "./Card";
import { CountUp, CountUpText } from "./CountUp";
import { FinStage, FloatCard } from "./FinStage";
import { MarketingNav } from "./MarketingNav";
import { Receipt } from "./Receipt";
import { RedFlagInterrupt } from "./RedFlagInterrupt";
import { Reveal } from "./Reveal";
import { StepCard } from "./StepCard";
import { SuccessCheck } from "./SuccessCheck";
import { Toast } from "./Toast";
import { URGENT_SELECTORS, countText, cubicBezier, easeGlide, motionOff, numberTokens } from "./motion";

// vitest.config.ts compiles TSX with the classic runtime (React.createElement): give the components a global React.
await vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const WEB = join(__dirname, "..", "..");
const css = readFileSync(join(WEB, "app/globals.css"), "utf8");
const FIGURE_SPACE = " ";

/** Rules of a stylesheet with the at-rules they sit in (comments stripped; enough CSS for our own file). */
function rules(source: string): { selector: string; body: string; at: string[] }[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string; at: string[] }[] = [];
  const stack: string[] = [];
  let buf = "";
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const prelude = stack.pop() ?? "";
      if (!prelude.startsWith("@")) out.push({ selector: prelude, body: buf.trim(), at: stack.filter((s) => s.startsWith("@")) });
      buf = "";
    } else buf += ch;
  }
  return out;
}

/** Keyframes blocks: name to the properties they animate. */
function keyframes(source: string): Map<string, Set<string>> {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const map = new Map<string, Set<string>>();
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (depth > 0 && i < text.length) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(start, i - 1);
    const props = new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]!));
    map.set(m[1]!, props);
  }
  return map;
}

const NO_PREF = "@media (prefers-reduced-motion: no-preference)";
const parsed = rules(css);
const ruleFor = (selector: string) => parsed.filter((r) => r.selector === selector);

describe("motion system (DIRECTION.md 5)", () => {
  it("tokens: glide easing, durations in the 150 to 450 ms band, and real Tailwind duration utilities", () => {
    expect(css).toContain("--ease-glide: cubic-bezier(0.2, 0.8, 0.2, 1);");
    for (const [name, ms] of [["enter", 360], ["reveal", 450]] as const) {
      expect(css).toContain(`--duration-${name}: ${ms}ms;`);
      expect(ms).toBeGreaterThanOrEqual(150);
      expect(ms).toBeLessThanOrEqual(450);
    }
    // Tailwind v4 reads --transition-duration-*: without these, duration-quick / duration-base were no-ops.
    for (const name of ["quick", "base", "morph", "enter", "reveal"]) expect(css).toContain(`--transition-duration-${name}:`);
  });

  it("our keyframes animate only transform and opacity (the success tick may draw its stroke)", () => {
    const allowed = new Set(["opacity", "transform", "translate", "scale"]);
    const k = keyframes(css);
    const ours = [...k.keys()].filter((n) => n.startsWith("mx-"));
    expect(ours.length).toBeGreaterThanOrEqual(10);
    for (const name of ours) {
      for (const p of k.get(name)!) {
        if (name === "mx-check-draw" && p === "stroke-dashoffset") continue;
        expect(allowed.has(p), `${name} animates ${p}`).toBe(true);
      }
    }
  });

  it("every entrance, loop and reveal is off under reduced motion (declared only inside no-preference)", () => {
    const moving = [
      ".mx-enter",
      ".mx-enter-pop",
      ".mx-enter-child > *",
      ".mx-stagger > *",
      'main#main-content:not([data-page-motion="off"])',
      ".mx-float",
      ".mx-fin-float",
      ".mx-depth",
      ".mx-toast",
      ".mx-check-disc",
      ".mx-check-path",
      ".mx-morph",
      ".mx-skeleton::after",
      ".mx-press:active:not(:disabled)",
      'dialog.mx-dialog[open]',
    ];
    for (const sel of moving) {
      const animated = ruleFor(sel).filter((r) => /\b(animation|transition|scale|translate)\s*:/.test(r.body));
      expect(animated.length, sel).toBeGreaterThan(0);
      for (const r of animated) expect(r.at.some((a) => a.startsWith(NO_PREF)), `${sel} outside no-preference`).toBe(true);
    }
    // The reveal hides content only with motion on and the runtime's "wait" mark, never by default.
    for (const r of parsed.filter((x) => x.selector.includes(".mx-reveal") && /opacity:\s*0/.test(x.body))) {
      expect(r.at.some((a) => a.startsWith(NO_PREF)), r.selector).toBe(true);
      expect(r.selector).toContain('[data-motion="on"]');
      expect(r.selector).toContain('[data-reveal="wait"]');
    }
    // The global reduced-motion rule also zeroes delays (so nothing waits hidden), and ?motion=off does the same.
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation-delay: 0ms !important;/);
    expect(css).toContain(':root[data-motion="off"] *');
  });

  it("urgent stays still: the CSS guard lists exactly URGENT_SELECTORS and stops all motion on and around them", () => {
    const list = `:is(${URGENT_SELECTORS.join(", ")})`;
    const guard = parsed.find((r) => r.selector.startsWith(list) && r.selector.includes(`${list} *`));
    expect(guard, "urgent guard").toBeTruthy();
    expect(guard!.body).toContain("animation: none !important");
    expect(guard!.body).toContain("transition: none !important");
    const containers = parsed.find((r) => r.selector.includes(`:has(\n    ${list}`) || r.selector.replace(/\s+/g, " ").includes(`:has( ${list} )`));
    expect(containers, "container guard").toBeTruthy();
    for (const c of [".mx-enter", ".mx-reveal", ".mx-stagger > *", ".mx-lift"]) expect(containers!.selector).toContain(c);
    expect(containers!.body).toContain("opacity: 1 !important");
    // The page (<main>) has its own guard: it drops its fade but never sets transform/translate, because the
    // minifier folds them into transform:translate(0), which made <main> a containing block for fixed layers.
    const page = parsed.find((r) => r.selector.startsWith("main#main-content:has(") && r.selector.replace(/\s+/g, " ").includes(`:has( ${list} )`));
    expect(page, "page guard").toBeTruthy();
    expect(page!.body).toContain("animation: none !important");
    expect(page!.body).toContain("opacity: 1 !important");
    expect(page!.body).not.toMatch(/transform|translate/);
    // The red-flag band no longer grows (no transition on .mx-interrupt).
    for (const r of parsed.filter((x) => x.selector.startsWith(".mx-interrupt"))) expect(r.body, r.selector).not.toMatch(/transition|animation/);
    // The page fade steps aside for fixed layers (the sign-in sheet) too.
    expect(css).toContain("main#main-content:has(.fixed)");
  });

  it("RedFlagInterrupt is open in its first render (server HTML), with no delay to wait for", () => {
    const hit = {
      ruleId: "RF-TEST",
      severity: "emergency",
      label: { en: "Chest pain with sweating", th: "x", it: "x" },
      action: { en: "Assess now", th: "x", it: "x" },
      patientMessage: { en: "x", th: "x", it: "x" },
      evidence: [{ quote: "chest pain", start: 0, end: 10 }],
    } as unknown as RedFlagHit;
    const html = render(h(RedFlagInterrupt, { hits: [hit], lang: "en", onAcknowledge: () => {}, children: "summary" }));
    expect(html).toContain('class="mx-interrupt" data-open="true"');
    expect(html).toContain('role="alert"');
    expect(html).not.toMatch(/mx-enter|mx-reveal|mx-lift/);
    const src = readFileSync(join(__dirname, "RedFlagInterrupt.tsx"), "utf8");
    expect(src).not.toMatch(/requestAnimationFrame|setTimeout|useState/);
  });

  it("primitives carry their motion classes", () => {
    const btn = buttonClasses({ variant: "primary" });
    expect(btn).toContain("mx-press");
    expect(btn).not.toContain("active:scale-[0.97]");
    expect(btn).toContain("outline-offset");
    expect(render(h(Card, { interactive: true, children: "x" }))).toContain("mx-lift");
    expect(render(h(Card, { children: "x" }))).not.toContain("mx-lift");
    const bento = render(h(BentoCard, { title: "Orders", media: h(BentoMedia, { src: "/landing/orders.webp", alt: "Orders with deterministic checks" }) }));
    expect(bento).toContain("mx-lift");
    expect(bento).toContain("mx-zoom");
    expect(render(h(StepCard, { step: 1, title: "Say it" }))).toContain("mx-draw");
    const nav = render(h(MarketingNav, { links: [{ href: "#a", label: "A" }] }));
    expect(nav).toContain("mx-nav-pill");
    expect(nav).toContain('data-scrolled="false"');
    const stage = render(h(FinStage, { cards: [h(FloatCard, { key: "a", title: "Sent" })] }));
    for (const c of ["mx-parallax", "mx-fin-float", "mx-depth", "mx-enter-child", "mx-float"]) expect(stage, c).toContain(c);
    const receipt = render(h(Receipt, { title: "Intake approved", rows: [{ label: "By", value: "Nurse A. Rossi" }] }));
    expect(receipt).toContain("mx-enter");
    expect(receipt).toContain("mx-check-path");
  });

  it("Reveal, SuccessCheck and Toast", () => {
    expect(render(h(Reveal, {}, "x"))).toBe('<div class="mx-reveal">x</div>');
    const stagger = render(h(Reveal, { as: "ul", stagger: true, delay: 120 }, h("li", null, "a")));
    expect(stagger).toContain('class="mx-reveal mx-reveal-stagger"');
    expect(stagger).toContain("--mx-delay:120ms");
    const tick = render(h(SuccessCheck, {}));
    expect(tick).toContain('aria-hidden="true"');
    expect(tick).toContain('pathLength="1"');
    expect(tick).toContain("mx-check-disc");
    const toast = render(h(Toast, { title: "Saved", onClose: () => {} }));
    expect(toast).toContain('role="status"');
    expect(toast).toContain("mx-toast");
    expect(toast).toContain('aria-label="Close"');
    expect(toast).not.toMatch(/signal/);
  });

  it("CountUp and CountUpText render the real value on the server (no-JS and reduced motion see the truth)", () => {
    const n = render(h(CountUp, { value: 37 }));
    expect(n).toContain(">37<");
    expect(n).toContain('<span class="sr-only">37</span>');
    expect(n).toContain("tabular-nums");
    expect(n).toContain("min-width:calc(2ch + 0.00em)");
    expect(render(h(CountUp, { value: 1872 }))).toContain("min-width:calc(4ch + 0.32em)");
    const t = render(h(CountUpText, { text: "49.1%" }));
    expect(t).toContain(">49.1%<");
    expect(t).toContain('<span class="sr-only">49.1%</span>');
  });
});

describe("motion helpers", () => {
  it("cubicBezier matches the CSS curve ends and stays monotonic", () => {
    expect(easeGlide(0)).toBe(0);
    expect(easeGlide(1)).toBe(1);
    let last = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const v = easeGlide(t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(easeGlide(0.5)).toBeGreaterThan(0.85); // glide lands softly: most of the travel is done by half time
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 4); // linear
  });

  it("countText counts every number in place and never changes the width", () => {
    for (const text of ["49.1%", "13 to 59%", "Dal 13 al 59%", "49,1%", "1,872 tests", "1 in 4"]) {
      expect(countText(text, 1)).toBe(text);
      for (const p of [0, 0.1, 0.37, 0.8]) expect(countText(text, p).length, `${text} @${p}`).toBe(text.length);
    }
    expect(countText("49.1%", 0)).toBe(`${FIGURE_SPACE}0.0%`);
    expect(countText("49,1%", 0.5)).toMatch(/^[ \d]{2},\d%$/);
    expect(countText("13 to 59%", 0)).toBe(`${FIGURE_SPACE}0 to ${FIGURE_SPACE}0%`);
    expect(countText("1,872 tests", 0.5)).toBe(`${FIGURE_SPACE}${FIGURE_SPACE}936 tests`);
    expect(numberTokens("1.234,5").map((x) => x.value)).toEqual([1234.5]);
    expect(numberTokens("no digits")).toEqual([]);
  });

  it("motionOff: reduced motion or ?motion=off turn motion off; no window means off", () => {
    const win = (reduce: boolean, search = "") =>
      ({ matchMedia: (q: string) => ({ matches: reduce && q.includes("reduce") }) as MediaQueryList, location: { search } as Location }) as Pick<Window, "matchMedia" | "location">;
    expect(motionOff(win(false))).toBe(false);
    expect(motionOff(win(true))).toBe(true);
    expect(motionOff(win(false, "?motion=off"))).toBe(true);
    expect(motionOff(undefined)).toBe(true);
  });
});

describe("typography (DIRECTION.md 3)", () => {
  it("Plus Jakarta Sans and Noto Sans Thai are the only UI fonts; SCBXBeta2 is gone from the web stack", () => {
    for (const v of ["--font-sans:", "--font-display:", "--font-serif:"]) {
      const line = css.split("\n").find((l) => l.trim().startsWith(v))!;
      expect(line, v).toContain("var(--font-jakarta");
      expect(line, v).toContain("var(--font-noto-thai");
      expect(line.toLowerCase(), v).not.toContain("scbx");
      // Platform Thai faces cover the moment before Noto Sans Thai loads.
      expect(line, v).toContain('"Leelawadee UI"');
    }
    const fonts = readFileSync(join(__dirname, "fonts.ts"), "utf8");
    expect(fonts).toContain("Plus_Jakarta_Sans(");
    expect(fonts).toContain("Noto_Sans_Thai(");
    expect(fonts).not.toMatch(/localFont|SCBX.*\.otf/);
    const layout = readFileSync(join(WEB, "app/layout.tsx"), "utf8");
    expect(layout).toContain("className={fontVariables}");
    expect(layout).toContain("<MotionRuntime />");
    expect(layout).not.toMatch(/next\/font\/local/);
  });

  it("type scale: tight display tracking, comfortable body line height, tabular figures in data", () => {
    const get = (name: string) => Number(css.match(new RegExp(`--text-${name}--line-height: ([\\d.]+);`))?.[1]);
    expect(get("body")).toBeGreaterThanOrEqual(1.55);
    expect(get("body")).toBeLessThanOrEqual(1.65);
    expect(get("lead-lg")).toBeGreaterThanOrEqual(1.55);
    for (const name of ["hero", "h2", "stat", "display"]) {
      const em = Number(css.match(new RegExp(`--text-${name}--letter-spacing: (-[\\d.]+)em;`))?.[1]);
      expect(em, name).toBeLessThanOrEqual(-0.02);
      expect(em, name).toBeGreaterThanOrEqual(-0.035);
    }
    expect(css).toContain('font-feature-settings: "tnum" 1, "lnum" 1;');
    // Thai keeps zero tracking and taller lines.
    expect(css).toMatch(/:lang\(th\) :is\(\.text-hero, \.text-h2\) \{\s*line-height: 1\.3;\s*letter-spacing: 0;/);
  });
});
