import type { CaseTrace, Localized } from "@medx/shared";

const L = (en: string, th = en, it = en): Localized => ({ en, th, it });

/** Typed sample used ONLY while GET /api/sessions/:id/trace does not answer (UI shows a "fixture" badge). */
export function fixtureTrace(sessionId: string): CaseTrace {
  const t = (s: number) => new Date(Date.UTC(2026, 9, 17, 9, 0, s)).toISOString();
  return {
    sessionId, version: "1", generatedAt: t(80), auditDigest: "fixture-0000000000000000",
    nodes: [
      { id: "n1", kind: "input", label: L("Patient turn", "คำตอบผู้ป่วย", "Turno del paziente"), at: t(0), actor: "human", status: "ok", detail: L("Patient described the problem."), evidence: [], auditIds: ["a1"] },
      { id: "n2", kind: "redact", label: L("Redact identifiers", "ลบข้อมูลระบุตัวตน", "Oscura identificativi"), at: t(1), actor: "rule", status: "ok", detail: L("Identifiers replaced before storage."), evidence: [], auditIds: ["a2"] },
      { id: "n3", kind: "red_flag_rules", label: L("Red-flag rules", "กฎสัญญาณอันตราย", "Regole red flag"), at: t(2), actor: "rule", status: "escalated", detail: L("A red-flag rule fired. Clinician alerted."), evidence: [], auditIds: ["a3"], latencyMs: 2 },
      { id: "n4", kind: "model_screen", label: L("Model screen", "โมเดลคัดกรอง", "Screening modello"), at: t(3), actor: "model", status: "skipped", detail: L("Skipped: rules already escalated."), evidence: [], auditIds: [] },
      { id: "n5", kind: "extract", label: L("Extract fields", "สกัดข้อมูล", "Estrai campi"), at: t(4), actor: "model", status: "ok", detail: L("Fields extracted with quotes."), evidence: [], auditIds: ["a4"], latencyMs: 840 },
      { id: "n6", kind: "verify", label: L("Verify quotes", "ตรวจสอบคำพูดอ้างอิง", "Verifica citazioni"), at: t(5), actor: "rule", status: "ok", detail: L("Quotes checked against the redacted text."), evidence: [], auditIds: ["a5"] },
      { id: "n7", kind: "clinician_action", label: L("Clinician review", "แพทย์ตรวจทาน", "Revisione clinica"), at: t(30), actor: "human", status: "ok", detail: L("Reviewed and approved by a clinician."), evidence: [], auditIds: ["a6"] },
      // Pharmacy chain, same labels as the trace route: pharmacist 1 verifies, pharmacist 2 dispenses, patient is called and collects.
      { id: "n8", kind: "order_check", label: L("Order checks", "ตรวจคำสั่ง", "Controlli ordini"), at: t(40), actor: "rule", status: "ok", detail: L("1 medication order(s), 0 investigation(s); rules fired: none; overrides 0"), evidence: [], auditIds: ["a7"] },
      { id: "n9", kind: "pharmacist_action", label: L("Pharmacist 1: prescription verified", "เภสัชกรคนที่ 1: ตรวจสอบใบสั่งยาแล้ว", "Farmacista 1: prescrizione verificata"), at: t(50), actor: "human", status: "ok", detail: L("Order verified", "ตรวจสอบคำสั่งยาแล้ว", "Ordine verificato"), evidence: [], auditIds: ["a8"] },
      { id: "n10", kind: "pharmacist_action", label: L("Pharmacist 2: dispensed", "เภสัชกรคนที่ 2: จ่ายยาแล้ว", "Farmacista 2: dispensato"), at: t(60), actor: "human", status: "ok", detail: L("Final double check 6 of 6 items confirmed by a second pharmacist", "ตรวจซ้ำขั้นสุดท้ายครบ 6 จาก 6 รายการ โดยเภสัชกรคนที่สอง", "Doppio controllo finale: 6 su 6 voci confermate da un secondo farmacista"), evidence: [], auditIds: ["a9"] },
      { id: "n11", kind: "pharmacist_action", label: L("Patient called to collect", "เรียกผู้ป่วยรับยา", "Paziente chiamato al ritiro"), at: t(70), actor: "human", status: "ok", detail: L("Medicines ready: 1 order(s) dispensed", "ยาพร้อมรับ: จ่ายแล้ว 1 รายการ", "Farmaci pronti: 1 ordine/i dispensato/i"), evidence: [], auditIds: ["a10"] },
      { id: "n12", kind: "pharmacist_action", label: L("Medicines collected", "ผู้ป่วยรับยาแล้ว", "Farmaci ritirati"), at: t(80), actor: "human", status: "ok", detail: L("Patient collected the medicines", "ผู้ป่วยรับยาเรียบร้อย", "Il paziente ha ritirato i farmaci"), evidence: [], auditIds: ["a11"] },
    ],
    edges: [
      { from: "n1", to: "n2" }, { from: "n2", to: "n3" }, { from: "n3", to: "n4", label: "no clearing" }, { from: "n3", to: "n5" }, { from: "n5", to: "n6" }, { from: "n6", to: "n7" },
      { from: "n7", to: "n8", label: "orders" }, { from: "n8", to: "n9" }, { from: "n9", to: "n10", label: "second check" }, { from: "n10", to: "n11" }, { from: "n11", to: "n12" },
    ],
  };
}
