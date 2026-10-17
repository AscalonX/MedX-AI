import type { IntakeSession, Lang, Localized } from "@medx/shared";
import medrules from "@medx/shared/src/medrules.json";

export const RULE_COUNTS = { drugs: medrules.drugs.length, interactions: medrules.interactions.length };

const L = (en: string, th: string, it: string): Localized => ({ en, th, it });

/** Chrome strings (th/it need native-speaker review). */
export const T = {
  suggestionLabel: L("Suggestion for nurse confirmation", "ข้อเสนอแนะ รอพยาบาลยืนยัน", "Suggerimento da confermare dall'infermiere"),
  vitalsTitle: L("Record vital signs", "บันทึกสัญญาณชีพ", "Registra i parametri vitali"),
  vitalsHint: L("Enter what you measured. Leave blank what you did not measure. Enter saves.", "กรอกค่าที่วัดได้ ช่องที่ไม่ได้วัดเว้นว่าง กด Enter เพื่อบันทึก", "Inserisci ciò che hai misurato. Lascia vuoto il resto. Invio salva."),
  hr: L("Heart rate (bpm)", "ชีพจร (ครั้ง/นาที)", "Frequenza cardiaca (bpm)"),
  sys: L("Systolic BP (mmHg)", "ความดันตัวบน (mmHg)", "Pressione sistolica (mmHg)"),
  dia: L("Diastolic BP (mmHg)", "ความดันตัวล่าง (mmHg)", "Pressione diastolica (mmHg)"),
  rr: L("Respiratory rate (/min)", "อัตราหายใจ (ครั้ง/นาที)", "Frequenza respiratoria (/min)"),
  temp: L("Temperature (°C)", "อุณหภูมิ (°C)", "Temperatura (°C)"),
  spo2: L("SpO2 (%)", "SpO2 (%)", "SpO2 (%)"),
  onO2: L("On supplemental oxygen?", "ได้รับออกซิเจนหรือไม่", "In ossigenoterapia?"),
  roomAir: L("No, room air", "ไม่ใช่ อากาศปกติ", "No, aria ambiente"),
  yesO2: L("Yes, on oxygen", "ใช่ ได้รับออกซิเจน", "Sì, in ossigeno"),
  o2Required: L("Choose yes or no.", "เลือกใช่หรือไม่ใช่", "Scegli sì o no."),
  moreUrgent: L("Suggested level is now more urgent than the confirmed level. Re-confirm.", "ระดับที่เสนอเร่งด่วนกว่าระดับที่ยืนยันไว้ ต้องยืนยันใหม่", "Il livello suggerito è ora più urgente di quello confermato. Riconferma."),
  prevConfirmed: L("Previously confirmed", "ยืนยันก่อนหน้า", "Confermato in precedenza"),
  pain: L("Pain (0 to 10)", "ความเจ็บปวด (0 ถึง 10)", "Dolore (0-10)"),
  acvpu: L("Consciousness (ACVPU)", "ระดับความรู้สึกตัว (ACVPU)", "Coscienza (ACVPU)"),
  notAssessed: L("Not assessed", "ไม่ได้ประเมิน", "Non valutato"),
  cAlert: L("Alert", "ตื่นดี", "Vigile"),
  cConfusion: L("New confusion", "สับสนใหม่", "Nuova confusione"),
  cVoice: L("Voice", "ตอบสนองต่อเสียง", "Voce"),
  cPain: L("Pain", "ตอบสนองต่อความเจ็บ", "Dolore"),
  cUnresp: L("Unresponsive", "ไม่ตอบสนอง", "Non responsivo"),
  save: L("Save vitals", "บันทึกสัญญาณชีพ", "Salva parametri"),
  saving: L("Saving", "กำลังบันทึก", "Salvataggio"),
  needOne: L("Enter at least one value.", "กรอกอย่างน้อยหนึ่งค่า", "Inserisci almeno un valore."),
  range: L("Enter a value from {min} to {max}.", "กรอกค่าระหว่าง {min} ถึง {max}", "Inserisci un valore da {min} a {max}."),
  diaLess: L("Diastolic must be lower than systolic.", "ตัวล่างต้องต่ำกว่าตัวบน", "La diastolica deve essere inferiore alla sistolica."),
  diaNeedsSys: L("Enter both blood pressure values or neither.", "กรอกความดันทั้งสองค่าหรือเว้นว่างทั้งคู่", "Inserisci entrambi i valori o nessuno."),
  alerts: L("Vital sign alerts", "การแจ้งเตือนสัญญาณชีพ", "Avvisi parametri vitali"),
  noAlerts: L("No vital sign alerts for this set.", "ไม่มีการแจ้งเตือนสำหรับชุดนี้", "Nessun avviso per questo set."),
  suggestedLevel: L("Suggested triage level {n}", "ระดับคัดกรองที่เสนอ {n}", "Livello di triage suggerito {n}"),
  levelScale: L("1 is most urgent, 5 is least urgent.", "1 เร่งด่วนที่สุด 5 น้อยที่สุด", "1 è il più urgente, 5 il meno."),
  warningScore: L("Warning score", "คะแนนเตือน", "Punteggio di allerta"),
  yourLevel: L("Triage level", "ระดับคัดกรอง", "Livello di triage"),
  note: L("Note", "บันทึก", "Nota"),
  noteLower: L("Required when you choose a lower urgency than suggested.", "ต้องระบุเมื่อเลือกความเร่งด่วนต่ำกว่าที่เสนอ", "Obbligatoria se scegli un'urgenza minore di quella suggerita."),
  confirmLevel: L("Confirm level {n}", "ยืนยันระดับ {n}", "Conferma livello {n}"),
  confirmed: L("Triage confirmed by {who}", "{who} ยืนยันระดับคัดกรองแล้ว", "Triage confermato da {who}"),
  level: L("Level", "ระดับ", "Livello"),
  at: L("At", "เวลา", "Alle"),
  confirmedBy: L("Confirmed by", "ยืนยันโดย", "Confermato da"),
  history: L("Previous vitals", "สัญญาณชีพก่อนหน้า", "Parametri precedenti"),
  noHistory: L("No vitals recorded yet.", "ยังไม่มีการบันทึก", "Nessun parametro registrato."),
  time: L("Time", "เวลา", "Ora"),
  bp: L("BP", "ความดัน", "PA"),
  by: L("By", "โดย", "Da"),
  fixture: L("fixture", "ข้อมูลจำลอง", "dati di prova"),
  fixtureWhy: L("Server route not answering. Showing sample logic, nothing is saved.", "เซิร์ฟเวอร์ยังไม่ตอบ แสดงตรรกะตัวอย่าง ไม่มีการบันทึกจริง", "Route del server non disponibile. Logica di esempio, nulla viene salvato."),
  patient: L("Patient", "ผู้ป่วย", "Paziente"),
  backToCase: L("Back to case", "กลับไปที่เคส", "Torna al caso"),
  loadFail: L("Could not load this case.", "โหลดเคสไม่ได้", "Impossibile caricare il caso."),
  // orders
  ordersTitle: L("Orders", "คำสั่งแพทย์", "Ordini"),
  invTitle: L("Investigations", "การตรวจเพิ่มเติม", "Accertamenti"),
  invSearch: L("Search tests", "ค้นหารายการตรวจ", "Cerca esami"),
  all: L("All", "ทั้งหมด", "Tutti"),
  lab: L("Lab", "ห้องปฏิบัติการ", "Laboratorio"),
  imaging: L("Imaging", "ภาพถ่าย", "Imaging"),
  ecg: L("ECG", "คลื่นหัวใจ", "ECG"),
  other: L("Other", "อื่นๆ", "Altro"),
  suggestedByConsult: L("Suggested by consult", "แนะนำจากการสนทนา", "Suggerito dalla consulenza"),
  consideredNotOrdered: L("considered, not ordered", "พิจารณาแล้ว ยังไม่ได้สั่ง", "considerato, non ordinato"),
  readGuideline: L("Read guideline", "อ่านแนวทางเวชปฏิบัติ", "Leggi la linea guida"),
  reason: L("Reason (optional)", "เหตุผล (ไม่บังคับ)", "Motivo (facoltativo)"),
  placeOrder: L("Order {what}", "สั่งตรวจ {what}", "Ordina {what}"),
  cancelPick: L("Cancel", "ยกเลิก", "Annulla"),
  ordered: L("Ordered", "สั่งแล้ว", "Ordinati"),
  noneOrdered: L("Nothing ordered yet.", "ยังไม่มีการสั่ง", "Ancora nulla di ordinato."),
  noMatch: L("No tests match.", "ไม่พบรายการ", "Nessun esame corrisponde."),
  medTitle: L("Prescribing", "การสั่งยา", "Prescrizione"),
  drug: L("Drug", "ยา", "Farmaco"),
  dose: L("Dose", "ขนาดยา", "Dose"),
  route: L("Route", "ทางให้ยา", "Via"),
  frequency: L("Frequency", "ความถี่", "Frequenza"),
  duration: L("Duration", "ระยะเวลา", "Durata"),
  check: L("Check", "ตรวจสอบ", "Controlla"),
  checking: L("Checking", "กำลังตรวจ", "Controllo"),
  update: L("Update and re-check", "แก้ไขและตรวจอีกครั้ง", "Aggiorna e ricontrolla"),
  newRx: L("New prescription", "สั่งยาใหม่", "Nuova prescrizione"),
  editRx: L("Edit prescription", "แก้ไขใบสั่งยา", "Modifica prescrizione"),
  required: L("Required", "จำเป็น", "Obbligatorio"),
  checksTitle: L("Prescribing checks", "ผลการตรวจสอบการสั่งยา", "Controlli di prescrizione"),
  noChecks: L("No rule fired. This is not a complete check.", "ไม่มีกฎที่ทำงาน นี่ไม่ใช่การตรวจที่สมบูรณ์", "Nessuna regola attivata. Non è un controllo completo."),
  high: L("High", "สูง", "Alta"),
  moderate: L("Moderate", "ปานกลาง", "Moderata"),
  unchecked: L("Not checked", "ยังไม่ได้ตรวจ", "Non controllato"),
  overrideReason: L("Reason for proceeding despite this alert", "เหตุผลที่สั่งต่อแม้มีการแจ้งเตือน", "Motivo per procedere nonostante l'avviso"),
  submit: L("Submit to pharmacy", "ส่งให้เภสัชกร", "Invia alla farmacia"),
  submitting: L("Submitting", "กำลังส่ง", "Invio"),
  submitBlocked: L("Enter a reason for every high alert to submit.", "ต้องระบุเหตุผลสำหรับทุกการแจ้งเตือนระดับสูงก่อนส่ง", "Inserisci un motivo per ogni avviso alto per inviare."),
  cancelOrder: L("Cancel order", "ยกเลิกคำสั่ง", "Annulla ordine"),
  edit: L("Edit", "แก้ไข", "Modifica"),
  stDraft: L("Draft", "ฉบับร่าง", "Bozza"),
  stSubmitted: L("Submitted, waiting for pharmacist", "ส่งแล้ว รอเภสัชกร", "Inviato, in attesa del farmacista"),
  stVerified: L("Verified by pharmacist", "เภสัชกรยืนยันแล้ว", "Verificato dal farmacista"),
  stReturned: L("Returned by pharmacist", "เภสัชกรส่งกลับ", "Restituito dal farmacista"),
  stCancelled: L("Cancelled", "ยกเลิกแล้ว", "Annullato"),
  pharmacistNote: L("Pharmacist note", "บันทึกจากเภสัชกร", "Nota del farmacista"),
  editResubmit: L("Edit prescription", "แก้ไขใบสั่งยา", "Modifica prescrizione"),
  patientsWords: L("From patient's words", "จากคำพูดของผู้ป่วย", "Dalle parole del paziente"),
  footer: L(
    "Checks use MedX rule set ({drugs} drugs, {ix} interactions). Not a complete drug-interaction check. The prescriber is responsible.",
    "การตรวจสอบใช้ชุดกฎ MedX ({drugs} ยา {ix} ปฏิกิริยาระหว่างยา) ไม่ใช่การตรวจปฏิกิริยาระหว่างยาที่สมบูรณ์ ผู้สั่งยาเป็นผู้รับผิดชอบ",
    "I controlli usano il set di regole MedX ({drugs} farmaci, {ix} interazioni). Non è un controllo completo delle interazioni. Il prescrittore è responsabile.",
  ),
  prototype: L("Research prototype. Supports clinicians; does not order, prescribe or decide triage.", "ต้นแบบงานวิจัย ช่วยบุคลากร ไม่สั่งตรวจ ไม่สั่งยา และไม่ตัดสินระดับคัดกรอง", "Prototipo di ricerca. Supporta i clinici; non ordina, non prescrive e non decide il triage."),
  considerations: L("Considerations from consult", "ประเด็นที่ควรพิจารณาจากการสนทนา", "Considerazioni dalla consulenza"),
  forReview: L("For clinician review, not a diagnosis.", "สำหรับบุคลากรพิจารณา ไม่ใช่การวินิจฉัย", "Per revisione clinica, non una diagnosi."),
  doctorsOnly: L("Prescribing and ordering are for doctors. You can view orders but not change them.", "การสั่งยาและสั่งตรวจสำหรับแพทย์ คุณดูได้แต่แก้ไขไม่ได้", "Prescrizioni e ordini sono riservati ai medici. Puoi visualizzare ma non modificare."),
  nursesOnly: L("Vitals are entered by nurses. You can view them but not change them.", "สัญญาณชีพบันทึกโดยพยาบาล คุณดูได้แต่แก้ไขไม่ได้", "I parametri vitali sono inseriti dagli infermieri. Puoi visualizzarli ma non modificarli."),
  returnedNote: L("Returned by pharmacist. Change the prescription, press Check, then submit again.", "เภสัชกรส่งกลับ แก้ไขใบสั่งยา กดตรวจสอบ แล้วส่งใหม่", "Restituito dal farmacista. Modifica la prescrizione, premi Controlla, poi invia di nuovo."),
  confirmCancel: L("Confirm cancel", "ยืนยันการยกเลิก", "Conferma annullamento"),
  keep: L("Keep", "เก็บไว้", "Mantieni"),
  o2col: L("On O2", "ออกซิเจน", "O2"),
  acvpuCol: L("ACVPU", "ACVPU", "ACVPU"),
  failed: L("Request failed", "ดำเนินการไม่สำเร็จ", "Richiesta non riuscita"),
} satisfies Record<string, Localized>;
export type TKey = keyof typeof T;
export const tr = (k: TKey, lang: Lang, vars?: Record<string, string | number>) =>
  T[k][lang].replace(/\{(\w+)\}/g, (_, v: string) => String(vars?.[v] ?? ""));

export const clockOf = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(lang === "th" ? "th-TH" : lang === "it" ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/** Call a route. READS (no body) may fall back to `fixture` on 404/405/5xx/network. WRITES never do: any failure throws the server message so the form stays and the user sees it. */
export async function call<T>(url: string, body: unknown | undefined, fixture: () => T): Promise<{ data: T; fixture: boolean }> {
  const write = body !== undefined;
  let res: Response;
  try {
    res = await fetch(url, write ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  } catch {
    if (write) throw new Error("Network error. Nothing was saved.");
    return { data: fixture(), fixture: true };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (!write && (res.status === 404 || res.status === 405 || res.status >= 500)) return { data: fixture(), fixture: true };
    throw new Error(json?.error ?? `Request failed (${res.status}). Nothing was saved.`);
  }
  return { data: json as T, fixture: false };
}

/** Routes return either the session or { session }. */
export const asSession = (b: unknown): IntakeSession => ((b as { session?: IntakeSession }).session ?? b) as IntakeSession;
