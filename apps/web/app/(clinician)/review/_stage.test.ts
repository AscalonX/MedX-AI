import { describe, expect, it } from "vitest";
import type { IntakeSession, MedAlert, MedicationOrder, OrderStatus } from "@medx/shared";
import { pharmacyStage, returnReport } from "./_stage";

const at = "2026-10-17T09:00:00Z";
const order = (id: string, status: OrderStatus, extra: Partial<MedicationOrder> = {}): MedicationOrder => ({
  id, drugText: "drug", generic: "drug", drugClass: null, dose: "1 mg", route: "oral", frequency: "daily", orderedBy: "Doctor A", at, status, checks: [], overrides: [], ...extra,
});
const session = (meds: MedicationOrder[], pickup?: IntakeSession["pickup"]): IntakeSession => ({
  id: "s", code: "B-001", patientLang: "en", status: "approved", turns: [], summary: null, createdAt: at, updatedAt: at,
  orders: { medications: meds, investigations: [] }, ...(pickup ? { pickup } : {}),
});
const ready = { status: "ready" as const, counter: "2", calledBy: "Pharmacist B", calledAt: at };
const collected = { ...ready, status: "collected" as const, collectedBy: "Pharmacist B", collectedAt: at };

describe("clinician pharmacy stage chip", () => {
  it("has no stage without medication orders at the pharmacy", () => {
    expect(pharmacyStage(session([]))).toBeNull();
    expect(pharmacyStage({ ...session([]), orders: undefined })).toBeNull();
    expect(pharmacyStage(session([order("a", "draft")]))).toBeNull();
    expect(pharmacyStage(session([order("a", "returned")]))).toBeNull();
    expect(pharmacyStage(session([order("a", "cancelled")]))).toBeNull();
  });
  it("follows the earliest active step: verify, then dispense, then call", () => {
    expect(pharmacyStage(session([order("a", "submitted"), order("b", "verified")]))).toBe("toVerify");
    expect(pharmacyStage(session([order("a", "verified"), order("b", "dispensed")]))).toBe("toDispense");
    expect(pharmacyStage(session([order("a", "dispensed"), order("b", "cancelled")]))).toBe("toCall");
  });
  it("does not claim the patient can be called while a draft or returned order is still open", () => {
    expect(pharmacyStage(session([order("a", "dispensed"), order("b", "draft")]))).toBeNull();
    expect(pharmacyStage(session([order("a", "dispensed"), order("b", "returned")]))).toBeNull();
  });
  it("shows pickup state once called, but new pharmacy work after collection wins", () => {
    expect(pharmacyStage(session([order("a", "dispensed")], ready))).toBe("ready");
    expect(pharmacyStage(session([order("a", "dispensed")], collected))).toBe("collected");
    expect(pharmacyStage(session([order("a", "dispensed"), order("b", "submitted")], collected))).toBe("toVerify");
  });
  it("reads a return report as flagged checks of this order plus options for prescriber review", () => {
    const alert = { id: "c1", ruleId: "MR-ALLERGY-01", kind: "allergy_conflict", severity: "high", message: { en: "m", th: "m", it: "m" }, action: { en: "a", th: "a", it: "a" }, medIds: [], allergyIds: [], evidence: [], source: "s" } satisfies MedAlert;
    const returned = order("a", "returned", { checks: [alert], pharmacist: { action: "return", by: "Pharmacist A", at, note: "allergy", report: { alertIds: ["c1", "unknown"], suggestedGenerics: ["ibuprofen", "ibuprofen"] } } });
    expect(returnReport(returned)).toEqual({ flagged: [alert], options: ["ibuprofen"] });
    expect(returnReport(order("b", "returned", { pharmacist: { action: "return", by: "Pharmacist A", at, note: "x" } }))).toBeNull();
    expect(returnReport(order("c", "verified", { pharmacist: { action: "verify", by: "Pharmacist A", at, report: { alertIds: ["c1"], suggestedGenerics: [] } } }))).toBeNull();
  });
});
