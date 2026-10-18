import { DEMO_PERSONAS, type DemoPersonaId, type Lang } from "@medx/shared";
import type { MarketingNavLabels } from "../../components/ui";

/*
 * Strings shared by the landing (/, /th, /it), the persona hub (/demo) and the persona launcher (/demo/<id>).
 * Kept apart from copy.ts so the /demo client bundle carries only these.
 * English is the source. Thai and Italian are marked "native review pending" until a native speaker signs off.
 */

export interface NavCopy {
  how: string;
  features: string;
  safety: string;
  roles: string;
  cta: string;
  labels: MarketingNavLabels;
}

export const NAV_COPY: Record<Lang, NavCopy> = {
  en: {
    how: "How it works",
    features: "Features",
    safety: "Safety",
    roles: "Try a role",
    cta: "Try the demo",
    labels: { nav: "Main", menuOpen: "Open menu", menuClose: "Close menu", language: "Language", skip: "Skip to content", home: "MedX home" },
  },
  th: {
    how: "วิธีการทำงาน",
    features: "ฟีเจอร์",
    safety: "ความปลอดภัย",
    roles: "ลองบทบาท",
    cta: "ลองเดโม",
    labels: { nav: "เมนูหลัก", menuOpen: "เปิดเมนู", menuClose: "ปิดเมนู", language: "ภาษา", skip: "ข้ามไปยังเนื้อหา", home: "หน้าแรก MedX" },
  },
  it: {
    how: "Come funziona",
    features: "Funzioni",
    safety: "Sicurezza",
    roles: "Provi un ruolo",
    cta: "Provi la demo",
    labels: { nav: "Principale", menuOpen: "Apri il menu", menuClose: "Chiudi il menu", language: "Lingua", skip: "Vai al contenuto", home: "Home di MedX" },
  },
};

/** Visible note on every non-English marketing page. */
export const PENDING_REVIEW: Record<Lang, string | null> = {
  en: null,
  th: "ข้อความภาษาไทยในหน้านี้รอการตรวจทานโดยเจ้าของภาษา (native review pending)",
  it: "Testo italiano in attesa di revisione madrelingua (native review pending)",
};

export interface PersonaCopy {
  label: string;
  task: string;
}

/** English comes from DEMO_PERSONAS (the shared contract); Thai and Italian are translations of it. */
const PERSONA_TRANSLATIONS: Record<Exclude<Lang, "en">, Record<DemoPersonaId, PersonaCopy>> = {
  th: {
    patient: { label: "ผู้ป่วย", task: "เล่าให้ Fin ฟังว่ามาด้วยอาการอะไร ด้วยเสียงหรือการพิมพ์ เป็นภาษาไทย อิตาลี หรืออังกฤษ" },
    "nurse-rossi": { label: "พยาบาล", task: "ทบทวนข้อมูลซักประวัติ บันทึกสัญญาณชีพ และยืนยันระดับการคัดแยก" },
    "doctor-bianchi": { label: "แพทย์", task: "ซักประวัติ ทบทวนข้อพิจารณาตามกฎ ลงนามบันทึก และสั่งการรักษา" },
    "pharm-conti": { label: "เภสัชกรคนที่ 1 (ตรวจสอบ)", task: "ตรวจใบสั่งยา แล้วยืนยัน หรือส่งคืนพร้อมทางเลือกให้ผู้สั่งยาพิจารณา" },
    "pharm-wong": { label: "เภสัชกรคนที่ 2 (จ่ายยา)", task: "ตรวจขั้นสุดท้ายแบบสองคน จ่ายยา และเรียกผู้ป่วยไปที่ช่องรับยา" },
    "ops-head": { label: "ฝ่ายปฏิบัติการคลินิก", task: "ติดตามคิว การส่งต่อด่วน การงดตอบ และขั้นตอนห้องยา" },
  },
  it: {
    patient: { label: "Paziente", task: "Racconti a Fin il motivo della visita, a voce o per iscritto, in tailandese, italiano o inglese." },
    "nurse-rossi": { label: "Infermiera", task: "Esamina l'accoglienza, registra i parametri vitali e conferma il livello di triage." },
    "doctor-bianchi": { label: "Medico", task: "Conduce il consulto, valuta le considerazioni basate su regole, firma la nota e prescrive." },
    "pharm-conti": { label: "Farmacista 1 (verifica)", task: "Controlla la prescrizione, poi la verifica o la restituisce con opzioni da valutare per il prescrittore." },
    "pharm-wong": { label: "Farmacista 2 (dispensazione)", task: "Esegue il controllo finale a due persone, dispensa e chiama il paziente al banco." },
    "ops-head": { label: "Operatività della clinica", task: "Segue la coda, le segnalazioni, le astensioni e il flusso della farmacia." },
  },
};

export function personaCopy(id: DemoPersonaId, lang: Lang): PersonaCopy {
  if (lang !== "en") return PERSONA_TRANSLATIONS[lang][id];
  const p = DEMO_PERSONAS.find((x) => x.id === id);
  return { label: p?.label ?? id, task: p?.task ?? "" };
}

export interface RolesCopy {
  phone: string;
  web: string;
  cta: string;
  patientName: string;
  notice: string;
}

export const ROLES_COPY: Record<Lang, RolesCopy> = {
  en: {
    phone: "Phone",
    web: "Web",
    cta: "Open the demo as this person",
    patientName: "You, the patient",
    notice: "Synthetic data only. Do not enter real patient information.",
  },
  th: {
    phone: "โทรศัพท์",
    web: "เว็บ",
    cta: "เปิดเดโมในบทบาทนี้",
    patientName: "คุณ ในฐานะผู้ป่วย",
    notice: "ข้อมูลสังเคราะห์เท่านั้น ห้ามกรอกข้อมูลผู้ป่วยจริง",
  },
  it: {
    phone: "Telefono",
    web: "Web",
    cta: "Apri la demo come questa persona",
    patientName: "Lei, come paziente",
    notice: "Solo dati sintetici. Non inserisca dati reali di pazienti.",
  },
};

export interface HubCopy {
  eyebrow: string;
  titleA: string;
  titleB: string;
  subtitle: string;
  countsTitle: string;
  countsNote: string;
  sessionsToday: string;
  awaiting: string;
  pharmacy: string;
  pickup: string;
  noData: string;
  countsUnavailable: string;
  qrTitle: string;
  qrBody: string;
  qrLabel: string;
  openPatient: string;
  /** Short label for the nav call to action (fits the phone nav). */
  navCta: string;
  backHome: string;
  footerDisclaimer: string;
  footerNote: string;
}

export const HUB_COPY: Record<Lang, HubCopy> = {
  en: {
    eyebrow: "Live demo",
    titleA: "Try MedX as",
    titleB: "any role",
    subtitle: "Each role opens a fresh synthetic case at that person's step, signed in as them. The counts below come live from the demo server.",
    countsTitle: "Live demo counts",
    countsNote: "Refreshes every 10 seconds. Synthetic cases only.",
    sessionsToday: "Visits today",
    awaiting: "Awaiting review",
    pharmacy: "In the pharmacy",
    pickup: "Ready to collect",
    noData: "No data yet",
    countsUnavailable: "Live counts are unavailable right now.",
    qrTitle: "Phone and web, one record",
    qrBody: "Scan the code with a phone camera to open the patient app. Staff see the same case on the web.",
    qrLabel: "QR code for the patient app",
    openPatient: "Open the patient app",
    navCta: "Patient app",
    backHome: "Back to the overview",
    footerDisclaimer:
      "Research prototype. MedX supports clinicians; it does not diagnose, treat, prescribe or decide urgency. Synthetic data only. Not clinically validated, not a medical device.",
    footerNote: "Built for AMD Developer Hackathon ACT III, Track 2 (Health and wellbeing).",
  },
  th: {
    eyebrow: "เดโมสด",
    titleA: "ลองใช้ MedX",
    titleB: "ในทุกบทบาท",
    subtitle: "แต่ละบทบาทเปิดเคสสังเคราะห์ใหม่ในขั้นตอนของคนนั้น พร้อมเข้าสู่ระบบในนามของเขา ตัวเลขด้านล่างมาจากเซิร์ฟเวอร์เดโมแบบสด",
    countsTitle: "ตัวเลขเดโมแบบสด",
    countsNote: "อัปเดตทุก 10 วินาที เป็นเคสสังเคราะห์เท่านั้น",
    sessionsToday: "การมาพบแพทย์วันนี้",
    awaiting: "รอทบทวน",
    pharmacy: "อยู่ที่ห้องยา",
    pickup: "พร้อมรับยา",
    noData: "ยังไม่มีข้อมูล",
    countsUnavailable: "ไม่สามารถแสดงตัวเลขสดได้ในขณะนี้",
    qrTitle: "โทรศัพท์และเว็บ ข้อมูลชุดเดียว",
    qrBody: "สแกนรหัสด้วยกล้องโทรศัพท์เพื่อเปิดแอปผู้ป่วย บุคลากรเห็นเคสเดียวกันบนเว็บ",
    qrLabel: "QR code สำหรับแอปผู้ป่วย",
    openPatient: "เปิดแอปผู้ป่วย",
    navCta: "แอปผู้ป่วย",
    backHome: "กลับไปหน้าภาพรวม",
    footerDisclaimer:
      "ต้นแบบงานวิจัย MedX สนับสนุนบุคลากรทางการแพทย์ ไม่วินิจฉัย ไม่รักษา ไม่สั่งยา และไม่ตัดสินความเร่งด่วน ใช้ข้อมูลสังเคราะห์เท่านั้น ยังไม่ผ่านการตรวจสอบทางคลินิก และไม่ใช่เครื่องมือแพทย์",
    footerNote: "สร้างสำหรับ AMD Developer Hackathon ACT III, Track 2 (สุขภาพและความเป็นอยู่ที่ดี)",
  },
  it: {
    eyebrow: "Demo dal vivo",
    titleA: "Provi MedX in",
    titleB: "ogni ruolo",
    subtitle: "Ogni ruolo apre un nuovo caso sintetico al passo di quella persona, con il suo accesso. I conteggi qui sotto arrivano in tempo reale dal server della demo.",
    countsTitle: "Conteggi della demo dal vivo",
    countsNote: "Aggiornati ogni 10 secondi. Solo casi sintetici.",
    sessionsToday: "Visite di oggi",
    awaiting: "In attesa di revisione",
    pharmacy: "In farmacia",
    pickup: "Pronti per il ritiro",
    noData: "Nessun dato",
    countsUnavailable: "I conteggi dal vivo non sono disponibili al momento.",
    qrTitle: "Telefono e web, una scheda",
    qrBody: "Inquadri il codice con la fotocamera del telefono per aprire l'app del paziente. Il personale vede lo stesso caso sul web.",
    qrLabel: "Codice QR per l'app del paziente",
    openPatient: "Apri l'app del paziente",
    navCta: "App paziente",
    backHome: "Torna alla panoramica",
    footerDisclaimer:
      "Prototipo di ricerca. MedX supporta i clinici; non diagnostica, non cura, non prescrive e non decide l'urgenza. Solo dati sintetici. Non validato clinicamente, non è un dispositivo medico.",
    footerNote: "Realizzato per AMD Developer Hackathon ACT III, Track 2 (Salute e benessere).",
  },
};

export interface LaunchCopy {
  opening: string;
  preparing: string;
  patient: string;
  ops: string;
  manual: string;
  back: string;
  signedInAs: string;
}

export const LAUNCH_COPY: Record<Lang, LaunchCopy> = {
  en: {
    opening: "Opening the demo as {name}",
    preparing: "Preparing a synthetic case at this step: the model replays the patient intake. This can take up to a minute.",
    patient: "Opening the patient app with a fresh intake.",
    ops: "Opening the clinic operations dashboard.",
    manual: "Open it now",
    back: "Back to all roles",
    signedInAs: "Signed in as",
  },
  th: {
    opening: "กำลังเปิดเดโมในนาม {name}",
    preparing: "กำลังเตรียมเคสสังเคราะห์ในขั้นตอนนี้ โมเดลกำลังเล่นบทซักประวัติคนไข้ซ้ำ อาจใช้เวลาถึงหนึ่งนาที",
    patient: "กำลังเปิดแอปผู้ป่วยพร้อมการซักประวัติใหม่",
    ops: "กำลังเปิดแดชบอร์ดการดำเนินงานของคลินิก",
    manual: "เปิดทันที",
    back: "กลับไปที่ทุกบทบาท",
    signedInAs: "เข้าสู่ระบบในนาม",
  },
  it: {
    opening: "Apertura della demo come {name}",
    preparing: "Preparazione di un caso sintetico a questo passo: il modello ripete l’anamnesi del paziente. Può richiedere fino a un minuto.",
    patient: "Apertura dell'app del paziente con una nuova accoglienza.",
    ops: "Apertura della dashboard operativa della clinica.",
    manual: "Apri ora",
    back: "Torna a tutti i ruoli",
    signedInAs: "Accesso come",
  },
};
