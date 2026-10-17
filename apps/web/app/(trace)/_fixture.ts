import type { CaseTrace, Localized } from "@medx/shared";

const L = (en: string, th = en, it = en): Localized => ({ en, th, it });

/** Typed sample used ONLY while GET /api/sessions/:id/trace does not answer (UI shows a "fixture" badge). */
export function fixtureTrace(sessionId: string): CaseTrace {
  const t = (s: number) => new Date(Date.UTC(2026, 9, 17, 9, 0, s)).toISOString();
  return {
    sessionId, version: "1", generatedAt: t(60), auditDigest: "fixture-0000000000000000",
    nodes: [
      { id: "n1", kind: "input", label: L("Patient turn", "คำตอบผู้ป่วย", "Turno del paziente"), at: t(0), actor: "human", status: "ok", detail: L("Patient described the problem."), evidence: [], auditIds: ["a1"] },
      { id: "n2", kind: "redact", label: L("Redact identifiers", "ลบข้อมูลระบุตัวตน", "Oscura identificativi"), at: t(1), actor: "rule", status: "ok", detail: L("Identifiers replaced before storage."), evidence: [], auditIds: ["a2"] },
      { id: "n3", kind: "red_flag_rules", label: L("Red-flag rules", "กฎสัญญาณอันตราย", "Regole red flag"), at: t(2), actor: "rule", status: "escalated", detail: L("A red-flag rule fired. Clinician alerted."), evidence: [], auditIds: ["a3"], latencyMs: 2 },
      { id: "n4", kind: "model_screen", label: L("Model screen", "โมเดลคัดกรอง", "Screening modello"), at: t(3), actor: "model", status: "skipped", detail: L("Skipped: rules already escalated."), evidence: [], auditIds: [] },
      { id: "n5", kind: "extract", label: L("Extract fields", "สกัดข้อมูล", "Estrai campi"), at: t(4), actor: "model", status: "ok", detail: L("Fields extracted with quotes."), evidence: [], auditIds: ["a4"], latencyMs: 840 },
      { id: "n6", kind: "verify", label: L("Verify quotes", "ตรวจสอบคำพูดอ้างอิง", "Verifica citazioni"), at: t(5), actor: "rule", status: "ok", detail: L("Quotes checked against the redacted text."), evidence: [], auditIds: ["a5"] },
      { id: "n7", kind: "clinician_action", label: L("Clinician review", "แพทย์ตรวจทาน", "Revisione clinica"), at: t(30), actor: "human", status: "ok", detail: L("Reviewed and approved by a clinician."), evidence: [], auditIds: ["a6"] },
    ],
    edges: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }, { from: "n3", to: "n4", label: "no clearing" }, { from: "n3", to: "n5" }, { from: "n5", to: "n6" }, { from: "n6", to: "n7" }],
  };
}
