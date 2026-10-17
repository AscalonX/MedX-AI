import { describe, expect, it } from "vitest";
import type { MedRuleFile } from "@medx/shared";
import medrules from "@medx/shared/src/medrules.json";
import { lookupDrug } from "../../lib/pipeline/medrules";
import { T, alternativeNotes, drugTextFor } from "./_lib";

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
