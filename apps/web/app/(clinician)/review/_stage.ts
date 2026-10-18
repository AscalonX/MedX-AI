import { JOURNEY_STAGE_LABELS, type IntakeSession, type JourneyStage, type Localized, type MedicationOrder } from "@medx/shared";
import { T, fmt } from "./_i18n";

/** Pharmacy stage of a case, for a neutral status chip in the queue and the case header. */
export type PharmacyStage = "toVerify" | "toDispense" | "toCall" | "ready" | "collected";

/**
 * Active pharmacy work (an order waiting for pharmacist 1 or pharmacist 2) wins over an earlier pickup.
 * "toCall" mirrors the pickup rule: every non-cancelled medication order is dispensed and nobody has
 * called the patient yet. Returned orders have their own chip and drafts are still with the prescriber,
 * so neither sets a stage by itself.
 */
export function pharmacyStage(s: IntakeSession): PharmacyStage | null {
  const active = (s.orders?.medications ?? []).filter((o) => o.status !== "cancelled");
  const any = (status: MedicationOrder["status"]) => active.some((o) => o.status === status);
  if (any("submitted")) return "toVerify";
  if (any("verified")) return "toDispense";
  if (s.pickup?.status === "ready") return "ready";
  if (s.pickup?.status === "collected") return "collected";
  if (active.length > 0 && active.every((o) => o.status === "dispensed")) return "toCall";
  return null;
}

/** Report a pharmacist attached to a return: flagged checks of this order and generics for the prescriber to review. */
export function returnReport(o: MedicationOrder) {
  const report = o.pharmacist?.action === "return" ? o.pharmacist.report : undefined;
  if (!report) return null;
  const flagged = report.alertIds.map((id) => o.checks.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const options = [...new Set(report.suggestedGenerics.filter((g) => g.trim()))];
  return flagged.length || options.length ? { flagged, options } : null;
}

/**
 * Words for the journey stage chip (S-01). The shared JOURNEY_STAGE_LABELS word, made more precise where the
 * pharmacy record says more: "Dispensed, patient not called" and the pickup counter. A neutral marker only:
 * it never decides urgency (red flags and triage do).
 */
export function stageWords(s: Pick<IntakeSession, "orders" | "pickup">, stage: JourneyStage): Localized {
  if (stage === "pharmacy_dispense" && pharmacyStage(s as IntakeSession) === "toCall") return T.stDispensedNotCalled;
  if (stage === "ready_for_pickup" && s.pickup?.counter) {
    const n = s.pickup.counter;
    return { en: fmt(T.stReadyCounter.en, { n }), th: fmt(T.stReadyCounter.th, { n }), it: fmt(T.stReadyCounter.it, { n }) };
  }
  return JOURNEY_STAGE_LABELS[stage];
}
