import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { color, gradient } from "@medx/shared/src/tokens";
import { MASCOT_POSES } from "@medx/shared/src/mascot";
import { BentoCard, BentoMedia } from "./BentoCard";
import { ButtonLink } from "./Button";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { FinArt, finArtSrc, type FinArtName } from "./FinArt";
import { FinStage, FloatCard } from "./FinStage";
import { Footer } from "./Footer";
import { GradientHero } from "./GradientHero";
import { MarketingNav } from "./MarketingNav";
import { Mascot } from "./Mascot";
import { PersonaCard } from "./PersonaCard";
import { Section } from "./Section";
import { StatStrip } from "./StatStrip";
import { StepCard } from "./StepCard";
import { VideoFrame } from "./VideoFrame";

// vitest.config.ts compiles TSX with the classic runtime (React.createElement), so the components need a global
// React while they load. vi.hoisted runs before the imports above.
await vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
const brandDir = join(__dirname, "../../public/brand");
const ARTS: FinArtName[] = ["wave", "listening", "thinking", "happy", "pointing", "hero-wave", "hero-hello", "mark"];

describe("brand art (DIRECTION.md 11)", () => {
  it("every file FinArt can request exists, and public/brand holds only those files, under 3 MB", () => {
    const wanted = new Set<string>();
    for (const a of ARTS) for (const w of [1, 96, 128, 256, 300, 384, 512, 640, 828, 1080, 3840]) wanted.add(finArtSrc(a, w).replace("/brand/", ""));
    for (const f of wanted) expect(existsSync(join(brandDir, f)), f).toBe(true);
    const present = readdirSync(brandDir);
    expect(present.sort()).toEqual([...wanted].sort());
    const bytes = present.reduce((n, f) => n + statSync(join(brandDir, f)).size, 0);
    expect(bytes).toBeLessThan(3 * 1024 * 1024);
  });
  it("finArtSrc picks the smallest file at least as wide as asked, else the largest", () => {
    expect(finArtSrc("wave", 112)).toBe("/brand/fin3d-wave-256.webp");
    expect(finArtSrc("wave", 300)).toBe("/brand/fin3d-wave-512.webp");
    expect(finArtSrc("wave", 2000)).toBe("/brand/fin3d-wave-512.webp");
    expect(finArtSrc("hero-hello", 640)).toBe("/brand/fin-hello-1024.webp");
  });
  it("FinArt is decorative by default and named only when labelled; priority only when asked", () => {
    const plain = render(h(FinArt, { art: "happy", size: 112 }));
    expect(plain).toContain('alt=""');
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).toContain('width="112"');
    expect(plain).toContain('loading="lazy"');
    const named = render(h(FinArt, { art: "hero-hello", size: 360, label: "Fin, the MedX dolphin", priority: true }));
    expect(named).toContain('alt="Fin, the MedX dolphin"');
    expect(named).not.toContain("aria-hidden");
    expect(named).not.toContain('loading="lazy"');
  });
  it("Mascot is the 3D art from 96px and the vector drawing below", () => {
    for (const p of MASCOT_POSES) {
      expect(render(h(Mascot, { pose: p, size: 112 }))).toContain(`/brand/fin3d-${p}-`);
      const small = render(h(Mascot, { pose: p, size: 48 }));
      expect(small).toContain("<svg");
      expect(small).not.toContain("<img");
    }
    expect(render(h(Mascot, { pose: "wave", size: 200, variant: "vector" }))).toContain("<svg");
  });
  it("GradientHero shows 3D Fin on the brand tone and refuses Fin on the red tone", () => {
    expect(render(h(GradientHero, { title: "3 intakes need you", mascot: "wave" }))).toContain("/brand/fin3d-wave-");
    const red = render(h(GradientHero, { title: "Red flag", mascot: "wave", tone: "signal" }));
    expect(red).not.toContain("/brand/");
    expect(red).not.toContain("<svg");
  });
  it("EmptyState with a mascot uses the 3D art", () => {
    expect(render(h(EmptyState, { mascot: "pointing", title: "No intakes yet" }))).toContain("/brand/fin3d-pointing-");
  });
});

describe("marketing primitives (DIRECTION.md 12)", () => {
  it("Section labels itself with its title and renders eyebrow, title, subtitle", () => {
    const html = render(h(Section, { id: "how-it-works", eyebrow: "How it works", title: "Say it. Check it. Decide.", subtitle: "Four steps." }, "x"));
    expect(html).toContain('id="how-it-works"');
    expect(html).toContain('aria-labelledby="how-it-works-title"');
    expect(html).toContain('<h2 id="how-it-works-title"');
    expect(html).toContain("text-h2");
    expect(html).toContain("How it works");
  });
  it("the ink Section and the ink BentoCard use the ink token surface, never red", () => {
    const band = render(h(Section, { id: "safety", title: "Fin prepares. People decide.", tone: "ink" }));
    const card = render(h(BentoCard, { title: "Voice intake", tone: "ink", accent: "signal" }));
    for (const html of [band, card]) {
      expect(html).toContain("bg-ink-gradient");
      expect(html).not.toMatch(/signal/);
    }
  });
  it("only accent=signal puts red on a bento card", () => {
    expect(render(h(BentoCard, { title: "Orders", icon: "i" }))).not.toMatch(/signal/);
    expect(render(h(BentoCard, { title: "Red flags as code", icon: "i", accent: "signal" }))).toContain("text-signal");
  });
  it("BentoMedia frames a real screenshot with alt text and neutral window dots", () => {
    const html = render(h(BentoMedia, { src: "/landing/consult.webp", alt: "Consult assistant with cited considerations", chrome: true }));
    expect(html).toContain('alt="Consult assistant with cited considerations"');
    expect(html).toContain("consult.webp");
    expect(html).not.toMatch(/signal|warn/);
  });
  it("StepCard human step is teal and carries its label", () => {
    const html = render(h(StepCard, { step: 4, title: "A clinician decides", human: true, humanLabel: "A person decides" }));
    expect(html).toContain("<li");
    expect(html).toContain("ring-teal");
    expect(html).toContain("A person decides");
    expect(html).not.toMatch(/signal|ink-gradient/);
  });
  it("PersonaCard is one link with decorative initials", () => {
    const html = render(h(PersonaCard, { href: "/review?as=nurse", name: "Nurse A. Rossi", role: "Triage nurse", cta: "Open the demo as this person" }));
    expect(html.match(/<a /g)?.length).toBe(1);
    expect(html).toContain('href="/review?as=nurse"');
    expect(html).toContain(">AR<");
    expect(html).toContain("Open the demo as this person");
    const patient = render(h(PersonaCard, { href: "/patient/", name: "Patient", role: "Phone", hardNav: true }));
    expect(patient).toContain('href="/patient/"');
  });
  it("VideoFrame has controls, a poster, metadata preload and no autoplay", () => {
    const html = render(h(VideoFrame, { title: "MedX in 60 seconds" }));
    expect(html).toContain('src="/media/medx-demo.mp4"');
    expect(html).toContain('poster="/media/medx-demo-poster.jpg"');
    expect(html).toContain("controls");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('aria-label="MedX in 60 seconds"');
    expect(html).not.toMatch(/autoplay/i);
  });
  it("StatStrip shows every source and marks new-tab links", () => {
    const html = render(
      h(StatStrip, {
        items: [
          { value: "1 in 4", label: "Example label", source: { label: "Example source", href: "https://example.org" } },
          { value: "30%", label: "Other", source: { label: "Report 2024" } },
        ],
      }),
    );
    expect(html).toContain("Example source");
    expect(html).toContain("Report 2024");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain("opens in a new tab");
  });
  it("MarketingNav: skip link, logo link, section links, one call to action, menu button", () => {
    const html = render(
      h(MarketingNav, {
        links: [
          { href: "#how-it-works", label: "How it works" },
          { href: "#features", label: "Features" },
        ],
        cta: { href: "#try-a-role", label: "Try the demo" },
        lang: "en",
        onLangChange: () => {},
      }),
    );
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('aria-label="MedX home"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain("Try the demo");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("glass");
  });
  it("Footer always carries the disclaimer", () => {
    const html = render(h(Footer, { disclaimer: "Research prototype. Synthetic data only. Not a medical device." }));
    expect(html).toContain("Not a medical device.");
  });
  it("FinStage is the hero art with patient-side floating cards; ButtonLink and Chip render", () => {
    const html = render(h(FinStage, { cards: [h(FloatCard, { key: "a", meta: "Fin is listening", title: "Question 2 of up to 5" })] }));
    expect(html).toContain("/brand/fin-hello-");
    expect(html).toContain("mx-float");
    expect(html).toContain("Fin is listening");
    expect(render(h(ButtonLink, { href: "/patient/", hardNav: true, variant: "primary" }, "Open the patient app"))).toContain("bg-primary-gradient");
    expect(render(h(Chip, { lang: "th", children: "ปวดหัว" }))).toContain('lang="th"');
  });
});

describe("tokens only (S-06)", () => {
  it("globals.css uses no hex value that is not a design token", () => {
    const allowed = new Set([...Object.values(color), ...Object.values(gradient).flatMap((g) => [g.from, g.to])].map((x) => x.toUpperCase()));
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    for (const x of hexes) expect(allowed.has(x.toUpperCase()), x).toBe(true);
  });
  it("design-system components contain no raw hex colours", () => {
    for (const f of readdirSync(__dirname).filter((n) => n.endsWith(".tsx"))) {
      expect(readFileSync(join(__dirname, f), "utf8"), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
  it("marketing utilities exist and the reveal honours reduced motion", () => {
    for (const u of ["bg-ink-gradient", "bg-mist", "bg-halo", "glass", "text-brand-gradient", "text-brand-gradient-light"]) expect(css, u).toContain(`@utility ${u} {`);
    for (const t of ["--text-hero:", "--text-h2:", "--text-h3:", "--text-lead-lg:", "--text-eyebrow:", "--radius-bento:", "--spacing-section:", "--container-page:", "--shadow-float:", "--shadow-ink:"]) expect(css, t).toContain(t);
    // v3.1: the reveal hides only what the runtime marked "wait", only with motion on, only without reduced motion.
    const reveal = css.indexOf(':root[data-motion="on"] .mx-reveal[data-reveal="wait"]');
    expect(reveal).toBeGreaterThan(-1);
    expect(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", reveal)).toBeGreaterThan(-1);
  });
});
