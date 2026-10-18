import { describe, expect, it } from "vitest";
import { AUDIT_TYPES, type AuditEvent, type AuditType, type InvestigationOrder, type Lang, type MedicationOrder } from "@medx/shared";
import { auditLine as pharmacyAuditLine } from "../../(pharmacy)/_lib";
import { auditLine, auditRow, type AuditCtx } from "./_lib";

const LANGS: Lang[] = ["en", "th", "it"];
const at = "2026-10-18T09:00:00Z";
const ev = (type: AuditType, payload: Record<string, unknown>, actor: AuditEvent["actor"] = "clinician", actorId?: string): AuditEvent => ({
  id: `${type}-1`, sessionId: "s1", at, actor, ...(actorId ? { actorId } : {}), type, payload,
});

const med: MedicationOrder = {
  id: "o1", drugText: "Amoxil 500", generic: "amoxicillin", drugClass: "penicillin", dose: "500 mg", route: "oral", frequency: "three times daily",
  orderedBy: "Dr. Marco Bianchi", at, status: "dispensed", checks: [], overrides: [],
};
const inv: InvestigationOrder = { id: "i1", code: "fbc", label: { en: "Full blood count", th: "ตรวจความสมบูรณ์ของเม็ดเลือด", it: "Emocromo" }, category: "lab", orderedBy: "Dr. Marco Bianchi", at, status: "submitted" };
const ctx: AuditCtx = { medications: [med], investigations: [inv] };

// Free text the engine stores in payloads. None of it may reach an audit line.
const FREE = ["Patient at the desk now", "rash last year per pharmacist", "label checked twice", "lower than suggested, seen by me"];

/** One realistic event per AuditType (payload shapes from lib/pipeline), with the key fields its line must name. */
const SAMPLE = {
  session_created: { e: ev("session_created", { patientLang: "it" }, "patient"), must: ["Italiano"] },
  turn_added: { e: ev("turn_added", { turnId: "t1", inputMode: "voice" }, "system"), must: [] },
  pii_redacted: { e: ev("pii_redacted", { turnId: "t1", replaced: [{ type: "phone", count: 2 }, { type: "email", count: 1 }] }, "system"), must: ["3"] },
  red_flag: { e: ev("red_flag", { ruleIds: ["RF-CHEST-01", "RF-CHEST-02"] }, "system"), must: ["RF-CHEST-01", "RF-CHEST-02"] },
  summary_generated: { e: ev("summary_generated", { status: "awaiting_review", supported: 7, required: 8, autoCaptured: 6 }, "system"), must: ["6", "8"] },
  abstained: { e: ev("abstained", { reason: "low_confidence" }, "system"), must: [] },
  review: { e: ev("review", { actions: [{ fieldKey: "chief_complaint", action: "approve" }, { fieldKey: "onset", action: "edit", newValue: "2 days" }] }, "clinician", "Nurse Anna Rossi"), must: [] },
  red_flag_review: { e: ev("red_flag_review", { actions: [{ ruleId: "RF-CHEST-01", action: "acknowledge" }] }, "clinician", "Nurse Anna Rossi"), must: ["RF-CHEST-01"] },
  pharmacy_review: { e: ev("pharmacy_review", { medActions: [{ action: "verify" }], allergyActions: [{ action: "verify" }], complete: true }, "clinician", "Pharmacist Laura Conti"), must: ["2"] },
  consult_turn: { e: ev("consult_turn", { turnId: "t2", speaker: "clinician", mode: "doctor", inputMode: "voice" }, "clinician"), must: [] },
  consult_suggestion: { e: ev("consult_suggestion", { suggestionId: "consider:CR-THROAT-03:CR-THROAT-03-C1", status: "asked" }, "clinician", "Dr. Marco Bianchi"), must: ["CR-THROAT-03"] },
  consult_note_signed: { e: ev("consult_note_signed", { mode: "doctor", editedLineIds: ["l1"], keptConsiderationIds: ["c1", "c2"], lineCount: 9 }, "clinician", "Dr. Marco Bianchi"), must: ["9", "2", "1"] },
  vitals_recorded: { e: ev("vitals_recorded", { vitalId: "v1", vitals: { heartRate: 104, systolicBP: 128, diastolicBP: 82, spo2: 97, tempC: 38.4 }, suggestedLevel: 3 }, "clinician", "Nurse Anna Rossi"), must: ["HR 104", "BP 128/82", "SpO2 97%", "T 38.4", "3"] },
  triage_confirmed: { e: ev("triage_confirmed", { level: 2, by: "Nurse Anna Rossi", at, note: FREE[3], suggestedLevel: 3 }, "clinician", "Nurse Anna Rossi"), must: ["2", "3"] },
  order_drafted: { e: ev("order_drafted", { orderId: "o1", updated: false, checkIds: [] }, "clinician", "Dr. Marco Bianchi"), must: ["amoxicillin"] },
  order_submitted: { e: ev("order_submitted", { orderId: "o1", overrides: [{ alertId: "a1", reason: FREE[1] }, { alertId: "a2", reason: FREE[1] }] }, "clinician", "Dr. Marco Bianchi"), must: ["amoxicillin", "2"] },
  order_pharmacy_action: { e: ev("order_pharmacy_action", { orderId: "o1", action: "verify", by: "Pharmacist Laura Conti", at, note: FREE[1] }, "clinician", "Pharmacist Laura Conti"), must: ["amoxicillin"] },
  order_cancelled: { e: ev("order_cancelled", { orderId: "o1" }, "clinician", "Dr. Marco Bianchi"), must: ["amoxicillin"] },
  order_dispensed: { e: ev("order_dispensed", { orderId: "o1", verifiedBy: "Pharmacist Laura Conti", by: "Pharmacist Nattaya Wong", at, checklist: {}, note: FREE[2] }, "clinician", "Pharmacist Nattaya Wong"), must: ["amoxicillin", "Pharmacist Laura Conti"] },
  order_recheck: { e: ev("order_recheck", { orderId: "o1", reason: "new_high_alert", alertIds: ["x1"], ruleIds: ["MR-ALLERGY-PEN"], message: "Re-check needed" }, "system"), must: ["amoxicillin", "MR-ALLERGY-PEN"] },
  pickup_called: { e: ev("pickup_called", { orderIds: ["o1"], recall: false, counter: "3" }, "clinician", "Pharmacist Nattaya Wong"), must: ["3"] },
  pickup_collected: { e: ev("pickup_collected", { calledBy: "Pharmacist Nattaya Wong", calledAt: at, orderIds: ["o1"] }, "clinician", "Pharmacist Nattaya Wong"), must: ["Pharmacist Nattaya Wong"] },
  takeover: { e: ev("takeover", { reason: FREE[0] }, "clinician", "Nurse Anna Rossi"), must: [] },
} satisfies Record<AuditType, { e: AuditEvent; must: string[] }>;

const RAW = /^(Event|Evento|เหตุการณ์)\s*:/;

describe("audit labels (S-02): every AuditType reads as words", () => {
  it("has a sample for every member of the shared AUDIT_TYPES", () => {
    for (const type of AUDIT_TYPES) expect(SAMPLE[type], type).toBeDefined();
  });

  for (const type of AUDIT_TYPES) {
    it(`labels ${type} in en, th and it with its key fields`, () => {
      const { e, must } = SAMPLE[type];
      for (const lang of LANGS) {
        const line = auditLine(e, lang, ctx);
        expect(line.trim(), `${type}.${lang}`).not.toBe("");
        expect(line, `${type}.${lang}`).not.toMatch(RAW);
        if (type.includes("_")) expect(line, `${type}.${lang} shows the raw type`).not.toContain(type);
        for (const m of must) expect(line, `${type}.${lang} names ${m}`).toContain(m);
        for (const f of FREE) expect(line, `${type}.${lang} leaks free text`).not.toContain(f);
      }
    });

    it(`labels ${type} even with an empty payload and no order context`, () => {
      for (const lang of LANGS) {
        const line = auditLine(ev(type, {}), lang);
        expect(line.trim(), `${type}.${lang}`).not.toBe("");
        expect(line, `${type}.${lang}`).not.toMatch(RAW);
      }
    });
  }

  it("puts the actor on every row: the staff name, or Patient / System", () => {
    for (const type of AUDIT_TYPES) {
      const { e } = SAMPLE[type];
      const row = auditRow(e, "en", ctx);
      expect(row.who, type).toBe(e.actorId ?? { patient: "Patient", system: "System", clinician: "Clinician" }[e.actor]);
      expect(row.text, type).toBe(auditLine(e, "en", ctx));
    }
    expect(auditRow(SAMPLE.order_recheck.e, "it", ctx).who).toBe("Sistema");
  });

  it("names the key fields the pharmacy chain needs", () => {
    expect(auditLine(SAMPLE.order_submitted.e, "en", ctx)).toBe("Medication order sent to pharmacy: amoxicillin, override reasons: 2");
    expect(auditLine(SAMPLE.order_dispensed.e, "en", ctx)).toContain("verified by Pharmacist Laura Conti");
    expect(auditLine(SAMPLE.pickup_called.e, "en", ctx)).toBe("Patient called to collect medicines at counter 3");
    expect(auditLine(ev("pickup_called", { recall: true, counter: "4" }), "en", ctx)).toBe("Patient called again to counter 4");
    expect(auditLine(SAMPLE.triage_confirmed.e, "en", ctx)).toBe("Triage level 2 confirmed (suggested 3)");
    const ret = ev("order_pharmacy_action", { orderId: "o1", action: "return", by: "Pharmacist Laura Conti", at, note: FREE[1], report: { alertIds: ["a1"], suggestedGenerics: ["clarithromycin", "clarithromycin"] } });
    expect(auditLine(ret, "en", ctx)).toBe("Pharmacist 1 returned amoxicillin to the prescriber, options for prescriber review: clarithromycin");
  });

  it("says a sent investigation has no lab system behind it, and a cancel recorded as a draft reads as a cancel", () => {
    const sent = ev("order_submitted", { orderId: "i1", kind: "investigation", code: "fbc" });
    expect(auditLine(sent, "en", ctx)).toBe("Investigation sent: Full blood count (no lab system in this prototype)");
    expect(auditLine(sent, "it", ctx)).toContain("Emocromo");
    expect(auditLine(ev("order_drafted", { orderId: "o1", action: "cancel", reason: FREE[0] }), "en", ctx)).toBe("Order cancelled: amoxicillin");
  });

  it("falls back to a neutral drug phrase when the order is not in the case", () => {
    expect(auditLine(SAMPLE.order_dispensed.e, "en")).toBe("Pharmacist 2 dispensed a medication order after the final double check (verified by Pharmacist Laura Conti)");
  });
});

// The pharmacy audit panel has its own auditLine (app/(pharmacy)/_lib.ts, pharmacist web builder). Same bar:
// every AuditType reads as words in every language, with the actor and the key fields the acceptance names.
describe("pharmacy audit labels (S-02)", () => {
  const pctx = { orders: [med] };
  const KEY: Partial<Record<AuditType, string[]>> = {
    triage_confirmed: ["2"],
    order_drafted: ["amoxicillin"],
    order_submitted: ["amoxicillin", "2"],
    order_pharmacy_action: ["amoxicillin"],
    order_dispensed: ["amoxicillin", "Pharmacist Laura Conti"],
    order_recheck: ["amoxicillin"],
    pickup_called: ["3"],
  };
  for (const type of AUDIT_TYPES) {
    it(`labels ${type} with the actor in en, th and it`, () => {
      const { e } = SAMPLE[type];
      for (const lang of LANGS) {
        const line = pharmacyAuditLine(e, lang, pctx);
        expect(line.trim(), `${type}.${lang}`).not.toBe("");
        expect(line, `${type}.${lang}`).not.toMatch(RAW);
        if (type.includes("_")) expect(line, `${type}.${lang} shows the raw type`).not.toContain(type);
        if (e.actorId) expect(line, `${type}.${lang} names the actor`).toContain(e.actorId);
        for (const m of KEY[type] ?? []) expect(line, `${type}.${lang} names ${m}`).toContain(m);
        for (const f of FREE) expect(line, `${type}.${lang} leaks free text`).not.toContain(f);
        expect(pharmacyAuditLine(ev(type, {}), lang).trim(), `${type}.${lang} empty payload`).not.toBe("");
      }
    });
  }
});
