import { describe, expect, it } from "vitest";
import type { DispenseChecklist, IntakeSession, MedicationOrder } from "@medx/shared";
import { alternativesFor } from "../../lib/pipeline/orders";
import { FIXTURES } from "./_fixtures";
import {
  CHECKLIST_KEYS, DICTIONARY_GENERICS, PHARMACISTS, activeOrders, alternativeEntries, applyDispense, applyOrderAction, applyPickup, canCall, collectedOrderIds, isRecheck, newlyDispensed,
  samePerson, stageRows, toDictionaryGeneric,
} from "./_lib";

const AT = "2026-10-18T09:00:00.000Z";
const ALL: DispenseChecklist = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const fx = (id: string) => structuredClone(FIXTURES.find((s) => s.id === id)!) as IntakeSession;
const order = (s: IntakeSession, id: string) => s.orders!.medications.find((o) => o.id === id)! as MedicationOrder;
const [P1, P2] = PHARMACISTS;

describe("pharmacy fixtures follow the contract", () => {
  it("order generics and every listed alternative are dictionary generics", () => {
    for (const s of FIXTURES) for (const o of s.orders?.medications ?? []) {
      expect(DICTIONARY_GENERICS).toContain(o.generic);
      for (const c of o.checks) for (const g of c.alternatives ?? []) expect(DICTIONARY_GENERICS).toContain(g);
    }
  });
  it("fixture alternatives match what the engine derives for the same patient (no model involved)", () => {
    const s2 = fx("fixture-th-penicillin"), o2 = order(s2, "fx2-o1");
    expect(alternativesFor(s2, o2, o2.checks[0])).toEqual(o2.checks[0].alternatives);
    // Allergy status is not recorded with evidence for F-203: the engine lists nothing (fail-safe), and neither does the fixture.
    const s3 = fx("fixture-en-warfarin");
    for (const o of s3.orders!.medications) for (const c of o.checks) {
      expect(alternativesFor(s3, o, c)).toEqual([]);
      expect(c.alternatives).toBeUndefined();
    }
  });
  it("shows the curated note behind an option", () => {
    const o2 = order(fx("fixture-th-penicillin"), "fx2-o1");
    expect(alternativeEntries(o2, o2.checks[0]).map((e) => e.id)).toEqual(["ALT-BETALACTAM-ALLERGY"]);
  });
});

describe("stage 1: verify or return with a report (local mirror of the engine)", () => {
  it("return requires a note and stores the report only on return", () => {
    const s = fx("fixture-th-penicillin");
    expect(() => applyOrderAction(s, "fx2-o1", { reviewerId: P1, action: "return" }, AT)).toThrow("Return requires a note");
    const r = applyOrderAction(s, "fx2-o1", { reviewerId: P1, action: "return", note: "Penicillin allergy", alertIds: ["fx2-o1-c1"], suggestedGenerics: ["Clarithromycin", "clarithromycin"] }, AT);
    expect(order(r, "fx2-o1").status).toBe("returned");
    expect(order(r, "fx2-o1").pharmacist).toEqual({ action: "return", by: P1, at: AT, note: "Penicillin allergy", report: { alertIds: ["fx2-o1-c1"], suggestedGenerics: ["clarithromycin"] } });
    const v = applyOrderAction(fx("fixture-it-paracetamol"), "fx1-o1", { reviewerId: P1, action: "verify" }, AT);
    expect(order(v, "fx1-o1").pharmacist?.report).toBeUndefined();
  });
  it("refuses unknown alerts, non-dictionary or ordered generics, more than five, and verify with an open high alert", () => {
    const s = fx("fixture-th-penicillin");
    const ret = (extra: object) => () => applyOrderAction(s, "fx2-o1", { reviewerId: P1, action: "return", note: "n", ...extra }, AT);
    expect(ret({ alertIds: ["nope"] })).toThrow("Unknown alert for this order");
    expect(ret({ suggestedGenerics: ["unobtainium"] })).toThrow("not in the drug dictionary");
    expect(ret({ suggestedGenerics: ["amoxicillin"] })).toThrow("Suggested generic is the ordered drug");
    expect(ret({ suggestedGenerics: DICTIONARY_GENERICS.slice(0, 6) })).toThrow("At most five");
    expect(() => applyOrderAction(s, "fx2-o1", { reviewerId: P1, action: "verify" }, AT)).toThrow("Every high alert requires an override reason");
    expect(toDictionaryGeneric(" Doxycycline ")).toBe("doxycycline");
    expect(toDictionaryGeneric("blood thinner (unspecified)")).toBeNull();
  });
});

describe("stage 2: two-person dispense", () => {
  it("refuses the verifier by name or staff id, an incomplete checklist, and a non-verified order", () => {
    const s = fx("fixture-th-verified");
    expect(samePerson(P1, "pharm-conti")).toBe(true);
    expect(() => applyDispense(s, "fx6-o1", { reviewerId: P1, checklist: ALL }, AT)).toThrow("A second pharmacist must dispense");
    expect(() => applyDispense(s, "fx6-o1", { reviewerId: "PHARM-CONTI", checklist: ALL }, AT)).toThrow("A second pharmacist must dispense");
    for (const k of CHECKLIST_KEYS) expect(() => applyDispense(s, "fx6-o1", { reviewerId: P2, checklist: { ...ALL, [k]: false } }, AT)).toThrow("Every dispense checklist item");
    expect(() => applyDispense(fx("fixture-it-paracetamol"), "fx1-o1", { reviewerId: P2, checklist: ALL }, AT)).toThrow("Only verified orders can be dispensed");
    const d = applyDispense(s, "fx6-o1", { reviewerId: P2, checklist: ALL, note: "Label in Thai" }, AT);
    expect(order(d, "fx6-o1")).toMatchObject({ status: "dispensed", dispense: { by: P2, at: AT, checklist: ALL, note: "Label in Thai" } });
  });
});

describe("pickup", () => {
  it("calls only when every active order is dispensed, re-calls while ready, collects once", () => {
    let s = fx("fixture-th-verified");
    expect(canCall(s)).toBe(false);
    expect(() => applyPickup(s, { reviewerId: P2, action: "call" }, AT)).toThrow("Every active medication order must be dispensed");
    s = applyDispense(s, "fx6-o1", { reviewerId: P2, checklist: ALL }, AT);
    expect(canCall(s)).toBe(true);
    expect(() => applyPickup(s, { reviewerId: P2, action: "collected" }, AT)).toThrow("Patient has not been called");
    s = applyPickup(s, { reviewerId: P2, action: "call", counter: "3" }, AT);
    expect(s.pickup).toEqual({ status: "ready", counter: "3", calledBy: P2, calledAt: AT });
    s = applyPickup(s, { reviewerId: P1, action: "call" }, AT); // re-call keeps the counter
    expect(s.pickup?.counter).toBe("3");
    s = applyPickup(s, { reviewerId: P1, action: "collected" }, AT);
    expect(s.pickup).toMatchObject({ status: "collected", collectedBy: P1, collectedAt: AT });
    expect(() => applyPickup(s, { reviewerId: P1, action: "call" }, AT)).toThrow("Medicines already collected");
  });
  it("refuses a call with no active orders", () => {
    const s = fx("fixture-th-abstained");
    expect(activeOrders(s)).toHaveLength(0);
    expect(() => applyPickup(s, { reviewerId: P1, action: "call" }, AT)).toThrow("No medication orders to collect");
  });
});

describe("pickup cycles mirror the engine (gate decisions a and b)", () => {
  const withOrders = (s: IntakeSession, meds: MedicationOrder[]): IntakeSession => ({ ...s, orders: { investigations: [], medications: meds } });
  const dispensed = (s: IntakeSession) => order(applyDispense(s, "fx6-o1", { reviewerId: P2, checklist: ALL }, AT), "fx6-o1");
  it("drafts do not block the call; returned, submitted and verified orders do", () => {
    const s = fx("fixture-th-verified");
    const done = dispensed(s);
    const draft = { ...done, id: "d1", status: "draft" as const, pharmacist: undefined, dispense: undefined };
    expect(canCall(withOrders(s, [done, draft]))).toBe(true);
    expect(() => applyPickup(withOrders(s, [done, draft]), { reviewerId: P2, action: "call" }, AT)).not.toThrow();
    for (const status of ["returned", "submitted", "verified"] as const) {
      const other = { ...done, id: `x-${status}`, status, dispense: undefined };
      expect(canCall(withOrders(s, [done, other])), status).toBe(false);
      expect(() => applyPickup(withOrders(s, [done, other]), { reviewerId: P2, action: "call" }, AT)).toThrow("Every active medication order must be dispensed before calling the patient");
    }
  });
  it("needs at least one dispensed order of this cycle: earlier-cycle orders come from the audit", () => {
    const s = fx("fixture-th-verified");
    const done = dispensed(s);
    const fresh = withOrders(s, [done]);
    const audit = [{ id: "a1", sessionId: s.id, at: AT, actor: "clinician" as const, actorId: P2, type: "pickup_collected" as const, payload: { orderIds: [done.id] } }];
    const collected = collectedOrderIds(audit);
    expect(collected.has(done.id)).toBe(true);
    expect(newlyDispensed(fresh, collected)).toHaveLength(0);
    expect(canCall(fresh, collected)).toBe(false);
    expect(() => applyPickup(fresh, { reviewerId: P2, action: "call" }, AT, collected)).toThrow("No newly dispensed medicines to collect");
    // a new order dispensed in this cycle makes the call possible again
    const next = { ...done, id: "o-new" };
    expect(canCall(withOrders(s, [done, next]), collected)).toBe(true);
    expect(collectedOrderIds(undefined).size).toBe(0);
  });
});

describe("re-check after verification", () => {
  it("an order sent back to pharmacist 1 is a re-check, sits in the verify stage, and cannot be dispensed or verified without an override", () => {
    const s = fx("fixture-th-penicillin");
    const o = order(s, "fx2-o1");
    const rechecked: MedicationOrder = { ...o, status: "submitted", recheck: { reason: "new_high_alert", alertIds: [o.checks[0].id], at: AT }, pharmacistHistory: [{ action: "verify", by: P1, at: AT, supersededAt: AT, reason: "new_high_alert" }] };
    const s2: IntakeSession = { ...s, orders: { investigations: [], medications: [rechecked] } };
    expect(isRecheck(rechecked)).toBe(true);
    expect(isRecheck({ ...rechecked, status: "verified" })).toBe(false);
    expect(stageRows([{ session: s2, fixture: true }], Date.now()).verify.map((r) => r.o.id)).toEqual(["fx2-o1"]);
    expect(() => applyDispense(s2, "fx2-o1", { reviewerId: P2, checklist: ALL }, AT)).toThrow(/^Re-check needed: .*Only verified orders can be dispensed$/);
    expect(() => applyOrderAction(s2, "fx2-o1", { reviewerId: P1, action: "verify" }, AT)).toThrow("Every high alert requires an override reason");
  });
});

describe("queue stages", () => {
  it("groups fixture work by stage (orders for verify and dispense, patients for pickup)", () => {
    const entries = FIXTURES.map((session) => ({ session, fixture: true }));
    const now = Date.now();
    const r = stageRows(entries, now);
    expect(r.verify.map((x) => x.o.id).sort()).toEqual(["fx1-o1", "fx2-o1", "fx3-o1", "fx3-o2"]);
    expect(r.verify[0].o.checks.some((c) => c.severity === "high")).toBe(true); // high alerts pinned first
    expect(r.dispense.map((x) => x.o.id)).toEqual(["fx6-o1"]);
    expect(r.call).toHaveLength(0);
    expect(r.ready.map((x) => x.session.code)).toEqual(["F-207"]);
    const collected = applyPickup(fx("fixture-en-pickup"), { reviewerId: P1, action: "collected" }, new Date(now).toISOString());
    expect(stageRows([{ session: collected, fixture: true }], now).collected).toHaveLength(1);
    expect(stageRows([{ session: collected, fixture: true }], now + 2 * 86400000).collected).toHaveLength(0); // "today" only
  });
});
