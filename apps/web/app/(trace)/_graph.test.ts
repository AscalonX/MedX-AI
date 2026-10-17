import { describe, expect, it } from "vitest";
import type { AuditEvent, IntakeSession, MedicationOrder } from "@medx/shared";
import { deriveTrace } from "../../lib/pipeline/trace";
import { edgeLabel, layoutTrace, summarize } from "./_graph";
import { fixtureTrace } from "./_fixture";

const at = (m: number) => new Date(Date.UTC(2026, 9, 17, 9, m)).toISOString();
const checklist = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const order: MedicationOrder = {
  id: "o1", drugText: "paracetamol 500 mg", generic: "paracetamol", drugClass: "analgesic", dose: "500 mg", route: "oral", frequency: "every 6 hours",
  orderedBy: "Doctor A", at: at(1), status: "dispensed", checks: [], overrides: [],
  pharmacist: { action: "verify", by: "Pharmacist A", at: at(2) }, dispense: { by: "Pharmacist B", at: at(3), checklist },
};
const session: IntakeSession = {
  id: "s1", code: "B-001", patientLang: "en", status: "approved", turns: [], summary: null,
  orders: { medications: [order], investigations: [] },
  pickup: { status: "collected", counter: "2", calledBy: "Pharmacist B", calledAt: at(4), collectedBy: "Pharmacist B", collectedAt: at(5) },
  createdAt: at(0), updatedAt: at(5),
};
const ev = (id: string, m: number, type: AuditEvent["type"], payload: Record<string, unknown>, actorId?: string): AuditEvent =>
  ({ id, sessionId: "s1", at: at(m), actor: actorId ? "clinician" : "system", ...(actorId ? { actorId } : {}), type, payload });
const audit: AuditEvent[] = [
  ev("a1", 0, "session_created", {}),
  ev("a2", 1, "order_submitted", { orderId: "o1", overrides: [] }, "Doctor A"),
  ev("a3", 2, "order_pharmacy_action", { orderId: "o1", action: "verify", by: "Pharmacist A", at: at(2) }, "Pharmacist A"),
  ev("a4", 3, "order_dispensed", { orderId: "o1", verifiedBy: "Pharmacist A", by: "Pharmacist B", at: at(3), checklist }, "Pharmacist B"),
  ev("a5", 4, "pickup_called", { orderIds: ["o1"], recall: false, counter: "2" }, "Pharmacist B"),
  ev("a6", 5, "pickup_collected", { calledBy: "Pharmacist B", calledAt: at(4), orderIds: ["o1"] }, "Pharmacist B"),
];

describe("case trace: pharmacy chain", () => {
  it("lays out verify, dispense, call and collected left to right with their labels and details", () => {
    const trace = deriveTrace(session, audit);
    const layout = layoutTrace(trace.nodes, trace.edges);
    expect(layout.placed).toHaveLength(trace.nodes.length);
    const pharm = layout.placed.filter(p => p.node.kind === "pharmacist_action").sort((a, b) => a.node.at.localeCompare(b.node.at));
    expect(pharm.map(p => p.node.label.en)).toEqual(["Pharmacist 1: prescription verified", "Pharmacist 2: dispensed", "Patient called to collect", "Medicines collected"]);
    expect(pharm.map(p => p.node.label.th).every(Boolean)).toBe(true);
    expect(pharm.map(p => p.node.label.it).every(Boolean)).toBe(true);
    // Each step sits one column to the right of the step it follows.
    expect(pharm.map(p => p.layer)).toEqual([...pharm.map(p => p.layer)].sort((a, b) => a - b));
    expect(new Set(pharm.map(p => p.layer)).size).toBe(4);
    expect(pharm[1].node.detail.en).toBe("Final double check 6 of 6 items confirmed by a second pharmacist");
    const second = layout.curves.find(c => c.from === pharm[0].node.id && c.to === pharm[1].node.id);
    expect(second?.label).toBe("second check");
    expect(edgeLabel(second?.label, "th")).toBe("ตรวจซ้ำโดยคนที่สอง");
    expect(summarize(trace.nodes).humans).toBe(4);
  });
  it("exports JSON that round-trips and carries no staff names", () => {
    const trace = deriveTrace(session, audit);
    const json = JSON.stringify(trace, null, 2);
    expect(JSON.parse(json)).toEqual(trace);
    expect(json).not.toContain("Pharmacist A");
    expect(json).not.toContain("Pharmacist B");
    expect(json).not.toContain("paracetamol");
  });
  it("keeps the fixture graph in step with the route: pharmacy chain after clinician review", () => {
    const fx = fixtureTrace("s1");
    const layout = layoutTrace(fx.nodes, fx.edges);
    const layer = (id: string) => layout.placed.find(p => p.node.id === id)!.layer;
    expect(["n7", "n8", "n9", "n10", "n11", "n12"].map(layer)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(fx.nodes.filter(n => n.kind === "pharmacist_action")).toHaveLength(4);
    expect(summarize(fx.nodes).escalatedAt).toBe(3);
  });
  it("localizes known edge labels and passes unknown ones through", () => {
    expect(edgeLabel("orders", "it")).toBe("ordini");
    expect(edgeLabel("escalated", "en")).toBe("escalated");
    expect(edgeLabel("new-edge", "th")).toBe("new-edge");
    expect(edgeLabel(undefined, "en")).toBeUndefined();
  });
});
