// Demo guide (M-06): who the visitor is playing and what to do next. Synthetic demo only; no clinical logic here.
// The stage comes from the shared journeyStage (server-derived on GET /api/sessions rows); this file only words it.
import { DEMO_PERSONAS, ROLE_STORAGE_KEY, reviewerStorageKey, type DemoPersona, type DemoPersonaId, type JourneyStage, type Lang, type Localized, type StaffRole } from "@medx/shared";

/** localStorage: the persona id chosen on the landing page (/demo or a persona card). The guide renders only when set. */
export const DEMO_PERSONA_KEY = "medx.demo.persona";
/** localStorage: the visitor's own demo case from POST /api/demo/start, as JSON { id, code, personaId }. */
export const DEMO_CASE_KEY = "medx.demo.case";
/** Same key useStaffRole reads for the last nurse/doctor choice. */
const CLINICIAN_ROLE_KEY = "medx.clinicianRole";

type Get = Pick<Storage, "getItem">;
type Set = Pick<Storage, "setItem">;
const local = (): (Get & Set & Pick<Storage, "removeItem">) | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

/** A stored persona value: the plain id, or JSON with an `id`. Anything else (or an unknown id) is no persona. */
export function parsePersona(raw: string | null | undefined): DemoPersona | null {
  if (!raw) return null;
  let id: unknown = raw.trim();
  if (typeof id === "string" && id.startsWith("{")) {
    try { id = (JSON.parse(id) as { id?: unknown }).id; } catch { return null; }
  }
  return DEMO_PERSONAS.find((p) => p.id === id) ?? null;
}

/** Every access is wrapped: private mode, blocked storage or a thumbnail capture simply means "no persona". */
export function readDemoPersona(storage: Get | null = local()): DemoPersona | null {
  try { return parsePersona(storage?.getItem(DEMO_PERSONA_KEY)); } catch { return null; }
}

export interface DemoCase { id: string; code: string; personaId?: DemoPersonaId }
export function readDemoCase(storage: Get | null = local()): DemoCase | null {
  try {
    const raw = storage?.getItem(DEMO_CASE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DemoCase>;
    return typeof v.id === "string" && v.id ? { id: v.id, code: typeof v.code === "string" ? v.code : "", personaId: v.personaId } : null;
  } catch { return null; }
}
export function writeDemoCase(c: DemoCase, storage: Set | null = local()) {
  try { storage?.setItem(DEMO_CASE_KEY, JSON.stringify(c)); } catch { /* storage blocked: the guide still navigates */ }
}

/**
 * Become a persona: remember it, and make the staff identity match so every write is attributed to that person.
 * Writes the persona, the role (and the last nurse/doctor role) and the reviewer name for that role.
 * Landing builders can call this from a persona card before navigating.
 */
export function applyDemoPersona(id: DemoPersonaId, storage: Set | null = local()): DemoPersona | null {
  const p = DEMO_PERSONAS.find((x) => x.id === id) ?? null;
  if (!p) return null;
  try {
    storage?.setItem(DEMO_PERSONA_KEY, p.id);
    if (p.role !== "patient") {
      storage?.setItem(ROLE_STORAGE_KEY, p.role);
      if (p.role === "nurse" || p.role === "doctor") storage?.setItem(CLINICIAN_ROLE_KEY, p.role);
      if (p.staffName) storage?.setItem(reviewerStorageKey(p.role), p.staffName);
    }
  } catch { /* storage blocked: identity stays in memory for this page */ }
  return p;
}

/**
 * The persona that matches the person on screen: the same staff name first, then the same role (keeping the stored
 * persona when it already has that role, so Pharmacist 2 stays Pharmacist 2), then the stored persona.
 */
export function personaFor(role: StaffRole | null | undefined, name: string | null | undefined, stored: DemoPersona | null): DemoPersona | null {
  const byName = name ? DEMO_PERSONAS.find((p) => p.staffName === name) : undefined;
  if (byName) return byName;
  if (role) {
    if (stored?.role === role) return stored;
    const byRole = DEMO_PERSONAS.find((p) => p.role === role);
    if (byRole) return byRole;
  }
  return stored;
}

/** Where a persona works on a case. */
export function demoHref(p: Pick<DemoPersona, "role">, caseId: string): string {
  const id = encodeURIComponent(caseId);
  if (p.role === "doctor") return `/review/${id}/consult?mode=doctor`;
  if (p.role === "pharmacist") return `/pharmacy/${id}`;
  if (p.role === "ops") return "/ops";
  return `/review/${id}`;
}

/** Case id in the current path (/review/<id>/..., /pharmacy/<id>), or null on queues and other pages. */
export function caseIdFromPath(path: string | null | undefined): string | null {
  const m = path?.match(/^\/(?:review|pharmacy)\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const L = (en: string, th: string, it: string): Localized => ({ en, th, it });

/** Guide chrome. Thai and Italian need native-speaker review. */
export const G = {
  label: L("Demo guide", "คู่มือการสาธิต", "Guida alla demo"),
  synthetic: L("Synthetic demo", "การสาธิตด้วยข้อมูลสังเคราะห์", "Demo con dati sintetici"),
  you: L("You are {name}", "คุณคือ {name}", "Lei è {name}"),
  patientName: L("the patient", "ผู้ป่วย", "il paziente"),
  next: L("Next", "ขั้นต่อไป", "Prossimo passo"),
  caseCode: L("Your case {code}", "เคสของคุณ {code}", "Il suo caso {code}"),
  caseOther: L("Case {code}", "เคส {code}", "Caso {code}"),
  openCase: L("Open my demo case", "เปิดเคสสาธิตของฉัน", "Apri il mio caso demo"),
  switchPersona: L("Switch persona", "เปลี่ยนบทบาท", "Cambia persona"),
  reset: L("Reset my demo case", "เริ่มเคสสาธิตใหม่", "Ricomincia il mio caso demo"),
  resetting: L("Preparing a new case", "กำลังเตรียมเคสใหม่", "Preparo un nuovo caso"),
  resetBusy: L("The demo is busy right now. Try again in a few minutes, or switch persona.", "ขณะนี้การสาธิตมีผู้ใช้มาก กรุณาลองใหม่ในอีกสักครู่ หรือเปลี่ยนบทบาท", "La demo è occupata. Riprovi tra qualche minuto o cambi persona."),
  resetOff: L("New demo cases are not enabled on this server.", "เซิร์ฟเวอร์นี้ไม่ได้เปิดการสร้างเคสสาธิตใหม่", "Su questo server i nuovi casi demo non sono attivi."),
  resetFailed: L("Could not start a new demo case: {msg}", "เริ่มเคสสาธิตใหม่ไม่ได้: {msg}", "Impossibile avviare un nuovo caso demo: {msg}"),
} satisfies Record<string, Localized>;
export type GKey = keyof typeof G;
export const gt = (k: GKey, lang: Lang, v: Record<string, string | number> = {}) => G[k][lang].replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? ""));

type Step = { owners: readonly StaffRole[]; own: Localized; other: Localized };
const STEP: Record<JourneyStage, Step> = {
  intake: {
    owners: ["nurse"],
    own: L("Review the intake: acknowledge any red flag, then approve the supported fields.", "ทบทวนข้อมูลที่รับมา รับทราบสัญญาณอันตรายถ้ามี แล้วอนุมัติช่องที่มีหลักฐาน", "Riveda l'accettazione: confermi eventuali segnali d'allarme, poi approvi i campi supportati."),
    other: L("The nurse reviews the intake first.", "พยาบาลทบทวนข้อมูลที่รับมาก่อน", "Prima l'infermiere rivede l'accettazione."),
  },
  intake_reviewed: {
    owners: ["nurse"],
    own: L("Record vitals, then confirm the triage level.", "บันทึกสัญญาณชีพ แล้วยืนยันระดับการคัดแยก", "Registri i parametri vitali, poi confermi il livello di triage."),
    other: L("The nurse records vitals and confirms triage next.", "พยาบาลบันทึกสัญญาณชีพและยืนยันการคัดแยกเป็นขั้นต่อไป", "Ora l'infermiere registra i parametri e conferma il triage."),
  },
  triaged: {
    owners: ["nurse"],
    own: L("Take the history in the consult, or press Ready for doctor.", "ซักประวัติในหน้าการสอบถาม หรือกด พร้อมพบแพทย์", "Raccolga l'anamnesi nel consulto, oppure prema Pronto per il medico."),
    other: L("The nurse takes the history, then hands over to the doctor.", "พยาบาลซักประวัติ แล้วส่งต่อให้แพทย์", "L'infermiere raccoglie l'anamnesi, poi passa al medico."),
  },
  nurse_done: {
    owners: ["doctor"],
    own: L("Run the consult, keep the considerations you agree with, then sign the note.", "ทำการตรวจ เก็บข้อพิจารณาที่เห็นด้วย แล้วลงนามบันทึก", "Conduca il consulto, mantenga le considerazioni che condivide, poi firmi la nota."),
    other: L("Handed over: the doctor runs the consult next.", "ส่งต่อแล้ว แพทย์จะทำการตรวจเป็นขั้นต่อไป", "Passato al medico: ora conduce il consulto."),
  },
  doctor_signed: {
    owners: ["doctor"],
    own: L("Write orders. Prescribing checks run before anything reaches the pharmacy.", "เขียนคำสั่งการรักษา ระบบตรวจการสั่งยาก่อนส่งถึงห้องยา", "Scriva gli ordini. I controlli di prescrizione girano prima della farmacia."),
    other: L("The doctor writes orders next.", "แพทย์เขียนคำสั่งการรักษาเป็นขั้นต่อไป", "Ora il medico scrive gli ordini."),
  },
  orders_submitted: {
    owners: ["doctor"],
    own: L("Orders sent. No medicine waits for the pharmacy on this case.", "ส่งคำสั่งแล้ว เคสนี้ไม่มียารอที่ห้องยา", "Ordini inviati. Nessun farmaco attende la farmacia per questo caso."),
    other: L("No prescription waits for the pharmacy on this case.", "เคสนี้ไม่มีใบสั่งยารอที่ห้องยา", "Nessuna prescrizione attende la farmacia per questo caso."),
  },
  pharmacy_verify: {
    owners: ["pharmacist"],
    own: L("Pharmacist 1: check the prescription, then verify it or return it with options for prescriber review.", "เภสัชกรคนที่ 1: ตรวจใบสั่งยา แล้วยืนยัน หรือส่งคืนพร้อมทางเลือกให้แพทย์ผู้สั่งพิจารณา", "Farmacista 1: controlli la prescrizione, poi la verifichi o la restituisca con opzioni da valutare."),
    other: L("Pharmacist 1 checks the prescription next.", "เภสัชกรคนที่ 1 ตรวจใบสั่งยาเป็นขั้นต่อไป", "Ora il farmacista 1 controlla la prescrizione."),
  },
  pharmacy_dispense: {
    owners: ["pharmacist"],
    own: L("Pharmacist 2: do the final two-person check, dispense, then call the patient.", "เภสัชกรคนที่ 2: ตรวจซ้ำขั้นสุดท้ายแบบสองคน จ่ายยา แล้วเรียกผู้ป่วย", "Farmacista 2: faccia il doppio controllo finale, dispensi, poi chiami il paziente."),
    other: L("Pharmacist 2 does the final check and dispenses next.", "เภสัชกรคนที่ 2 ตรวจซ้ำขั้นสุดท้ายและจ่ายยาเป็นขั้นต่อไป", "Ora il farmacista 2 fa il controllo finale e dispensa."),
  },
  ready_for_pickup: {
    owners: ["pharmacist"],
    own: L("Hand over the medicines, then mark them collected.", "ส่งมอบยา แล้วบันทึกว่าผู้ป่วยรับยาแล้ว", "Consegni i farmaci, poi segni il ritiro."),
    other: L("The patient has been called to collect the medicines.", "เรียกผู้ป่วยมารับยาแล้ว", "Il paziente è stato chiamato al ritiro."),
  },
  collected: {
    owners: [],
    own: L("This visit is complete. Reset my demo case to walk through it again.", "การมาพบครั้งนี้เสร็จสมบูรณ์ กด เริ่มเคสสาธิตใหม่ เพื่อทำอีกครั้ง", "La visita è completa. Ricominci il caso demo per ripercorrerla."),
    other: L("This visit is complete. Reset my demo case to walk through it again.", "การมาพบครั้งนี้เสร็จสมบูรณ์ กด เริ่มเคสสาธิตใหม่ เพื่อทำอีกครั้ง", "La visita è completa. Ricominci il caso demo per ripercorrerla."),
  },
};
/** Role-specific wording where one stage has work for two roles. */
const ROLE_STEP: Partial<Record<JourneyStage, Partial<Record<StaffRole, Localized>>>> = {
  // "Ready for doctor" is a handover, not a record change: the doctor starts at a triaged case.
  triaged: {
    doctor: L("Start the consult: listen, keep the considerations you agree with, then sign the note.", "เริ่มการตรวจ ฟังผู้ป่วย เก็บข้อพิจารณาที่เห็นด้วย แล้วลงนามบันทึก", "Avvii il consulto: ascolti, mantenga le considerazioni che condivide, poi firmi la nota."),
  },
};
const COLLECTING = L("The patient is still answering. Wait for the summary, or take over.", "ผู้ป่วยยังตอบอยู่ รอสรุป หรือรับช่วงต่อ", "Il paziente sta ancora rispondendo. Attenda il riepilogo o prenda in gestione.");
const RETURNED = L("A pharmacist returned a prescription: read the report, edit, re-check and submit again.", "เภสัชกรส่งใบสั่งยาคืน อ่านรายงาน แก้ไข ตรวจซ้ำ แล้วส่งใหม่", "Un farmacista ha restituito una prescrizione: legga il rapporto, modifichi, ricontrolli e invii di nuovo.");
const OPS = L("Watch the queue, escalations, abstentions and the pharmacy pipeline.", "ติดตามคิว การส่งต่อเร่งด่วน การงดสรุป และงานของห้องยา", "Segua la coda, le escalation, le astensioni e il flusso della farmacia.");
const PATIENT = L("Describe what brings you in on the phone, in English, Thai or Italian.", "เล่าอาการบนโทรศัพท์ว่าวันนี้มาด้วยเรื่องอะไร เป็นภาษาไทย อังกฤษ หรืออิตาลี", "Descriva al telefono perché è qui, in italiano, inglese o tailandese.");

/**
 * The next step for this person at this stage. Words only: the stage is a neutral journey marker and never decides
 * urgency (red flags and triage do). `collecting`: the patient is still answering. `returned`: a medication order
 * is back with the prescriber.
 */
export function nextStep(stage: JourneyStage, role: StaffRole | "patient", opts: { collecting?: boolean; returned?: boolean } = {}): Localized {
  if (role === "ops") return OPS;
  if (role === "patient") return stage === "intake" ? PATIENT : STEP[stage].other;
  if (stage === "intake" && opts.collecting) return COLLECTING;
  if (opts.returned && role === "doctor" && stage === "orders_submitted") return RETURNED;
  const special = ROLE_STEP[stage]?.[role];
  if (special) return special;
  const s = STEP[stage];
  return s.owners.includes(role) ? s.own : s.other;
}
