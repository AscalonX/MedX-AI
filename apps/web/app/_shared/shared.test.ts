import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PERSONAS, JOURNEY_STAGES, ROLE_STORAGE_KEY, reviewerStorageKey, type StaffRole } from "@medx/shared";
import { matchesCode } from "./codeSearch";
import {
  DEMO_CASE_KEY, DEMO_PERSONA_KEY, G, applyDemoPersona, caseIdFromPath, demoHref, nextStep, parsePersona, personaFor, readDemoCase, readDemoPersona, writeDemoCase,
} from "./demoPersona";
import { startVisiblePolling, type PollEnv } from "./visiblePolling";

/** A document stand-in: visibility state plus listeners, with real (fake-timer) intervals. */
function fakeDoc() {
  let hidden = false;
  const subs = new Set<() => void>();
  const env: PollEnv = {
    isHidden: () => hidden,
    onVisibilityChange: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  };
  return {
    env,
    subs,
    hide: () => { hidden = true; subs.forEach((f) => f()); },
    show: () => { hidden = false; subs.forEach((f) => f()); },
    startHidden: () => { hidden = true; },
  };
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };

afterEach(() => { vi.useRealTimers(); });

describe("visibility-paused polling (C-03)", () => {
  it("polls while visible, makes no call for 60 s while hidden, and polls at once when shown again", () => {
    vi.useFakeTimers();
    const d = fakeDoc();
    const fn = vi.fn();
    const stop = startVisiblePolling(fn, 5000, d.env);
    expect(fn).toHaveBeenCalledTimes(1); // first load at once
    vi.advanceTimersByTime(15000);
    expect(fn).toHaveBeenCalledTimes(4);
    d.hide();
    fn.mockClear();
    vi.advanceTimersByTime(60000);
    expect(fn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0); // no timer left running in a backgrounded tab
    d.show();
    expect(fn).toHaveBeenCalledTimes(1); // resumes immediately on visibilitychange
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(d.subs.size).toBe(0);
  });

  it("makes no call at all for a tab opened in the background until it is shown", () => {
    vi.useFakeTimers();
    const d = fakeDoc();
    d.startHidden();
    const fn = vi.fn();
    startVisiblePolling(fn, 5000, d.env);
    vi.advanceTimersByTime(60000);
    expect(fn).not.toHaveBeenCalled();
    d.show();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never runs two intervals after repeated visibility events", () => {
    vi.useFakeTimers();
    const d = fakeDoc();
    const fn = vi.fn();
    startVisiblePolling(fn, 5000, d.env);
    d.show(); d.show(); d.hide(); d.show();
    fn.mockClear();
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("patient code search (C-04)", () => {
  const codes = ["B-001", "B-012", "B-112", "B-120", "B-012A"];
  const find = (q: string) => codes.filter((c) => matchesCode(c, q));
  it("finds exactly B-012 from 'B-012', '12', '012', 'b012' and ' b-012 '", () => {
    for (const q of ["B-012", "12", "012", "b012", " b-012 "]) expect(find(q), q).toEqual(["B-012"]);
  });
  it("matches every code for an empty query and nothing for an unknown number", () => {
    expect(find("")).toEqual(codes);
    expect(find("999")).toEqual([]);
  });
  it("falls back to a substring match for non-numeric text", () => {
    expect(find("012A")).toEqual(["B-012A"]);
  });
});

describe("demo persona storage (M-06)", () => {
  it("reads a plain persona id or JSON with an id, and ignores anything else", () => {
    expect(parsePersona("nurse-rossi")?.id).toBe("nurse-rossi");
    expect(parsePersona('{"id":"doctor-bianchi"}')?.id).toBe("doctor-bianchi");
    expect(parsePersona("someone-else")).toBeNull();
    expect(parsePersona("{not json")).toBeNull();
    expect(parsePersona(null)).toBeNull();
  });

  it("treats blocked storage as no persona and never throws", () => {
    expect(readDemoPersona(blocked)).toBeNull();
    expect(readDemoCase(blocked)).toBeNull();
    expect(() => writeDemoCase({ id: "x", code: "B-001" }, blocked)).not.toThrow();
    expect(() => applyDemoPersona("nurse-rossi", blocked)).not.toThrow();
    expect(readDemoPersona(null)).toBeNull();
  });

  it("becoming a persona stores the persona, the role and the exact staff name for that role", () => {
    const st = new MemoryStorage();
    const p = applyDemoPersona("doctor-bianchi", st)!;
    expect(st.getItem(DEMO_PERSONA_KEY)).toBe("doctor-bianchi");
    expect(st.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
    expect(st.getItem("medx.clinicianRole")).toBe("doctor");
    expect(st.getItem(reviewerStorageKey("doctor"))).toBe(p.staffName);
    expect(readDemoPersona(st)?.id).toBe("doctor-bianchi");
    const ph = applyDemoPersona("pharm-wong", st)!;
    expect(st.getItem(ROLE_STORAGE_KEY)).toBe("pharmacist");
    expect(st.getItem("medx.clinicianRole")).toBe("doctor"); // the last nurse/doctor choice is kept
    expect(st.getItem(reviewerStorageKey("pharmacist"))).toBe(ph.staffName);
  });

  it("round-trips the visitor's demo case", () => {
    const st = new MemoryStorage();
    writeDemoCase({ id: "abc", code: "B-031", personaId: "nurse-rossi" }, st);
    expect(readDemoCase(st)).toEqual({ id: "abc", code: "B-031", personaId: "nurse-rossi" });
    st.setItem(DEMO_CASE_KEY, "garbage");
    expect(readDemoCase(st)).toBeNull();
  });

  it("names the person on screen: same staff name first, then the same role, then the stored persona", () => {
    const wong = DEMO_PERSONAS.find((p) => p.id === "pharm-wong")!;
    expect(personaFor("doctor", "Dr. Marco Bianchi", wong)?.id).toBe("doctor-bianchi");
    expect(personaFor("pharmacist", "Somebody", wong)?.id).toBe("pharm-wong"); // keeps Pharmacist 2
    expect(personaFor("nurse", "Nurse Kanya Srisuk", wong)?.id).toBe("nurse-rossi");
    expect(personaFor(null, null, wong)?.id).toBe("pharm-wong");
  });

  it("routes each persona to the page where its work starts", () => {
    const by = (id: string) => DEMO_PERSONAS.find((p) => p.id === id)!;
    expect(demoHref(by("nurse-rossi"), "s1")).toBe("/review/s1");
    expect(demoHref(by("doctor-bianchi"), "s1")).toBe("/review/s1/consult?mode=doctor");
    expect(demoHref(by("pharm-conti"), "s1")).toBe("/pharmacy/s1");
    expect(demoHref(by("ops-head"), "s1")).toBe("/ops");
    expect(caseIdFromPath("/review/abc/consult")).toBe("abc");
    expect(caseIdFromPath("/pharmacy/xyz")).toBe("xyz");
    expect(caseIdFromPath("/review")).toBeNull();
  });
});

describe("demo guide next step", () => {
  const roles: (StaffRole | "patient")[] = ["nurse", "doctor", "pharmacist", "ops", "patient"];
  it("has words in en, th and it for every stage and role", () => {
    for (const stage of JOURNEY_STAGES) for (const role of roles) for (const lang of ["en", "th", "it"] as const) {
      expect(nextStep(stage, role)[lang]?.trim(), `${stage}/${role}/${lang}`).toBeTruthy();
    }
  });
  it("gives the owner of a stage an action and everyone else a status", () => {
    expect(nextStep("intake", "nurse").en).toMatch(/approve the supported fields/);
    expect(nextStep("nurse_done", "doctor").en).toMatch(/sign the note/);
    expect(nextStep("nurse_done", "nurse").en).toMatch(/doctor runs the consult/);
    expect(nextStep("triaged", "doctor").en).toMatch(/^Start the consult/); // after Ready for doctor
    expect(nextStep("pharmacy_verify", "pharmacist").en).toMatch(/options for prescriber review/);
    expect(nextStep("pharmacy_dispense", "pharmacist").en).toMatch(/two-person check/);
    expect(nextStep("intake", "nurse", { collecting: true }).en).toMatch(/still answering/);
    expect(nextStep("orders_submitted", "doctor", { returned: true }).en).toMatch(/returned a prescription/);
  });
  it("never decides urgency, diagnoses or names the mascot", () => {
    const all = [...JOURNEY_STAGES.flatMap((s) => roles.map((r) => nextStep(s, r).en)), ...Object.values(G).map((l) => l.en)];
    for (const t of all) {
      expect(t).not.toMatch(/diagnos|emergency|urgent|\bFin\b/i);
      expect(t).not.toMatch(/[—–]/);
    }
  });
  it("has every guide string in all three languages with the same placeholders", () => {
    const vars = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const [k, v] of Object.entries(G)) for (const lang of ["en", "th", "it"] as const) {
      expect(v[lang]?.trim(), `${k}.${lang}`).toBeTruthy();
      expect(vars(v[lang]), `${k}.${lang}`).toBe(vars(v.en));
    }
  });
});
