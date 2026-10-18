import { afterEach, describe, expect, it, vi } from "vitest";
import type { MedRuleFile } from "@medx/shared";
import medrules from "@medx/shared/src/medrules.json";
import { lookupDrug } from "../../lib/pipeline/medrules";
import { T, alternativeNotes, call, drugTextFor, fixturesRequested } from "./_lib";

const RULES = medrules as unknown as MedRuleFile;

describe("orders UI helpers", () => {
  it("pre-fills a drug text the engine resolves back to the same generic, for every suggestible generic", () => {
    // Pharmacists may suggest any specific dictionary generic (the engine rejects "(unspecified)").
    const generics = RULES.drugs.map((d) => d.generic).filter((g) => !g.endsWith("(unspecified)"));
    const misses = generics.filter((g) => lookupDrug(drugTextFor(g))?.generic !== g);
    expect(misses).toEqual([]);
  });

  it("uses the generic itself when it resolves, a product name only for combinations", () => {
    expect(drugTextFor("paracetamol")).toBe("paracetamol");
    expect(drugTextFor("clarithromycin")).toBe("clarithromycin");
    expect(drugTextFor("amoxicillin+clavulanic acid")).not.toBe("amoxicillin+clavulanic acid");
  });

  it("finds the curated alternatives notes the engine uses, by alert kind and drug class", () => {
    const notes = alternativeNotes("allergy_conflict", "nsaid");
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.kinds.includes("allergy_conflict") && n.drugClasses.includes("nsaid"))).toBe(true);
    expect(alternativeNotes("allergy_conflict", null)).toEqual([]);
  });

  it("has th, it and en for every chrome string, and frames alternatives as options for review", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const [k, v] of Object.entries(T)) for (const lang of ["en", "th", "it"] as const) {
      expect(v[lang]?.trim(), `${k}.${lang}`).toBeTruthy();
      expect(vars(v[lang]), `${k}.${lang} placeholders`).toBe(vars(v.en));
    }
    expect(T.suggestedAlts.en).toMatch(/for your review/);
    expect(T.suggestedAltsNote.en).toMatch(/not a prescription/);
    expect(T.optionsNote.en).toMatch(/not a prescription/);
  });
});

// w20 fix: a store outage (503) or a missing session never swaps a real case for sample data on reads.
describe("call() reads", () => {
  const fx = () => ({ session: { id: "fixture", code: "B-042" } });
  const stub = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })));
  afterEach(() => vi.unstubAllGlobals());
  it("503 'Shared store unavailable' throws the server message (no fixture)", async () => {
    stub(503, { error: "Shared store unavailable; this change may not have been saved. Reload and retry; needs human review if it persists.", code: "internal" });
    await expect(call("/api/sessions/real", undefined, fx, { fixtures: false })).rejects.toThrow(/^Shared store unavailable/);
  });
  it("404 'Session not found' for a real id throws; a 500 throws", async () => {
    stub(404, { error: "Session not found", code: "not_found" });
    await expect(call("/api/sessions/real", undefined, fx, { fixtures: false })).rejects.toThrow("Session not found");
    stub(500, { error: "Unable to complete request", code: "internal" });
    await expect(call("/api/sessions/real", undefined, fx, { fixtures: false })).rejects.toThrow("Unable to complete request");
  });
  it("a network error on a read throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(call("/api/sessions/real", undefined, fx, { fixtures: false })).rejects.toThrow(/Network error/);
  });
  it("only a route missing on this server (HTML 404 / 405) falls back, or any failure with ?fixtures=1", async () => {
    stub(404, "<!doctype html><title>404</title>");
    expect(await call("/api/sessions/real/trace", undefined, fx, { fixtures: false })).toEqual({ data: fx(), fixture: true });
    stub(503, { error: "Store busy, retry", code: "internal" });
    expect(await call("/api/sessions/real", undefined, fx, { fixtures: true })).toEqual({ data: fx(), fixture: true });
    expect(fixturesRequested("?fixtures=1")).toBe(true);
    expect(fixturesRequested("?fixture=1")).toBe(false);
    expect(fixturesRequested("")).toBe(false);
  });
  it("writes never fall back, even with ?fixtures=1", async () => {
    stub(503, { error: "Store busy, retry", code: "internal" });
    await expect(call("/api/sessions/real/vitals", { a: 1 }, fx, { fixtures: true })).rejects.toThrow("Store busy, retry");
  });
});
