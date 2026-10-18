import { describe, expect, it } from "vitest";
import type { ExtractedField, IntakeSession, MedAlert, MedicationOrder, OpsMetrics, RedFlagHit, SessionStatus } from "@medx/shared";
import { healthHardware, highAlertsOpen, isEmptySession, isEmergency, isHealth, isMetrics, isModelFlag, isSessions, orderedQueue, pendingEscalations, pharmacyStages, readyForPickup, recordedCalls, triageView, verifiedComplaint, waitingSeconds } from "./ops-data";

const localized = { en: "headache", it: "mal di testa", th: "ปวดหัว" };
const field: ExtractedField = { key: "chief_complaint", value: localized, valueOriginal: "headache", status: "supported", confidence: 0.9, required: true, evidence: [{ turnId: "turn-1", quote: "headache", start: 0, end: 8 }] };
const flag: RedFlagHit = { ruleId: "RF-TEST-01", severity: "emergency", label: localized, action: localized, patientMessage: localized, evidence: field.evidence };
function session(status: SessionStatus = "collecting", id: string = status): IntakeSession {
  return { id, code: id, status, patientLang: "en", createdAt: "2026-10-17T00:00:00Z", updatedAt: "2026-10-17T00:01:00Z", turns: [{ id: "turn-1", role: "patient", text: "headache", lang: "en", at: "2026-10-17T00:00:00Z" }], summary: { sessionId: id, fields: [structuredClone(field)], redFlags: [], nextQuestion: null, abstained: false, modelCalls: [], generatedAt: "2026-10-17T00:01:00Z" } };
}
const metrics: OpsMetrics = { sessionsToday: 0, escalations: 0, byStatus: { collecting: 0, escalated: 0, awaiting_review: 0, needs_human: 0, approved: 0, taken_over: 0 }, autoCapturedRate: 0, abstainRate: 0, medianReviewSeconds: null, modelLatencyMs: { p50: null, p95: 0 }, provider: { name: "mock", model: "deterministic-mock", hardware: "mock" } };

describe("ops queue and evidence boundary", () => {
  it("orders every status and pins emergency escalations without mutating the response", () => {
    const urgent = session("escalated", "urgent");
    urgent.summary!.redFlags = [{ ...flag, severity: "urgent" }];
    const emergency = session("escalated", "emergency");
    emergency.createdAt = "2026-10-17T01:00:00Z";
    emergency.summary!.redFlags = [flag];
    const input = [session("approved"), session("collecting"), urgent, session("awaiting_review"), session("taken_over"), session("needs_human"), emergency];
    expect(orderedQueue(input).map(s => s.id)).toEqual(["emergency", "urgent", "needs_human", "awaiting_review", "collecting", "approved", "taken_over"]);
    expect(input[0].id).toBe("approved");
  });
  it("sorts oldest first within a status", () => {
    const newer = session("collecting", "newer");
    newer.createdAt = "2026-10-17T01:00:00Z";
    expect(orderedQueue([newer, session("collecting", "older")]).map(s => s.id)).toEqual(["older", "newer"]);
  });
  it("keeps an emergency ahead of an escalation with no summary", () => {
    const incomplete = { ...session("escalated", "incomplete"), summary: null };
    const emergency = session("escalated", "emergency");
    emergency.createdAt = "2026-10-17T01:00:00Z";
    emergency.summary!.redFlags = [flag];
    expect(isEmergency(incomplete)).toBe(false);
    expect(orderedQueue([incomplete, emergency]).map(s => s.id)).toEqual(["emergency", "incomplete"]);
  });
  it("retains a clinician-reviewed flag without clearing the API escalation", () => {
    const s = session("escalated");
    s.summary!.redFlags = [{ ...flag, review: { action: "false_alarm", reviewerId: "test", at: s.createdAt } }];
    expect(isEmergency(s)).toBe(true);
    expect(isModelFlag({ ruleId: "MODEL-test" })).toBe(true);
    expect(isModelFlag({ ruleId: flag.ruleId })).toBe(false);
  });
  it("permits supported text only when patient offsets reproduce the quote", () => {
    const s = session();
    expect(verifiedComplaint(s).status).toBe("supported");
    s.summary!.fields[0].evidence[0].end = 80;
    expect(verifiedComplaint(s).status).toBe("unsupported");
    s.summary!.fields[0].evidence[0] = { turnId: "turn-1", quote: "headache", start: 1, end: 8 };
    expect(verifiedComplaint(s).status).toBe("unsupported");
  });
  it("rejects assistant evidence and unquoted clinician-approved text", () => {
    const s = session();
    s.turns[0].role = "assistant";
    expect(verifiedComplaint(s).status).toBe("unsupported");
    s.summary!.fields[0].status = "approved";
    s.summary!.fields[0].evidence = [];
    expect(verifiedComplaint(s).status).toBe("unsupported");
    s.summary = null;
    expect(verifiedComplaint(s).value).toBeNull();
  });
  it("stops waiting for completed intakes and never displays a negative wait", () => {
    expect(waitingSeconds(session("approved"), Date.parse("2026-10-17T00:10:00Z"))).toBeNull();
    expect(waitingSeconds(session("taken_over"), 0)).toBeNull();
    expect(waitingSeconds(session(), 0)).toBe(0);
    expect(waitingSeconds(session(), Date.parse("2026-10-17T00:10:00Z"))).toBe(600);
  });
});

describe("ops data integrity", () => {
  it("counts pending intakes once and opens the oldest regardless of severity", () => {
    const oldest = session("escalated", "oldest");
    oldest.summary!.redFlags = [{ ...flag, severity: "urgent" }, { ...flag, severity: "urgent" }];
    const newer = session("escalated", "newer");
    newer.createdAt = "2026-10-17T02:00:00Z";
    newer.summary!.redFlags = [flag];
    const reviewed = session("escalated", "reviewed");
    reviewed.summary!.redFlags = [{ ...flag, review: { action: "acknowledge", reviewerId: "nurse", at: reviewed.updatedAt } }];
    expect(pendingEscalations([newer, reviewed, oldest]).map(s => s.id)).toEqual(["oldest", "newer"]);
    expect(pendingEscalations([{ ...oldest, summary: null }])).toHaveLength(1);
    reviewed.summary!.redFlags[0].review!.action = "false_alarm";
    expect(pendingEscalations([reviewed])).toHaveLength(0);
  });
  it("hides only empty sessions without safety flags", () => {
    const empty = { ...session(), turns: [] };
    expect(isEmptySession(empty)).toBe(true);
    expect(isEmptySession(session())).toBe(false);
    expect(isEmptySession({ ...empty, status: "escalated" })).toBe(false);
    empty.summary!.redFlags = [flag];
    expect(isEmptySession(empty)).toBe(false);
  });
  it("counts only high medication alerts still awaiting a pharmacist review", () => {
    const s = session();
    const alert: MedAlert = { id: "high", ruleId: "MR-ALLERGY-01", kind: "allergy_conflict", severity: "high", message: localized, action: localized, medIds: [], allergyIds: [], evidence: [], source: "synthetic" };
    s.summary!.medAlerts = [alert, { ...alert, id: "moderate", severity: "moderate" }, { ...alert, id: "reviewed", review: { action: "acknowledge", reviewerId: "pharmacist", at: s.updatedAt } }];
    expect(highAlertsOpen([s])).toBe(1);
  });
  it("also counts high prescribing checks on orders waiting for pharmacist 1, and nothing else", () => {
    const s = session();
    const alert: MedAlert = { id: "high", ruleId: "MR-ALLERGY-01", kind: "allergy_conflict", severity: "high", message: localized, action: localized, medIds: [], allergyIds: [], evidence: [], source: "synthetic" };
    s.summary!.medAlerts = [alert];
    const order = (id: string, status: MedicationOrder["status"], checks: MedAlert[], extra: Partial<MedicationOrder> = {}): MedicationOrder =>
      ({ id, drugText: "amoxicillin", generic: "amoxicillin", drugClass: "penicillin", dose: "500 mg", route: "oral", frequency: "every 8 hours", orderedBy: "Dr. Test", at: s.createdAt, status, checks, overrides: [], ...extra });
    s.orders = { investigations: [], medications: [
      // waiting for pharmacist 1: the high check counts even with a prescriber override, the moderate one does not
      order("o1", "submitted", [{ ...alert, id: "c1" }, { ...alert, id: "c2", severity: "moderate" }], { overrides: [{ alertId: "c1", reason: "Reviewed, synthetic", by: "Dr. Test", at: s.createdAt }] }),
      // re-check: back with pharmacist 1
      order("o2", "submitted", [{ ...alert, id: "c3" }], { recheck: { reason: "new_high_alert", alertIds: ["c3"], at: s.createdAt } }),
      // a pharmacist already acted, or the order never reached the pharmacy
      order("o3", "verified", [{ ...alert, id: "c4" }]),
      order("o4", "returned", [{ ...alert, id: "c5" }]),
      order("o5", "dispensed", [{ ...alert, id: "c6" }]),
      order("o6", "draft", [{ ...alert, id: "c7" }]),
      order("o7", "cancelled", [{ ...alert, id: "c8" }]),
    ] };
    expect(highAlertsOpen([s])).toBe(3); // 1 reconciliation alert + c1 + c3
    expect(highAlertsOpen([{ ...s, summary: null }])).toBe(2);
    // malformed orders never throw and never count
    expect(highAlertsOpen([{ ...s, summary: null, orders: { investigations: [], medications: [null, { status: "submitted" }, { status: "submitted", checks: [null, { severity: "high" }] }] } } as unknown as IntakeSession])).toBe(1);
  });
  it("shows confirmed triage as the clinician's level and a suggestion only as a suggestion", () => {
    const s = session();
    expect(triageView(s)).toEqual({ kind: "none" });
    s.triage = { suggestedLevel: 3, reasons: [], vitalAlerts: [] };
    expect(triageView(s)).toEqual({ kind: "suggested", level: 3 });
    s.triage.confirmed = { level: 2, by: "Nurse Test", at: s.createdAt };
    expect(triageView(s)).toEqual({ kind: "confirmed", level: 2, by: "Nurse Test" });
    expect(triageView({ ...s, triage: { suggestedLevel: 9, reasons: [], vitalAlerts: [] } } as unknown as IntakeSession)).toEqual({ kind: "none" });
  });
  it("uses health hardware verbatim and never invents an AMD claim for mock", () => {
    expect(isHealth({ provider: "mock", model: "deterministic-mock" })).toBe(true);
    expect(isHealth({ provider: "mock", model: "test", hardware: 1 })).toBe(false);
    expect(healthHardware({ provider: "mock", model: "test", hardware: "None (mock)" })).toBe("None (mock)");
    expect(healthHardware({ provider: "mock", model: "test", hardware: "AMD" })).toBeUndefined();
    expect(healthHardware({ provider: "mock", model: "test", hardware: "\u2014" })).toBeUndefined();
    expect(healthHardware({ provider: "amd-tokenfactory", model: "test", hardware: "AMD MI300X" })).toBe("AMD MI300X");
  });
  it("accepts empty snapshots, null measurements and real zero measurements", () => {
    expect(isSessions([])).toBe(true);
    expect(isSessions([session()])).toBe(true);
    expect(isMetrics(metrics)).toBe(true);
    expect(isMetrics({ ...metrics, medianReviewSeconds: 0 })).toBe(true);
  });
  it("rejects malformed responses rather than inventing a zero or partial queue", () => {
    expect(isSessions({ sessions: [] })).toBe(false);
    expect(isSessions([{ ...session(), status: "unknown" }])).toBe(false);
    expect(isSessions([{ ...session(), summary: { fields: [] } }])).toBe(false);
    expect(isMetrics({ ...metrics, autoCapturedRate: 2 })).toBe(false);
    expect(isMetrics({ ...metrics, medianReviewSeconds: undefined })).toBe(false);
    expect(isMetrics({ ...metrics, modelLatencyMs: { p50: Number.NaN, p95: 0 } })).toBe(false);
    expect(isMetrics({ ...metrics, provider: { name: "mock" } })).toBe(false);
  });
  it("accepts an absent pharmacy block and rejects a malformed one instead of showing zeros", () => {
    const pharmacy = { toVerify: 2, toDispense: 1, readyForPickup: 1, collectedToday: 0 };
    expect(isMetrics({ ...metrics, pharmacy })).toBe(true);
    expect(isMetrics(metrics)).toBe(true);
    expect(isMetrics({ ...metrics, pharmacy: { ...pharmacy, toDispense: 1.5 } })).toBe(false);
    expect(isMetrics({ ...metrics, pharmacy: { ...pharmacy, collectedToday: -1 } })).toBe(false);
    expect(isMetrics({ ...metrics, pharmacy: { toVerify: 2 } })).toBe(false);
    expect(isMetrics({ ...metrics, pharmacy: null })).toBe(false);
  });
  it("lists only patients called and not yet collected, longest wait first, with code and counter only", () => {
    const later = { ...session("approved", "later"), pickup: { status: "ready" as const, counter: " 2 ", calledBy: "Pharmacist B", calledAt: "2026-10-17T03:00:00Z" } };
    const earlier = { ...session("approved", "earlier"), pickup: { status: "ready" as const, calledBy: "Pharmacist B", calledAt: "2026-10-17T02:00:00Z" } };
    const collected = { ...session("approved", "collected"), pickup: { status: "collected" as const, calledBy: "Pharmacist B", calledAt: "2026-10-17T01:00:00Z", collectedBy: "Pharmacist B", collectedAt: "2026-10-17T01:10:00Z" } };
    const malformed = { ...session("approved", "malformed"), pickup: { status: "ready", calledAt: "not a date" } } as unknown as IntakeSession;
    const rows = readyForPickup([later, session("approved", "none"), collected, malformed, earlier]);
    expect(rows).toEqual([{ id: "earlier", code: "earlier", calledAt: "2026-10-17T02:00:00Z" }, { id: "later", code: "later", calledAt: "2026-10-17T03:00:00Z", counter: "2" }]);
    expect(JSON.stringify(rows)).not.toContain("Pharmacist");
    expect(pharmacyStages).toEqual(["toVerify", "toDispense", "readyForPickup", "collectedToday"]);
  });
  it("keeps failed and zero-latency calls with their original provider/model", () => {
    const s = session();
    s.summary!.modelCalls = [{ step: "extract", latencyMs: 0, ok: true, provider: "mock", model: "original-model" }, { step: "red_flags", latencyMs: 200, ok: false, provider: "amd-tokenfactory", model: "gemma" }];
    const calls = recordedCalls([s]);
    expect(calls.map(c => [c.step, c.latencyMs, c.ok, c.provider, c.model])).toEqual([["extract", 0, true, "mock", "original-model"], ["red_flags", 200, false, "amd-tokenfactory", "gemma"]]);
    expect(recordedCalls([{ ...s, summary: null }])).toEqual([]);
  });
});
