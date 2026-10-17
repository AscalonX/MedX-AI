import { describe, expect, it } from "vitest";
import type { ExtractedField, IntakeSession, OpsMetrics, RedFlagHit, SessionStatus } from "@medx/shared";
import { isEmergency, isMetrics, isModelFlag, isSessions, orderedQueue, recordedCalls, verifiedComplaint, waitingSeconds } from "./ops-data";

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
  it("keeps failed and zero-latency calls with their original provider/model", () => {
    const s = session();
    s.summary!.modelCalls = [{ step: "extract", latencyMs: 0, ok: true, provider: "mock", model: "original-model" }, { step: "red_flags", latencyMs: 200, ok: false, provider: "amd-tokenfactory", model: "gemma" }];
    const calls = recordedCalls([s]);
    expect(calls.map(c => [c.step, c.latencyMs, c.ok, c.provider, c.model])).toEqual([["extract", 0, true, "mock", "original-model"], ["red_flags", 200, false, "amd-tokenfactory", "gemma"]]);
    expect(recordedCalls([{ ...s, summary: null }])).toEqual([]);
  });
});
