// The pharmacy UI against the real route handlers: the request bodies the shell builds are accepted,
// responses are the updated session (what the shell swaps in), and the fixture-mode mirrors in _lib refuse
// with the server's own words. No dev server is needed.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeSession, MedicationOrder, PharmacyOrderActionReq } from "@medx/shared";
import { addTurn, createSession } from "../../lib/pipeline/pipeline";
import { medicationAction, medicationOrder } from "../../lib/pipeline/orders";
import { getSession } from "../../lib/pipeline/store";
import { POST as postPharmacy } from "../api/sessions/[id]/orders/medications/[orderId]/pharmacy/route";
import { POST as postDispense } from "../api/sessions/[id]/orders/medications/[orderId]/dispense/route";
import { POST as postPickup } from "../api/sessions/[id]/pickup/route";
import { PHARMACISTS, applyDispense, applyOrderAction, applyPickup, canCall, samePerson, stageRows } from "./_lib";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "medx-pharmacy-ui-"));
  vi.stubEnv("MEDX_STORE_PATH", path.join(dir, "store.json")); vi.stubEnv("MODEL_PROVIDER", "mock");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const [P1, P2] = PHARMACISTS;
const doctor = "Dr. Marco Bianchi";
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const req = (value: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(value) });
const ctx = (id: string, orderId = "") => ({ params: Promise.resolve({ id, orderId }) });
const orderOf = (s: IntakeSession, id: string) => s.orders!.medications.find((o) => o.id === id)! as MedicationOrder;
/** What the shell does with a response: accept only a session with the same id. */
async function accepted(res: Response, id: string) {
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(200);
  expect(body.id).toBe(id);
  return body as IntakeSession;
}
async function refused(res: Response, status: number) {
  expect(res.status).toBe(status);
  return ((await res.json()) as { error: string }).error;
}
/** The local mirror's message for the same request on the same state. */
const localMessage = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return (e as Error).message; } };

describe("two-stage pharmacy against the live routes", () => {
  it("return with report, verify, two-person dispense, call, collect", async () => {
    const id = (await addTurn(createSession("en").id, "I have a headache since today. No allergies.")).id;
    let s = await medicationOrder(id, { orderedBy: doctor, drugText: "paracetamol", dose: "500 mg", route: "oral", frequency: "every 6 hours", duration: "3 days" });
    const oid = s.orders!.medications.at(-1)!.id;
    const submit = async () => { const o = orderOf(getSession(id)!, oid); await medicationAction(id, oid, "submit", { orderedBy: doctor, overrides: o.checks.filter((c) => c.severity === "high").map((c) => ({ alertId: c.id, reason: "Reviewed synthetic case" })) }); };
    await submit();
    s = getSession(id)!;
    expect(stageRows([{ session: s }], Date.now()).verify).toHaveLength(1);

    // Stage 1 return: body exactly as the shell's submitOrder builds it for a return with a report.
    const checkIds = orderOf(s, oid).checks.map((c) => c.id);
    const ret: PharmacyOrderActionReq = { reviewerId: P1, action: "return", note: "Please confirm the daily total.", alertIds: checkIds.slice(0, 1), suggestedGenerics: ["ibuprofen"] };
    const local = applyOrderAction(s, oid, ret, "t");
    s = await accepted(await postPharmacy(req(ret), ctx(id, oid)), id);
    expect(orderOf(s, oid).status).toBe("returned");
    expect(orderOf(s, oid).pharmacist?.report).toEqual(orderOf(local, oid).pharmacist?.report);

    // Ordered generic as a suggestion: same refusal locally and on the server.
    await submit(); s = getSession(id)!;
    const bad: PharmacyOrderActionReq = { ...ret, suggestedGenerics: ["paracetamol"] };
    expect(await refused(await postPharmacy(req(bad), ctx(id, oid)), 400)).toBe(localMessage(() => applyOrderAction(s, oid, bad, "t")));

    // Stage 1 verify: no report travels with a verify.
    s = await accepted(await postPharmacy(req({ reviewerId: P1, action: "verify" }), ctx(id, oid)), id);
    expect(orderOf(s, oid)).toMatchObject({ status: "verified", pharmacist: { action: "verify", by: P1 } });
    expect(orderOf(s, oid).pharmacist?.report).toBeUndefined();
    expect(stageRows([{ session: s }], Date.now()).dispense).toHaveLength(1);

    // Calling before dispensing: refused, same words.
    const early = { reviewerId: P1, action: "call" as const, counter: "1" };
    expect(await refused(await postPickup(req(early), ctx(id)), 409)).toBe(localMessage(() => applyPickup(s, early, "t")));

    // Stage 2 by the verifier: the UI disables it (samePerson); the server refuses it with the same words as the mirror.
    expect(samePerson(orderOf(s, oid).pharmacist?.by, P1)).toBe(true);
    const mine = { reviewerId: P1, checklist: ALL };
    const msg = await refused(await postDispense(req(mine), ctx(id, oid)), 409);
    expect(msg).toMatch(/second pharmacist/i);
    expect(msg).toBe(localMessage(() => applyDispense(s, oid, mine, "t")));
    const partial = { reviewerId: P2, checklist: { ...ALL, labelled: false } };
    expect(await refused(await postDispense(req(partial), ctx(id, oid)), 400)).toBe(localMessage(() => applyDispense(s, oid, partial, "t")));

    s = await accepted(await postDispense(req({ reviewerId: P2, checklist: ALL, note: "Label printed in English" }), ctx(id, oid)), id);
    expect(orderOf(s, oid)).toMatchObject({ status: "dispensed", dispense: { by: P2, note: "Label printed in English" } });
    expect(canCall(s)).toBe(true);
    expect(stageRows([{ session: s }], Date.now()).call).toHaveLength(1);

    // Pickup.
    s = await accepted(await postPickup(req({ reviewerId: P2, action: "call", counter: "2" }), ctx(id)), id);
    expect(s.pickup).toMatchObject({ status: "ready", counter: "2", calledBy: P2 });
    expect(stageRows([{ session: s }], Date.now()).ready).toHaveLength(1);
    s = await accepted(await postPickup(req({ reviewerId: P2, action: "collected" }), ctx(id)), id);
    expect(s.pickup).toMatchObject({ status: "collected", collectedBy: P2 });
    expect(stageRows([{ session: s }], Date.now()).collected).toHaveLength(1);
    const again = { reviewerId: P2, action: "call" as const };
    expect(await refused(await postPickup(req(again), ctx(id)), 409)).toBe(localMessage(() => applyPickup(s, again, "t")));
  });
});
