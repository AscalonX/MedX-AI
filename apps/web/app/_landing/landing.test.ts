import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_TYPES, DEMO_PERSONAS, DEMO_SAMPLES, ROLE_STORAGE_KEY, reviewerStorageKey, type Lang } from "@medx/shared";
import { checkRedFlags } from "../../lib/pipeline/redflags";
import { CLINICIAN_ROLE_KEY as APP_CLINICIAN_ROLE_KEY } from "../_shared/useStaffRole";
import robots from "../robots";
import sitemap from "../sitemap";
import { AUDIT_ROWS, LANDING_COPY } from "./copy";
import { RED_FLAG_EXAMPLE, RULE_COUNTS, TRY_SAYING, excerpt, hasAudioTrack, highlightParts, patientQrSvg, still, videoInfo, webpSize } from "./data";
import { CLINICIAN_ROLE_KEY, DEMO_PERSONA_KEY, findPersonaCase, personaById, personaHref, personaInitials, personaStorage, rememberPersona, rememberPersonaCase } from "./demo";
import { DEMO_CASE_KEY, readDemoCase } from "../_shared/demoPersona";
import { HUB_COPY, LAUNCH_COPY, NAV_COPY, PENDING_REVIEW, personaCopy } from "./demoCopy";
import { FEATURE_STILLS } from "./Features";
import { modelLabel } from "./HealthChip";
import { LANDING_SECTION_IDS, Landing } from "./Landing";
import { landingNavLinks } from "./nav";
import { PROMO_PATH, PROMO_POSTER_PATH, PROMO_TRACK_PATHS, VIDEO_PATH, VIDEO_POSTER_PATH, VIDEO_TRACK_PATHS, fill } from "./site";

// vitest.config.ts compiles TSX with the classic runtime (React.createElement): give the components a global React.
await vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

const LANGS: Lang[] = ["en", "th", "it"];
const render = (lang: Lang) => renderToStaticMarkup(h(Landing, { lang }));
const html = { en: render("en"), th: render("th"), it: render("it") };
const WEB = join(__dirname, "..", "..");

/** Every string in a nested copy object. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** The markup of the <article> (bento card) or <section> that contains `needle`. */
function enclosing(markup: string, needle: string, tag: "article" | "section"): string {
  const at = markup.indexOf(needle);
  const start = markup.lastIndexOf(`<${tag}`, at);
  const end = markup.indexOf(`</${tag}>`, at);
  return markup.slice(start, end);
}

describe("landing page structure (M-07)", () => {
  it("renders every section id in the required order, in every language", () => {
    for (const lang of LANGS) {
      const positions = LANDING_SECTION_IDS.map((id) => html[lang].indexOf(`id="${id}"`));
      expect(positions.every((p) => p >= 0), lang).toBe(true);
      expect([...positions].sort((a, b) => a - b), lang).toEqual(positions);
    }
    // The acceptance order (extra sections may sit between these).
    const required = ["nav", "hero", "built-with", "video", "how-it-works", "features", "safety", "demo-accounts", "phone-and-web", "under-the-hood", "cta", "footer"];
    const at = required.map((id) => html.en.indexOf(`id="${id}"`));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("is the marketing page, not the staff shell: no AppShell, no signed-in identity, no metrics polling", () => {
    for (const lang of LANGS) {
      expect(html[lang]).not.toContain("Signed in as");
      expect(html[lang]).not.toContain("/api/metrics");
    }
    const src = readdirSync(__dirname).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
    const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    for (const f of src) expect(code(join(__dirname, f)), f).not.toMatch(/\/api\/metrics|ClinicianFrame|AppShell/);
    expect(code(join(WEB, "app/page.tsx"))).not.toMatch(/use client|ClinicianFrame|AppShell/);
  });

  it("has one H1, the skip link target and a sticky nav with the four anchors and the demo call to action", () => {
    expect(html.en.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html.en).toContain('id="main-content"');
    for (const l of landingNavLinks("en")) expect(html.en).toContain(`href="${l.href}"`);
    expect(landingNavLinks("en").map((l) => l.label)).toEqual(["How it works", "Features", "Safety", "Try a role"]);
    expect(html.en).toContain(">Try the demo<");
    expect(html.en).toContain('href="/demo"');
    expect(html.en).toMatch(/role="radiogroup"[^>]*aria-label="Language"/);
  });

  it("hero: two-tone H1, Fin named in the subtitle, two calls to action, trust chips with synthetic data first", () => {
    const hero = enclosing(html.en, 'id="hero"', "section");
    expect(hero).toMatch(/<h1[^>]*>Every word, <span class="text-brand-gradient">understood\.<\/span><\/h1>/);
    expect(hero).toContain("Patients tell Fin");
    expect(hero).toContain('href="#video"');
    expect(LANDING_COPY.en.hero.trust[0]).toBe("Synthetic data only");
    for (const chip of ["Synthetic data only", "Thai, Italian, English", "Every field cites the patient", "Red flags are code", "A clinician approves"]) expect(hero).toContain(chip);
  });

  it("Fin appears exactly once, in the hero, with patient-side cards only and no red anywhere near", () => {
    for (const lang of LANGS) {
      expect(html[lang].match(/<img[^>]*\/brand\/[^>]*>/g), lang).toHaveLength(1);
      const hero = enclosing(html[lang], 'id="hero"', "section");
      expect(hero).toContain("/brand/fin-hello-");
      expect(hero).not.toMatch(/signal/);
    }
    expect(enclosing(html.en, 'id="hero"', "section")).toContain("Sent. A nurse will review.");
  });

  it("red appears only on the red-flag card", () => {
    for (const lang of LANGS) {
      const title = LANDING_COPY[lang].features.cards.redflag.title.replace(/'/g, "&#x27;"); // as React escapes it
      const card = enclosing(html[lang], `>${title}</h3>`, "article");
      expect(card).toMatch(/signal/);
      const rest = html[lang].replace(card, "");
      expect(rest, lang).not.toMatch(/(?:bg|text|ring|border|from|to)-signal/);
    }
  });

  it("features: exactly one ink card, twelve cards, at least nine real screen crops with alt text, no icon-only card", () => {
    const features = enclosing(html.en, 'id="features"', "section");
    const cards = features.match(/<article[\s\S]*?<\/article>/g) ?? [];
    expect(cards).toHaveLength(12);
    expect(cards.filter((c) => c.includes("bg-ink-gradient"))).toHaveLength(1);
    const crops = cards.filter((c) => /<img[^>]+alt="[^"]{12,}"[^>]+src="[^"]*landing%2F[a-z-]+\.webp/.test(c) || /<img[^>]+src="[^"]*landing%2F[a-z-]+\.webp[^"]*"[^>]+alt="[^"]{12,}"/.test(c));
    expect(crops.length).toBeGreaterThanOrEqual(9);
    // The two cards without a crop render real product output instead (the rule hit, the audit event types).
    for (const c of cards.filter((x) => !crops.includes(x))) expect(c).toMatch(/<figure/);
    // Safety band is the only other dark surface.
    expect(html.en.match(/bg-ink-gradient/g)).toHaveLength(2);
  });

  it("every still the bento uses exists in public/landing and is a readable WebP", () => {
    expect(new Set(FEATURE_STILLS).size).toBe(10);
    for (const name of FEATURE_STILLS) {
      const size = webpSize(readFileSync(join(WEB, "public/landing", `${name}.webp`)));
      expect(size, name).not.toBeNull();
      expect(size!.w, name).toBeGreaterThan(300);
    }
    for (const name of ["hero-consult", "nurse-case", "consult", "orders", "pharmacy-verify", "pharmacy-dispense", "patient-pickup", "ops", "trace"]) {
      expect(FEATURE_STILLS).toContain(name);
    }
  });

  it("how it works: three numbered steps, the last one the human in teal; Try saying is synthetic, non-urgent, three languages", () => {
    const how = enclosing(html.en, 'id="how-it-works"', "section");
    const steps = how.match(/<li class="mx-reveal relative flex flex-col gap-3[\s\S]*?<\/li>/g) ?? [];
    expect(steps).toHaveLength(3);
    expect(steps[2]).toContain("ring-teal/40");
    expect(steps[2]).toContain("A person decides");
    expect(new Set(TRY_SAYING.map((s) => s.lang))).toEqual(new Set(["en", "th", "it"]));
    for (const s of TRY_SAYING) {
      expect(checkRedFlags(s.text), s.id).toHaveLength(0);
      expect(how).toContain(`href="/patient/?new=1&amp;lang=${s.lang}&amp;sample=${s.id}"`);
    }
    expect(how).toContain("Synthetic examples");
    // Verbatim DEMO_SAMPLES entries (w20: TH-01 joined DEMO_SAMPLES), so every chip's ?sample= id prefills in the
    // patient app; DEMO_SAMPLES texts are themselves kept verbatim with data/cases by contracts.test.ts.
    for (const s of TRY_SAYING) expect(DEMO_SAMPLES.find((d) => d.id === s.id)?.text, s.id).toBe(s.text);
    expect(TRY_SAYING.map((s) => s.id)).toContain("TH-01");
  });

  it("the red-flag card shows the real rule hit for the synthetic red-flag sample", () => {
    expect(RED_FLAG_EXAMPLE).not.toBeNull();
    const ex = RED_FLAG_EXAMPLE!;
    expect(ex.sample.redFlag).toBe(true);
    expect(checkRedFlags(ex.sample.text).map((x) => x.ruleId)).toContain(ex.hit.ruleId);
    expect(ex.quotes.length).toBeGreaterThan(0);
    const card = enclosing(html.en, ">Red flags are code</h3>", "article");
    expect(card).toContain(ex.hit.ruleId);
    expect(card).toContain("<mark");
    expect(highlightParts("abcdef", ["bc", "cd"])).toEqual([
      { text: "a", mark: false },
      { text: "bcd", mark: true },
      { text: "ef", mark: false },
    ]);
  });

  it("numbers come from the rule files, never typed in copy", () => {
    expect(RULE_COUNTS.rules).toBeGreaterThan(0);
    expect(html.en).toContain(`${RULE_COUNTS.rules} deterministic, guideline-sourced rules`);
    expect(html.en).toContain(`${RULE_COUNTS.drugs} drugs, ${RULE_COUNTS.interactions} interactions`);
    for (const lang of LANGS) expect(html[lang], lang).not.toMatch(/\{(rules|drugs|interactions|doses|model|hardware)\}/);
  });

  it("audit card lists real audit event types in journey order", () => {
    for (const t of AUDIT_ROWS) expect(AUDIT_TYPES).toContain(t);
    const card = enclosing(html.en, ">Append-only audit log</h3>", "article");
    const at = AUDIT_ROWS.map((t) => card.indexOf(`>${t}<`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("demo accounts: six persona cards, each one link to /demo/<id>, with the synthetic-data notice", () => {
    const roles = enclosing(html.en, 'id="demo-accounts"', "section");
    expect(roles).toContain("Synthetic data only. Do not enter real patient information.");
    for (const p of DEMO_PERSONAS) expect(roles.match(new RegExp(`href="/demo/${p.id}"`, "g")), p.id).toHaveLength(1);
    expect(roles).not.toMatch(/signal|\/brand\//);
    expect(DEMO_PERSONAS).toHaveLength(6);
  });

  it("phone and web: an inline QR code for the patient app on the public site, in token colours", () => {
    const svg = patientQrSvg("https://medx.areazeroai.com/patient/")!;
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 \d+ \d+"/);
    expect(svg).toContain('fill="#0F1E2E"');
    const phone = enclosing(html.en, 'id="phone-and-web"', "section");
    expect(phone).toContain("<svg");
    expect(phone).toContain("/patient/");
  });

  it("under the hood: the model label only ever comes from /api/health", () => {
    const t = LANDING_COPY.en.hood;
    expect(modelLabel({ provider: "mock", model: "deterministic-mock", hardware: "—" }, t)).toBe("Demo runs a mock model; Gemma on AMD pending");
    expect(modelLabel({ provider: "amd", model: "gemma-3-27b", hardware: "AMD Instinct MI300X", providerConfigured: true }, t)).toBe("gemma-3-27b on AMD Instinct MI300X");
    expect(modelLabel({ provider: "amd", model: "x", providerConfigured: false }, t)).toBe(t.modelNotConfigured);
    expect(modelLabel(null, t)).toBe(t.modelUnknown);
    for (const lang of LANGS) expect(strings(LANDING_COPY[lang]).join(" "), lang).not.toMatch(/runs on AMD|gira su AMD|ทำงานบน AMD/i);
    expect(enclosing(html.en, 'id="under-the-hood"', "section")).toContain("Reading the live model label");
  });

  it("footer carries the full claim boundary", () => {
    const footer = html.en.slice(html.en.indexOf('id="footer"'));
    expect(footer).toContain("it does not diagnose, treat, prescribe or decide urgency");
    expect(footer).toContain("Synthetic data only");
    expect(footer).toContain("not a medical device");
  });
});

describe(`product video (promo ${PROMO_PATH}, walkthrough ${VIDEO_PATH})`, () => {
  it("ships each cut under a new name: the narrated walkthrough and the voiced promo, never the cached silent names", () => {
    // /media is cached for a year (next.config.ts): a new cut under an old name would keep serving the old file.
    expect(VIDEO_PATH).toBe("/media/medx-demo-narrated.mp4");
    expect(VIDEO_TRACK_PATHS[0]).toBe("/media/medx-demo-narrated.en.vtt");
    expect(PROMO_PATH).toBe("/media/medx-promo-vo.mp4");
    expect(PROMO_TRACK_PATHS[0]).toBe("/media/medx-promo-vo.en.vtt");
  });

  it("shows a graceful poster-only state while the file is missing", () => {
    const v = videoInfo(join(tmpdir(), "medx-landing-no-media-here"));
    expect(v).toEqual({ src: null, poster: null, track: null, audio: false, kind: null, walkthrough: null });
    if (!videoInfo().src) {
      const video = enclosing(html.en, 'id="video"', "section");
      expect(video).toContain('data-video-state="pending"');
      expect(video).not.toContain("<video");
    }
  });

  it("finds the video, poster and captions, and reads the audio track from the MP4 header", () => {
    const dir = mkdtempSync(join(tmpdir(), "medx-landing-"));
    try {
      mkdirSync(join(dir, "media"));
      const box = (type: string, handler: string) => Buffer.concat([Buffer.from([0, 0, 0, 33]), Buffer.from(type), Buffer.alloc(8), Buffer.from(handler), Buffer.alloc(13)]);
      writeFileSync(join(dir, VIDEO_PATH), Buffer.concat([box("hdlr", "vide"), box("hdlr", "soun")]));
      writeFileSync(join(dir, VIDEO_POSTER_PATH), "x");
      writeFileSync(join(dir, VIDEO_TRACK_PATHS[0]), "WEBVTT");
      // No promo yet: the walkthrough is the primary video and there is no secondary action.
      expect(videoInfo(dir)).toEqual({ src: VIDEO_PATH, poster: VIDEO_POSTER_PATH, track: VIDEO_TRACK_PATHS[0], audio: true, kind: "walkthrough", walkthrough: null });
      expect(hasAudioTrack(box("hdlr", "vide"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("puts the promo first and the walkthrough behind the secondary action; poster-only falls back to either poster", () => {
    const dir = mkdtempSync(join(tmpdir(), "medx-landing-promo-"));
    try {
      mkdirSync(join(dir, "media"));
      writeFileSync(join(dir, PROMO_POSTER_PATH), "x");
      // Poster only, no video yet: the promo poster stands in, still no player.
      expect(videoInfo(dir)).toEqual({ src: null, poster: PROMO_POSTER_PATH, track: null, audio: false, kind: null, walkthrough: null });
      writeFileSync(join(dir, PROMO_PATH), "no boxes");
      writeFileSync(join(dir, VIDEO_PATH), "no boxes");
      writeFileSync(join(dir, VIDEO_POSTER_PATH), "x");
      const v = videoInfo(dir);
      expect(v.src).toBe(PROMO_PATH);
      expect(v.poster).toBe(PROMO_POSTER_PATH);
      expect(v.kind).toBe("promo");
      expect(v.walkthrough).toEqual({ src: VIDEO_PATH, poster: VIDEO_POSTER_PATH, track: null, audio: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the walkthrough opens in a native dialog with its own player: controls, inline, metadata only, never autoplay", async () => {
    const { LandingVideo } = await import("./LandingVideo");
    const t = LANDING_COPY.en.video;
    const labels = { name: t.name, playSound: t.playSound, play: t.play, caption: t.caption, captions: t.captions, fallback: t.fallback, walkthrough: t.walkthrough, walkthroughTitle: t.walkthroughTitle, walkthroughNote: t.walkthroughNote, close: t.close };
    const walk = { src: "/media/medx-demo.mp4", poster: "/media/medx-demo-poster.jpg", track: "/media/medx-demo.en.vtt", audio: false };
    const out = renderToStaticMarkup(h(LandingVideo, { src: "/media/medx-promo.mp4", poster: "/media/medx-promo-poster.jpg", track: null, audio: true, labels, walkthrough: walk }));
    expect(out).toContain("Watch the full product walkthrough");
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toMatch(/<dialog[^>]*aria-labelledby="[^"]+"/);
    expect(out).toContain('aria-label="Close"');
    const videos = out.match(/<video[^>]*>/g) ?? [];
    expect(videos).toHaveLength(2);
    for (const v of videos) {
      expect(v).toMatch(/\scontrols/);
      expect(v).toMatch(/playsInline|playsinline/i);
      expect(v).toContain('preload="metadata"');
      expect(v).not.toMatch(/autoplay/i);
    }
    expect(videos[0]).toMatch(/\smuted/); // the promo starts muted until "Play with sound"
    expect(out).toContain('src="/media/medx-demo.mp4"');
    expect(out).toContain('poster="/media/medx-demo-poster.jpg"');
    // Without a walkthrough there is no dialog and no second player.
    const single = renderToStaticMarkup(h(LandingVideo, { src: "/media/medx-demo.mp4", poster: null, track: null, audio: false, labels }));
    expect(single).not.toContain("<dialog");
    expect(single.match(/<video/g)).toHaveLength(1);
    // The page today: the primary video is whichever file exists, and the secondary appears only beside a promo.
    const section = enclosing(html.en, 'id="video"', "section");
    if (videoInfo().kind === "promo" && videoInfo().walkthrough) expect(section).toContain("Watch the full product walkthrough");
    else expect(section).not.toContain("Watch the full product walkthrough");
    for (const lang of LANGS) for (const k of ["walkthrough", "walkthroughTitle", "close"] as const) expect(LANDING_COPY[lang].video[k].length, `${lang} ${k}`).toBeGreaterThan(2);
  });

  it("the player is muted, inline, metadata-only, never autoplays, and labels its button by the audio track", async () => {
    const { LandingVideo } = await import("./LandingVideo");
    const labels = { name: "MedX in 60 seconds", playSound: "Play with sound", play: "Play", caption: "c", captions: "English captions", fallback: "Download" };
    const withSound = renderToStaticMarkup(h(LandingVideo, { src: "/media/medx-demo.mp4", poster: "/media/medx-demo-poster.jpg", track: "/media/medx-demo.en.vtt", audio: true, labels }));
    expect(withSound).toMatch(/<video[^>]*\scontrols/);
    expect(withSound).toMatch(/<video[^>]*\smuted/);
    expect(withSound).toMatch(/<video[^>]*playsInline|<video[^>]*playsinline/i);
    expect(withSound).toContain('preload="metadata"');
    expect(withSound).toContain('poster="/media/medx-demo-poster.jpg"');
    expect(withSound).not.toMatch(/autoplay/i);
    expect(withSound).toContain('<track kind="captions"');
    expect(withSound).toContain("Play with sound");
    const silent = renderToStaticMarkup(h(LandingVideo, { src: "/media/medx-demo.mp4", poster: null, track: null, audio: false, labels }));
    expect(silent).toContain(">Play<");
    expect(silent).not.toContain("Play with sound");
  });
});

describe("languages (English default, Thai and Italian on the toggle)", () => {
  it("English at /, and the other languages carry the native-review note and their lang attribute", () => {
    expect(html.en).toContain('lang="en"');
    expect(PENDING_REVIEW.en).toBeNull();
    for (const lang of ["th", "it"] as const) {
      expect(html[lang]).toContain(`lang="${lang}"`);
      expect(html[lang]).toContain(PENDING_REVIEW[lang]!);
      expect(PENDING_REVIEW[lang]).toContain("native review pending");
    }
  });

  it("copy follows the house style: no em or en dashes, no exclamation marks, no claim-boundary breaches", () => {
    const all = [LANDING_COPY, NAV_COPY, HUB_COPY, LAUNCH_COPY].flatMap((c) => LANGS.flatMap((l) => strings(c[l])));
    for (const s of all) {
      expect(s, s).not.toMatch(/[–—!]/);
      expect(s, s).not.toMatch(/\bAI doctor\b|\btriages\b|\breplaces (doctors|clinicians|nurses)\b|\bdiagnoses\b/i);
    }
    for (const lang of LANGS) for (const p of DEMO_PERSONAS) expect(personaCopy(p.id, lang).label.length, `${lang} ${p.id}`).toBeGreaterThan(0);
  });

  it("no raw hex colours in the landing sources (tokens only)", () => {
    for (const dir of [__dirname, join(WEB, "app/demo"), join(WEB, "app/demo/[persona]")]) {
      for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x) && !x.endsWith(".test.ts"))) {
        expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/);
      }
    }
  });

  it("fill keeps unknown placeholders visible and excerpt cuts on a word", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(excerpt("short")).toBe("short");
    const e = excerpt("Hi, I've had burning when I pee for two days now, and I need to go all the time.", 40);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(41);
  });
});

describe("persona entry (/demo/<id>)", () => {
  it("writes the identity every staff surface reads", () => {
    expect(CLINICIAN_ROLE_KEY).toBe(APP_CLINICIAN_ROLE_KEY);
    expect(personaStorage(personaById("nurse-rossi")!)).toEqual([
      [DEMO_PERSONA_KEY, "nurse-rossi"],
      [ROLE_STORAGE_KEY, "nurse"],
      [CLINICIAN_ROLE_KEY, "nurse"],
      [reviewerStorageKey("nurse"), "Nurse Anna Rossi"],
    ]);
    expect(personaStorage(personaById("doctor-bianchi")!)).toContainEqual([CLINICIAN_ROLE_KEY, "doctor"]);
    expect(personaStorage(personaById("pharm-wong")!)).toEqual([
      [DEMO_PERSONA_KEY, "pharm-wong"],
      [ROLE_STORAGE_KEY, "pharmacist"],
      [reviewerStorageKey("pharmacist"), "Pharmacist Nattaya Wong"],
    ]);
    expect(personaStorage(personaById("ops-head")!)).toContainEqual([reviewerStorageKey("ops"), "Head Nurse Elena Greco"]);
    expect(personaStorage(personaById("patient")!)).toEqual([[DEMO_PERSONA_KEY, "patient"]]);
    const store = new Map<string, string>();
    expect(rememberPersona(personaById("pharm-conti")!, { setItem: (k, v) => void store.set(k, v) })).toBe(true);
    expect(store.get(reviewerStorageKey("pharmacist"))).toBe("Pharmacist Laura Conti");
    expect(rememberPersona(personaById("pharm-conti")!, { setItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(rememberPersona(personaById("pharm-conti")!, null)).toBe(false);
  });

  it("lands each persona on the right screen", () => {
    const go = (id: string, caseId: string | null) => personaHref(personaById(id)!, caseId);
    expect(go("patient", "x")).toBe("/patient/?new=1&lang=en");
    expect(go("nurse-rossi", "abc")).toBe("/review/abc");
    expect(go("doctor-bianchi", "abc")).toBe("/review/abc/consult?mode=doctor");
    expect(go("pharm-conti", "abc")).toBe("/pharmacy/abc");
    expect(go("pharm-wong", "abc")).toBe("/pharmacy/abc");
    expect(go("ops-head", "abc")).toBe("/ops");
    expect(go("nurse-rossi", null)).toBe("/review");
    expect(go("pharm-wong", null)).toBe("/pharmacy");
    expect(personaInitials(personaById("pharm-conti")!)).toBe("LC");
    expect(personaInitials(personaById("ops-head")!)).toBe("EG");
    expect(personaInitials(personaById("doctor-bianchi")!)).toBe("MB");
  });

  it("asks /api/demo/start for the persona's stage, falls back to /api/demo/cases, and never calls for patient or ops", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fake = (responses: Record<string, { ok: boolean; json: unknown } | Error>) => async (url: string, init?: RequestInit) => {
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      const r = responses[url];
      if (!r) throw new Error(`unexpected ${url}`);
      if (r instanceof Error) throw r;
      return { ok: r.ok, json: async () => r.json };
    };
    const conti = personaById("pharm-conti")!;
    expect(await findPersonaCase(conti, fake({ "/api/demo/start": { ok: true, json: { id: "s1", code: "B-101" } } }))).toEqual({ id: "s1", code: "B-101", fresh: true });
    expect(calls[0]).toEqual({ url: "/api/demo/start", body: JSON.stringify({ stage: "pharmacy_verify" }) });

    calls.length = 0;
    const shared = { "pharm-conti": { id: "seed-1", code: "B-014", status: "approved", stage: "pharmacy_verify" } };
    expect(await findPersonaCase(conti, fake({ "/api/demo/start": { ok: false, json: { error: "limit" } }, "/api/demo/cases": { ok: true, json: shared } }))).toEqual({ id: "seed-1", code: "B-014", fresh: false });
    expect(calls.map((c) => c.url)).toEqual(["/api/demo/start", "/api/demo/cases"]);

    expect(await findPersonaCase(conti, fake({ "/api/demo/start": new Error("offline"), "/api/demo/cases": new Error("offline") }))).toBeNull();

    calls.length = 0;
    expect(await findPersonaCase(personaById("patient")!, fake({}))).toBeNull();
    expect(await findPersonaCase(personaById("ops-head")!, fake({}))).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("(w20) the launcher records a fresh case as the visitor's own and clears a stale one for every other outcome", () => {
    const store = new Map<string, string>();
    const st = { setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), getItem: (k: string) => store.get(k) ?? null };
    const conti = personaById("pharm-conti")!;
    // A nurse-stage case left by an earlier "Reset my demo case" as the nurse.
    store.set(DEMO_CASE_KEY, JSON.stringify({ id: "old-nurse-case", code: "B-031", personaId: "nurse-rossi" }));
    rememberPersonaCase(conti, { id: "s1", code: "B-101", fresh: true }, st);
    expect(readDemoCase(st)).toEqual({ id: "s1", code: "B-101", personaId: "pharm-conti" });
    rememberPersonaCase(conti, { id: "seed-1", code: "B-014", fresh: false }, st); // the shared seeded case is not "yours"
    expect(store.has(DEMO_CASE_KEY)).toBe(false);
    store.set(DEMO_CASE_KEY, "x");
    rememberPersonaCase(conti, null, st);
    expect(store.has(DEMO_CASE_KEY)).toBe(false);
    for (const id of ["patient", "ops-head"]) {
      store.set(DEMO_CASE_KEY, "x");
      rememberPersonaCase(personaById(id)!, null, st);
      expect(store.has(DEMO_CASE_KEY), id).toBe(false);
    }
    expect(() => rememberPersonaCase(conti, { id: "s1", code: "B-101", fresh: true }, { setItem: () => { throw new Error("blocked"); }, removeItem: () => {} })).not.toThrow();
    expect(() => rememberPersonaCase(conti, null, null)).not.toThrow();
  });
});

describe("metadata, robots, sitemap, Open Graph image", () => {
  it("robots keeps staff surfaces, the API and demo starts out of search", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    for (const p of ["/review", "/pharmacy", "/ops", "/api", "/demo/"]) expect(rule.disallow).toContain(p);
    expect(r.sitemap).toBe("https://medx.areazeroai.com/sitemap.xml");
  });

  it("sitemap lists the three landings and the persona hub on the public origin", () => {
    expect(sitemap().map((e) => e.url)).toEqual(["https://medx.areazeroai.com", "https://medx.areazeroai.com/th", "https://medx.areazeroai.com/it", "https://medx.areazeroai.com/demo"]);
  });

  it("layout sets metadataBase, Open Graph and Twitter, and loads the v3 fonts", () => {
    const layout = readFileSync(join(WEB, "app/layout.tsx"), "utf8");
    expect(layout).toContain("metadataBase: new URL(SITE_URL)");
    expect(layout).toMatch(/openGraph:/);
    expect(layout).toMatch(/twitter:\s*\{\s*card: "summary_large_image"/);
    expect(layout).toContain('className={fontVariables}');
  });

  it("opengraph-image.png is a 1200x630 PNG", () => {
    const png = readFileSync(join(WEB, "app/opengraph-image.png"));
    expect(png.toString("ascii", 1, 4)).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it("(w20) the share card's source puts no clinical or red-flag chip beside Fin, says synthetic, and makes no model claim", () => {
    const src = readFileSync(join(WEB, "../../pitch/cover/cover-v5-og.html"), "utf8");
    const body = src.slice(src.indexOf("<body"));
    expect(body).not.toMatch(/chest pain/i);
    expect(body).not.toMatch(/Gemma|AMD/);
    expect(body).toContain("Synthetic data only");
    expect(readFileSync(join(WEB, "app/opengraph-image.alt.txt"), "utf8")).toMatch(/synthetic data only/i);
  });

  it("still() follows the real file within the card's range and falls back when the file is missing", () => {
    expect(still("trace", [1, 10], 2).aspect).toMatch(/^\d+ \/ 1000$/);
    expect(still("nope" as never, [1, 2], 1.5).aspect).toBe("1500 / 1000");
  });
});
