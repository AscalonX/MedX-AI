// Fixture sessions that follow the pharmacist contract (types.ts MedicationEntry / AllergyEntry / MedAlert).
// Used only while the engine does not yet populate summary.medications. The UI badges them "fixture data".
// Synthetic patients. Evidence offsets are computed from the turn text so every quote verifies.
import type { MedicationOrder, AllergyEntry, Evidence, ExtractedField, IntakeSession, Lang, MedAlert, MedicationEntry, RedFlagHit, Turn } from "@medx/shared";

import { staffFor } from "@medx/shared";
const DOCTOR = staffFor("doctor")[0].name;
const base = Date.now();
const iso = (minAgo: number) => new Date(base - minAgo * 60000).toISOString();

function turns(id: string, lang: Lang, lines: [role: "patient" | "assistant", text: string][], startMinAgo: number): Turn[] {
  return lines.map(([role, text], i) => ({ id: `${id}-t${i + 1}`, role, lang, text, at: iso(startMinAgo - i) }));
}
/** Evidence for `quote` inside turn number `n` (1-based). Throws if the quote is not present: fixtures must verify. */
function ev(ts: Turn[], n: number, quote: string): Evidence {
  const t = ts[n - 1];
  const start = t.text.indexOf(quote);
  if (start < 0) throw new Error(`fixture quote not found: ${quote}`);
  return { turnId: t.id, quote, start, end: start + quote.length };
}
const L = (th: string, it: string, en: string) => ({ th, it, en });
const field = (key: ExtractedField["key"], value: ReturnType<typeof L> | null, original: string | null, evidence: Evidence[], status: ExtractedField["status"], required = false): ExtractedField =>
  ({ key, value, valueOriginal: original, evidence, confidence: evidence.length ? 0.9 : 0, status, required });

function session(p: {
  id: string; code: string; lang: Lang; minAgo: number; ts: Turn[]; complaint: ReturnType<typeof L>; complaintQuote: Evidence;
  meds: MedicationEntry[]; allergies: AllergyEntry[]; alerts: MedAlert[]; allergyField: ExtractedField;
  nka?: Evidence[]; redFlags?: RedFlagHit[]; abstain?: boolean;
}): IntakeSession {
  return {
    id: p.id, code: p.code, patientLang: p.lang, status: "awaiting_review", turns: p.ts, pharmacyStatus: "pending",
    createdAt: iso(p.minAgo), updatedAt: iso(p.minAgo - p.ts.length),
    summary: {
      sessionId: p.id, redFlags: p.redFlags ?? [], nextQuestion: null, abstained: !!p.abstain, ...(p.abstain ? { abstainReason: "schema_error" as const } : {}), ...(p.nka ? { noKnownAllergiesEvidence: p.nka } : {}), generatedAt: iso(p.minAgo - p.ts.length),
      modelCalls: [{ step: "extract", provider: "mock", model: "fixture", latencyMs: 0, ok: true }],
      fields: [field("chief_complaint", p.complaint, p.complaintQuote.quote, [p.complaintQuote], "supported", true), p.allergyField],
      medications: p.meds, allergies: p.allergies, medAlerts: p.alerts,
    },
  };
}

// ---- 1. Italian tourist: two paracetamol products the same morning ----
const t1 = turns("fx1", "it", [
  ["patient", "Buongiorno, ho un forte mal di testa e un po' di febbre da due giorni."],
  ["assistant", "Sta prendendo dei medicinali? Mi dica anche quando li ha presi."],
  ["patient", "Stamattina ho preso una Tachipirina 1000 alle 8 e poi un'Efferalgan 500 alle 11 perché non passava. Di solito prendo anche l'omeprazolo la mattina."],
  ["assistant", "Ha allergie a farmaci?"],
  ["patient", "No, nessuna allergia che io sappia."],
], 38);
const fx1 = session({
  id: "fixture-it-paracetamol", code: "F-201", lang: "it", minAgo: 38, ts: t1,
  complaint: L("ปวดศีรษะรุนแรงและมีไข้เล็กน้อย 2 วัน", "Forte mal di testa e febbre da due giorni", "Severe headache and mild fever for two days"),
  complaintQuote: ev(t1, 1, "forte mal di testa e un po' di febbre da due giorni"),
  allergyField: field("allergies", L("ไม่มีประวัติแพ้ยา", "Nessuna allergia nota", "No known allergies"), "nessuna allergia che io sappia", [ev(t1, 5, "nessuna allergia che io sappia")], "supported", true),
  nka: [ev(t1, 5, "nessuna allergia che io sappia")],
  meds: [
    { id: "fx1-m1", nameOriginal: "Tachipirina 1000", generic: "Paracetamol", drugClass: "analgesic_antipyretic", dose: "1000 mg", frequency: null, timing: "alle 8 di stamattina", evidence: [ev(t1, 3, "Tachipirina 1000 alle 8")], confidence: 0.95, status: "supported" },
    { id: "fx1-m2", nameOriginal: "Efferalgan 500", generic: "Paracetamol", drugClass: "analgesic_antipyretic", dose: "500 mg", frequency: null, timing: "alle 11 di stamattina", evidence: [ev(t1, 3, "Efferalgan 500 alle 11")], confidence: 0.92, status: "supported" },
    { id: "fx1-m3", nameOriginal: "omeprazolo", generic: "Omeprazole", drugClass: "ppi", dose: null, frequency: "la mattina", timing: "di solito", evidence: [ev(t1, 3, "l'omeprazolo la mattina")], confidence: 0.72, status: "supported" },
  ],
  allergies: [],
  alerts: [
    { id: "fx1-a1", ruleId: "MR-DOSE-01", kind: "max_dose_risk", severity: "moderate", medIds: ["fx1-m1", "fx1-m2"], allergyIds: [], evidence: [ev(t1, 3, "una Tachipirina 1000 alle 8 e poi un'Efferalgan 500 alle 11")], source: "Paracetamol product labelling, adult maximum 4 g per day",
      message: L("ผู้ป่วยกินพาราเซตามอลจาก 2 ผลิตภัณฑ์ในเช้าเดียวกัน รวม 1,500 มก. ภายใน 3 ชั่วโมง", "Paracetamolo da due prodotti nella stessa mattina: 1500 mg in 3 ore", "Paracetamol from two products this morning: 1500 mg within 3 hours"),
      action: L("ตรวจปริมาณรวมที่กินวันนี้และเวลากินครั้งล่าสุด แจ้งแพทย์ผู้ดูแลเพื่อยืนยันแผนการใช้ยา", "Verificare la dose totale di oggi e l'ora dell'ultima assunzione; segnalare al clinico curante per confermare il piano terapeutico", "Check today's total and the time of the last dose; flag for the treating clinician to confirm the medication plan") },
    { id: "fx1-a2", ruleId: "MR-DUP-01", kind: "duplicate_therapy", severity: "moderate", medIds: ["fx1-m1", "fx1-m2"], allergyIds: [], evidence: [ev(t1, 3, "Tachipirina 1000"), ev(t1, 3, "Efferalgan 500")], source: "Same active ingredient (paracetamol) in two brands",
      message: L("Tachipirina และ Efferalgan มีตัวยาเดียวกัน (พาราเซตามอล)", "Tachipirina ed Efferalgan contengono lo stesso principio attivo (paracetamolo)", "Tachipirina and Efferalgan contain the same active ingredient (paracetamol)"),
      action: L("ยืนยันกับผู้ป่วยว่าใช้ผลิตภัณฑ์ใดบ้าง แจ้งแพทย์ผู้ดูแลเพื่อยืนยันแผนการใช้ยา", "Confermare col paziente quali prodotti ha preso; segnalare al clinico curante per confermare il piano terapeutico", "Confirm with the patient which products were taken; flag for the treating clinician to confirm the medication plan") },
  ],
});

// ---- 2. Thai patient: penicillin allergy, takes Augmentin; herbal remedy unmatched ----
const t2 = turns("fx2", "th", [
  ["patient", "ฉันเจ็บคอมา 3 วันค่ะ กลืนน้ำลายก็เจ็บ"],
  ["assistant", "ตอนนี้กินยาอะไรอยู่บ้างคะ"],
  ["patient", "กินยาออคเมนตินที่เหลือจากคราวก่อน วันละสองเม็ด กับยาพาราแก้ปวด แล้วก็ยาต้มสมุนไพรร้านแถวบ้านด้วยค่ะ"],
  ["assistant", "แพ้ยาหรืออาหารอะไรไหมคะ"],
  ["patient", "แพ้เพนิซิลลิน เคยกินแล้วขึ้นผื่นทั้งตัว"],
], 24);
const fx2 = session({
  id: "fixture-th-penicillin", code: "F-202", lang: "th", minAgo: 24, ts: t2,
  complaint: L("เจ็บคอ 3 วัน", "Mal di gola da 3 giorni", "Sore throat for 3 days"),
  complaintQuote: ev(t2, 1, "เจ็บคอมา 3 วัน"),
  allergyField: field("allergies", L("แพ้เพนิซิลลิน (ผื่นทั้งตัว)", "Allergia alla penicillina (eruzione cutanea diffusa)", "Penicillin allergy (full-body rash)"), "แพ้เพนิซิลลิน เคยกินแล้วขึ้นผื่นทั้งตัว", [ev(t2, 5, "แพ้เพนิซิลลิน เคยกินแล้วขึ้นผื่นทั้งตัว")], "supported", true),
  meds: [
    { id: "fx2-m1", nameOriginal: "ยาออคเมนติน", generic: "Amoxicillin / clavulanic acid", drugClass: "aminopenicillin", dose: null, frequency: "วันละสองเม็ด", timing: "ที่เหลือจากคราวก่อน", evidence: [ev(t2, 3, "ยาออคเมนตินที่เหลือจากคราวก่อน วันละสองเม็ด")], confidence: 0.93, status: "supported" },
    { id: "fx2-m2", nameOriginal: "ยาพารา", generic: "Paracetamol", drugClass: "analgesic_antipyretic", dose: null, frequency: null, timing: null, evidence: [ev(t2, 3, "ยาพาราแก้ปวด")], confidence: 0.8, status: "supported" },
    { id: "fx2-m3", nameOriginal: "ยาต้มสมุนไพรร้านแถวบ้าน", generic: null, drugClass: null, dose: null, frequency: null, timing: null, evidence: [ev(t2, 3, "ยาต้มสมุนไพรร้านแถวบ้าน")], confidence: 0.6, status: "unmatched" },
  ],
  allergies: [
    { id: "fx2-g1", allergenOriginal: "เพนิซิลลิน", allergenClass: "penicillin", reaction: "ผื่นทั้งตัว", evidence: [ev(t2, 5, "แพ้เพนิซิลลิน เคยกินแล้วขึ้นผื่นทั้งตัว")], status: "supported" },
  ],
  alerts: [
    { id: "fx2-a1", ruleId: "MR-ALLERGY-01", kind: "allergy_conflict", severity: "high", medIds: ["fx2-m1"], allergyIds: ["fx2-g1"], evidence: [ev(t2, 3, "ยาออคเมนติน"), ev(t2, 5, "แพ้เพนิซิลลิน")], source: "Aminopenicillins are contraindicated in penicillin allergy",
      message: L("ผู้ป่วยแพ้เพนิซิลลิน แต่กำลังกินออคเมนติน (อะม็อกซิซิลลิน/กรดคลาวูลานิก) ซึ่งอยู่ในกลุ่มเพนิซิลลิน", "Allergia alla penicillina dichiarata, ma assume Augmentin (amoxicillina/acido clavulanico), della stessa classe", "Stated penicillin allergy, but the patient is taking Augmentin (amoxicillin/clavulanic acid), a penicillin"),
      action: L("แจ้งแพทย์ผู้ดูแลทันทีเพื่อทบทวน ถามอาการแพ้ครั้งนี้ แพทย์เป็นผู้ยืนยันแผนการใช้ยา", "Segnalare subito al clinico curante per revisione; chiedere di eventuali reazioni; il clinico conferma il piano terapeutico", "Flag for the treating clinician now; ask about any reaction this time; the clinician confirms the medication plan") },
    { id: "fx2-a2", ruleId: "MR-UNK-01", kind: "unknown_medication", severity: "moderate", medIds: ["fx2-m3"], allergyIds: [], evidence: [ev(t2, 3, "ยาต้มสมุนไพรร้านแถวบ้าน")], source: "Medicine named by the patient is not in the dictionary",
      message: L("ไม่รู้จักยาต้มสมุนไพรที่ผู้ป่วยระบุ", "Rimedio erboristico non riconosciuto", "Herbal remedy not recognised"),
      action: L("ขอดูฉลากหรือส่วนผสม แล้วระบุชื่อยา", "Chiedere etichetta o ingredienti e identificare il prodotto", "Ask for the label or ingredients and identify the product") },
  ],
});

// ---- 3. English speaker: warfarin plus ibuprofen; allergies not stated; atorvastatin stopped ----
const t3 = turns("fx3", "en", [
  ["patient", "My right knee has been really painful since Monday, I can barely walk."],
  ["assistant", "What have you taken for it so far?"],
  ["patient", "I've been taking ibuprofen 400 mg three times a day for four days. I'm also on warfarin 5 mg every evening for my heart. I stopped the atorvastatin last week."],
], 15);
const fx3 = session({
  id: "fixture-en-warfarin", code: "F-203", lang: "en", minAgo: 15, ts: t3,
  complaint: L("ปวดเข่าขวาตั้งแต่วันจันทร์ เดินแทบไม่ได้", "Dolore al ginocchio destro da lunedì, cammina a fatica", "Right knee pain since Monday, can barely walk"),
  complaintQuote: ev(t3, 1, "right knee has been really painful since Monday"),
  allergyField: field("allergies", null, null, [], "missing", true),
  meds: [
    { id: "fx3-m1", nameOriginal: "ibuprofen", generic: "Ibuprofen", drugClass: "nsaid", dose: "400 mg", frequency: "three times a day", timing: "for four days", evidence: [ev(t3, 3, "ibuprofen 400 mg three times a day for four days")], confidence: 0.96, status: "supported" },
    { id: "fx3-m2", nameOriginal: "warfarin", generic: "Warfarin", drugClass: "anticoagulant", dose: "5 mg", frequency: "every evening", timing: "ongoing", evidence: [ev(t3, 3, "warfarin 5 mg every evening")], confidence: 0.97, status: "supported" },
    { id: "fx3-m3", nameOriginal: "atorvastatin", generic: "Atorvastatin", drugClass: "statin", dose: null, frequency: null, timing: "stopped last week", evidence: [ev(t3, 3, "stopped the atorvastatin last week")], confidence: 0.9, status: "discontinued" },
    { id: "fx3-m4", nameOriginal: "paracetamol", generic: "Paracetamol", drugClass: "analgesic_antipyretic", dose: "500 mg", frequency: "at night", timing: "sometimes", evidence: [], confidence: 0.4, status: "unsupported" },
  ],
  allergies: [{ id: "fx3-g1", allergenOriginal: "shellfish", allergenClass: "shellfish", reaction: "swelling", evidence: [], status: "unsupported" }],
  alerts: [
    { id: "fx3-a1", ruleId: "MR-INT-01", kind: "interaction", severity: "high", medIds: ["fx3-m1", "fx3-m2"], allergyIds: [], evidence: [ev(t3, 3, "ibuprofen 400 mg three times a day"), ev(t3, 3, "warfarin 5 mg every evening")], source: "NSAID with warfarin: increased bleeding risk",
      message: L("ไอบูโพรเฟนร่วมกับวาร์ฟารินเพิ่มความเสี่ยงเลือดออก", "Ibuprofene con warfarin: aumenta il rischio di sanguinamento", "Ibuprofen with warfarin raises the risk of bleeding"),
      action: L("แจ้งแพทย์ผู้ดูแลเพื่อทบทวนก่อนจ่ายยา ถามอาการเลือดออกหรือจ้ำเลือด แพทย์เป็นผู้ยืนยันแผนการใช้ยา", "Segnalare al clinico curante prima della dispensazione; chiedere di sanguinamenti o lividi; il clinico conferma il piano terapeutico", "Flag for the treating clinician before dispensing; ask about bleeding or bruising; the clinician confirms the medication plan") },
  ],
});

// ---- 4. Abstained summary: no conclusions may be shown ----
const t4 = turns("fx4", "th", [["patient", "ขอโทษค่ะ พิมพ์ผิด ไม่รู้ว่ากินยาอะไรอยู่ ลืมหมดเลย"]], 8);
const fx4 = session({
  id: "fixture-th-abstained", code: "F-204", lang: "th", minAgo: 8, ts: t4,
  complaint: L("", "", ""), complaintQuote: ev(t4, 1, "ขอโทษค่ะ"),
  allergyField: field("allergies", null, null, [], "missing", true), meds: [], allergies: [], alerts: [], abstain: true,
});
fx4.summary!.fields = [];

// ---- 5. Unreviewed red flag: pharmacist cannot sign off ----
const t5 = turns("fx5", "en", [
  ["patient", "I have crushing chest pain since this morning and I took two aspirin 300 mg."],
], 5);
const fx5 = session({
  id: "fixture-en-redflag", code: "F-205", lang: "en", minAgo: 5, ts: t5,
  complaint: L("เจ็บแน่นหน้าอกตั้งแต่เช้า", "Dolore toracico oppressivo da stamattina", "Crushing chest pain since this morning"),
  complaintQuote: ev(t5, 1, "crushing chest pain since this morning"),
  allergyField: field("allergies", null, null, [], "missing", true),
  meds: [{ id: "fx5-m1", nameOriginal: "aspirin", generic: "Acetylsalicylic acid", drugClass: "nsaid", dose: "300 mg", frequency: null, timing: "this morning", evidence: [ev(t5, 1, "two aspirin 300 mg")], confidence: 0.9, status: "supported" }],
  allergies: [], alerts: [],
  redFlags: [{
    ruleId: "RF-CHEST-01", severity: "emergency",
    label: L("เจ็บหน้าอกรุนแรง", "Dolore toracico intenso", "Severe chest pain"),
    action: L("แจ้งแพทย์ทันที", "Avvisare subito il clinico", "Alert a clinician now"),
    patientMessage: L("กรุณาไปที่เคาน์เตอร์ทันที", "Si rechi subito al banco", "Go to the desk now"),
    evidence: [ev(t5, 1, "crushing chest pain since this morning")],
  }],
});

// ---- doctor medication orders (submitted, with deterministic checks) ----
const ord = (id: string, drugText: string, generic: string, drugClass: string, dose: string, frequency: string, duration: string, checks: MedAlert[], overrides: MedicationOrder["overrides"], minAgo: number): MedicationOrder =>
  ({ id, drugText, generic, drugClass, dose, route: "oral", frequency, duration, orderedBy: DOCTOR, at: iso(minAgo), status: "submitted", checks, overrides });
const chk = (id: string, kind: MedAlert["kind"], severity: MedAlert["severity"], en: string, act: string, src: string): MedAlert =>
  ({ id, ruleId: `MR-${kind.toUpperCase().slice(0, 6)}-O`, kind, severity, medIds: [], allergyIds: [], evidence: [], source: src, message: L(en, en, en), action: L(act, act, act) });
fx1.orders = { investigations: [], medications: [
  ord("fx1-o1", "Paracetamol 1000 mg", "Paracetamol", "analgesic_antipyretic", "1000 mg", "every 6 hours", "3 days",
    [chk("fx1-o1-c1", "max_dose_risk", "moderate", "With the 1500 mg already taken today, the daily paracetamol total would reach 5500 mg.", "Confirm the time of the last dose and the daily total before dispensing.", "Paracetamol labelling, adult maximum 4 g per day")], [], 4)] };
fx2.orders = { investigations: [], medications: [
  ord("fx2-o1", "Amoxicillin 500 mg", "Amoxicillin", "aminopenicillin", "500 mg", "every 8 hours", "5 days",
    [chk("fx2-o1-c1", "allergy_conflict", "high", "The patient states a penicillin allergy; amoxicillin is a penicillin.", "Return to the prescriber to confirm the plan.", "Aminopenicillins are contraindicated in penicillin allergy")], [], 6)] };
fx3.orders = { investigations: [], medications: [
  ord("fx3-o1", "Diclofenac 50 mg", "Diclofenac", "nsaid", "50 mg", "every 8 hours", "5 days",
    [chk("fx3-o1-c1", "interaction", "high", "Diclofenac with warfarin raises the risk of bleeding.", "Check the plan with the prescriber.", "NSAID with warfarin: increased bleeding risk"),
     chk("fx3-o1-c2", "dose_range", "moderate", "150 mg per day is at the upper end of the usual range.", "Confirm the duration.", "Dictionary daily range")],
    [{ alertId: "fx3-o1-c1", reason: "INR checked this morning (2.4); short course with gastric protection; patient counselled.", by: DOCTOR, at: iso(5) }], 5),
  ord("fx3-o2", "Naproxen 500 mg", "Naproxen", "nsaid", "500 mg", "twice daily", "7 days",
    [chk("fx3-o2-c1", "interaction", "high", "Naproxen with warfarin raises the risk of bleeding.", "Return to the prescriber to confirm the plan.", "NSAID with warfarin: increased bleeding risk")], [], 3)] };

export const FIXTURES: IntakeSession[] = [fx1, fx2, fx3, fx4, fx5];
