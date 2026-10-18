// Where a visit is in the clinic journey, derived from the record only (pure, no I/O, no model).
// A neutral label for queues and headers; it never decides urgency (triage and red flags do that).
import type { ConsultMode, ConsultNote, IntakeSession, Localized } from "./types";

export type JourneyStage =
  | "intake" // patient is answering, or the intake waits for a clinician
  | "intake_reviewed" // a clinician approved or took over the intake, or reviewed every red flag
  | "triaged" // a nurse confirmed a triage level
  | "nurse_done" // triaged and the consult has moved on (consult speech or a consult note exists)
  | "doctor_signed" // the doctor signed the consult note
  | "orders_submitted" // orders left the prescriber, none waiting on the pharmacy (investigations, or a medicine returned to the prescriber)
  | "pharmacy_verify" // a medication order waits for pharmacist 1
  | "pharmacy_dispense" // a verified order waits for pharmacist 2, or dispensed medicines wait for the patient call
  | "ready_for_pickup" // the patient was called to the counter
  | "collected"; // the patient collected the medicines

/** Journey order, earliest first. */
export const JOURNEY_STAGES: readonly JourneyStage[] = [
  "intake", "intake_reviewed", "triaged", "nurse_done", "doctor_signed", "orders_submitted",
  "pharmacy_verify", "pharmacy_dispense", "ready_for_pickup", "collected",
];

/** Word labels for stage chips (never colour alone). Thai and Italian need native-speaker review. */
export const JOURNEY_STAGE_LABELS: Record<JourneyStage, Localized> = {
  intake: { en: "Intake", it: "Accoglienza", th: "ซักประวัติ" },
  intake_reviewed: { en: "Intake reviewed", it: "Accoglienza rivista", th: "ทบทวนประวัติแล้ว" },
  triaged: { en: "Triaged", it: "Triage confermato", th: "คัดแยกแล้ว" },
  nurse_done: { en: "Ready for doctor", it: "Pronto per il medico", th: "พร้อมพบแพทย์" },
  doctor_signed: { en: "Doctor signed", it: "Firmato dal medico", th: "แพทย์ลงนามแล้ว" },
  orders_submitted: { en: "Orders sent", it: "Ordini inviati", th: "ส่งคำสั่งแล้ว" },
  pharmacy_verify: { en: "Pharmacy check", it: "Controllo in farmacia", th: "เภสัชกรตรวจสอบ" },
  pharmacy_dispense: { en: "Dispensing", it: "In dispensazione", th: "กำลังจ่ายยา" },
  ready_for_pickup: { en: "Ready to collect", it: "Pronto per il ritiro", th: "พร้อมรับยา" },
  collected: { en: "Collected", it: "Ritirato", th: "รับยาแล้ว" },
};

/** The parts of a session the stage reads. Any IntakeSession fits. */
export type JourneySession = Pick<IntakeSession, "status" | "turns" | "summary" | "triage" | "orders" | "pickup">;
/** Consult notes only; the engine's consult record fits this shape. `null` when no consult exists. */
export interface JourneyConsult { notes?: Partial<Record<ConsultMode, ConsultNote | undefined>> }

/**
 * Furthest milestone the record shows. Pharmacy work still pending wins over an earlier pickup:
 * a submitted order means pharmacist 1, a verified order pharmacist 2. Drafts stay with the prescriber
 * and never move the stage.
 */
export function journeyStage(s: JourneySession, consult: JourneyConsult | null): JourneyStage {
  const meds = (s.orders?.medications ?? []).filter(o => o.status !== "cancelled");
  const has = (status: string) => meds.some(o => o.status === status);
  if (has("submitted")) return "pharmacy_verify";
  if (has("verified")) return "pharmacy_dispense";
  if (s.pickup?.status === "collected") return "collected";
  if (s.pickup?.status === "ready") return "ready_for_pickup";
  if (has("dispensed") && !has("returned")) return "pharmacy_dispense"; // dispensed, patient not called yet
  const investigations = (s.orders?.investigations ?? []).filter(o => o.status !== "cancelled" && o.status !== "draft");
  if (meds.some(o => o.status !== "draft") || investigations.length) return "orders_submitted";
  const notes = consult?.notes ?? {};
  if (notes.doctor?.signed) return "doctor_signed";
  if (s.triage?.confirmed) {
    const consulted = s.turns.some(t => t.role === "clinician") || !!notes.nurse || !!notes.doctor;
    return consulted ? "nurse_done" : "triaged";
  }
  const flags = s.summary?.redFlags ?? [];
  if (s.status === "approved" || s.status === "taken_over" || (flags.length > 0 && flags.every(f => !!f.review))) return "intake_reviewed";
  return "intake";
}
