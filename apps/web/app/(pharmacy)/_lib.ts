import type {
  AllergyEntry, AuditEvent, Evidence, RedFlagHit, GetSessionRes, IntakeSession, Lang, Localized, MedAlert, MedAlertKind, MedicationEntry,
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

/** Only the explicit contract field counts as no known allergies. */
export const hasNka = (s: IntakeSession) => (s.summary?.noKnownAllergiesEvidence?.length ?? 0) > 0;
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
      Number(openHigh(b).length + openFlags(b).length > 0) - Number(openHigh(a).length + openFlags(a).length > 0) ||
      rank[pharmStatus(a)] - rank[pharmStatus(b)] ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

// ---------- sign-off ----------
export const isAbstained = (s: IntakeSession) => !s.summary || s.summary.abstained;
export const redFlagsOf = (s: IntakeSession): RedFlagHit[] => s.summary?.redFlags ?? [];
export const openFlags = (s: IntakeSession) => redFlagsOf(s).filter((h) => !h.review);

/** Reasons the pharmacist cannot sign off yet; empty list means the button is live. */
export function blockers(s: IntakeSession): Localized[] {
  if (isAbstained(s)) return [L("ระบบไม่สามารถสรุปได้ ต้องให้บุคลากรตรวจ", "Il sistema non ha prodotto un riepilogo: serve revisione umana", "No summary was produced: needs human review")];
  const out: Localized[] = [];
  const nf = openFlags(s).length;
  if (nf) out.push(L(`สัญญาณอันตราย ${nf} รายการยังไม่ได้รับการทบทวนโดยแพทย์/พยาบาล`, `${nf} segnali d'allarme non ancora rivisti da un clinico`, `${nf} red ${nf === 1 ? "flag has" : "flags have"} not been reviewed by a clinician`));
  const high = openHigh(s).length;
  if (high) out.push(L(`การแจ้งเตือนระดับสูง ${high} รายการยังไม่ได้จัดการ`, `${high} avvisi alti non ancora gestiti`, `${high} high ${high === 1 ? "alert" : "alerts"} not handled`));
  const names = (list: { nameOriginal: string }[]) => list.map((m) => `"${m.nameOriginal}"`).join(", ");
  const un = medsOf(s).filter((m) => m.status === "unmatched");
  if (un.length) out.push(L(`ต้องระบุชื่อยา ${names(un)}`, `identificare ${names(un)}`, `identify ${names(un)}`));
  const pe = medsOf(s).filter((m) => m.status === "unsupported");
  if (pe.length) out.push(L(`ไม่มีคำพูดผู้ป่วยรองรับ ${names(pe)} ให้ยืนยันกับผู้ป่วยหรือหยุดรายการ`, `nessuna citazione del paziente per ${names(pe)}: verificare o sospendere`, `no patient quote for ${names(pe)}: verify or discontinue`));
  const ap = allergiesOf(s).filter((a) => a.status === "unsupported" || a.status === "unmatched");
  if (ap.length) {
    const n = names(ap.map((a) => ({ nameOriginal: a.allergenOriginal })));
    out.push(L(`ข้อมูลการแพ้ยังไม่ได้ยืนยัน ${n}`, `allergia da verificare ${n}`, `allergy not verified ${n}`));
  }
  return out;
}

// ---------- questions for the patient ----------
export interface PatientQuestion { id: string; why: string; text: Localized }
const q = (id: string, why: string, th: string, it: string, en: string): PatientQuestion => ({ id, why, text: L(th, it, en) });

/** Generated client-side from gaps in the record. Wording is plain and never suggests a diagnosis. */
export function buildQuestions(s: IntakeSession): PatientQuestion[] {
  const out: PatientQuestion[] = [];
  if (isAbstained(s)) return out;
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
  if (allergiesOf(s).length === 0 && !hasNka(s)) {
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
    const review = { ...m.review, reviewerId: req.reviewerId, at };
    if (a.action === "verify") return m.status === "unmatched" ? m : { ...m, status: "verified" as const, review };
    if (a.action === "discontinue") return { ...m, status: "discontinued" as const, review };
    const previous = m.review?.previous ?? { generic: m.generic, dose: m.dose, frequency: m.frequency };
    return {
      ...m,
      generic: a.generic?.trim() ? a.generic.trim() : m.generic,
      dose: a.dose !== undefined ? a.dose : m.dose, // "" clears
      frequency: a.frequency !== undefined ? a.frequency : m.frequency,
      status: "edited" as const,
      review: { reviewerId: req.reviewerId, at, previous },
    };
  });
  const allergies = (sum.allergies ?? []).map((g) => {
    const a = req.allergyActions?.find((x) => x.allergyId === g.id);
    if (!a) return g;
    if (a.action === "verify") return { ...g, status: "verified" as const, review: { ...g.review, reviewerId: req.reviewerId, at } };
    const previous = g.review?.previous ?? { allergenClass: g.allergenClass, reaction: g.reaction };
    return {
      ...g,
      allergenClass: a.allergenClass !== undefined ? a.allergenClass : g.allergenClass,
      reaction: a.reaction !== undefined ? a.reaction : g.reaction,
      status: "edited" as const,
      review: { reviewerId: req.reviewerId, at, previous },
    };
  });
  const medAlerts = (sum.medAlerts ?? []).map((al) => {
    const a = req.alertActions.find((x) => x.alertId === al.id);
    return a ? { ...al, review: { action: a.action, reviewerId: req.reviewerId, at, ...(a.note ? { note: a.note } : {}) } } : al;
  });
  return {
    ...s,
    summary: { ...sum, medications, allergies, medAlerts },
    pharmacyStatus: req.complete ? "reconciled" : "in_review",
    pharmacyReviewerId: req.reviewerId,
    updatedAt: at,
  };
}

export function auditLine(e: AuditEvent): string {
  const p = e.payload as { allergyActions?: { action: string }[]; medActions?: { medId: string; action: string }[]; alertActions?: { alertId: string; action: string }[]; complete?: boolean };
  switch (e.type) {
    case "pharmacy_review": {
      const parts = [
        ...(p.medActions ?? []).map((a) => `${a.action} medicine`),
        ...(p.allergyActions ?? []).map((a) => `${a.action} allergy`),
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
  if (sel.type === "nka") return s.summary?.noKnownAllergiesEvidence ?? [];
  const al = alertsOf(s).find((a) => a.id === sel.id);
  if (!al) return [];
  return [
    ...al.evidence,
    ...al.medIds.flatMap((id) => meds.find((m) => m.id === id)?.evidence ?? []),
    ...al.allergyIds.flatMap((id) => alg.find((a) => a.id === id)?.evidence ?? []),
  ];
}

/** Operational and safety copy, localized for the clinician language. */
export const U = {
  fromPatient: L("จากคำพูดผู้ป่วย", "Dalle parole del paziente", "From patient's words"),
  needsCheck: L("ต้องตรวจสอบ", "Da verificare", "Needs check"),
  verify: L("ยืนยัน", "Verifica", "Verify"),
  edit: L("แก้ไข", "Modifica", "Edit"),
  discontinue: L("หยุดรายการ", "Sospendi", "Discontinue"),
  identify: L("ระบุชื่อยา", "Identifica", "Identify"),
  save: L("บันทึก", "Salva", "Save"),
  cancel: L("ยกเลิก", "Annulla", "Cancel"),
  unmatched: L("ไม่รู้จักยา ต้องระบุ", "Non riconosciuto, identificare", "Unmatched, identify"),
  highAlert: L("แจ้งเตือนสูง", "Avviso alto", "High alert"),
  verified: L("ยืนยันแล้ว", "Verificato", "Verified"),
  editedBy: L("แก้ไขโดยเภสัชกร", "Modificato dal farmacista", "Edited by pharmacist"),
  stopped: L("หยุดแล้ว", "Sospeso", "Discontinued"),
  classUnknown: L("ไม่ทราบกลุ่มยา", "Classe sconosciuta", "Class unknown"),
  confirmStop: L("ผู้ป่วยไม่ได้ใช้ยานี้ในขณะนี้ รายการยังอยู่ในใบ ขีดฆ่าไว้", "Il paziente non lo assume ora. Resta sul foglio, barrato.", "The patient does not take it now. It stays on the sheet, struck through."),
  confirmStopBtn: L("ยืนยันหยุดรายการ", "Conferma sospensione", "Confirm discontinue"),
  oldStays: L("ค่าเดิมยังมองเห็นได้ ขีดฆ่าไว้ ช่องว่างหมายถึงล้างค่า", "Il vecchio valore resta visibile, barrato. Campo vuoto = cancella.", "The old value stays visible, struck through. An empty field clears it."),
  nka: L("ไม่มีประวัติแพ้ยา (ผู้ป่วยบอกเอง)", "Nessuna allergia nota (dichiarata dal paziente)", "No known allergies (stated by the patient)"),
  notStatedAsk: L("ยังไม่ได้ระบุ ถามผู้ป่วย", "Non indicato, chiedere al paziente", "Not stated, ask the patient"),
  needsHuman: L("ต้องให้บุคลากรตรวจ", "Serve revisione umana", "Needs human review"),
  needsHumanBody: L("ระบบไม่สามารถสรุปรายการยาและการแพ้ได้อย่างน่าเชื่อถือ จึงไม่แสดงข้อสรุปใดๆ อ่านคำพูดของผู้ป่วยแล้วตรวจด้วยตนเอง", "Il sistema non ha potuto riepilogare farmaci e allergie in modo affidabile, quindi non mostra conclusioni. Leggere le parole del paziente e verificare a mano.", "The system could not summarise medicines and allergies reliably, so no conclusions are shown. Read the patient's words and check by hand."),
  flags: L("สัญญาณอันตรายที่พบ", "Segnali d'allarme rilevati", "Red flags raised"),
  flagReview: L("เปิดหน้าทบทวนของแพทย์/พยาบาล", "Apri la revisione clinica", "Open clinician review"),
  flagOpen: L("ยังไม่ได้ทบทวน", "Non ancora rivisto", "Not reviewed yet"),
  flagDone: L("ทบทวนแล้วโดย", "Rivisto da", "Reviewed by"),
  blocked: L("ยังลงนามไม่ได้", "Firma bloccata", "Sign-off blocked"),
  ready: L("จัดการการแจ้งเตือนสูงครบแล้วและไม่มียาที่ไม่รู้จัก", "Avvisi alti gestiti e nessun farmaco non riconosciuto", "Every high alert is handled and no medicine is unmatched"),
  signOff: L("ลงนามยืนยันรายการยา", "Firma la riconciliazione", "Sign off reconciliation"),
  ruleSet: L("ตรวจกับชุดกฎ MedX v1.0 (ยา 59 รายการ ปฏิกิริยา 18 คู่) ไม่ใช่การตรวจปฏิกิริยายาแบบครบถ้วน", "Controllato con il set di regole MedX v1.0 (59 farmaci, 18 interazioni). Non è un controllo completo delle interazioni.", "Checked against MedX rule set v1.0 (59 drugs, 18 interactions). Not a complete interaction check."),
  noAlerts: L("ไม่มีการแจ้งเตือนจากชุดกฎนี้ ไม่ได้หมายความว่าปลอดภัย", "Nessun avviso dal set di regole. Non significa che sia sicuro.", "No alerts from this rule set. That does not mean it is safe."),
  noMeds: L("ไม่พบยาที่ผู้ป่วยกล่าวถึง", "Nessun farmaco citato", "No medicines mentioned"),
  fixtureNote: L("ข้อมูลตัวอย่างสังเคราะห์ ระบบยังไม่ส่งข้อมูลยา การกระทำจะเก็บในเบราว์เซอร์นี้เท่านั้น", "Dati sintetici: il motore non restituisce ancora i farmaci. Le azioni restano solo in questo browser.", "Synthetic data: the engine does not return medicines yet. Actions stay in this browser only."),
  disclaimer: L("การแจ้งเตือนมาจากกฎตายตัว โมเดลล้างไม่ได้ และไม่มีผลต่อการรักษาจนกว่าแพทย์ยืนยัน", "Gli avvisi vengono da regole deterministiche; un modello non può cancellarli. Nulla cambia l'assistenza finché un clinico non conferma.", "Alerts come from deterministic rules; a model cannot clear them. Nothing here changes care until a clinician confirms."),
  refused: L("เซิร์ฟเวอร์ปฏิเสธ", "Rifiutato dal server", "Server refused"),
};
