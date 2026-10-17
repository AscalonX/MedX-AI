import { describe, expect, it } from "vitest";
import type { ConsultSuggestion } from "@medx/shared";
import { considerationsFor, questionsFor } from "./_guard";

const s = (id: string, kind: ConsultSuggestion["kind"], mode: ConsultSuggestion["mode"]): ConsultSuggestion => ({
  id, kind, mode, text: { en: id, th: id, it: id }, why: { en: "", th: "", it: "" }, evidence: [], source: "rule", confidence: 1, status: "open",
});
const all = [s("q1", "ask_next", ["nurse", "doctor"]), s("r1", "rule_out", ["nurse", "doctor"]), s("c1", "consider", ["doctor"]), s("c2", "consider", ["nurse", "doctor"])];

describe("consult suggestion guards", () => {
  it("nurse mode never sees a consideration", () => {
    expect(considerationsFor("nurse", all)).toEqual([]);
    expect(questionsFor("nurse", all).map((x) => x.id)).toEqual(["q1", "r1"]);
  });
  it("doctor mode shows considerations only in their own panel", () => {
    expect(considerationsFor("doctor", all).map((x) => x.id)).toEqual(["c1", "c2"]);
    expect(questionsFor("doctor", all).some((x) => x.kind === "consider")).toBe(false);
  });
});
