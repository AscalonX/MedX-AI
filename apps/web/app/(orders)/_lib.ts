import type { IntakeSession, Lang, Localized, MedAlert, MedRuleFile } from "@medx/shared";
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
  stDispensed: L("Dispensed, second pharmacist checked", "จ่ายยาแล้ว เภสัชกรคนที่สองตรวจซ้ำ", "Dispensato, controllato dal secondo farmacista"),
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
  tlTitle: L("Order history", "ประวัติคำสั่ง", "Cronologia ordine"),
  tlSubmitted: L("Submitted by", "ส่งโดย", "Inviato da"),
  tlResubmitted: L("Resubmitted by", "ส่งใหม่โดย", "Reinviato da"),
  tlReturned: L("Returned by", "ส่งกลับโดย", "Restituito da"),
  tlVerified: L("Verified by", "ยืนยันโดย", "Verificato da"),
  tlCancelled: L("Cancelled by", "ยกเลิกโดย", "Annullato da"),
  failed: L("Request failed", "ดำเนินการไม่สำเร็จ", "Richiesta non riuscita"),
  // pharmacist report, alternatives, dispense, pickup
  pharmacistReport: L("Pharmacist report", "รายงานจากเภสัชกร", "Rapporto del farmacista"),
  reportBy: L("Returned by {who}, {time}", "{who} ส่งกลับ เวลา {time}", "Restituito da {who}, {time}"),
  flaggedChecks: L("Checks the pharmacist flagged", "ผลตรวจที่เภสัชกรระบุ", "Controlli segnalati dal farmacista"),
  flaggedBadge: L("Flagged by pharmacist", "เภสัชกรระบุ", "Segnalato dal farmacista"),
  flaggedGone: L("{n} flagged check no longer fires after the latest re-check.", "ผลตรวจที่เภสัชกรระบุ {n} รายการไม่ปรากฏแล้วหลังการตรวจซ้ำล่าสุด", "{n} controllo segnalato non si attiva più dopo l'ultimo ricontrollo."),
  suggestedAlts: L("Suggested alternatives (for your review)", "ยาทางเลือกที่เสนอ (ให้แพทย์พิจารณา)", "Alternative suggerite (da valutare)"),
  suggestedAltsNote: L(
    "Options from the pharmacist for the prescriber to review, not a prescription. Choosing one opens the edit form: you set dose, route and frequency, the checks run again, and you submit again.",
    "ตัวเลือกจากเภสัชกรให้แพทย์ผู้สั่งยาพิจารณา ไม่ใช่คำสั่งใช้ยา เมื่อเลือกจะเปิดแบบฟอร์มแก้ไข แพทย์กำหนดขนาดยา ทางให้ยา และความถี่เอง ระบบตรวจสอบซ้ำ แล้วแพทย์ส่งใหม่อีกครั้ง",
    "Opzioni del farmacista da valutare dal prescrittore, non una prescrizione. Sceglierne una apre il modulo di modifica: imposti dose, via e frequenza, i controlli vengono rifatti e invii di nuovo.",
  ),
  optionsToReview: L("Options to review", "ตัวเลือกให้พิจารณา", "Opzioni da valutare"),
  optionsNote: L(
    "From the MedX rule set, already run through this patient's allergy, medicine and pregnancy checks. For prescriber review, not a prescription. Nothing changes until you edit and re-check.",
    "จากชุดกฎ MedX และผ่านการตรวจแพ้ยา ยาที่ใช้อยู่ และการตั้งครรภ์ของผู้ป่วยรายนี้แล้ว สำหรับแพทย์ผู้สั่งยาพิจารณา ไม่ใช่คำสั่งใช้ยา ไม่มีอะไรเปลี่ยนจนกว่าแพทย์จะแก้ไขและตรวจซ้ำ",
    "Dal set di regole MedX, già passate nei controlli di allergie, farmaci e gravidanza di questo paziente. Da valutare dal prescrittore, non una prescrizione. Nulla cambia finché non modifichi e ricontrolli.",
  ),
  useAlt: L("Edit with {drug}", "แก้ไขเป็น {drug}", "Modifica con {drug}"),
  altSource: L("Source", "แหล่งอ้างอิง", "Fonte"),
  switchHint: L(
    "Option under review: {drug}. Dose and frequency are cleared: set them for {drug}, press Update and re-check, then submit again.",
    "ตัวเลือกที่กำลังพิจารณา: {drug} ล้างขนาดยาและความถี่แล้ว กำหนดใหม่สำหรับ {drug} กดแก้ไขและตรวจอีกครั้ง แล้วส่งใหม่",
    "Opzione in valutazione: {drug}. Dose e frequenza sono state svuotate: impostale per {drug}, premi Aggiorna e ricontrolla, poi invia di nuovo.",
  ),
  previousRx: L("Previous", "เดิม", "Precedente"),
  verifiedLine: L("Verified by {who}, {time}", "{who} ตรวจสอบใบสั่งยาแล้ว เวลา {time}", "Verificato da {who}, {time}"),
  dispensedLine: L("Dispensed by {who}, {time}", "{who} จ่ายยา เวลา {time}", "Dispensato da {who}, {time}"),
  dispenseChecked: L("Final double check: right patient, drug, dose and route; allergy rechecked; labelled.", "ตรวจซ้ำขั้นสุดท้าย: ถูกคน ถูกยา ถูกขนาด ถูกทาง ตรวจแพ้ยาซ้ำ และติดฉลากแล้ว", "Doppio controllo finale: paziente, farmaco, dose e via corretti; allergie ricontrollate; etichettato."),
  noCancelLocked: L("Verified and dispensed orders cannot be cancelled here. Contact the pharmacy.", "คำสั่งที่เภสัชกรตรวจสอบหรือจ่ายยาแล้วยกเลิกจากหน้านี้ไม่ได้ โปรดติดต่อห้องยา", "Gli ordini verificati o dispensati non si annullano da qui. Contatta la farmacia."),
  pickupTitle: L("Medicine pickup", "การรับยา", "Ritiro farmaci"),
  pickupReady: L("Ready, patient called to counter {counter}", "พร้อมแล้ว เรียกผู้ป่วยรับยาที่ช่อง {counter}", "Pronto, paziente chiamato allo sportello {counter}"),
  pickupReadyNoCounter: L("Ready, patient called to collect", "พร้อมแล้ว เรียกผู้ป่วยรับยา", "Pronto, paziente chiamato al ritiro"),
  pickupCalledBy: L("Called by {who}, {time}", "เรียกโดย {who} เวลา {time}", "Chiamato da {who}, {time}"),
  pickupCollected: L("Medicines collected", "ผู้ป่วยรับยาแล้ว", "Farmaci ritirati"),
  pickupHandedBy: L("Handed over by {who}, {time}", "ส่งมอบโดย {who} เวลา {time}", "Consegnati da {who}, {time}"),
  pickupPreparing: L("Being prepared: {n} of {total} dispensed", "ห้องยากำลังจัดยา จ่ายแล้ว {n} จาก {total} รายการ", "In preparazione: {n} di {total} dispensati"),
  tlDispensed: L("Dispensed by", "จ่ายยาโดย", "Dispensato da"),
  tlPickupCalled: L("Patient called to collect by", "เรียกผู้ป่วยรับยาโดย", "Paziente chiamato al ritiro da"),
  tlPickupRecalled: L("Patient called again by", "เรียกผู้ป่วยรับยาซ้ำโดย", "Paziente richiamato da"),
  tlPickupCollected: L("Collected, handed over by", "รับยาแล้ว ส่งมอบโดย", "Ritirato, consegnato da"),
  tlPickupReset: L("pickup reset, medicines being prepared again", "ยกเลิกการเรียกรับยา กำลังจัดยาใหม่", "ritiro annullato, farmaci di nuovo in preparazione"),
  tlCounter: L("counter {counter}", "ช่อง {counter}", "sportello {counter}"),
  tlSuggested: L("suggested for review: {drugs}", "เสนอให้พิจารณา: {drugs}", "suggeriti da valutare: {drugs}"),
  // w20: investigations are sent, never "verified" or "resulted": there is no lab system in this prototype (C-05)
  invSent: L("Sent (no lab system in this prototype)", "ส่งแล้ว (ต้นแบบนี้ไม่มีระบบห้องปฏิบัติการ)", "Inviato (nessun sistema di laboratorio in questo prototipo)"),
  invNoLab: L("There is no lab system in this prototype: orders are recorded and sent, and no results come back here.", "ต้นแบบนี้ไม่มีระบบห้องปฏิบัติการ คำสั่งตรวจจะถูกบันทึกและส่ง แต่จะไม่มีผลตรวจกลับมาที่นี่", "In questo prototipo non c'è un sistema di laboratorio: gli esami sono registrati e inviati, nessun risultato torna qui."),
  // w20: nurse to doctor handover after triage (S-01)
  handoverTitle: L("Handover", "ส่งต่อ", "Passaggio di consegne"),
  readyForDoctor: L("Ready for doctor", "พร้อมพบแพทย์", "Pronto per il medico"),
  readyForDoctorHint: L("Triage is confirmed. Ready for doctor switches the role to Doctor and opens the doctor consult for this case.", "ยืนยันการคัดแยกแล้ว ปุ่มพร้อมพบแพทย์จะเปลี่ยนบทบาทเป็นแพทย์และเปิดหน้าการตรวจของเคสนี้", "Il triage è confermato. Pronto per il medico passa al ruolo Medico e apre il consulto medico di questo caso."),
  startHistory: L("Start history taking", "เริ่มซักประวัติ", "Avvia anamnesi"),
  yes: L("Yes", "ใช่", "Sì"),
  no: L("No", "ไม่ใช่", "No"),
  // w20: an order sent back to pharmacist 1 by the engine's re-check
  recheckNote: L("Re-check needed: a new high alert came up after verification, so this order is back with pharmacist 1.", "ต้องตรวจซ้ำ: มีการแจ้งเตือนระดับสูงใหม่หลังการตรวจสอบ คำสั่งนี้จึงกลับไปที่เภสัชกรคนที่ 1", "Ricontrollo necessario: dopo la verifica è comparso un nuovo avviso alto, l'ordine torna al farmacista 1."),
  tlRecheck: L("Re-check needed, back to pharmacist 1", "ต้องตรวจซ้ำ ส่งกลับเภสัชกรคนที่ 1", "Ricontrollo necessario, torna al farmacista 1"),
} satisfies Record<string, Localized>;
export type TKey = keyof typeof T;
export const tr = (k: TKey, lang: Lang, vars?: Record<string, string | number>) =>
  T[k][lang].replace(/\{(\w+)\}/g, (_, v: string) => String(vars?.[v] ?? ""));

export const clockOf = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(lang === "th" ? "th-TH" : lang === "it" ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/** The page was opened with ?fixtures=1 (demos and tests): reads may then fall back to sample data on any failure. */
export function fixturesRequested(search: string | undefined = typeof window === "undefined" ? undefined : window.location.search): boolean {
  return !!search && new URLSearchParams(search).get("fixtures") === "1";
}

/**
 * Call a route. READS (no body) fall back to `fixture` only when the route itself is missing on this server (404/405
 * without an API error body, e.g. an older deploy), or on any failure when the page was opened with ?fixtures=1.
 * A 5xx (503 "Shared store unavailable"), a 404 "Session not found" or a network error throws the server's message:
 * the page keeps the last real data it had and shows why, never sample data under a real case URL (invariant 3).
 * WRITES never fall back: any failure throws the server message so the form stays and the user sees it.
 */
export async function call<T>(url: string, body: unknown | undefined, fixture: () => T, opts: { fixtures?: boolean } = {}): Promise<{ data: T; fixture: boolean }> {
  const write = body !== undefined;
  const allowFixture = !write && (opts.fixtures ?? fixturesRequested());
  let res: Response;
  try {
    res = await fetch(url, write ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  } catch {
    if (write) throw new Error("Network error. Nothing was saved.");
    if (allowFixture) return { data: fixture(), fixture: true };
    throw new Error("Network error: the server did not answer. Needs human review if it persists.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const apiError = typeof json?.error === "string";
    if (!write && (allowFixture || ((res.status === 404 || res.status === 405) && !apiError))) return { data: fixture(), fixture: true };
    throw new Error(json?.error ?? (write ? `Request failed (${res.status}). Nothing was saved.` : `Request failed (${res.status}).`));
  }
  return { data: json as T, fixture: false };
}

const RULES = medrules as unknown as MedRuleFile;
// Same matching as the engine's lookup (lower-case NFC substring, longest name wins). UI convenience only:
// the server re-resolves drugText and reruns every check on "Update and re-check".
const medNorm = (t: string) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim() + " ";
function genericOf(text: string): string | null {
  const t = medNorm(text); let best: string | null = null; let len = 0;
  for (const d of RULES.drugs) for (const n of d.names) if (n.length > len && t.includes(n.normalize("NFC"))) { best = d.generic; len = n.length; }
  return best;
}
/** Text to pre-fill the drug field with so the dictionary resolves it to `generic` (combinations resolve by product name). */
export function drugTextFor(generic: string): string {
  if (genericOf(generic) === generic) return generic;
  const d = RULES.drugs.find((x) => x.generic === generic);
  return d?.names.map((n) => n.trim()).find((n) => /[a-z]/i.test(n) && genericOf(n) === generic) ?? generic;
}
/** Curated notes behind an alert's alternatives (same table the engine reads), for prescriber context. */
export const alternativeNotes = (kind: MedAlert["kind"], drugClass: string | null) =>
  drugClass ? (RULES.alternatives ?? []).filter((e) => e.kinds.includes(kind) && e.drugClasses.includes(drugClass)) : [];

/** Routes return either the session or { session }. */
export const asSession = (b: unknown): IntakeSession => ((b as { session?: IntakeSession }).session ?? b) as IntakeSession;
