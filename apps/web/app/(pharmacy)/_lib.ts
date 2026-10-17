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
// Display language for times and durations. The shell sets it on every render, before children render.
let DISPLAY_LANG: Lang = "en";
export const setDisplayLang = (l: Lang) => { DISPLAY_LANG = l; };
export const clock = (iso: string) => new Intl.DateTimeFormat(DISPLAY_LANG, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export function waited(fromIso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60000));
  const u = { th: { m: "นาที", h: "ชม.", d: "วัน" }, it: { m: "min", h: "h", d: "g" }, en: { m: "min", h: "h", d: "d" } }[DISPLAY_LANG];
  if (min < 60) return `${min} ${u.m}`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} ${u.h} ${min % 60} ${u.m}` : `${Math.floor(h / 24)} ${u.d}`;
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
export const PHARM_STATUS_LABEL = {
  pending: L("รอดำเนินการ", "In attesa", "Pending"),
  in_review: L("กำลังตรวจ", "In revisione", "In review"),
  reconciled: L("เทียบรายการยาแล้ว", "Riconciliato", "Reconciled"),
} as const;
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
  const out: Localized[] = [];
  if (isAbstained(s)) out.push(L("ระบบไม่สามารถสรุปได้ ต้องให้บุคลากรตรวจ", "Il sistema non ha prodotto un riepilogo: serve revisione umana", "No summary was produced: needs human review"));
  const nf = openFlags(s).length;
  if (nf) out.push(L(`สัญญาณอันตราย ${nf} รายการยังไม่ได้รับการทบทวนโดยแพทย์/พยาบาล`, `${nf} segnali d'allarme non ancora rivisti da un clinico`, `${nf} red ${nf === 1 ? "flag has" : "flags have"} not been reviewed by a clinician`));
  const high = openHigh(s).length;
  if (high) out.push(L(`การแจ้งเตือนระดับสูง ${high} รายการยังไม่ได้จัดการ`, `${high} avvisi alti non ancora gestiti`, `${high} high ${high === 1 ? "alert" : "alerts"} not handled`));
  if (isAbstained(s)) return out; // extracted medicines and allergies are untrusted when abstained
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
export interface PatientQuestion { id: string; why: Localized; text: Localized }
const q = (id: string, why: Localized, th: string, it: string, en: string): PatientQuestion => ({ id, why, text: L(th, it, en) });

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
      out.push(q(`um-${m.id}`, L(`ไม่รู้จักยา: ${n}`, `Non riconosciuto: ${n}`, `Unmatched: ${n}`),
        `“${n}” คือยาอะไร ช่วยแสดงกล่องหรือฉลากยาให้ดูได้ไหม`,
        `Che medicinale è «${n}»? Può mostrarmi la confezione o l'etichetta?`,
        `What is "${n}"? Can you show me the box or the label?`));
      continue;
    }
    if (!m.dose) out.push(q(`dose-${m.id}`, L(`ไม่มีขนาดยา: ${n}`, `Dose mancante: ${n}`, `Dose missing: ${n}`),
      `${thn} กินครั้งละเท่าไร (กี่เม็ด หรือกี่มิลลิกรัม)`,
      `Quanto ${n} prende per volta (compresse o mg)?`,
      `How much ${n} do you take each time (tablets or mg)?`));
    if (!m.frequency) out.push(q(`freq-${m.id}`, L(`ไม่มีความถี่: ${n}`, `Frequenza mancante: ${n}`, `Frequency missing: ${n}`),
      `${thn} กินวันละกี่ครั้ง และกินครั้งล่าสุดเมื่อไร`,
      `Quante volte al giorno prende ${n}, e quando è stata l'ultima dose?`,
      `How many times a day do you take ${n}, and when was the last dose?`));
  }
  if (allergiesOf(s).length === 0 && !hasNka(s)) {
    out.push(q("allergy-ask", L("ยังไม่ได้ระบุการแพ้", "Allergie non indicate", "Allergies not stated"),
      "แพ้ยา อาหาร หรืออะไรบ้างไหม ถ้าแพ้ เป็นอย่างไร",
      "Ha allergie a farmaci, cibi o altro? Se sì, che reazione ha avuto?",
      "Are you allergic to any medicines, foods or anything else? If so, what happened?"));
  }
  for (const a of allergiesOf(s)) {
    if (!a.reaction) out.push(q(`react-${a.id}`, L(`ไม่มีอาการแพ้: ${a.allergenOriginal}`, `Reazione mancante: ${a.allergenOriginal}`, `Reaction missing: ${a.allergenOriginal}`),
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
      out.push(q(`al-${al.id}`, L(`${KIND_LABEL[al.kind].th}: ${joined}`, `${KIND_LABEL[al.kind].it}: ${joined}`, `${KIND_LABEL[al.kind].en}: ${joined}`),
        `วันนี้กิน ${joined} ไปรวมกันกี่เม็ดแล้ว และกินครั้งล่าสุดเมื่อไร`,
        `Quante compresse in totale di ${joined} ha preso oggi, e a che ora l'ultima?`,
        `How many tablets of ${joined} have you taken today in total, and when was the last one?`));
    } else if (al.kind === "allergy_conflict") {
      out.push(q(`al-${al.id}`, L(`${KIND_LABEL[al.kind].th}: ${joined}`, `${KIND_LABEL[al.kind].it}: ${joined}`, `${KIND_LABEL[al.kind].en}: ${joined}`),
        `หลังกิน ${joined} ครั้งนี้ มีผื่น คัน หรือหายใจลำบากไหม`,
        `Dopo ${joined} ha avuto eruzioni cutanee, prurito o difficoltà a respirare?`,
        `After taking ${joined} this time, did you get a rash, itching or trouble breathing?`));
    } else if (al.kind === "interaction") {
      out.push(q(`al-${al.id}`, L(`${KIND_LABEL[al.kind].th}: ${joined}`, `${KIND_LABEL[al.kind].it}: ${joined}`, `${KIND_LABEL[al.kind].en}: ${joined}`),
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

const AUD = {
  med: { verify: L("ยืนยันยา", "verificato farmaco", "verified medicine"), edit: L("แก้ไขยา", "modificato farmaco", "edited medicine"), discontinue: L("หยุดยา", "sospeso farmaco", "discontinued medicine") },
  allergy: { verify: L("ยืนยันการแพ้", "verificata allergia", "verified allergy"), edit: L("แก้ไขการแพ้", "modificata allergia", "edited allergy") },
  alert: { acknowledge: L("รับทราบการแจ้งเตือน", "avviso preso in carico", "acknowledged alert"), resolved: L("จัดการการแจ้งเตือนแล้ว", "avviso risolto", "resolved alert"), false_alarm: L("แจ้งเตือนผิด", "falso allarme", "false alarm alert") },
  signed: L("ลงนามเทียบรายการยา", "riconciliazione firmata", "signed off reconciliation"),
  review: L("การทบทวนของเภสัชกร", "Revisione farmacista", "Pharmacy review"),
  opened: L("เปิดดู", "aperta", "opened"),
  events: {
    red_flag: L("พบสัญญาณอันตราย", "Segnale d'allarme rilevato", "Red flag raised"),
    summary_generated: L("สร้างสรุปแล้ว", "Riepilogo generato", "Summary generated"),
    pii_redacted: L("ปกปิดข้อมูลส่วนตัวแล้ว", "Dati personali oscurati", "Personal details redacted"),
    session_created: L("เริ่มการรับข้อมูล", "Accesso avviato", "Intake started"),
    turn_added: L("มีข้อความใหม่", "Messaggio aggiunto", "Turn added"),
    review: L("แพทย์/พยาบาลทบทวนช่องข้อมูล", "Revisione clinica dei campi", "Clinician field review"),
  } as Record<string, Localized>,
};
export function auditLine(e: AuditEvent, lang: Lang): string {
  const p = e.payload as { allergyActions?: { action: string }[]; medActions?: { action: string }[]; alertActions?: { action: string }[]; complete?: boolean };
  if (e.type === "pharmacy_review") {
    const parts = [
      ...(p.medActions ?? []).map((a) => (AUD.med as Record<string, Localized>)[a.action]?.[lang] ?? a.action),
      ...(p.allergyActions ?? []).map((a) => (AUD.allergy as Record<string, Localized>)[a.action]?.[lang] ?? a.action),
      ...(p.alertActions ?? []).map((a) => (AUD.alert as Record<string, Localized>)[a.action]?.[lang] ?? a.action),
      ...(p.complete ? [AUD.signed[lang]] : []),
    ];
    return `${AUD.review[lang]}: ${parts.join(", ") || AUD.opened[lang]}`;
  }
  return AUD.events[e.type]?.[lang] ?? e.type;
}

/** The completed (signed-off) pharmacy_review event, the only trustworthy source for the receipt time and signer. */
export const signOffEvent = (audit: AuditEvent[]) => [...audit].reverse().find((e) => e.type === "pharmacy_review" && (e.payload as { complete?: boolean }).complete === true);

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

/** Plain-language reasons for an abstained summary (local map until lib/pipeline/messages.ts exists). */
export const ABSTAIN: Record<string, Localized> = {
  provider_error: L("บริการโมเดลไม่ตอบสนอง", "Il servizio del modello non ha risposto", "The model service did not answer"),
  schema_error: L("ตรวจสอบคำตอบของโมเดลไม่ได้", "La risposta del modello non è verificabile", "The model's answer could not be checked"),
  low_confidence: L("คำตอบของผู้ป่วยไม่ชัดพอที่จะสรุปอย่างปลอดภัย", "La risposta era troppo poco chiara per riassumerla in sicurezza", "The answer was too unclear to summarise safely"),
  unsupported_language: L("ข้อความไม่ใช่ภาษาไทย อิตาลี หรืออังกฤษ หรืออ่านไม่ได้", "Il testo non è in thailandese, italiano o inglese, o non è leggibile", "The text is not in Thai, Italian or English, or could not be read"),
  out_of_scope: L("เรื่องนี้อยู่นอกขอบเขตของแบบสอบถามนี้", "Questo sembra fuori dallo scopo di questo modulo", "This looks outside what this intake is for"),
  conflicting_information: L("ผู้ป่วยให้ข้อมูลที่ขัดแย้งกัน", "Il paziente ha detto cose contraddittorie", "The patient said things that contradict each other"),
};

/** Chrome strings (th/it/en). */
export const C = {
  queueTitle: L("คิวเทียบรายการยา", "Coda di riconciliazione", "Reconciliation queue"),
  queue: L("คิว", "Coda", "Queue"),
  pendingStat: L("รอเทียบรายการยา", "In attesa di riconciliazione", "Pending reconciliation"),
  urgentStat: L("การแจ้งเตือนสูงและสัญญาณอันตรายที่ยังเปิดอยู่", "Avvisi alti e segnali d'allarme aperti", "High alerts and red flags open"),
  doneStat: L("เทียบรายการแล้ววันนี้", "Riconciliati oggi", "Reconciled today"),
  noIntakes: L("ยังไม่มีรายการที่ต้องเทียบยา", "Nessun accesso da riconciliare", "No intakes need reconciliation"),
  noIntakesBody: L("รายการที่มียาจะปรากฏที่นี่เมื่อผู้ป่วยตอบเสร็จ", "Gli accessi con farmaci compaiono qui quando il paziente ha finito.", "New intakes with medicines appear here as patients finish."),
  noComplaint: L("ยังไม่มีอาการสำคัญ", "Nessun motivo indicato", "No complaint yet"),
  medicinesN: (n: number) => L(`ยา ${n} รายการ`, n === 1 ? "1 farmaco" : `${n} farmaci`, n === 1 ? "1 medicine" : `${n} medicines`),
  redFlagsN: (n: number) => L(`สัญญาณอันตราย ${n}`, n === 1 ? "1 segnale d'allarme" : `${n} segnali d'allarme`, n === 1 ? "1 red flag" : `${n} red flags`),
  redFlagsDone: (n: number) => L(`สัญญาณอันตราย ${n} ทบทวนแล้ว`, n === 1 ? "1 segnale rivisto" : `${n} segnali rivisti`, n === 1 ? "1 red flag, reviewed" : `${n} red flags, reviewed`),
  highN: (n: number) => L(`สูง ${n}`, `${n} alti`, `${n} high`),
  toCheckN: (n: number) => L(`ต้องตรวจ ${n}`, `${n} da verificare`, `${n} to check`),
  allHandled: L("จัดการครบแล้ว", "Tutto gestito", "All handled"),
  noRuleAlerts: L("ไม่มีการแจ้งเตือนจากกฎ", "Nessun avviso dalle regole", "No rule alerts"),
  notRefreshed: L("รีเฟรชคิวสดไม่ได้", "Coda non aggiornata", "Live queue not refreshed"),
  back: L("กลับไปที่คิว", "Torna alla coda", "Back to queue"),
  words: L("คำพูดของผู้ป่วย", "Parole del paziente", "Patient's words"),
  close: L("ปิด", "Chiudi", "Close"),
  started: L("เริ่มเมื่อ", "Iniziato alle", "Started"),
  waiting: L("รอมา", "attesa", "waiting"),
  patient: L("ผู้ป่วย", "Paziente", "Patient"),
  question: L("คำถาม", "Domanda", "Question"),
  emergency: L("ฉุกเฉิน", "Emergenza", "Emergency"),
  urgent: L("เร่งด่วน", "Urgente", "Urgent"),
  notStated: L("ไม่ได้ระบุ", "Non indicato", "Not stated"),
  originalLang: (name: string) => L(`ภาษาเดิม: ${name}`, `Lingua originale: ${name}`, `Original language: ${name}`),
  fixture: L("ข้อมูลตัวอย่าง", "Dati di esempio", "Fixture data"),
  fixtureTag: L("ตัวอย่าง", "esempio", "fixture"),
  signedInAs: L("ลงชื่อเข้าใช้เป็น", "Accesso come", "Signed in as"),
  linked: L("เชื่อมกับการแจ้งเตือนที่เลือก", "collegato all'avviso selezionato", "linked to selected alert"),
  genericName: L("ชื่อสามัญ", "Nome generico", "Generic name"),
  identifyAs: L("ระบุว่าเป็น (ชื่อสามัญ)", "Identifica come (nome generico)", "Identify as (generic name)"),
  identifyHint: L("พิมพ์ชื่อสามัญจากกล่องหรือฉลาก คำพูดของผู้ป่วยยังอยู่ในบันทึก", "Scrivi il nome generico dalla confezione o etichetta. Le parole del paziente restano nel registro.", "Type the generic name from the box or label. The patient's words stay on record."),
  allergenClass: L("กลุ่มสารก่อภูมิแพ้", "Classe dell'allergene", "Allergen class"),
  alertHelp: L("รับทราบ = เห็นแล้ว ยังเกี่ยวข้อง  จัดการแล้ว = ดำเนินการแล้ว  แจ้งเตือนผิด = กฎไม่ตรงกับกรณีนี้ (ต้องมีหมายเหตุ)", "Presa in carico = visto, ancora rilevante. Risolto = gestito. Falso allarme = la regola non si applica (nota obbligatoria).", "Acknowledge = seen, still relevant. Resolved = handled. False alarm = rule does not apply (note required)."),
  evidenceTurn: (n: number) => L(`หลักฐาน ข้อความที่ ${n}`, `Evidenza, messaggio ${n}`, `Evidence, turn ${n}`),
  noEvidence: L("ไม่มีคำพูดอ้างอิงสำหรับรายการนี้", "Nessuna citazione per questo elemento", "No evidence quote for this item"),
  extractedBy: (x: string) => L(`สกัดข้อมูลโดย ${x}`, `Estratto da ${x}`, `Extracted by ${x}`),
  unverified: L("ยังไม่ยืนยัน", "Non verificato", "Unverified"),
  safetyAlerts: L("การแจ้งเตือนด้านความปลอดภัย (กฎ)", "Avvisi di sicurezza (regole)", "Safety alerts (rules)"),
  safetyAlertsNote: L("แสดงเฉพาะการแจ้งเตือนจากกฎที่บันทึกไว้ รายการยาที่สกัดได้ไม่ถูกแสดงเพราะระบบสรุปไม่ได้", "Solo gli avvisi delle regole registrati. I farmaci estratti non sono mostrati perché il riepilogo non è affidabile.", "Recorded rule alerts only. Extracted medicines are not shown because the summary is not reliable."),
  statedStopped: L("ผู้ป่วยบอกว่าหยุดยานี้แล้ว โปรดยืนยัน", "Il paziente dice di aver sospeso il farmaco: confermare", "Patient says this medicine was stopped: confirm"),
  openDrawer: L("เปิดคำพูดของผู้ป่วย", "Apri le parole del paziente", "Open the patient's words"),
  noExtraction: L("ไม่มีบันทึกการสกัดข้อมูล", "Registro di estrazione non disponibile", "Extraction record not available"),
  summaryAt: L("สรุปเมื่อ", "riepilogo alle", "summary"),
  showAudit: (open: boolean, n: number) => L(`${open ? "ซ่อน" : "แสดง"}บันทึกการตรวจสอบ (${n} รายการ)`, `${open ? "Nascondi" : "Mostra"} registro e provenienza (${n} eventi)`, `${open ? "Hide" : "Show"} audit and provenance (${n} events)`),
  noPharmActions: L("ยังไม่มีการดำเนินการของเภสัชกร", "Nessuna azione del farmacista registrata", "No pharmacist actions recorded yet"),
  readWords: L("อ่านคำพูดของผู้ป่วย", "Leggi le parole del paziente", "Read the patient's words"),
  askDirect: L("ถามผู้ป่วยโดยตรงเกี่ยวกับยาและการแพ้ แล้วบันทึกผลในหน้าทบทวนของแพทย์/พยาบาล", "Chiedere direttamente al paziente di farmaci e allergie, poi registrare nella revisione clinica.", "Ask the patient directly about medicines and allergies, then record it in clinician review."),
  receiptTitle: L("เทียบรายการยาเสร็จแล้ว", "Riconciliazione completata", "Reconciliation signed off"),
  receiptBy: L("โดย", "da", "by"),
  receiptMeds: (n: number, v: number, e: number, d: number) => L(`ยา ${n} รายการ: ยืนยัน ${v} แก้ไข ${e} หยุด ${d}`, `${n} farmaci: ${v} verificati, ${e} modificati, ${d} sospesi`, `${n} ${n === 1 ? "medicine" : "medicines"}: ${v} verified, ${e} edited, ${d} discontinued`),
  receiptAllergies: (n: number, nka: boolean) => L(nka ? "ผู้ป่วยแจ้งว่าไม่มีประวัติแพ้ยา" : `การแพ้ ${n} รายการ`, nka ? "Il paziente dichiara nessuna allergia" : `${n} allergie`, nka ? "Patient stated no known allergies" : `${n} ${n === 1 ? "allergy" : "allergies"}`),
  receiptAlerts: (n: number, ack: number, res: number, fa: number) => L(`การแจ้งเตือน ${n} รายการ: รับทราบ ${ack} จัดการแล้ว ${res} แจ้งเตือนผิด ${fa}`, `${n} avvisi: ${ack} presi in carico, ${res} risolti, ${fa} falsi allarmi`, `${n} ${n === 1 ? "alert" : "alerts"}: ${ack} acknowledged, ${res} resolved, ${fa} false alarms`),
  receiptNote: L("การแจ้งเตือนทั้งหมดยังอยู่ในบันทึก ไม่มีผลต่อการรักษาจนกว่าแพทย์ยืนยัน", "Tutti gli avvisi restano nel registro. Nulla cambia l'assistenza finché un clinico non conferma.", "All alerts stay on the record. Nothing changes care until a clinician confirms."),
  signedOffAnnounce: L("ลงนามเทียบรายการยาแล้ว", "Riconciliazione firmata", "Reconciliation signed off"),
};
