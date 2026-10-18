import { describe, expect, it } from "vitest";
import { JOURNEY_STAGE_LABELS, type IntakeSession, type MedicationOrder, type RedFlagHit, type SessionStatus } from "@medx/shared";
import { T as ORDERS_T } from "../../(orders)/_lib";
import { T } from "./_i18n";
import { sortQueue } from "./_lib";
import { stageWords } from "./_stage";
import { C } from "./[id]/consult/_c18n";

const base = "2026-10-18T08:00:00Z";
const minutes = (m: number) => new Date(Date.parse(base) + m * 60000).toISOString();
const flag = (severity: RedFlagHit["severity"]): RedFlagHit => ({ ruleId: `RF-${severity}`, severity, label: { en: "x", th: "x", it: "x" }, action: { en: "x", th: "x", it: "x" }, patientMessage: { en: "x", th: "x", it: "x" }, evidence: [], source: "rule" } as unknown as RedFlagHit);
const s = (code: string, status: SessionStatus, createdMin: number, extra: Partial<IntakeSession> = {}): IntakeSession => ({
  id: code, code, patientLang: "en", status, turns: [], summary: null, createdAt: minutes(createdMin), updatedAt: minutes(createdMin), ...extra,
});
const triaged = (level: 1 | 2 | 3 | 4 | 5): Partial<IntakeSession> => ({
  triage: { suggestedLevel: level, reasons: [], vitalAlerts: [], confirmed: { level, by: "Nurse Anna Rossi", at: base } },
});
const withFlags = (sev: RedFlagHit["severity"]): Partial<IntakeSession> => ({ summary: { redFlags: [flag(sev)] } as unknown as IntakeSession["summary"] });

describe("queue order (S-01)", () => {
  it("keeps escalated first (emergency before urgent), then orders each group by confirmed triage level, then by wait", () => {
    const list = [
      s("B-010", "awaiting_review", 1),
      s("B-011", "awaiting_review", 2, triaged(3)),
      s("B-012", "awaiting_review", 3, triaged(1)),
      s("B-013", "awaiting_review", 0, triaged(3)),
      s("B-014", "escalated", 9, withFlags("urgent")),
      s("B-015", "escalated", 10, withFlags("emergency")),
      s("B-016", "needs_human", 4, triaged(2)),
      s("B-017", "needs_human", 0),
      s("B-018", "approved", 5, triaged(4)),
      s("B-019", "approved", 6, triaged(2)),
    ];
    expect(sortQueue(list).map((x) => x.code)).toEqual([
      "B-015", "B-014", // escalated: emergency, then urgent
      "B-012", "B-013", "B-011", "B-010", // awaiting: level 1, level 3 (older first), unconfirmed last
      "B-016", "B-017", // needs human: level 2, then unconfirmed
      "B-019", "B-018", // approved: level 2, then level 4
    ]);
  });

  it("does not drop or duplicate a case and keeps the row type", () => {
    const rows = [s("B-001", "approved", 0), s("B-002", "collecting", 1)].map((x) => ({ ...x, stage: "intake" as const }));
    const out = sortQueue(rows);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.stage === "intake")).toBe(true);
  });
});

describe("stage chip words", () => {
  const order = (status: MedicationOrder["status"]): MedicationOrder => ({ id: status, drugText: "d", generic: "d", drugClass: null, dose: "1", route: "oral", frequency: "daily", orderedBy: "Dr", at: base, status, checks: [], overrides: [] });
  it("uses the shared journey label, made precise for dispensed-not-called and the pickup counter", () => {
    expect(stageWords({ orders: { medications: [], investigations: [] } }, "nurse_done")).toEqual(JOURNEY_STAGE_LABELS.nurse_done);
    expect(stageWords({ orders: { medications: [order("verified")], investigations: [] } }, "pharmacy_dispense")).toEqual(JOURNEY_STAGE_LABELS.pharmacy_dispense);
    expect(stageWords({ orders: { medications: [order("dispensed")], investigations: [] } }, "pharmacy_dispense").en).toBe("Dispensed, patient not called");
    expect(stageWords({ orders: { medications: [order("dispensed")], investigations: [] }, pickup: { status: "ready", counter: "2", calledBy: "P", calledAt: base } }, "ready_for_pickup").en).toBe("Ready to collect, counter 2");
  });
});

describe("clinician strings", () => {
  const vars = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const [name, table] of [["review", T], ["consult", C], ["orders", ORDERS_T]] as const) {
    it(`${name}: every string exists in en, th and it with the same placeholders, and no dashes`, () => {
      for (const [k, v] of Object.entries(table)) for (const lang of ["en", "th", "it"] as const) {
        expect(v[lang]?.trim(), `${k}.${lang}`).toBeTruthy();
        expect(vars(v[lang]), `${k}.${lang}`).toBe(vars(v.en));
        expect(v[lang], `${k}.${lang}`).not.toMatch(/[—–]/);
      }
    });
  }
  it("labels a sent investigation honestly in every language (C-05)", () => {
    expect(ORDERS_T.invSent.en).toBe("Sent (no lab system in this prototype)");
    expect(ORDERS_T.invSent.it).toMatch(/laboratorio/);
    expect(ORDERS_T.invSent.th).toMatch(/ห้องปฏิบัติการ/);
    for (const lang of ["en", "th", "it"] as const) expect(ORDERS_T.invSent[lang]).not.toMatch(/verif|result|risultat|ผลตรวจ/i);
  });
});
