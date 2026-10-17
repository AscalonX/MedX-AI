import type {
  AllergyEntry, AuditEvent, Evidence, GetSessionRes, IntakeSession, Lang, Localized, MedAlert, MedAlertKind, MedicationEntry,
  PharmacyReviewReq,
} from "@medx/shared";

export const LANG_OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "th", label: "ไทย" },
  { lang: "it", label: "Italiano" },
  { lang: "en", label: "English" },
];
export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };
/** Local stand-in for sign-in. Prototype only: no authentication. */
export const PHARMACISTS = ["Pharmacist M. Bianchi", "Pharmacist K. Suwan"];

export const L = (th: string, it: string, en: string): Localized => ({ th, it, en });

// ---------- fetch ----------
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}
export const fetchQueue = () => getJson<IntakeSession[]>("/api/sessions");
export const fetchSession = (id: string) => getJson<GetSessionRes>(`/api/sessions/${id}`);
export const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// ---------- time ----------
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export function waited(fromIso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d`;
}

// ---------- labels ----------
export const KIND_LABEL: Record<MedAlertKind, Localized> = {
  allergy_conflict: L("ขัดกับประวัติแพ้ยา", "Conflitto con allergia", "Allergy conflict"),
  duplicate_therapy: L("ยาซ้ำซ้อน", "Terapia duplicata", "Duplicate therapy"),
  pregnancy_caution: L("ข้อควรระวังในการตั้งครรภ์", "Cautela in gravidanza", "Pregnancy caution"),
  interaction: L("ปฏิกิริยาระหว่างยา", "Interazione", "Interaction"),
  max_dose_risk: L("เสี่ยงเกินขนาดสูงสุด", "Rischio dose massima", "Maximum dose risk"),
  unknown_medication: L("ยาที่ไม่รู้จัก", "Farmaco non riconosciuto", "Unknown medicine"),
};
export const PHARM_STATUS_LABEL = { pending: "Pending", in_review: "In review", reconciled: "Reconciled" } as const;
export const pharmStatus = (s: IntakeSession) => s.pharmacyStatus ?? "pending";

export const hasMedData = (s: IntakeSession) => !!s.summary?.medications;
export const alertsOf = (s: IntakeSession): MedAlert[] => s.summary?.medAlerts ?? [];
export const medsOf = (s: IntakeSession): MedicationEntry[] => s.summary?.medications ?? [];
export const allergiesOf = (s: IntakeSession): AllergyEntry[] => s.summary?.allergies ?? [];
export const openHigh = (s: IntakeSession) => alertsOf(s).filter((a) => a.severity === "high" && !a.review);

/** Queue order: unhandled high alerts pinned first, then pending, in review, reconciled; longest wait first. */
export function sortQueue(list: IntakeSession[]): IntakeSession[] {
  const rank = { pending: 1, in_review: 2, reconciled: 3 };
  return [...list].sort(
    (a, b) =>
      Number(openHigh(b).length > 0) - Number(openHigh(a).length > 0) ||
      rank[pharmStatus(a)] - rank[pharmStatus(b)] ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

// ---------- sign-off ----------
/** Reasons the pharmacist cannot sign off yet; empty list means the button is live. */
export function blockers(s: IntakeSession): string[] {
  const out: string[] = [];
  const high = openHigh(s).length;
  if (high) out.push(`${high} high ${high === 1 ? "alert" : "alerts"} not handled (acknowledge, resolve or mark false alarm)`);
  const names = (list: MedicationEntry[]) => list.map((m) => `"${m.nameOriginal}"`).join(", ");
  const unmatched = medsOf(s).filter((m) => m.status === "unmatched");
  if (unmatched.length) out.push(`identify ${names(unmatched)}`);
  const pencil = medsOf(s).filter((m) => m.status === "unsupported");
  if (pencil.length) out.push(`no patient quote for ${names(pencil)}: verify or discontinue`);
  return out;
}

// ---------- questions for the patient ----------
export interface PatientQuestion { id: string; why: string; text: Localized }
const q = (id: string, why: string, th: string, it: string, en: string): PatientQuestion => ({ id, why, text: L(th, it, en) });

/** Generated client-side from gaps in the record. Wording is plain and never suggests a diagnosis. */
export function buildQuestions(s: IntakeSession): PatientQuestion[] {
  const out: PatientQuestion[] = [];
  const meds = medsOf(s);
  const byId = new Map(meds.map((m) => [m.id, m]));
  for (const m of meds) {
    if (m.status === "discontinued") continue;
    const n = m.nameOriginal;
    const thn = n.startsWith("ยา") ? n : `ยา ${n}`; // avoid "ยา ยา..."
    if (m.status === "unmatched") {
      out.push(q(`um-${m.id}`, `Unmatched: ${n}`,
        `“${n}” คือยาอะไร ช่วยแสดงกล่องหรือฉลากยาให้ดูได้ไหม`,
        `Che medicinale è «${n}»? Può mostrarmi la confezione o l'etichetta?`,
        `What is "${n}"? Can you show me the box or the label?`));
      continue;
    }
    if (!m.dose) out.push(q(`dose-${m.id}`, `Dose missing: ${n}`,
      `${thn} กินครั้งละเท่าไร (กี่เม็ด หรือกี่มิลลิกรัม)`,
      `Quanto ${n} prende per volta (compresse o mg)?`,
      `How much ${n} do you take each time (tablets or mg)?`));
    if (!m.frequency) out.push(q(`freq-${m.id}`, `Frequency missing: ${n}`,
      `${thn} กินวันละกี่ครั้ง และกินครั้งล่าสุดเมื่อไร`,
      `Quante volte al giorno prende ${n}, e quando è stata l'ultima dose?`,
      `How many times a day do you take ${n}, and when was the last dose?`));
  }
  const field = s.summary?.fields.find((f) => f.key === "allergies");
  if (allergiesOf(s).length === 0 && !(field?.status === "supported" && field.evidence.length)) {
    out.push(q("allergy-ask", "Allergies not stated",
      "แพ้ยา อาหาร หรืออะไรบ้างไหม ถ้าแพ้ เป็นอย่างไร",
      "Ha allergie a farmaci, cibi o altro? Se sì, che reazione ha avuto?",
      "Are you allergic to any medicines, foods or anything else? If so, what happened?"));
  }
  for (const a of allergiesOf(s)) {
    if (!a.reaction) out.push(q(`react-${a.id}`, `Reaction missing: ${a.allergenOriginal}`,
      `เมื่อแพ้ ${a.allergenOriginal} มีอาการอย่างไร`,
      `Quale reazione ha avuto con ${a.allergenOriginal}?`,
      `What reaction did you have to ${a.allergenOriginal}?`));
  }
  for (const al of alertsOf(s)) {
    if (al.review) continue;
    const names = al.medIds.map((id) => byId.get(id)?.nameOriginal).filter(Boolean) as string[];
    if (!names.length) continue;
    const joined = names.join(" + ");
    if (al.kind === "max_dose_risk" || al.kind === "duplicate_therapy") {
      out.push(q(`al-${al.id}`, `${KIND_LABEL[al.kind].en}: ${joined}`,
        `วันนี้กิน ${joined} ไปรวมกันกี่เม็ดแล้ว และกินครั้งล่าสุดเมื่อไร`,
        `Quante compresse in totale di ${joined} ha preso oggi, e a che ora l'ultima?`,
        `How many tablets of ${joined} have you taken today in total, and when was the last one?`));
    } else if (al.kind === "allergy_conflict") {
      out.push(q(`al-${al.id}`, `${KIND_LABEL[al.kind].en}: ${joined}`,
        `หลังกิน ${joined} ครั้งนี้ มีผื่น คัน หรือหายใจลำบากไหม`,
        `Dopo ${joined} ha avuto eruzioni cutanee, prurito o difficoltà a respirare?`,
        `After taking ${joined} this time, did you get a rash, itching or trouble breathing?`));
    } else if (al.kind === "interaction") {
      out.push(q(`al-${al.id}`, `${KIND_LABEL[al.kind].en}: ${joined}`,
        `ใช้ ${joined} ร่วมกันมานานเท่าไร และมีอาการผิดปกติไหม`,
        `Da quanto tempo assume ${joined} insieme, e ha notato sintomi insoliti?`,
        `How long have you taken ${joined} together, and have you noticed anything unusual?`));
    }
  }
  return out;
}

// ---------- local application of a review (fixture sessions only; live sessions use the server) ----------
export function applyReview(s: IntakeSession, req: PharmacyReviewReq, at: string): IntakeSession {
  const sum = s.summary;
  if (!sum) return s;
  const medications = (sum.medications ?? []).map((m) => {
    const a = req.medActions.find((x) => x.medId === m.id);
    if (!a) return m;
    if (a.action === "verify") return m.status === "unmatched" ? m : { ...m, status: "verified" as const };
    if (a.action === "discontinue") return { ...m, status: "discontinued" as const };
    return {
      ...m,
      generic: a.generic?.trim() || m.generic,
      dose: a.dose?.trim() || m.dose,
      frequency: a.frequency?.trim() || m.frequency,
      status: "edited" as const,
    };
  });
  const medAlerts = (sum.medAlerts ?? []).map((al) => {
    const a = req.alertActions.find((x) => x.alertId === al.id);
    return a ? { ...al, review: { action: a.action, reviewerId: req.reviewerId, at, ...(a.note ? { note: a.note } : {}) } } : al;
  });
  return {
    ...s,
    summary: { ...sum, medications, medAlerts },
    pharmacyStatus: req.complete ? "reconciled" : "in_review",
    pharmacyReviewerId: req.reviewerId,
    updatedAt: at,
  };
}

export function auditLine(e: AuditEvent): string {
  const p = e.payload as { medActions?: { medId: string; action: string }[]; alertActions?: { alertId: string; action: string }[]; complete?: boolean };
  switch (e.type) {
    case "pharmacy_review": {
      const parts = [
        ...(p.medActions ?? []).map((a) => `${a.action} medicine`),
        ...(p.alertActions ?? []).map((a) => `${a.action.replace("_", " ")} alert`),
        ...(p.complete ? ["signed off reconciliation"] : []),
      ];
      return `Pharmacy review: ${parts.join(", ") || "opened"}`;
    }
    case "red_flag": return "Red flag raised";
    case "summary_generated": return "Summary generated";
    case "pii_redacted": return "Personal details redacted";
    case "session_created": return "Intake started";
    case "turn_added": return "Turn added";
    case "review": return "Clinician field review";
    default: return e.type;
  }
}

export type Sel = { type: "med" | "allergy" | "alert" | "nka"; id: string };
export const selKey = (s: Sel | null) => (s ? `${s.type}:${s.id}` : "");

/** Evidence the selection points at. An alert also pulls in the quotes of the medicines and allergies it links. */
export function selEvidence(s: IntakeSession, sel: Sel | null): Evidence[] {
  if (!sel) return [];
  const meds = medsOf(s), alg = allergiesOf(s);
  if (sel.type === "med") return meds.find((m) => m.id === sel.id)?.evidence ?? [];
  if (sel.type === "allergy") return alg.find((a) => a.id === sel.id)?.evidence ?? [];
  if (sel.type === "nka") return s.summary?.fields.find((f) => f.key === "allergies")?.evidence ?? [];
  const al = alertsOf(s).find((a) => a.id === sel.id);
  if (!al) return [];
  return [
    ...al.evidence,
    ...al.medIds.flatMap((id) => meds.find((m) => m.id === id)?.evidence ?? []),
    ...al.allergyIds.flatMap((id) => alg.find((a) => a.id === id)?.evidence ?? []),
  ];
}
