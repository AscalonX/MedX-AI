import catalog from "@medx/shared/src/investigations.json";
import type {
  ConsultSuggestion, InvestigationCatalog, IntakeSession, InvestigationOrder, Localized, MedAlert, MedicationOrder, TriageAssessment, VitalAlert, VitalSigns,
  VitalsReq, MedicationOrderReq,
} from "@medx/shared";

/** Typed sample data and logic used ONLY while the server routes do not answer (UI shows a "fixture" badge). Not clinical rules. */
const L = (en: string, th = en, it = en): Localized => ({ en, th, it });
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export const fixtureSession = (id: string): IntakeSession => ({
  id, code: "B-042", patientLang: "en", status: "awaiting_review", pharmacyStatus: "pending",
  turns: [{ id: "t1", role: "patient", text: "I have chest pain since this morning. I am allergic to penicillin." } as unknown as IntakeSession["turns"][number]],
  summary: null, vitals: [], createdAt: now(), updatedAt: now(),
});

export const CATALOG = catalog as InvestigationCatalog;

export const fixtureConsider: ConsultSuggestion[] = [{
  id: "consider:CR-CHEST-01:acs", kind: "consider", mode: ["doctor"], text: L("Consider: acute coronary syndrome, for clinician review"), why: L("Chest pain with the patient's description is a don't-miss pattern."),
  evidence: [], version: "fixture", status: "open", source: "rule", confidence: 1, ruleId: "CR-CHEST-01",
  workup: [{ id: "ecg", label: L("12-lead ECG") }, { id: "troponin", label: L("Troponin (high-sensitivity)") }],
  guideline: { title: "ESC acute coronary syndromes guideline", url: "https://www.escardio.org/Guidelines" },
} as unknown as ConsultSuggestion];

// ---- vitals / triage -------------------------------------------------------
export function fixtureVitals(s: IntakeSession, req: VitalsReq): IntakeSession {
  const v: VitalSigns = { ...req.vitals, id: uid("v"), at: now(), recordedBy: req.recordedBy };
  const alerts: VitalAlert[] = [];
  const add = (vital: keyof VitalSigns, severity: "high" | "moderate", en: string) => alerts.push({ id: uid("va"), ruleId: `FX-${vital}`, vital, severity, message: L(en) });
  if (v.spo2 !== undefined) { if (v.spo2 < 92) add("spo2", "high", `SpO2 ${v.spo2}% is low`); else if (v.spo2 < 95) add("spo2", "moderate", `SpO2 ${v.spo2}% is borderline`); }
  if (v.respRate !== undefined) { if (v.respRate >= 25 || v.respRate <= 8) add("respRate", "high", `Respiratory rate ${v.respRate}/min is outside the safe band`); else if (v.respRate >= 21) add("respRate", "moderate", `Respiratory rate ${v.respRate}/min is raised`); }
  if (v.heartRate !== undefined) { if (v.heartRate >= 131 || v.heartRate <= 40) add("heartRate", "high", `Heart rate ${v.heartRate} bpm is outside the safe band`); else if (v.heartRate >= 111) add("heartRate", "moderate", `Heart rate ${v.heartRate} bpm is raised`); }
  if (v.systolicBP !== undefined) { if (v.systolicBP <= 90) add("systolicBP", "high", `Systolic BP ${v.systolicBP} mmHg is low`); else if (v.systolicBP <= 100) add("systolicBP", "moderate", `Systolic BP ${v.systolicBP} mmHg is lowish`); }
  if (v.tempC !== undefined && (v.tempC >= 39 || v.tempC <= 35)) add("tempC", "moderate", `Temperature ${v.tempC} °C is abnormal`);
  if (v.consciousness && v.consciousness !== "alert") add("consciousness", "high", "Not fully alert");
  const high = alerts.filter((a) => a.severity === "high").length;
  const triage: TriageAssessment = {
    suggestedLevel: high ? 2 : alerts.length ? 3 : 4,
    reasons: high ? alerts.filter((a) => a.severity === "high").map((a) => a.message) : alerts.length ? alerts.map((a) => a.message) : [L("No vital sign outside the sample bands.")],
    warningScore: high * 3 + (alerts.length - high), vitalAlerts: alerts,
  };
  return { ...s, vitals: [...(s.vitals ?? []), v], triage };
}

export function fixtureConfirm(s: IntakeSession, by: string, level: 1 | 2 | 3 | 4 | 5, note?: string): IntakeSession {
  return s.triage ? { ...s, triage: { ...s.triage, confirmed: { level, by, at: now(), note } } } : s;
}

// ---- orders -----------------------------------------------------------------
const DRUGS: { re: RegExp; generic: string; cls: string; maxSingle?: number }[] = [
  { re: /amoxi|augmentin|penicill/i, generic: "amoxicillin", cls: "penicillin" },
  { re: /paracetamol|acetaminophen|tylenol/i, generic: "paracetamol", cls: "analgesic", maxSingle: 1000 },
  { re: /ibuprofen|nurofen/i, generic: "ibuprofen", cls: "nsaid", maxSingle: 800 },
  { re: /aspirin/i, generic: "aspirin", cls: "nsaid", maxSingle: 1000 },
];
export function fixtureMedication(s: IntakeSession, req: MedicationOrderReq): IntakeSession {
  const d = DRUGS.find((x) => x.re.test(req.drugText));
  const mg = /(\d+(?:\.\d+)?)\s*mg/i.exec(req.dose)?.[1];
  const checks: MedAlert[] = [];
  const mk = (kind: MedAlert["kind"], severity: MedAlert["severity"], en: string, action: string, quote?: string): MedAlert => ({
    id: uid("ma"), ruleId: `FX-${kind}`, kind, severity, message: L(en), action: L(action), medIds: [], allergyIds: [],
    evidence: quote ? [{ turnId: "t1", quote, start: 0, end: quote.length }] : [], source: "fixture",
  });
  if (!d) checks.push(mk("unknown_medication", "moderate", `"${req.drugText}" is not in the rule set, so it was not checked.`, "Check this medicine manually."));
  else {
    if (d.cls === "penicillin") checks.push(mk("allergy_conflict", "high", "Patient reports a penicillin allergy; this is a penicillin.", "Confirm the allergy with the patient before prescribing.", "I am allergic to penicillin"));
    if (d.maxSingle && mg && Number(mg) > d.maxSingle) checks.push(mk("dose_range", "high", `${req.dose} is above the usual single-dose maximum (${d.maxSingle} mg).`, "Re-check the dose."));
  }
  const prev = req.orderId ? s.orders?.medications.find((m) => m.id === req.orderId) : undefined;
  const order: MedicationOrder = {
    id: prev?.id ?? uid("mo"), drugText: req.drugText, generic: d?.generic ?? null, drugClass: d?.cls ?? null, dose: req.dose, doseMg: mg ? Number(mg) : undefined,
    route: req.route, frequency: req.frequency, duration: req.duration, orderedBy: req.orderedBy, at: now(), status: "draft", checks, overrides: [],
  };
  const meds = prev ? s.orders!.medications.map((m) => (m.id === prev.id ? order : m)) : [...(s.orders?.medications ?? []), order];
  return { ...s, orders: { medications: meds, investigations: s.orders?.investigations ?? [] } };
}

export function fixtureMedStatus(s: IntakeSession, orderId: string, patch: (m: MedicationOrder) => Partial<MedicationOrder>): IntakeSession {
  return { ...s, orders: { medications: (s.orders?.medications ?? []).map((m) => (m.id === orderId ? { ...m, ...patch(m) } : m)), investigations: s.orders?.investigations ?? [] } };
}

export function fixtureInvestigation(s: IntakeSession, by: string, code: string, label: Localized, category: InvestigationOrder["category"], reason?: string, fromSuggestionId?: string): IntakeSession {
  const inv: InvestigationOrder = { id: uid("io"), code, label, category, reason, fromSuggestionId, orderedBy: by, at: now(), status: "submitted" };
  return { ...s, orders: { medications: s.orders?.medications ?? [], investigations: [...(s.orders?.investigations ?? []), inv] } };
}
