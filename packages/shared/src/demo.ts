// Demo entry points for the landing page ("Try a role", "Try saying"). Synthetic data only.
import type { JourneyStage } from "./journey";
import { STAFF, type StaffRole } from "./staff";
import type { Lang } from "./types";

export type DemoPersonaId = "patient" | "nurse-rossi" | "doctor-bianchi" | "pharm-conti" | "pharm-wong" | "ops-head";

export interface DemoPersona {
  id: DemoPersonaId;
  role: "patient" | StaffRole;
  /** Exact STAFF display name (the identity every write is attributed to); null for the patient. */
  staffName: string | null;
  /** Journey stage of this persona's demo case: where their work starts (POST /api/demo/start { stage }). */
  stage: JourneyStage;
  /** English card label. */
  label: string;
  /** English one-line description of what this person does in the demo. */
  task: string;
}

function staffName(id: string): string {
  const member = STAFF.find(s => s.id === id);
  if (!member) throw new Error(`DEMO_PERSONAS: ${id} is not in STAFF`);
  return member.name;
}

/** Exactly six roles. The patient and the nurse share one record: the phone and the nurse's queue show the same case. */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { id: "patient", role: "patient", staffName: null, stage: "intake", label: "Patient", task: "Tell Fin what brings you in, by voice or text, in English, Thai or Italian." },
  { id: "nurse-rossi", role: "nurse", staffName: staffName("nurse-rossi"), stage: "intake", label: "Nurse", task: "Review the intake, record vitals and confirm the triage level." },
  { id: "doctor-bianchi", role: "doctor", staffName: staffName("doctor-bianchi"), stage: "nurse_done", label: "Doctor", task: "Run the consult, review rule-based considerations, sign the note and write orders." },
  { id: "pharm-conti", role: "pharmacist", staffName: staffName("pharm-conti"), stage: "pharmacy_verify", label: "Pharmacist 1 (verify)", task: "Check the prescription, then verify it or return it with options for prescriber review." },
  { id: "pharm-wong", role: "pharmacist", staffName: staffName("pharm-wong"), stage: "pharmacy_dispense", label: "Pharmacist 2 (dispense)", task: "Do the final two-person check, dispense, and call the patient to the counter." },
  { id: "ops-head", role: "ops", staffName: staffName("ops-head"), stage: "ready_for_pickup", label: "Clinic operations", task: "Watch the queue, escalations, abstentions and the pharmacy pipeline." },
];

export interface DemoSample {
  /** Same as fixtureId. */
  id: string;
  lang: Lang;
  /** Exact first patient turn of the synthetic fixture in data/cases/<fixtureId>.json. */
  text: string;
  fixtureId: string;
  synthetic: true;
  /** English label for the example. */
  label: string;
  /** true when the deterministic red-flag rules escalate this text (show it with urgency styling, never next to Fin). */
  redFlag: boolean;
}

/** "Try saying" examples. Each text is copied verbatim from its synthetic fixture (a test keeps them in sync). */
export const DEMO_SAMPLES: readonly DemoSample[] = [
  { id: "EN-01", fixtureId: "EN-01", lang: "en", synthetic: true, redFlag: false, label: "Burning when passing urine",
    text: "Hi, I've had burning when I pee for two days now, and I need to go all the time. No fever. It's about a 4 out of 10. I'm a 31 year old woman, I'm not pregnant, no allergies, and I only take a daily multivitamin." },
  { id: "EN-02", fixtureId: "EN-02", lang: "en", synthetic: true, redFlag: false, label: "Twisted ankle",
    text: "I rolled my left ankle playing football yesterday evening. It's swollen and I can barely put weight on it, maybe 6/10. I'm 24, male, no allergies, and I don't take any medication." },
  { id: "IT-01", fixtureId: "IT-01", lang: "it", synthetic: true, redFlag: false, label: "Sore throat (Italian)",
    text: "Buongiorno, ho mal di gola da due giorni, soprattutto quando deglutisco. Niente febbre. Direi 4 su 10. Sono un uomo di 35 anni, non sono allergico a nulla e non prendo farmaci." },
  { id: "DEMO-GOLD", fixtureId: "DEMO-GOLD", lang: "en", synthetic: true, redFlag: false, label: "Sore throat, white spots on the tonsils, penicillin allergy",
    text: "I've had a sore throat for two days and I can see white spots on my tonsils. It hurts to swallow. It's about 7 out of 10. I'm a 24 year old man. I'm allergic to penicillin, it gave me a rash. I don't take any medication." },
  { id: "TH-01", fixtureId: "TH-01", lang: "th", synthetic: true, redFlag: false, label: "Sore throat (Thai)",
    text: "เจ็บคอมาสองวันแล้วครับ กลืนน้ำลายก็เจ็บ มีไข้ต่ำๆ ประมาณ 37.8 เจ็บระดับ 4 จาก 10 ผู้ชายอายุ 28 ครับ ไม่แพ้ยาอะไร ไม่ได้กินยาประจำ มีแค่พาราตอนเช้า" },
  { id: "TH-05", fixtureId: "TH-05", lang: "th", synthetic: true, redFlag: true, label: "Chest pain with sweating (Thai, red flag)",
    text: "แน่นหน้าอก เหงื่อออกเยอะมากเลยค่ะ ร้าวไปที่แขนซ้ายด้วย เป็นมาประมาณครึ่งชั่วโมงแล้ว ผู้หญิงอายุ 58 แพ้ยาซัลฟา กินยาความดันทุกวัน" },
];
