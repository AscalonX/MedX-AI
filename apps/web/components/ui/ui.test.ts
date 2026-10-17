import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { color, inkLevel } from "@medx/shared/src/tokens";
import { segments } from "./segments";

describe("segments", () => {
  const text = "ho mal di petto e sudo freddo";
  const view = (s: ReturnType<typeof segments>) => s.map((x) => [x.text, x.mark ? (x.mark.active ? `A${x.mark.order}` : "P") : "-"]);
  it("marks exact quotes, splits overlaps at boundaries, orders active runs", () => {
    const s = segments(text, [
      { start: 3, end: 14, quote: "mal di petto", active: true }, // wrong offsets: 3..14 is "mal di pett"
      { start: 3, end: 15, quote: "mal di petto", active: true },
      { start: 18, end: 29, quote: "sudo freddo", active: false },
      { start: 23, end: 29, quote: "freddo", active: true },
    ]);
    expect(s.map((x) => x.text).join("")).toBe(text);
    expect(view(s)).toEqual([
      ["ho ", "-"],
      ["mal di petto", "A0"],
      [" e ", "-"],
      ["sudo ", "P"],
      ["freddo", "A1"],
    ]);
  });
  it("selected quote inside a passive quote: only the selected range is active", () => {
    const t = "Headache since yesterday";
    const s = segments(t, [
      { start: 0, end: 24, quote: t, active: false },
      { start: 9, end: 24, quote: "since yesterday", active: true },
    ]);
    expect(view(s)).toEqual([
      ["Headache ", "P"],
      ["since yesterday", "A0"],
    ]);
  });
  it("partial overlap and passive inside active", () => {
    const t = "pain in chest and arm";
    const s = segments(t, [
      { start: 0, end: 13, quote: "pain in chest", active: true },
      { start: 8, end: 21, quote: "chest and arm", active: false },
      { start: 0, end: 4, quote: "pain", active: false },
    ]);
    expect(view(s)).toEqual([
      ["pain in chest", "A0"],
      [" and arm", "P"],
    ]);
  });
  it("drops a mark whose offsets do not reproduce the quote", () => {
    expect(segments(text, [{ start: 0, end: 2, quote: "xx", active: true }])).toEqual([{ text }]);
  });
});

describe("tokens", () => {
  it("inkLevel thresholds", () => {
    expect([0, 0.49, 0.5, 0.8, 0.95].map((c) => inkLevel(c).level)).toEqual([1, 1, 2, 3, 4]);
  });
  it("globals.css mirrors every colour token", () => {
    const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
    for (const [k, hex] of Object.entries(color)) {
      const name = k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      expect(css, k).toContain(`--color-${name}: ${hex};`);
    }
  });
});

describe("copy rules", () => {
  it("no em or en dashes in design-system component copy", () => {
    for (const f of readdirSync(__dirname).filter((n) => n.endsWith(".tsx"))) {
      const src = readFileSync(join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
