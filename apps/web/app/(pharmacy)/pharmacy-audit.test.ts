// S-02 (pharmacy side): every AuditType gets words, the actor and its key fields, in en, th and it.
import { describe, expect, it } from "vitest";
import { AUDIT_TYPES, type AuditEvent, type AuditType, type Lang, type MedicationOrder } from "@medx/shared";
import { FIXTURES } from "./_fixtures";
import { auditActor, auditLine } from "./_lib";

const LANGS: Lang[] = ["en", "th", "it"];
const RAW = /^(Event|Evento|เหตุการณ์)\s*:/;
const ev = (type: AuditType, payload: Record<string, unknown> = {}, actor: AuditEvent["actor"] = "clinician", actorId?: string): AuditEvent =>
  ({ id: `e-${type}`, sessionId: "s1", at: "2026-10-18T09:00:00.000Z", actor, ...(actorId ? { actorId } : {}), type, payload });
const order = FIXTURES.find((s) => s.id === "fixture-th-penicillin")!.orders!.medications[0] as MedicationOrder; // amoxicillin 500 mg
const ctx = { orders: [order] };

describe("pharmacy audit lines", () => {
  it("label every AuditType in every language: never empty, never a raw type, always with the actor", () => {
    for (const type of AUDIT_TYPES) {
      for (const lang of LANGS) {
        for (const e of [ev(type), ev(type, {}, "system"), ev(type, {}, "patient"), ev(type, { orderId: order.id }, "clinician", "Pharmacist Laura Conti")]) {
          const line = auditLine(e, lang, ctx);
          expect(line.trim(), `${type} ${lang}`).not.toBe("");
          expect(line, `${type} ${lang}`).not.toMatch(RAW);
          expect(line, `${type} ${lang}`).not.toContain(type.includes("_") ? type : `\u0000${type}`); // no raw snake_case type name
          expect(line, `${type} ${lang}`).toContain(auditActor(e, lang));
          expect(line).not.toMatch(/\bundefined\b|\bnull\b|\bNaN\b|\[object/); // word bounds: "annullato" is fine
          expect(line).not.toMatch(/[–—]/); // no en or em dashes in UI copy
        }
      }
    }
  });

  it("names the actor: staff name, the system or the patient", () => {
    expect(auditLine(ev("order_dispensed", {}, "clinician", "Pharmacist Nattaya Wong"), "en")).toContain("by Pharmacist Nattaya Wong");
    expect(auditLine(ev("order_recheck", {}, "system"), "en")).toMatch(/by the system$/);
    expect(auditLine(ev("turn_added", {}, "patient"), "it")).toMatch(/dal paziente$/);
    expect(auditLine(ev("pickup_called", {}, "clinician", "Nurse X"), "th")).toContain("โดย Nurse X");
  });

  it("carries the key fields: triage level, drug generic, override count, verifier, counter", () => {
    const triage = auditLine(ev("triage_confirmed", { level: 2, suggestedLevel: 3, by: "Nurse Rossi" }, "clinician", "Nurse Rossi"), "en");
    expect(triage).toContain("level 2");
    expect(triage).toContain("suggested 3");
    expect(auditLine(ev("triage_confirmed", { level: 2, suggestedLevel: 2 }), "it")).toContain("livello 2");
    expect(auditLine(ev("triage_confirmed", { level: 4 }), "th")).toContain("ระดับ 4");
    expect(auditLine(ev("vitals_recorded", { suggestedLevel: 3 }), "en")).toContain("suggested triage level 3");

    const submitted = auditLine(ev("order_submitted", { orderId: order.id, overrides: [{ alertId: "a" }, { alertId: "b" }] }, "clinician", "Dr. Marco Bianchi"), "en", ctx);
    expect(submitted).toContain("amoxicillin 500 mg");
    expect(submitted).toContain("2 prescriber overrides");
    expect(auditLine(ev("order_submitted", { orderId: order.id, overrides: [{ alertId: "a" }] }), "it", ctx)).toContain("1 deroga del prescrittore");
    expect(auditLine(ev("order_submitted", { orderId: order.id, overrides: [], pickupReset: true }), "en", ctx)).toContain("new pickup cycle");

    const dispensed = auditLine(ev("order_dispensed", { orderId: order.id, verifiedBy: "Pharmacist Laura Conti", checklist: { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true } }, "clinician", "Pharmacist Nattaya Wong"), "en", ctx);
    expect(dispensed).toContain("amoxicillin 500 mg");
    expect(dispensed).toContain("verified by Pharmacist Laura Conti");
    expect(dispensed).toContain("6 of 6 checks");
    expect(dispensed).toContain("by Pharmacist Nattaya Wong");

    expect(auditLine(ev("pickup_called", { counter: "2", recall: false, orderIds: ["o1"] }), "en")).toContain("counter 2");
    expect(auditLine(ev("pickup_called", { counter: "3", recall: true }), "it")).toContain("sportello 3");
    expect(auditLine(ev("pickup_called", { counter: "1" }), "th")).toContain("ช่อง 1");

    const ret = auditLine(ev("order_pharmacy_action", { orderId: order.id, action: "return", report: { alertIds: ["c1"], suggestedGenerics: ["clarithromycin", "doxycycline"] } }), "en", ctx);
    expect(ret).toContain("returned the order with a report: amoxicillin 500 mg");
    expect(ret).toContain("1 alert raised");
    expect(ret).toContain("2 options for prescriber review");

    const recheck = auditLine(ev("order_recheck", { orderId: order.id, reason: "new_high_alert", alertIds: ["x"], ruleIds: ["MR-ALLERGY-PEN"], previousPharmacist: "Pharmacist Laura Conti" }, "system"), "en", ctx);
    expect(recheck).toContain("Re-check needed");
    expect(recheck).toContain("MR-ALLERGY-PEN");
    expect(recheck).toContain("earlier verified by Pharmacist Laura Conti");
  });

  it("names the drug only from the session's orders or the payload, never invents one", () => {
    expect(auditLine(ev("order_submitted", { orderId: "unknown", overrides: [] }), "en", ctx)).not.toContain(":");
    expect(auditLine(ev("order_drafted", { orderId: order.id, action: "cancel", reason: "free text stays off the line" }), "en", ctx)).toBe("Order cancelled: amoxicillin 500 mg, by a clinician");
    expect(auditLine(ev("order_drafted", { orderId: order.id, action: "cancel", reason: "x" }), "en", ctx)).not.toContain("free text");
  });

  it("keeps the reconciliation summary for pharmacy_review", () => {
    const line = auditLine(ev("pharmacy_review", { medActions: [{ medId: "m", action: "verify" }], alertActions: [{ alertId: "a", action: "false_alarm" }], complete: true }, "clinician", "Pharmacist Laura Conti"), "en");
    expect(line).toBe("Pharmacy review: verified medicine, false alarm alert, signed off reconciliation, by Pharmacist Laura Conti");
  });
});
