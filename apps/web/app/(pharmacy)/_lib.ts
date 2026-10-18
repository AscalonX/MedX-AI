import { STAFF, staffFor } from "@medx/shared";
import medrules from "@medx/shared/src/medrules.json";
import type {
  MedicationOrder, AllergyEntry, AuditEvent, AuditType, Evidence, RedFlagHit, GetSessionRes, IntakeSession, Lang, Localized, MedAlert, MedAlertKind, MedicationEntry,
  PharmacyReviewReq, PharmacyOrderActionReq, DispenseChecklist, DispenseOrderReq, PickupReq,
} from "@medx/shared";

export const LANG_OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "th", label: "ไทย" },
  { lang: "it", label: "Italiano" },
  { lang: "en", label: "English" },
];
export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };
/** Local stand-in for sign-in. Prototype only: no authentication. */
export const PHARMACISTS = staffFor("pharmacist").map((m) => m.name);

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
  dose_range: L("ขนาดยานอกช่วงปกติ", "Dose fuori intervallo", "Dose outside usual range"),
};
export const PHARM_STATUS_LABEL = {
  pending: L("รอดำเนินการ", "In attesa", "Pending"),
  in_review: L("กำลังตรวจ", "In revisione", "In review"),
  reconciled: L("เทียบรายการยาแล้ว", "Riconciliato", "Reconciled"),
} as const;
export const pharmStatus = (s: IntakeSession) => s.pharmacyStatus ?? "pending";

/** Only the explicit contract field counts as no known allergies. */
export const hasNka = (s: IntakeSession) => (s.summary?.noKnownAllergiesEvidence?.length ?? 0) > 0;
/** Title for a check or alert: an unchecked dose must not read as "outside range". */
export const kindTitle = (a: { kind: MedAlertKind; ruleId: string }): Localized =>
  /UNCHECKED/.test(a.ruleId) ? L("ยังไม่ได้ตรวจขนาดยา", "Dose non verificata", "Dose not checked") : KIND_LABEL[a.kind];
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

// ---------- audit lines: every AuditType gets words, the actor and its key fields (never "Event: x") ----------
const AUD = {
  med: { verify: L("ยืนยันยา", "verificato farmaco", "verified medicine"), edit: L("แก้ไขยา", "modificato farmaco", "edited medicine"), discontinue: L("หยุดยา", "sospeso farmaco", "discontinued medicine") },
  allergy: { verify: L("ยืนยันการแพ้", "verificata allergia", "verified allergy"), edit: L("แก้ไขการแพ้", "modificata allergia", "edited allergy") },
  alert: { acknowledge: L("รับทราบการแจ้งเตือน", "avviso preso in carico", "acknowledged alert"), resolved: L("จัดการการแจ้งเตือนแล้ว", "avviso risolto", "resolved alert"), false_alarm: L("แจ้งเตือนผิด", "falso allarme", "false alarm alert") },
  signed: L("ลงนามเทียบรายการยา", "riconciliazione firmata", "signed off reconciliation"),
  review: L("การทบทวนของเภสัชกร", "Revisione farmacista", "Pharmacy review"),
  opened: L("เปิดดู", "aperta", "opened"),
};
const LANG_WORD: Record<Lang, Localized> = { th: L("ไทย", "thailandese", "Thai"), it: L("อิตาลี", "italiano", "Italian"), en: L("อังกฤษ", "inglese", "English") };
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).filter(isStr);
/** "1 override" / "2 overrides", with Italian and Thai counts. */
const count = (n: number, en: [string, string], it: [string, string], th: string) => L(`${th} ${n}`, `${n} ${n === 1 ? it[0] : it[1]}`, `${n} ${n === 1 ? en[0] : en[1]}`);
const join = (lang: Lang, parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(lang === "th" ? " " : ", ");
const MODE_WORD: Record<string, Localized> = { nurse: L("พยาบาล", "infermiere", "nurse"), doctor: L("แพทย์", "medico", "doctor") };
const SPEAKER_WORD: Record<string, Localized> = { patient: L("ผู้ป่วย", "paziente", "patient"), clinician: L("บุคลากร", "clinico", "clinician"), nurse: L("พยาบาล", "infermiere", "nurse"), doctor: L("แพทย์", "medico", "doctor") };
const SUGGESTION_WORD: Record<string, Localized> = {
  asked: L("ถามแล้ว", "segnato come chiesto", "marked asked"),
  dismissed: L("ไม่ใช้", "scartato", "dismissed"),
  answered: L("มีคำตอบจากคำพูดผู้ป่วยแล้ว", "risposto dalle parole del paziente", "answered by the patient's words"),
  open: L("เปิดอยู่", "aperto", "open"),
};
const SUMMARY_EVENT: Record<string, Localized> = {
  screen_completed: L("การคัดกรองความปลอดภัยด้วยโมเดลเสร็จแล้ว", "Controllo di sicurezza del modello completato", "Model safety screen completed"),
  screen_unavailable: L("การคัดกรองความปลอดภัยด้วยโมเดลใช้ไม่ได้ กฎตายตัวยังทำงาน", "Controllo di sicurezza del modello non disponibile; le regole restano attive", "Model safety screen unavailable; the rules still ran"),
  consult_note_drafted: L("ร่างบันทึกการตรวจแล้ว", "Bozza della nota di visita preparata", "Consult note drafted"),
};

/** Who did it, in the UI language: a staff name, the system or the patient. */
export function auditActor(e: AuditEvent, lang: Lang): string {
  if (isStr(e.actorId)) return `${L("โดย", "da", "by")[lang]} ${e.actorId.trim()}`;
  return (e.actor === "system" ? L("โดยระบบ", "dal sistema", "by the system") : e.actor === "patient" ? L("โดยผู้ป่วย", "dal paziente", "by the patient") : L("โดยบุคลากร", "da un clinico", "by a clinician"))[lang];
}

/** Optional context: the session's orders, so an order event can name the drug (orderId is all the audit stores). */
export interface AuditCtx { orders?: MedicationOrder[] }
type P = Record<string, unknown>;
const drugOf = (p: P, ctx?: AuditCtx): string | null => {
  const o = isStr(p.orderId) ? ctx?.orders?.find((x) => x.id === p.orderId) : undefined;
  if (o) return orderTitle(o);
  return isStr(p.generic) ? p.generic : isStr(p.drugText) ? p.drugText : null;
};
const withDrug = (l: Localized, drug: string | null): Localized => (drug ? L(`${l.th}: ${drug}`, `${l.it}: ${drug}`, `${l.en}: ${drug}`) : l);

/** Event words per type. A Record over AuditType: a new type fails to compile until it has words here. */
const AUDIT_TEXT: Record<AuditType, (p: P, lang: Lang, ctx?: AuditCtx) => string> = {
  session_created: (p, lang) => {
    const pl = isStr(p.patientLang) && (p.patientLang === "th" || p.patientLang === "it" || p.patientLang === "en") ? LANG_WORD[p.patientLang][lang] : null;
    return L(`เริ่มการรับข้อมูล${pl ? ` ภาษาของผู้ป่วย ${pl}` : ""}`, `Accesso avviato${pl ? `, lingua del paziente: ${pl}` : ""}`, `Intake started${pl ? `, patient language ${pl}` : ""}`)[lang];
  },
  turn_added: (p, lang) => {
    const voice = p.inputMode === "voice";
    return L(`มีข้อความใหม่จากผู้ป่วย${voice ? " (เสียง)" : ""}`, `Messaggio del paziente aggiunto${voice ? " (voce)" : ""}`, `Patient message added${voice ? " (voice)" : ""}`)[lang];
  },
  pii_redacted: (p, lang) => {
    const n = arr(p.replaced).reduce<number>((t, r) => t + (r && typeof r === "object" && isNum((r as P).count) ? ((r as P).count as number) : 0), 0);
    return L(`ปกปิดข้อมูลส่วนตัวแล้ว${n ? ` ${n} รายการ` : ""}`, `Dati personali oscurati${n ? ` (${n})` : ""}`, `Personal details redacted${n ? ` (${n})` : ""}`)[lang];
  },
  red_flag: (p, lang) => {
    const ids = [...strs(p.ruleIds), ...(isStr(p.ruleId) ? [p.ruleId] : [])].join(", ");
    return withDrug(L("พบสัญญาณอันตราย", "Segnale d'allarme rilevato", "Red flag raised"), ids || null)[lang];
  },
  summary_generated: (p, lang) => {
    if (p.event === "consult_note_drafted") {
      const mode = isStr(p.mode) ? MODE_WORD[p.mode]?.[lang] : undefined;
      const lines = isNum(p.lineCount) ? count(p.lineCount, ["line", "lines"], ["riga", "righe"], "บรรทัด")[lang] : null;
      return `${SUMMARY_EVENT.consult_note_drafted[lang]}${mode || lines ? ` (${join(lang, [mode, lines])})` : ""}`;
    }
    if (isStr(p.event)) return SUMMARY_EVENT[p.event]?.[lang] ?? `${L("บันทึกขั้นตอนการสรุป", "Passaggio del riepilogo registrato", "Summary step recorded")[lang]} (${p.event})`;
    if (isNum(p.autoCaptured) && isNum(p.required)) {
      return L(`สร้างสรุปแล้ว: ช่องบังคับ ${p.autoCaptured} จาก ${p.required} มีคำพูดผู้ป่วยรองรับ`, `Riepilogo generato: ${p.autoCaptured} di ${p.required} campi obbligatori dalle parole del paziente`, `Summary generated: ${p.autoCaptured} of ${p.required} required fields from the patient's words`)[lang];
    }
    return L("สร้างสรุปแล้ว", "Riepilogo generato", "Summary generated")[lang];
  },
  abstained: (p, lang) => {
    const why = isStr(p.reason) ? ABSTAIN[p.reason]?.[lang] : undefined;
    return `${L("ระบบไม่สรุป ต้องให้บุคลากรตรวจ", "Il sistema si è astenuto: serve revisione umana", "System abstained: needs human review")[lang]}${why ? ` (${why})` : ""}`;
  },
  review: (p, lang) => {
    const acts = arr(p.actions).map((a) => (a && typeof a === "object" ? (a as P).action : undefined));
    const n = (k: string) => acts.filter((a) => a === k).length;
    const it = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    const parts = [
      n("approve") > 0 && L(`อนุมัติ ${n("approve")}`, it(n("approve"), "approvato", "approvati"), `${n("approve")} approved`)[lang],
      n("edit") > 0 && L(`แก้ไข ${n("edit")}`, it(n("edit"), "modificato", "modificati"), `${n("edit")} edited`)[lang],
      n("reject") > 0 && L(`ปฏิเสธ ${n("reject")}`, it(n("reject"), "rifiutato", "rifiutati"), `${n("reject")} rejected`)[lang],
    ];
    const head = L("แพทย์/พยาบาลทบทวนช่องข้อมูล", "Revisione clinica dei campi", "Clinician field review")[lang];
    return parts.some(Boolean) ? `${head}: ${join(lang, parts)}` : head;
  },
  red_flag_review: (p, lang) => {
    const parts = arr(p.actions).flatMap((a) => {
      if (!a || typeof a !== "object") return [];
      const x = a as P;
      const verb = x.action === "acknowledge" ? L("รับทราบ", "confermato", "acknowledged") : x.action === "false_alarm" ? L("แจ้งเตือนผิด", "falso allarme", "false alarm") : null;
      return [`${isStr(x.ruleId) ? x.ruleId : ""}${verb ? ` ${verb[lang]}` : ""}`.trim()].filter(Boolean);
    });
    const head = L("แพทย์/พยาบาลทบทวนสัญญาณอันตราย", "Revisione clinica del segnale d'allarme", "Clinician reviewed red flag")[lang];
    return parts.length ? `${head}: ${parts.join("; ")}` : head;
  },
  pharmacy_review: (p, lang) => {
    const acts = (v: unknown, map: Record<string, Localized>) => arr(v).map((a) => (a && typeof a === "object" ? String((a as P).action ?? "") : "")).filter(Boolean).map((a) => map[a]?.[lang] ?? a);
    const parts = [...acts(p.medActions, AUD.med), ...acts(p.allergyActions, AUD.allergy), ...acts(p.alertActions, AUD.alert), ...(p.complete === true ? [AUD.signed[lang]] : [])];
    return `${AUD.review[lang]}: ${parts.join(", ") || AUD.opened[lang]}`;
  },
  consult_turn: (p, lang) => {
    const who = isStr(p.speaker) ? SPEAKER_WORD[p.speaker]?.[lang] : undefined;
    const mode = isStr(p.mode) ? MODE_WORD[p.mode]?.[lang] : undefined;
    const voice = p.inputMode === "voice" ? L("เสียง", "voce", "voice")[lang] : undefined;
    const head = L("เพิ่มบรรทัดการตรวจ", "Riga di visita aggiunta", "Consult line added")[lang];
    return who || mode || voice ? `${head} (${join(lang, [who, mode && L(`การตรวจของ${mode}`, `visita ${mode}`, `${mode} consult`)[lang], voice])})` : head;
  },
  consult_suggestion: (p, lang) => {
    const st = isStr(p.status) ? SUGGESTION_WORD[p.status]?.[lang] : undefined;
    const head = L("คำแนะนำระหว่างการตรวจ", "Suggerimento di visita", "Consult suggestion")[lang];
    return st ? `${head}: ${st}` : head;
  },
  consult_note_signed: (p, lang) => {
    const mode = isStr(p.mode) ? MODE_WORD[p.mode]?.[lang] : undefined;
    const lines = isNum(p.lineCount) ? count(p.lineCount, ["line", "lines"], ["riga", "righe"], "บรรทัด")[lang] : null;
    const kept = strs(p.keptConsiderationIds).length;
    const keptWord = kept ? count(kept, ["consideration kept", "considerations kept"], ["ipotesi mantenuta", "ipotesi mantenute"], "ข้อพิจารณาที่เก็บไว้")[lang] : null;
    const head = L("ลงนามบันทึกการตรวจแล้ว", "Nota di visita firmata", "Consult note signed")[lang];
    return mode || lines || keptWord ? `${head} (${join(lang, [mode && L(`บันทึกของ${mode}`, `nota ${mode}`, `${mode} note`)[lang], lines, keptWord])})` : head;
  },
  vitals_recorded: (p, lang) => {
    const lvl = isNum(p.suggestedLevel) ? p.suggestedLevel : null;
    return L(`บันทึกสัญญาณชีพแล้ว${lvl ? ` ระดับคัดกรองที่เสนอ ${lvl}` : ""}`, `Parametri vitali registrati${lvl ? `, livello di triage suggerito ${lvl}` : ""}`, `Vital signs recorded${lvl ? `, suggested triage level ${lvl}` : ""}`)[lang];
  },
  triage_confirmed: (p, lang) => {
    const lvl = isNum(p.level) ? p.level : null;
    const sug = isNum(p.suggestedLevel) && p.suggestedLevel !== lvl ? p.suggestedLevel : null;
    return L(
      `ยืนยันระดับคัดกรอง${lvl ? ` ระดับ ${lvl}` : ""}${sug ? ` (ระบบเสนอ ${sug})` : ""}`,
      `Triage confermato${lvl ? `: livello ${lvl}` : ""}${sug ? ` (suggerito ${sug})` : ""}`,
      `Triage confirmed${lvl ? `: level ${lvl}` : ""}${sug ? ` (suggested ${sug})` : ""}`,
    )[lang];
  },
  order_drafted: (p, lang, ctx) => {
    const drug = drugOf(p, ctx);
    if (p.action === "cancel") return withDrug(L("ยกเลิกใบสั่งยา", "Ordine annullato", "Order cancelled"), drug)[lang]; // the engine records a cancel as order_drafted + action
    const head = p.updated === true ? L("แพทย์แก้ไขร่างใบสั่งยา", "Il prescrittore ha aggiornato una bozza", "Prescriber updated a draft order") : L("แพทย์บันทึกร่างใบสั่งยา", "Il prescrittore ha salvato una bozza", "Prescriber saved a draft order");
    const n = strs(p.checkIds).length;
    return join(lang, [withDrug(head, drug)[lang], Array.isArray(p.checkIds) && count(n, ["rule check", "rule checks"], ["controllo", "controlli"], "การตรวจตามกฎ")[lang]]);
  },
  order_submitted: (p, lang, ctx) => {
    if (p.kind === "investigation") return withDrug(L("สั่งการตรวจเพิ่มเติม", "Esame richiesto", "Investigation ordered"), isStr(p.code) ? p.code : null)[lang];
    const n = arr(p.overrides).length;
    return join(lang, [
      withDrug(L("แพทย์ส่งใบสั่งยาไปห้องยา", "Il prescrittore ha inviato l'ordine alla farmacia", "Prescriber sent the order to pharmacy"), drugOf(p, ctx))[lang],
      Array.isArray(p.overrides) && count(n, ["prescriber override", "prescriber overrides"], ["deroga del prescrittore", "deroghe del prescrittore"], "เหตุผลยืนยันของแพทย์")[lang],
      p.pickupReset === true && L("เริ่มรอบรับยาใหม่", "nuovo ciclo di ritiro", "new pickup cycle")[lang],
    ]);
  },
  order_pharmacy_action: (p, lang, ctx) => {
    const drug = drugOf(p, ctx);
    const again = p.afterRecheck === true ? L("หลังการตรวจซ้ำ", "dopo il ricontrollo", "after re-check")[lang] : null;
    if (p.action === "return") {
      const r = (p.report && typeof p.report === "object" ? p.report : {}) as P;
      const a = strs(r.alertIds).length, g = strs(r.suggestedGenerics).length;
      return join(lang, [
        withDrug(L("เภสัชกรคนแรกส่งใบสั่งยากลับแพทย์พร้อมรายงาน", "Il primo farmacista ha restituito l'ordine con un rapporto", "First pharmacist returned the order with a report"), drug)[lang],
        a > 0 && count(a, ["alert raised", "alerts raised"], ["avviso segnalato", "avvisi segnalati"], "การแจ้งเตือนที่แจ้งแพทย์")[lang],
        g > 0 && count(g, ["option for prescriber review", "options for prescriber review"], ["opzione per il prescrittore", "opzioni per il prescrittore"], "ทางเลือกให้แพทย์พิจารณา")[lang],
        again,
      ]);
    }
    return join(lang, [withDrug(L("เภสัชกรคนแรกตรวจสอบใบสั่งยาแล้ว", "Il primo farmacista ha verificato l'ordine", "First pharmacist verified the order"), drug)[lang], again]);
  },
  order_cancelled: (p, lang, ctx) => withDrug(L("ยกเลิกใบสั่งยา", "Ordine annullato", "Order cancelled"), drugOf(p, ctx))[lang],
  order_dispensed: (p, lang, ctx) => {
    const list = p.checklist && typeof p.checklist === "object" ? (p.checklist as P) : null;
    const ticked = list ? CHECKLIST_KEYS.filter((k) => list[k] === true).length : null;
    return join(lang, [
      withDrug(L("เภสัชกรคนที่สองตรวจขั้นสุดท้ายและจ่ายยาแล้ว", "Il secondo farmacista ha fatto il controllo finale e dispensato", "Second pharmacist did the final check and dispensed"), drugOf(p, ctx))[lang],
      isStr(p.verifiedBy) && L(`ตรวจสอบโดย ${p.verifiedBy}`, `verificato da ${p.verifiedBy}`, `verified by ${p.verifiedBy}`)[lang],
      ticked !== null && L(`ตรวจครบ ${ticked} จาก 6 ข้อ`, `controlli ${ticked} di 6`, `${ticked} of 6 checks`)[lang],
    ]);
  },
  order_recheck: (p, lang, ctx) => {
    const rules = strs(p.ruleIds).join(", ");
    const prev = isStr(p.previousPharmacist) ? p.previousPharmacist : null;
    return join(lang, [
      withDrug(L("ต้องตรวจซ้ำ: มีการแจ้งเตือนสูงใหม่หลังตรวจสอบ ส่งกลับเภสัชกรคนแรก", "Ricontrollo necessario: nuovo avviso alto dopo la verifica, l'ordine torna al primo farmacista", "Re-check needed: new high alert after verification, back to the first pharmacist"), drugOf(p, ctx))[lang],
      rules && L(`กฎ ${rules}`, `regola ${rules}`, `rule ${rules}`)[lang],
      prev && L(`เคยตรวจสอบโดย ${prev}`, `verificato prima da ${prev}`, `earlier verified by ${prev}`)[lang],
    ]);
  },
  pickup_called: (p, lang) => {
    const counter = isStr(p.counter) ? p.counter : null;
    const n = strs(p.orderIds).length;
    return join(lang, [
      L(p.recall === true ? "เรียกผู้ป่วยซ้ำ" : "เรียกผู้ป่วยรับยา", p.recall === true ? "Paziente richiamato" : "Paziente chiamato al ritiro", p.recall === true ? "Patient called again" : "Patient called to collect")[lang],
      counter && L(`ช่อง ${counter}`, `sportello ${counter}`, `counter ${counter}`)[lang],
      n > 0 && count(n, ["order", "orders"], ["ordine", "ordini"], "รายการยา")[lang],
    ]);
  },
  pickup_collected: (p, lang) => {
    const n = strs(p.orderIds).length;
    return join(lang, [L("ผู้ป่วยรับยาแล้ว", "Farmaci ritirati dal paziente", "Patient collected the medicines")[lang], n > 0 && count(n, ["order", "orders"], ["ordine", "ordini"], "รายการยา")[lang]]);
  },
  takeover: (_p, lang) => L("แพทย์/พยาบาลรับช่วงต่อการรับข้อมูล", "Un clinico ha preso in carico l'accesso", "Clinician took over the intake")[lang],
};

/**
 * One audit line in the UI language: what happened, its key fields (drug, triage level, override count, verifier,
 * counter) and who did it. Never empty and never a raw type name. Notes and free text stay on the order card.
 */
export function auditLine(e: AuditEvent, lang: Lang, ctx?: AuditCtx): string {
  const p = (e.payload && typeof e.payload === "object" ? e.payload : {}) as P;
  const text = AUDIT_TEXT[e.type]?.(p, lang, ctx) ?? L("บันทึกในระบบ", "Registrato nel sistema", "Recorded in the system")[lang];
  return `${text}, ${auditActor(e, lang)}`;
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
  pharmacyQueue: L("คิวห้องยา", "Coda della farmacia", "Pharmacy queue"),
  queueTitle: L("คิวเทียบรายการยา", "Coda di riconciliazione", "Reconciliation queue"),
  reconTab: L("เทียบรายการยา", "Riconciliazione", "Reconciliation"),
  findCode: L("ค้นหารหัสผู้ป่วย", "Cerca il codice paziente", "Find a patient code"),
  findCodeHint: L("พิมพ์ B-012 หรือ 12", "Scriva B-012 o 12", "Type B-012 or 12"),
  noCodeMatch: (q: string) => L(`ไม่พบรหัส "${q}" ในคิวนี้`, `Nessun codice "${q}" in questa coda`, `No code "${q}" in this queue`),
  noCodeMatchBody: L("ลองหาในขั้นตอนอื่น หรือล้างคำค้นหา", "Provi un'altra fase o cancelli la ricerca.", "Try another stage, or clear the search."),
  clearSearch: L("ล้างคำค้นหา", "Cancella la ricerca", "Clear search"),
  newArrival: L("ใหม่", "Nuovo", "New"),
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

// ---------- doctor medication orders ----------
export const ordersOf = (s: IntakeSession): MedicationOrder[] => s.orders?.medications ?? [];
export const hasOrders = (s: IntakeSession) => ordersOf(s).length > 0;
/** Submitted orders that still need the pharmacist. */
export const pendingOrders = (s: IntakeSession) => ordersOf(s).filter((o) => o.status === "submitted");
export const overrideOf = (o: MedicationOrder, alertId: string) => o.overrides.find((x) => x.alertId === alertId);
export const openHighChecks = (o: MedicationOrder) => o.checks.filter((c) => c.severity === "high" && !overrideOf(o, c.id));
/** Why Verify is disabled: every high alert needs a documented prescriber override. */
export function orderBlock(o: MedicationOrder): string | null {
  const n = openHighChecks(o).length;
  return n ? `${n} high ${n === 1 ? "alert has" : "alerts have"} no prescriber override. Return the order to the prescriber with a note.` : null;
}
export const orderTitle = (o: MedicationOrder) => `${o.generic ?? o.drugText} ${o.dose}`;

// ---------- two-stage pharmacy: verify (pharmacist 1), dispense (pharmacist 2), pickup ----------
/** Non-cancelled orders (drafts included). */
export const activeOrders = (s: IntakeSession) => ordersOf(s).filter((o) => o.status !== "cancelled");
/** Orders that left the prescriber: not cancelled and not drafts. Drafts stay with the prescriber and never block a call. */
export const sentOrders = (s: IntakeSession) => ordersOf(s).filter((o) => o.status !== "cancelled" && o.status !== "draft");
export const verifiedOrders = (s: IntakeSession) => ordersOf(s).filter((o) => o.status === "verified");
/** Waiting on pharmacist 1 (submitted), pharmacist 2 (verified) or back with the prescriber (returned): these block the call. */
const PHARMACY_PENDING = new Set<MedicationOrder["status"]>(["submitted", "returned", "verified"]);
export const blockingOrders = (s: IntakeSession) => sentOrders(s).filter((o) => PHARMACY_PENDING.has(o.status));
/** Dispensed orders already handed over in an earlier pickup cycle, from the append-only audit (empty when it is not loaded). */
export function collectedOrderIds(audit: AuditEvent[] | undefined): Set<string> {
  return new Set((audit ?? []).filter((e) => e.type === "pickup_collected").flatMap((e) => strs((e.payload as P | undefined)?.orderIds)));
}
/** Dispensed orders of the current pickup cycle. */
export const newlyDispensed = (s: IntakeSession, collected: ReadonlySet<string> = new Set()) => sentOrders(s).filter((o) => o.status === "dispensed" && !collected.has(o.id));
/**
 * Mirrors the engine's call rule (gate decisions a and b): nothing waiting on the pharmacy or the prescriber after a
 * return, at least one dispensed order not collected in an earlier cycle, never while the current cycle is collected.
 * Without the audit, earlier-cycle orders cannot be told apart; the server then refuses with its own words.
 */
export function canCall(s: IntakeSession, collected?: ReadonlySet<string>) {
  return s.pickup?.status !== "collected" && blockingOrders(s).length === 0 && newlyDispensed(s, collected).length > 0;
}
/** An order sent back to pharmacist 1 because a new high alert appeared after it was verified. */
export const isRecheck = (o: MedicationOrder) => o.status === "submitted" && !!o.recheck;

export type Stage = "verify" | "dispense" | "call" | "ready" | "collected";
export const STAGES: Stage[] = ["verify", "dispense", "call", "ready", "collected"];
export const STAGE_LABEL: Record<Stage, Localized> = {
  verify: L("รอตรวจใบสั่งยา", "Da verificare", "To verify"),
  dispense: L("รอจัดและจ่ายยา", "Da dispensare", "To dispense"),
  call: L("รอเรียกผู้ป่วย", "Da chiamare", "To call"),
  ready: L("พร้อมให้รับยา", "Pronti per il ritiro", "Ready for pickup"),
  collected: L("รับยาแล้ววันนี้", "Ritirati oggi", "Collected today"),
};
const sameDay = (iso: string | undefined, now: number) => !!iso && now > 0 && new Date(iso).toDateString() === new Date(now).toDateString();
/** Queue rows per stage. Verify and dispense are per order (one patient can have both); the pickup stages are per patient. */
export function stageRows<E extends { session: IntakeSession }>(entries: E[], now: number) {
  const orderRows = (pick: (s: IntakeSession) => MedicationOrder[]) => entries.flatMap((e) => pick(e.session).map((o) => ({ ...e, o })));
  const highFirst = (a: { o: MedicationOrder }, b: { o: MedicationOrder }) =>
    Number(b.o.checks.some((c) => c.severity === "high")) - Number(a.o.checks.some((c) => c.severity === "high")) || a.o.at.localeCompare(b.o.at);
  return {
    verify: orderRows(pendingOrders).sort(highFirst),
    dispense: orderRows(verifiedOrders).sort((a, b) => (a.o.pharmacist?.at ?? a.o.at).localeCompare(b.o.pharmacist?.at ?? b.o.at)),
    call: entries.filter((e) => canCall(e.session) && !e.session.pickup),
    ready: entries.filter((e) => e.session.pickup?.status === "ready").sort((a, b) => a.session.pickup!.calledAt.localeCompare(b.session.pickup!.calledAt)),
    collected: entries.filter((e) => e.session.pickup?.status === "collected" && sameDay(e.session.pickup.collectedAt, now)),
  };
}

// Same person: the engine compares staff id and display name as one identity (case-insensitive).
const norm = (v: string) => v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const personKey = (v: string) => { const n = norm(v); return STAFF.find((m) => norm(m.id) === n || norm(m.name) === n)?.id ?? n; };
export const samePerson = (a?: string | null, b?: string | null) => !!a && !!b && personKey(a) === personKey(b);

export const CHECKLIST_KEYS: (keyof DispenseChecklist)[] = ["rightPatient", "rightDrug", "rightDose", "rightRoute", "allergyRechecked", "labelled"];

// ---------- curated alternatives (medrules.alternatives): options for prescriber review, never a prescription ----------
interface AltEntry { id: string; kinds: string[]; drugClasses: string[]; consider: string[]; note: Localized; source: string }
const ALT_TABLE: AltEntry[] = ((medrules as { alternatives?: AltEntry[] }).alternatives ?? []);
/** The curated entries behind an alert's options (same match as the engine), so the UI can show their note and source. */
export function alternativeEntries(o: MedicationOrder, a: MedAlert): AltEntry[] {
  const options = a.alternatives ?? [];
  if (!options.length || !o.drugClass) return [];
  return ALT_TABLE.filter((e) => e.kinds.includes(a.kind) && e.drugClasses.includes(o.drugClass!) && e.consider.some((g) => options.includes(g)));
}
/** Specific dictionary generics a pharmacist may name in a report (no "(unspecified)" placeholders). */
export const DICTIONARY_GENERICS: string[] = [...new Set(medrules.drugs.map((d) => d.generic))].filter((g) => !g.endsWith("(unspecified)")).sort();
export const toDictionaryGeneric = (v: string) => { const n = v.normalize("NFC").trim().toLowerCase(); return DICTIONARY_GENERICS.includes(n) ? n : null; };
export const sameGeneric = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------- local application of order actions (fixture sessions only; live sessions use the server) ----------
// Each mirrors the engine rule and message (lib/pipeline/orders.ts), so the demo refuses what the server refuses.
const refuse = (msg: string): never => { throw new Error(msg); };
function withOrder(s: IntakeSession, orderId: string, change: (o: MedicationOrder) => MedicationOrder, at: string): IntakeSession {
  const meds = s.orders?.medications ?? [];
  if (!meds.some((o) => o.id === orderId)) refuse("Order not found");
  return { ...s, orders: { investigations: s.orders?.investigations ?? [], medications: meds.map((o) => (o.id === orderId ? change(o) : o)) }, updatedAt: at };
}
export function applyOrderAction(s: IntakeSession, orderId: string, req: PharmacyOrderActionReq, at: string): IntakeSession {
  const note = req.note?.trim();
  if (req.action === "return" && !note) refuse("Return requires a note");
  const generics = [...new Set((req.suggestedGenerics ?? []).map((g) => toDictionaryGeneric(g) ?? refuse("Suggested generic is not in the drug dictionary")))];
  if (generics.length > 5) refuse("At most five suggested generics");
  const alertIds = [...new Set(req.alertIds ?? [])];
  return withOrder(s, orderId, (o) => {
    if (o.status !== "submitted") refuse("Only submitted orders can be reviewed by pharmacy");
    if (alertIds.some((a) => !o.checks.some((c) => c.id === a))) refuse("Unknown alert for this order");
    if (generics.some((g) => sameGeneric(g, o.generic))) refuse("Suggested generic is the ordered drug");
    if (req.action === "verify" && openHighChecks(o).length) refuse("Every high alert requires an override reason");
    return {
      ...o,
      status: req.action === "verify" ? "verified" : "returned",
      pharmacist: { action: req.action, by: req.reviewerId, at, ...(note ? { note } : {}), ...(req.action === "return" ? { report: { alertIds, suggestedGenerics: generics } } : {}) },
    };
  }, at);
}
export function applyDispense(s: IntakeSession, orderId: string, req: DispenseOrderReq, at: string): IntakeSession {
  if (CHECKLIST_KEYS.some((k) => req.checklist[k] !== true)) refuse("Every dispense checklist item must be confirmed");
  const note = req.note?.trim();
  return withOrder(s, orderId, (o) => {
    if (isRecheck(o)) refuse("Re-check needed: a new high alert appeared after verification, so the order went back to pharmacist 1. Only verified orders can be dispensed");
    if (o.status !== "verified") refuse("Only verified orders can be dispensed");
    if (!o.pharmacist || samePerson(o.pharmacist.by, req.reviewerId)) refuse("A second pharmacist must dispense: the pharmacist who verified this order cannot also dispense it");
    return { ...o, status: "dispensed", dispense: { by: req.reviewerId, at, checklist: { ...req.checklist }, ...(note ? { note } : {}) } };
  }, at);
}
export function applyPickup(s: IntakeSession, req: PickupReq, at: string, collected: ReadonlySet<string> = new Set()): IntakeSession {
  if (req.action === "call") {
    if (s.pickup?.status === "collected") refuse("Medicines already collected");
    const sent = sentOrders(s);
    if (blockingOrders(s).length) refuse("Every active medication order must be dispensed before calling the patient");
    if (!newlyDispensed(s, collected).length) refuse(sent.length ? "No newly dispensed medicines to collect" : "No medication orders to collect");
    const where = req.counter?.trim() || (s.pickup?.status === "ready" ? s.pickup.counter : undefined);
    return { ...s, pickup: { status: "ready", ...(where ? { counter: where } : {}), calledBy: req.reviewerId, calledAt: at }, updatedAt: at };
  }
  if (s.pickup?.status !== "ready") refuse("Patient has not been called for pickup");
  return { ...s, pickup: { ...s.pickup!, status: "collected", collectedBy: req.reviewerId, collectedAt: at }, updatedAt: at };
}
