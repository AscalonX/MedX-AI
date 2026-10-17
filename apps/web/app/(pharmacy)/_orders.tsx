"use client";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { DispenseChecklist, IntakeSession, Lang, Localized, MedAlert, MedicationOrder } from "@medx/shared";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Icon, LangMorph, Pill, SegmentedControl } from "@/components/ui";
import {
  C, CHECKLIST_KEYS, DICTIONARY_GENERICS, L, PHARMACISTS, STAGES, STAGE_LABEL, U, activeOrders, allergiesOf, alternativeEntries, canCall, clock, hasNka, isAbstained,
  kindTitle, openHighChecks, orderTitle, ordersOf, overrideOf, sameGeneric, samePerson, stageRows, toDictionaryGeneric, waited, type Stage,
} from "./_lib";
import { usePharmacy, type Entry } from "./_shell";

/** Workspace action runner: sets busy, refreshes the audit, and hands a refusal message to `onError`. */
export type Run = (fn: () => Promise<unknown>, onError?: (message: string) => void) => Promise<boolean>;

const sm = "h-8! px-3! text-small!";
const ST_TONE: Record<MedicationOrder["status"], "outline" | "ocean" | "teal" | "pencil"> = { draft: "outline", submitted: "ocean", verified: "teal", returned: "pencil", dispensed: "teal", cancelled: "outline" };
const ST_RANK: Record<MedicationOrder["status"], number> = { submitted: 0, verified: 1, returned: 2, dispensed: 3, draft: 4, cancelled: 5 };
const OL = {
  status: {
    draft: L("ฉบับร่าง", "Bozza", "Draft"),
    submitted: L("รอเภสัชกร", "In attesa del farmacista", "Awaiting pharmacist"),
    verified: L("ตรวจสอบแล้ว", "Verificato", "Verified"),
    returned: L("ส่งกลับแพทย์", "Restituito al prescrittore", "Returned to prescriber"),
    dispensed: L("จ่ายยาแล้ว", "Dispensato", "Dispensed"),
    cancelled: L("ยกเลิก", "Annullato", "Cancelled"),
  } as Record<MedicationOrder["status"], Localized>,
  prescribedBy: L("สั่งโดย", "Prescritto da", "Prescribed by"),
  noAlerts: L("ไม่มีการแจ้งเตือนจากกฎสำหรับคำสั่งนี้ ไม่ใช่การตรวจการสั่งยาแบบครบถ้วน", "Nessun avviso dalle regole per questo ordine. Non è un controllo completo della prescrizione.", "No rule alerts for this order. This is not a complete prescribing check."),
  high: L("สูง", "Alto", "High"), moderate: L("ปานกลาง", "Moderato", "Moderate"),
  check: L("สิ่งที่ต้องตรวจ", "Da verificare", "Check"),
  override: L("แพทย์ยืนยันดำเนินการต่อ", "Deroga del prescrittore", "Prescriber override"),
  noOverride: L("ไม่มีเหตุผลการยืนยันดำเนินการต่อจากแพทย์", "Nessuna deroga del prescrittore registrata", "No prescriber override recorded"),
  // stage 1: pharmacist 1
  stage1: L("ขั้นที่ 1: ตรวจใบสั่งยา (เภสัชกรคนแรก)", "Fase 1: verifica della prescrizione (primo farmacista)", "Stage 1: prescription check (first pharmacist)"),
  verify: L("ตรวจสอบ", "Verifica", "Verify"),
  returnBtn: L("ส่งกลับแพทย์", "Restituisci al prescrittore", "Return to prescriber"),
  blocked: L("ยังตรวจสอบไม่ได้", "Verifica bloccata", "Verify is blocked"),
  blockHigh: (n: number) => L(`การแจ้งเตือนสูง ${n} รายการไม่มีเหตุผลจากแพทย์ ให้ส่งกลับแพทย์พร้อมหมายเหตุ`, `${n} avvisi alti senza deroga del prescrittore. Restituire l'ordine con una nota.`, `${n} high ${n === 1 ? "alert has" : "alerts have"} no prescriber override. Return the order to the prescriber with a note.`),
  overridesOk: L("การแจ้งเตือนสูงทุกรายการมีเหตุผลจากแพทย์ที่บันทึกไว้ การตรวจสอบคือการยืนยันคำสั่งและเหตุผลนั้น", "Ogni avviso alto ha una deroga documentata. Verificando, confermi l'ordine e quel ragionamento.", "Every high alert has a documented prescriber override. You are verifying the order and that reasoning."),
  noteLabel: L("หมายเหตุถึงแพทย์ (จำเป็น)", "Nota al prescrittore (obbligatoria)", "Note to the prescriber (required)"),
  noteHint: L("บอกสิ่งที่ต้องแก้หรือยืนยัน คำสั่งยังอยู่ในบันทึก", "Indica cosa cambiare o confermare. L'ordine resta nel registro.", "Say what to change or confirm. The order stays on the record."),
  returnOrder: L("ส่งคืนคำสั่งพร้อมรายงาน", "Restituisci con il rapporto", "Return with report"),
  verified: L("ตรวจสอบคำสั่งแล้ว", "Ordine verificato", "Order verified"),
  by: L("โดย", "da", "By"),
  byInline: L("โดย", "da", "by"),
  reasonsReviewed: L("ได้ทบทวนเหตุผลของแพทย์แล้ว", "Motivi del prescrittore esaminati.", "Prescriber override reasons reviewed."),
  nextDispense: L(
    "ขั้นต่อไป: เภสัชกรคนที่สองจัดยาและบันทึกการตรวจขั้นสุดท้ายที่หน้านี้ การส่งมอบยาให้ผู้ป่วยยังเป็นหน้าที่ของเภสัชกรที่เคาน์เตอร์",
    "Prossimo passo: un secondo farmacista prepara il farmaco e registra qui il controllo finale. La consegna al paziente resta al farmacista allo sportello.",
    "Next: a second pharmacist picks the medicine and records the final check on this screen. Handing it to the patient stays with the pharmacist at the counter.",
  ),
  // options for prescriber review (medrules.alternatives)
  optionsTitle: L("ทางเลือกให้แพทย์ผู้สั่งยาพิจารณา", "Opzioni da valutare dal prescrittore", "Options for prescriber review"),
  optionsFoot: L(
    "ไม่ใช่ใบสั่งยา คัดจากตารางที่กำหนดไว้และผ่านกฎ MedX ของผู้ป่วยรายนี้ แต่ไม่ได้หมายความว่าตรวจแล้วปลอดภัย แพทย์ผู้สั่งยาเป็นผู้ตัดสินใจ",
    "Non è una prescrizione. Da una tabella curata, filtrate con le regole MedX per questo paziente: elencato non significa verificato come sicuro. Decide il prescrittore.",
    "Not a prescription. From a curated table, filtered by MedX rules for this patient: listed does not mean checked safe. The prescriber decides.",
  ),
  source: L("แหล่งอ้างอิง", "Fonte", "Source"),
  // return form
  raiseAlerts: L("การแจ้งเตือนที่ต้องการให้แพทย์ทบทวน", "Avvisi da segnalare al prescrittore", "Alerts to raise with the prescriber"),
  raiseHint: L("เลือกการแจ้งเตือนระดับสูงไว้ให้แล้ว เปลี่ยนได้", "Gli avvisi alti sono già selezionati; si possono cambiare.", "High alerts are preselected; change as needed."),
  suggestTitle: L("ทางเลือกให้แพทย์ผู้สั่งยาพิจารณา (ไม่บังคับ สูงสุด 5 รายการ)", "Opzioni da valutare dal prescrittore (facoltative, al massimo 5)", "Options for prescriber review (optional, up to 5)"),
  suggestHint: L(
    "ระบบไม่เขียนทางเลือกลงในใบสั่งยา แพทย์เป็นผู้ตัดสินใจ และใบสั่งยาที่แก้ไขจะถูกตรวจใหม่ทั้งหมด",
    "Un'opzione non viene mai scritta nell'ordine. Decide il prescrittore, e un ordine modificato viene ricontrollato da capo.",
    "An option is never written into the order. The prescriber decides, and an edited order is checked again from scratch.",
  ),
  fromTable: L("จากตารางทางเลือก", "dalla tabella", "from the table"),
  noAltOptions: L("ไม่มีทางเลือกจากตารางสำหรับคำสั่งนี้ เพิ่มชื่อสามัญจากพจนานุกรมได้", "Nessuna opzione dalla tabella per questo ordine. Si può aggiungere un generico dal dizionario.", "No options from the table for this order. You can add a dictionary generic."),
  addGeneric: L("เพิ่มชื่อสามัญจากพจนานุกรมยา", "Aggiungi un generico dal dizionario", "Add a dictionary generic"),
  addGenericHint: L("พิมพ์ชื่อสามัญตามพจนานุกรม MedX แล้วกดเพิ่ม", "Scrivi il nome generico come nel dizionario MedX, poi Aggiungi.", "Type the generic as written in the MedX dictionary, then Add."),
  add: L("เพิ่ม", "Aggiungi", "Add"),
  errNotDict: L("ไม่มีในพจนานุกรมยา MedX", "Non presente nel dizionario MedX", "Not in the MedX drug dictionary"),
  errOrdered: L("เป็นยาที่สั่งอยู่แล้ว", "È il farmaco già ordinato", "This is the ordered drug"),
  errMax: L("เลือกได้สูงสุด 5 รายการ", "Al massimo 5 opzioni", "At most 5 options"),
  // returned with report
  returnedTo: L("ส่งกลับให้", "Restituito a", "Returned to"),
  note: L("หมายเหตุ", "Nota", "Note"),
  reportAlerts: L("การแจ้งเตือนที่แจ้งแพทย์", "Avvisi segnalati", "Alerts raised"),
  reportOptions: L("ทางเลือกให้แพทย์ผู้สั่งยาพิจารณา ไม่ใช่ใบสั่งยา", "Opzioni da valutare dal prescrittore, non una prescrizione", "Options for prescriber review, not a prescription"),
  waitingPrescriber: L("รอแพทย์ผู้สั่งยาทบทวน แก้ไข หรือยกเลิกใบสั่งยา", "In attesa che il prescrittore riveda, modifichi o annulli l'ordine", "Waiting for the prescriber to review, edit or cancel the order"),
  // stage 2: pharmacist 2
  stage2: L("ขั้นที่ 2: จัดยาและตรวจขั้นสุดท้าย (เภสัชกรคนที่สอง)", "Fase 2: preparazione e controllo finale (secondo farmacista)", "Stage 2: pick and final check (second pharmacist)"),
  verifiedBy: L("ตรวจสอบโดย", "Verificato da", "Verified by"),
  twoPersonTitle: L("ต้องให้เภสัชกรคนที่สองจ่ายยา", "Serve un secondo farmacista", "A second pharmacist must dispense"),
  twoPersonBody: (name: string) => L(
    `คุณ (${name}) เป็นผู้ตรวจสอบใบสั่งยานี้ จึงตรวจขั้นสุดท้ายเองไม่ได้ ให้เภสัชกรอีกคนลงชื่อเข้าใช้ที่ "${C.signedInAs.th}"`,
    `Lei (${name}) ha verificato questo ordine, quindi non può fare anche il controllo finale. Un altro farmacista accede da "${C.signedInAs.it}".`,
    `You (${name}) verified this order, so you cannot also do the final check. Another pharmacist signs in under "${C.signedInAs.en}".`,
  ),
  switchTo: (name: string) => L(`ลงชื่อเข้าใช้เป็น ${name}`, `Accedi come ${name}`, `Sign in as ${name}`),
  checkIntro: L(
    "ตรวจแต่ละข้อด้วยตนเอง เทียบกับใบสั่งยาที่ตรวจสอบแล้วและฉลากในมือ ถ้าข้อใดไม่ผ่าน อย่าติ๊ก ให้หยุดและกลับไปหาเภสัชกรคนแรกหรือแพทย์",
    "Controlli ogni voce di persona, sull'ordine verificato e sull'etichetta in mano. Se una voce non torna, non la spunti: si fermi e torni dal primo farmacista o dal prescrittore.",
    "Check each item yourself against the verified order and the label in hand. If any item fails, do not tick it: stop and go back to the first pharmacist or the prescriber.",
  ),
  checklist: L("การตรวจขั้นสุดท้าย 6 ข้อ", "Controllo finale in 6 voci", "Six-item final check"),
  ticked: (n: number) => L(`ยืนยันแล้ว ${n} จาก 6 ข้อ`, `${n} di 6 confermate`, `${n} of 6 confirmed`),
  dispenseNote: L("หมายเหตุ (ไม่บังคับ)", "Nota (facoltativa)", "Note (optional)"),
  recordDispense: L("บันทึกการตรวจและจ่ายยา", "Registra controllo e dispensazione", "Record final check and dispense"),
  patientCode: L("รหัสผู้ป่วย", "Codice paziente", "Patient code"),
  allergiesRecorded: L("การแพ้ที่บันทึกไว้", "Allergie registrate", "Recorded allergies"),
  dispensedBy: L("จ่ายยาโดย", "Dispensato da", "Dispensed by"),
  finalChecked: L("ยืนยันการตรวจขั้นสุดท้ายครบ 6 ข้อ", "Controllo finale confermato, 6 voci su 6.", "All six final checks confirmed."),
  handOver: L("ส่งมอบยาที่เคาน์เตอร์เมื่อเรียกผู้ป่วย", "La consegna avviene allo sportello quando il paziente viene chiamato.", "Hand-over happens at the counter when the patient is called."),
  // card + queue
  title: L("ใบสั่งยา", "Prescrizioni", "Prescriptions"),
  fixture: L("ตัวอย่าง", "Esempio", "Fixture"),
  highNoOverride: (n: number) => L(`สูง ${n} ไม่มีเหตุผลแพทย์`, `${n} alti, nessuna deroga`, `${n} high, no override`),
  highN: (n: number) => L(`สูง ${n}`, `${n} alti`, `${n} high`),
  toCheck: (n: number) => L(`ต้องตรวจ ${n}`, `${n} da verificare`, `${n} to check`),
  noRule: L("ไม่มีการแจ้งเตือนจากกฎ", "Nessun avviso dalle regole", "No rule alerts"),
  stages: L("ขั้นตอนห้องยา", "Fasi della farmacia", "Pharmacy stages"),
  needsSecond: L("คุณตรวจสอบเอง ต้องให้เภสัชกรคนที่สองจ่ายยา", "Verificato da Lei: serve un secondo farmacista", "You verified it: needs a second pharmacist"),
  readyToPick: L("พร้อมจัดยา", "Da preparare", "Ready to pick"),
  allDispensed: L("จ่ายยาครบแล้ว เรียกผู้ป่วยได้", "Tutto dispensato: chiamare il paziente", "All dispensed: call the patient"),
  dispensedN: (n: number) => L(`จ่ายยาแล้ว ${n} รายการ`, n === 1 ? "1 farmaco dispensato" : `${n} farmaci dispensati`, n === 1 ? "1 medicine dispensed" : `${n} medicines dispensed`),
  calledBy: L("เรียกโดย", "Chiamato da", "Called by"),
  collectedBy: L("ส่งมอบโดย", "Consegnato da", "Handed over by"),
  called: L("เรียกแล้ว", "Chiamato", "Called"),
  collected: L("รับยาแล้ว", "Ritirato", "Collected"),
  stageHint: {
    verify: L("เภสัชกรคนแรกตรวจใบสั่งยาแต่ละรายการ: การแพ้ ปฏิกิริยาระหว่างยา ขนาดยา และเหตุผลของแพทย์ นับเป็นรายการยา", "Il primo farmacista verifica ogni prescrizione: allergie, interazioni, dose e motivi del prescrittore. Conteggio per ordine.", "The first pharmacist checks each prescription: allergy, interaction, dose and the prescriber's reasons. Counted per order."),
    dispense: L("เภสัชกรคนที่สอง (คนละคนกับผู้ตรวจสอบ) จัดยาและตรวจขั้นสุดท้าย 6 ข้อ นับเป็นรายการยา", "Un secondo farmacista, diverso da chi ha verificato, prepara e fa il controllo finale in 6 voci. Conteggio per ordine.", "A second pharmacist, not the one who verified, picks the medicine and does the six-item final check. Counted per order."),
    call: L("ยาทุกรายการของผู้ป่วยจ่ายแล้ว เรียกผู้ป่วยมารับยา นับเป็นผู้ป่วย", "Tutti gli ordini attivi sono dispensati: chiamare il paziente. Conteggio per paziente.", "Every active order is dispensed: call the patient to a counter. Counted per patient."),
    ready: L("เรียกผู้ป่วยแล้ว รอรับยาที่เคาน์เตอร์ นับเป็นผู้ป่วย", "Paziente chiamato, in attesa allo sportello. Conteggio per paziente.", "Called to a counter, waiting to collect. Counted per patient."),
    collected: L("ส่งมอบยาแล้ววันนี้ นับเป็นผู้ป่วย", "Consegnati oggi. Conteggio per paziente.", "Handed over today. Counted per patient."),
  } as Record<Stage, Localized>,
  stageEmpty: {
    verify: L("ไม่มีใบสั่งยารอตรวจ", "Nessuna prescrizione da verificare", "No prescriptions to verify"),
    dispense: L("ไม่มียารอจัด", "Nessun farmaco da dispensare", "Nothing to dispense"),
    call: L("ไม่มีผู้ป่วยรอเรียก", "Nessun paziente da chiamare", "No patients to call"),
    ready: L("ไม่มีผู้ป่วยรอรับยา", "Nessun paziente in attesa di ritiro", "No patients waiting to collect"),
    collected: L("ยังไม่มีการรับยาวันนี้", "Nessun ritiro oggi", "No collections today"),
  } as Record<Stage, Localized>,
  stageEmptyBody: L("คิวอัปเดตอัตโนมัติทุก 5 วินาที", "La coda si aggiorna da sola ogni 5 secondi.", "The queue refreshes by itself every 5 seconds."),
  // pickup
  pickupTitle: L("รับยา", "Ritiro dei farmaci", "Medicine pickup"),
  stillToDo: L("เรียกผู้ป่วยได้เมื่อยาทุกรายการที่ยังใช้อยู่จ่ายแล้ว ยังเหลือ", "Si può chiamare il paziente quando ogni ordine attivo è dispensato. Mancano", "You can call the patient when every active order is dispensed. Still open"),
  withPrescriber: (n: number) => L(`อยู่ที่แพทย์ ${n}`, `${n} dal prescrittore`, `${n} with the prescriber`),
  counter: (c: string) => L(`ช่อง ${c}`, `Sportello ${c}`, `Counter ${c}`),
  counterLabel: L("ช่องรับยา", "Sportello", "Counter"),
  callPatient: L("เรียกผู้ป่วย", "Chiama il paziente", "Call patient"),
  callAgain: L("เรียกซ้ำ", "Chiama di nuovo", "Call again"),
  markCollected: L("บันทึกว่ารับยาแล้ว", "Segna come ritirato", "Mark collected"),
  callNote: L("การเรียกจะเปลี่ยนสถานะที่แอปของผู้ป่วยแสดง แต่ไม่รับประกันว่าผู้ป่วยเห็นแล้ว", "La chiamata aggiorna lo stato che l'app del paziente mostra; non garantisce che il paziente l'abbia visto.", "Calling sets the status the patient app shows. It does not guarantee the patient saw it."),
  collectNote: L("ยืนยันตัวผู้ป่วยที่เคาน์เตอร์และแนะนำการใช้ยาก่อนส่งมอบ", "Allo sportello, confermi l'identità del paziente e dia le istruzioni prima della consegna.", "At the counter, confirm the patient's identity and counsel before handing over."),
  collectedTitle: L("ผู้ป่วยรับยาแล้ว", "Farmaci ritirati", "Medicines collected"),
  newOrderAfter: L("มีใบสั่งยาใหม่หลังรับยาแล้ว ระบบเรียกผู้ป่วยซ้ำไม่ได้ ให้แจ้งผู้ป่วยโดยตรง", "C'è un nuovo ordine dopo il ritiro: il sistema non può richiamare il paziente. Avvisarlo di persona.", "A new order arrived after collection. The system cannot call the patient again: tell the patient in person."),
};

/** A refused action: amber "blocked" styling with the server's own words (red stays for urgency). */
const Refusal = ({ msg, lang }: { msg: string | null; lang: Lang }) =>
  msg ? <p role="alert" className="mt-2 rounded-lg bg-warn-tint px-3 py-2 text-small font-semibold text-warn">{U.refused[lang]}: {msg}</p> : null;

const severityBadge = (c: MedAlert, lang: Lang) => (
  <Badge tone={c.severity === "high" ? "signalOutline" : "pencil"} icon={<Icon name="triangle-alert" size={14} />}>{c.severity === "high" ? OL.high[lang] : OL.moderate[lang]}</Badge>
);

/** What pharmacist 2 re-reads for the allergy item. Abstained summaries are not trusted. */
function allergyLine(s: IntakeSession, lang: Lang): { text: string; warn: boolean } {
  if (isAbstained(s)) return { text: U.needsHuman[lang], warn: true };
  const list = allergiesOf(s);
  if (list.length) {
    return {
      text: list.map((a) => `${a.allergenClass ?? a.allergenOriginal}${a.reaction ? ` (${a.reaction})` : ""}${a.status === "unsupported" || a.status === "unmatched" ? `, ${U.needsCheck[lang]}` : ""}`).join("; "),
      warn: list.some((a) => a.status === "unsupported" || a.status === "unmatched"),
    };
  }
  return hasNka(s) ? { text: U.nka[lang], warn: false } : { text: U.notStatedAsk[lang], warn: true };
}

const CHECK_ITEMS: Record<keyof DispenseChecklist, { label: Localized; hint: Localized }> = {
  rightPatient: {
    label: L("ผู้ป่วยถูกคน", "Paziente giusto", "Right patient"),
    hint: L("ตัวระบุ 2 อย่าง (ชื่อ และวันเกิดหรือรหัสผู้ป่วย) ตรงกับใบสั่งยาและฉลาก", "Due identificativi (nome e data di nascita o codice paziente) corrispondono all'ordine e all'etichetta.", "Two identifiers (name and date of birth or patient code) match the order and the label."),
  },
  rightDrug: {
    label: L("ยาถูกตัว", "Farmaco giusto", "Right drug"),
    hint: L("ยาที่หยิบเป็นชื่อสามัญและความแรงที่ตรวจสอบแล้ว ไม่ใช่ยาที่ชื่อหรือรูปลักษณ์คล้ายกัน", "Il prodotto preso è il generico e il dosaggio verificati, non un farmaco simile per nome o aspetto.", "The product picked is the verified generic and strength, not a look-alike or sound-alike."),
  },
  rightDose: {
    label: L("ขนาดยาถูกต้อง", "Dose giusta", "Right dose"),
    hint: L("ความแรงคูณจำนวนต่อครั้งเท่ากับขนาดที่ตรวจสอบแล้ว และจำนวนยาตรงกับความถี่และระยะเวลา", "Dosaggio per numero di unità = dose verificata; la quantità corrisponde a frequenza e durata.", "Strength times units per dose equals the verified dose; the quantity matches frequency and duration."),
  },
  rightRoute: {
    label: L("วิธีให้ยาถูกต้อง", "Via giusta", "Right route"),
    hint: L("รูปแบบยาเหมาะกับวิธีให้ยา (ยาเม็ด ยาทา ยาสูด)", "La forma farmaceutica corrisponde alla via (compressa, topica, inalatoria).", "The formulation fits the route (oral tablet, topical, inhaled)."),
  },
  allergyRechecked: {
    label: L("ตรวจการแพ้ซ้ำแล้ว", "Allergie ricontrollate", "Allergies re-checked"),
    hint: L("อ่านประวัติแพ้ยาเทียบกับตัวยาทุกตัว รวมถึงยาผสม ถ้าพบการแพ้ใหม่หรือไม่ชัด ให้หยุด อย่าจ่ายยา", "Allergie registrate rilette contro ogni principio attivo, anche nei prodotti combinati. Un'allergia nuova o non chiara: fermarsi, non dispensare.", "Recorded allergies re-read against every ingredient, including combination products. A new or unclear allergy means stop: do not dispense."),
  },
  labelled: {
    label: L("ติดฉลากแล้ว", "Etichettato", "Labelled"),
    hint: L("ฉลากมีชื่อผู้ป่วย ชื่อสามัญ ความแรง ขนาด ความถี่ ระยะเวลา และคำเตือนสำคัญ เป็นภาษาของผู้ป่วย", "L'etichetta riporta nome del paziente, generico, dosaggio, dose, frequenza, durata e avvertenze principali, nella lingua del paziente.", "The label shows patient name, generic, strength, dose, frequency, duration and key warnings, in the patient's language."),
  },
};

/** Options for prescriber review under one alert: the generics plus the curated note and source. Never a prescription. */
function AlertOptions({ o, c, lang }: { o: MedicationOrder; c: MedAlert; lang: Lang }) {
  if (!c.alternatives?.length) return null;
  const entries = alternativeEntries(o, c);
  return (
    <div className="mt-2 rounded-lg bg-sheet px-3 py-2 ring-1 ring-inset ring-rule">
      <p className="flex items-center gap-2 text-small font-bold text-ink"><Icon name="clipboard-list" size={16} className="text-ink-soft" />{OL.optionsTitle[lang]}</p>
      <ul aria-label={OL.optionsTitle[lang]} className="mt-1.5 flex flex-wrap gap-2">
        {c.alternatives.map((g) => <li key={g}><Badge tone="outline">{g}</Badge></li>)}
      </ul>
      {entries.map((e) => <p key={e.id} className="mt-1.5 max-w-[75ch] text-small text-ink-soft"><LangMorph text={e.note} lang={lang} /></p>)}
      <p className="mt-1.5 text-micro text-graphite">{OL.optionsFoot[lang]}</p>
      {entries.length > 0 && (
        <details className="mt-1 text-micro text-graphite">
          <summary className="cursor-pointer font-semibold text-ocean">{OL.source[lang]}</summary>
          {entries.map((e) => <p key={e.id} className="mt-1">{e.source}</p>)}
        </details>
      )}
    </div>
  );
}

/** Pharmacist 1's return: required note, alerts to raise (high preselected), options for prescriber review (max 5). */
export function ReturnForm({ o, lang, busy, onCancel, onSubmit }: {
  o: MedicationOrder; lang: Lang; busy: boolean; onCancel: () => void;
  onSubmit: (note: string, alertIds: string[], suggestedGenerics: string[]) => void;
}) {
  const listId = useId();
  const [note, setNote] = useState("");
  const [alertIds, setAlertIds] = useState<Set<string>>(() => new Set(o.checks.filter((c) => c.severity === "high").map((c) => c.id)));
  const tableOptions = [...new Set(o.checks.flatMap((c) => c.alternatives ?? []))].filter((g) => !sameGeneric(g, o.generic));
  const [extras, setExtras] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [extraErr, setExtraErr] = useState<string | undefined>();
  const options = [...tableOptions, ...extras.filter((g) => !tableOptions.includes(g))];
  const toggle = (g: string, on: boolean) => setChosen((cur) => (on ? (cur.includes(g) || cur.length >= 5 ? cur : [...cur, g]) : cur.filter((x) => x !== g)));
  const addExtra = () => {
    const g = toDictionaryGeneric(extra);
    if (!g) return setExtraErr(OL.errNotDict[lang]);
    if (sameGeneric(g, o.generic)) return setExtraErr(OL.errOrdered[lang]);
    if (!chosen.includes(g) && chosen.length >= 5) return setExtraErr(OL.errMax[lang]);
    setExtraErr(undefined); setExtra("");
    if (!options.includes(g)) setExtras((cur) => [...cur, g]);
    toggle(g, true);
  };
  return (
    <form
      className="mt-3 flex flex-col gap-4 rounded-xl border border-rule/70 bg-paper p-3"
      onSubmit={(e) => { e.preventDefault(); if (note.trim()) onSubmit(note.trim(), o.checks.filter((c) => alertIds.has(c.id)).map((c) => c.id), chosen); }}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <Field autoFocus required multiline maxLength={500} label={OL.noteLabel[lang]} hint={OL.noteHint[lang]} value={note} onChange={(e) => setNote(e.target.value)} />
      {o.checks.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-small font-semibold text-ink">{OL.raiseAlerts[lang]}</legend>
          <p className="text-micro text-graphite">{OL.raiseHint[lang]}</p>
          {o.checks.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-sheet px-3 py-2 ring-1 ring-inset ring-rule">
              <input
                type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-ocean)]" checked={alertIds.has(c.id)}
                onChange={(e) => setAlertIds((cur) => { const n = new Set(cur); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
              />
              <span className="flex flex-wrap items-center gap-2 text-small">
                {severityBadge(c, lang)}
                <span className="font-semibold"><LangMorph text={kindTitle(c)} lang={lang} /></span>
                <span className="text-micro text-ink-soft">{c.ruleId}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-small font-semibold text-ink">{OL.suggestTitle[lang]}</legend>
        <p className="text-micro text-graphite">{OL.suggestHint[lang]}</p>
        {options.length === 0 && <p className="text-small text-ink-soft">{OL.noAltOptions[lang]}</p>}
        {options.map((g) => {
          const on = chosen.includes(g);
          return (
            <label key={g} className="flex cursor-pointer items-center gap-3 rounded-lg bg-sheet px-3 py-2 ring-1 ring-inset ring-rule">
              <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-ocean)]" checked={on} disabled={!on && chosen.length >= 5} onChange={(e) => toggle(g, e.target.checked)} />
              <span className="text-body font-semibold">{g}</span>
              {tableOptions.includes(g) && <span className="text-micro text-graphite">{OL.fromTable[lang]}</span>}
            </label>
          );
        })}
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <Field
              label={OL.addGeneric[lang]} hint={OL.addGenericHint[lang]} list={listId} maxLength={120} autoComplete="off" value={extra} error={extraErr}
              onChange={(e) => { setExtra(e.target.value); setExtraErr(undefined); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (extra.trim()) addExtra(); } }}
            />
          </div>
          <Button className="mb-0.5" disabled={!extra.trim()} onClick={addExtra}>{OL.add[lang]}</Button>
        </div>
        <datalist id={listId}>{DICTIONARY_GENERICS.filter((g) => !sameGeneric(g, o.generic)).map((g) => <option key={g} value={g} />)}</datalist>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" className={sm} disabled={busy || !note.trim()}>{OL.returnOrder[lang]}</Button>
        <Button className={sm} onClick={onCancel}>{U.cancel[lang]}</Button>
      </div>
    </form>
  );
}

/** Pharmacist 2: six separate, unticked items; no "select all"; the verifier is refused (UI and server). */
function DispensePanel({ o, session, lang, busy, reviewer, onSwitch, onSubmit }: {
  o: MedicationOrder; session: IntakeSession; lang: Lang; busy: boolean; reviewer: string; onSwitch: (name: string) => void;
  onSubmit: (checklist: DispenseChecklist, note?: string) => void;
}) {
  const [ticks, setTicks] = useState<Partial<Record<keyof DispenseChecklist, boolean>>>({});
  const [note, setNote] = useState("");
  const verifier = o.pharmacist?.by;
  const mine = samePerson(verifier, reviewer);
  const other = PHARMACISTS.find((p) => !samePerson(p, verifier));
  const n = CHECKLIST_KEYS.filter((k) => ticks[k]).length;
  const all = n === CHECKLIST_KEYS.length;
  const allergies = allergyLine(session, lang);
  const hintId = useId();
  return (
    <section aria-labelledby={`st2-${o.id}`} className="mt-3 rounded-xl border border-rule/70 bg-paper p-3">
      <h4 id={`st2-${o.id}`} className="flex items-center gap-2 text-body font-bold"><Icon name="pill" size={16} className="text-ocean" />{OL.stage2[lang]}</h4>
      <p className="mt-0.5 text-small text-ink-soft">{OL.verifiedBy[lang]} {verifier ?? "?"}{o.pharmacist ? `, ${clock(o.pharmacist.at)}` : ""}</p>
      {mine ? (
        <div role="status" className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-warn/60 bg-warn-tint px-3 py-2 text-small text-warn">
          <p className="flex items-center gap-2 font-bold"><Icon name="user" size={16} />{OL.twoPersonTitle[lang]}</p>
          <p>{OL.twoPersonBody(reviewer)[lang]}</p>
          {other && <span><Button className={sm} onClick={() => onSwitch(other)} icon={<Icon name="user" size={14} />}>{OL.switchTo(other)[lang]}</Button></span>}
        </div>
      ) : (
        <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (all) onSubmit(Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])) as unknown as DispenseChecklist, note.trim() || undefined); }}>
          <p className="text-small text-ink-soft">{OL.checkIntro[lang]}</p>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-small font-semibold text-ink">{OL.checklist[lang]}</legend>
            {CHECKLIST_KEYS.map((k) => (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg bg-sheet px-3 py-2 ring-1 ring-inset ring-rule">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-teal)]" checked={!!ticks[k]} onChange={(e) => setTicks((cur) => ({ ...cur, [k]: e.target.checked }))} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold">{CHECK_ITEMS[k].label[lang]}</span>
                  <span className="text-small text-ink-soft">{CHECK_ITEMS[k].hint[lang]}</span>
                  {k === "rightPatient" && <span className="mt-0.5 text-small">{OL.patientCode[lang]}: <span className="font-bold">{session.code}</span></span>}
                  {k === "rightDrug" && <span className="mt-0.5 text-small">{orderTitle(o)} · {o.route} · {o.frequency}{o.duration ? ` · ${o.duration}` : ""}</span>}
                  {k === "allergyRechecked" && (
                    <span className={`mt-0.5 text-small ${allergies.warn ? "font-semibold text-warn" : ""}`}>{OL.allergiesRecorded[lang]}: {allergies.text}</span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
          <Field label={OL.dispenseNote[lang]} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" className={sm} disabled={busy || !all} aria-describedby={hintId} icon={<Icon name="circle-check" size={16} />}>{OL.recordDispense[lang]}</Button>
            <span id={hintId} role="status" className="text-small text-ink-soft tabular-nums">{OL.ticked(n)[lang]}</span>
          </div>
        </form>
      )}
    </section>
  );
}

function OrderCard({ o, session, lang, busy, run }: { o: MedicationOrder; session: IntakeSession; lang: Lang; busy: boolean; run: Run }) {
  const { submitOrder, dispense, reviewer, setReviewer } = usePharmacy();
  const [form, setForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => { setErr(null); return run(fn, setErr); };
  const nHigh = openHighChecks(o).length;
  const block = nHigh ? OL.blockHigh(nHigh)[lang] : null;
  const open = o.status === "submitted";
  const hasHigh = o.checks.some((c) => c.severity === "high");
  const report = o.status === "returned" ? o.pharmacist?.report : undefined;
  const titleOf = (id: string) => { const c = o.checks.find((x) => x.id === id); return c ? `${kindTitle(c)[lang]} (${c.ruleId})` : id; };
  return (
    <li id={`order-${o.id}`} className="scroll-mt-4 rounded-2xl border border-rule/70 bg-sheet p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean"><Icon name="pill" /></span>
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="text-lead font-bold">{orderTitle(o)}</h3>
          <p className="text-small text-ink-soft">{o.route} · {o.frequency}{o.duration ? ` · ${o.duration}` : ""}{o.drugClass ? ` · ${o.drugClass.replace(/_/g, " ")}` : ""}</p>
          <p className="text-small text-ink-soft">{OL.prescribedBy[lang]} {o.orderedBy}, {clock(o.at)}</p>
        </div>
        <Badge tone={ST_TONE[o.status]}>{OL.status[o.status][lang]}</Badge>
      </div>

      {o.checks.length === 0 ? (
        <p className="mt-3 text-small text-ink-soft">{OL.noAlerts[lang]}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {o.checks.map((c) => {
            const ov = overrideOf(o, c.id);
            return (
              <li key={c.id} className={`rounded-xl p-3 ${c.severity === "high" ? "border border-signal/50 bg-signal-tint ring-1 ring-signal/20" : "border border-warn/30 bg-warn-tint"}`}>
                <p className="flex flex-wrap items-center gap-2">
                  {severityBadge(c, lang)}
                  <span className="font-bold"><LangMorph text={kindTitle(c)} lang={lang} /></span>
                  <span className="text-micro text-ink-soft">{c.ruleId}</span>
                </p>
                <p className="mt-1 text-body"><LangMorph text={c.message} lang={lang} /></p>
                <p className="text-small text-ink-soft"><span className="font-semibold">{OL.check[lang]}: </span><LangMorph text={c.action} lang={lang} /></p>
                {c.source && <p className="text-micro text-graphite">{c.source}</p>}
                {ov ? (
                  <p className="mt-2 rounded-lg bg-sheet px-3 py-2 text-small"><span className="font-bold">{OL.override[lang]}: </span>{ov.reason} <span className="text-ink-soft">({ov.by}, {clock(ov.at)})</span></p>
                ) : c.severity === "high" ? (
                  <p className="mt-2 text-small font-semibold text-signal">{OL.noOverride[lang]}.</p>
                ) : null}
                <AlertOptions o={o} c={c} lang={lang} />
              </li>
            );
          })}
        </ul>
      )}

      {open && !form && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="basis-full text-small font-bold text-ink">{OL.stage1[lang]}</span>
          <Button variant="primary" className={sm} disabled={busy || !!block} aria-describedby={`ob-${o.id}`} onClick={() => act(() => submitOrder(session.id, o.id, "verify"))} icon={<Icon name="circle-check" size={16} />}>{OL.verify[lang]}</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm(true); setErr(null); }}>{OL.returnBtn[lang]}</Button>
          {block && <p id={`ob-${o.id}`} role="status" className="basis-full text-small font-semibold text-warn">{OL.blocked[lang]}: {block}</p>}
          {!block && hasHigh && <p id={`ob-${o.id}`} className="basis-full text-small text-ink-soft">{OL.overridesOk[lang]}</p>}
        </div>
      )}
      {open && form && (
        <ReturnForm
          o={o} lang={lang} busy={busy} onCancel={() => setForm(false)}
          onSubmit={async (note, alertIds, suggestedGenerics) => { if (await act(() => submitOrder(session.id, o.id, "return", note, { alertIds, suggestedGenerics }))) setForm(false); }}
        />
      )}

      {(o.status === "verified" || o.status === "dispensed") && o.pharmacist && (
        <p role="status" className="mt-3 rounded-xl border border-teal/30 bg-teal-tint p-3 text-small text-ink">
          <span className="flex items-center gap-2 font-bold text-teal"><Icon name="circle-check" size={16} />{OL.verified[lang]}</span>
          {OL.by[lang]} {o.pharmacist.by}, {clock(o.pharmacist.at)}. {hasHigh ? OL.reasonsReviewed[lang] : ""} {o.status === "verified" ? OL.nextDispense[lang] : ""}
        </p>
      )}
      {o.status === "verified" && (
        <DispensePanel
          key={o.id} o={o} session={session} lang={lang} busy={busy} reviewer={reviewer} onSwitch={setReviewer}
          onSubmit={(checklist, note) => act(() => dispense(session.id, o.id, checklist, note))}
        />
      )}
      {o.status === "dispensed" && o.dispense && (
        <p role="status" className="mt-2 rounded-xl border border-teal/30 bg-teal-tint p-3 text-small text-ink">
          <span className="flex items-center gap-2 font-bold text-teal"><Icon name="circle-check" size={16} />{OL.dispensedBy[lang]} {o.dispense.by}, {clock(o.dispense.at)}</span>
          {OL.finalChecked[lang]} {OL.handOver[lang]}{o.dispense.note ? <> {OL.note[lang]}: {o.dispense.note}</> : null}
        </p>
      )}
      {o.status === "returned" && o.pharmacist && (
        <div role="status" className="mt-3 flex flex-col gap-1.5 rounded-xl border border-warn/30 bg-warn-tint p-3 text-small text-ink">
          <p><span className="font-bold text-warn">{OL.returnedTo[lang]} {o.orderedBy}</span> {OL.byInline[lang]} {o.pharmacist.by}, {clock(o.pharmacist.at)}.</p>
          {o.pharmacist.note && <p><span className="font-semibold">{OL.note[lang]}: </span>{o.pharmacist.note}</p>}
          {report && report.alertIds.length > 0 && <p><span className="font-semibold">{OL.reportAlerts[lang]}: </span>{report.alertIds.map(titleOf).join("; ")}</p>}
          {report && report.suggestedGenerics.length > 0 && (
            <div>
              <p className="font-semibold">{OL.reportOptions[lang]}:</p>
              <ul className="mt-1 flex flex-wrap gap-2">{report.suggestedGenerics.map((g) => <li key={g}><Badge tone="outline">{g}</Badge></li>)}</ul>
            </div>
          )}
          <p className="text-ink-soft">{OL.waitingPrescriber[lang]}</p>
        </div>
      )}
      <Refusal msg={err} lang={lang} />
    </li>
  );
}

/** Prescriptions card on the session page: every order with its stage (verify, dispense), above the reconciliation. */
export function PrescriptionsCard({ session, lang, busy, fixture, run }: { session: IntakeSession; lang: Lang; busy: boolean; fixture: boolean; run: Run }) {
  const visible = ordersOf(session).filter((o) => o.status !== "draft");
  if (visible.length === 0) return null;
  const sorted = [...visible].sort((a, b) => ST_RANK[a.status] - ST_RANK[b.status] || Number(openHighChecks(b).length > 0) - Number(openHighChecks(a).length > 0));
  const count = (st: MedicationOrder["status"]) => visible.filter((o) => o.status === st).length;
  const summary = (["submitted", "verified", "returned", "dispensed"] as const).filter((st) => count(st) > 0);
  return (
    <Card id="orders" aria-labelledby="h-orders">
      <CardHeader title={<span id="h-orders">{OL.title[lang]}</span>} action={<span className="flex items-center gap-2">{fixture && <Badge tone="pencil">{OL.fixture[lang]}</Badge>}<span className="text-small text-ink-soft">{visible.length}</span></span>} />
      {summary.length > 0 && (
        <p className="-mt-2 mb-3 flex flex-wrap gap-2">{summary.map((st) => <Badge key={st} tone={ST_TONE[st]}>{OL.status[st][lang]}: {count(st)}</Badge>)}</p>
      )}
      <ul className="flex flex-col gap-3">
        {sorted.map((o) => <OrderCard key={o.id} o={o} session={session} lang={lang} busy={busy} run={run} />)}
      </ul>
    </Card>
  );
}

const COUNTERS = ["1", "2", "3"] as const;
/** Pickup: call the patient once every active order is dispensed, then record collection. */
export function PickupCard({ session, lang, busy, run }: { session: IntakeSession; lang: Lang; busy: boolean; run: Run }) {
  const { pickup, now } = usePharmacy();
  const p = session.pickup;
  const [counter, setCounter] = useState<string>(p?.counter && (COUNTERS as readonly string[]).includes(p.counter) ? p.counter : "1");
  const [err, setErr] = useState<string | null>(null);
  const active = activeOrders(session);
  if (!active.some((o) => o.status !== "draft") && !p) return null; // nothing has reached the pharmacy yet
  const act = (fn: () => Promise<unknown>) => { setErr(null); return run(fn, setErr); };
  const open = active.filter((o) => o.status !== "dispensed");
  const n = (st: MedicationOrder["status"]) => open.filter((o) => o.status === st).length;
  const remaining = [
    n("submitted") ? `${STAGE_LABEL.verify[lang]} ${n("submitted")}` : "",
    n("verified") ? `${STAGE_LABEL.dispense[lang]} ${n("verified")}` : "",
    n("returned") + n("draft") ? OL.withPrescriber(n("returned") + n("draft"))[lang] : "",
  ].filter(Boolean);
  const callable = canCall(session);
  const counters = COUNTERS.map((c) => ({ value: c, label: OL.counter(c)[lang] }));
  const code = (
    <div className="flex flex-col">
      <span className="text-micro font-semibold text-ink-soft">{OL.patientCode[lang]}</span>
      <span className="text-display font-extrabold tabular-nums tracking-wide">{session.code}</span>
    </div>
  );
  return (
    <Card id="pickup" aria-labelledby="h-pickup" className="scroll-mt-4">
      <CardHeader
        title={<span id="h-pickup" className="flex items-center gap-2"><Icon name="bell" className="text-ocean" />{OL.pickupTitle[lang]}</span>}
        action={p ? <Badge tone={p.status === "collected" ? "teal" : "ocean"} icon={<Icon name={p.status === "collected" ? "check" : "bell"} size={14} />}>{p.status === "collected" ? OL.collected[lang] : STAGE_LABEL.ready[lang]}</Badge> : undefined}
      />
      {p?.status === "collected" ? (
        <div role="status" className="rounded-2xl border border-teal/30 bg-teal-tint p-4">
          <p className="flex items-center gap-2 text-lead font-bold text-teal"><Icon name="circle-check" />{OL.collectedTitle[lang]}</p>
          <p className="mt-1 text-small text-ink">{OL.collectedBy[lang]} {p.collectedBy}{p.collectedAt ? `, ${clock(p.collectedAt)}` : ""}. {OL.calledBy[lang]} {p.calledBy}, {clock(p.calledAt)}{p.counter ? `, ${OL.counter(p.counter)[lang]}` : ""}.</p>
          {open.length > 0 && <p className="mt-2 rounded-lg bg-warn-tint px-3 py-2 text-small font-semibold text-warn">{OL.newOrderAfter[lang]}</p>}
        </div>
      ) : p?.status === "ready" ? (
        <div className="flex flex-col gap-4">
          <div role="status" className="flex flex-wrap items-end gap-x-10 gap-y-3 rounded-2xl bg-ocean-tint p-4">
            {code}
            <div className="flex flex-col">
              <span className="text-micro font-semibold text-ink-soft">{OL.counterLabel[lang]}</span>
              <span className="text-display font-extrabold text-ocean">{p.counter ?? "-"}</span>
            </div>
            <p className="min-w-0 flex-1 basis-56 text-small text-ink">{OL.calledBy[lang]} {p.calledBy}, {clock(p.calledAt)}{now ? ` (${waited(p.calledAt, now)})` : ""}. {OL.collectNote[lang]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={busy} onClick={() => act(() => pickup(session.id, "collected"))} icon={<Icon name="circle-check" size={16} />}>{OL.markCollected[lang]}</Button>
            <SegmentedControl ariaLabel={OL.counterLabel[lang]} value={counter} onChange={setCounter} options={counters} size="sm" />
            <Button disabled={busy} onClick={() => act(() => pickup(session.id, "call", counter))} icon={<Icon name="bell" size={16} />}>{OL.callAgain[lang]}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-3 rounded-2xl bg-paper p-4">
            {code}
            <p className="min-w-0 flex-1 basis-56 text-small text-ink-soft">
              {callable ? OL.dispensedN(active.length)[lang] : <><span className="font-semibold text-ink">{OL.stillToDo[lang]}:</span> {remaining.join(", ")}.</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl ariaLabel={OL.counterLabel[lang]} value={counter} onChange={setCounter} options={counters} size="sm" />
            <Button variant="primary" disabled={busy || !callable} aria-describedby="pickup-note" onClick={() => act(() => pickup(session.id, "call", counter))} icon={<Icon name="bell" size={16} />}>{OL.callPatient[lang]}</Button>
          </div>
          <p id="pickup-note" className="text-micro text-graphite">{OL.callNote[lang]}</p>
        </div>
      )}
      <Refusal msg={err} lang={lang} />
    </Card>
  );
}

// ---------- queue: one list per stage ----------
const ROW = "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-rule/70 bg-sheet p-4 transition-[transform,box-shadow] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted";
const Disc = ({ icon, tone }: { icon: "pill" | "triangle-alert" | "bell" | "check" | "user"; tone: "signal" | "ocean" | "teal" | "warn" }) => (
  <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full ${{ signal: "bg-signal text-on-signal", ocean: "bg-ocean-tint text-ocean", teal: "bg-teal-tint text-teal", warn: "bg-warn-tint text-warn" }[tone]}`}><Icon name={icon} /></span>
);
const Row = ({ href, children }: { href: string; children: ReactNode }) => (
  <li><Link href={href} className={ROW}>{children}<Icon name="chevron-right" className="text-graphite" /></Link></li>
);

/** Work counts per stage (orders for verify/dispense, patients for the pickup stages). */
export function stageCounts(entries: Entry[], now: number): Record<Stage, number> {
  const r = stageRows(entries, now);
  return { verify: r.verify.length, dispense: r.dispense.length, call: r.call.length, ready: r.ready.length, collected: r.collected.length };
}

/** Prescription queue grouped by pharmacy stage, with counts. Opens on the first stage that has work. */
export function PrescriptionQueue() {
  const { entries, now, lang, reviewer } = usePharmacy();
  const [stage, setStage] = useState<Stage | null>(null);
  useEffect(() => {
    if (stage !== null || !entries) return;
    const c = stageCounts(entries, now);
    setStage(STAGES.find((k) => c[k] > 0) ?? "verify");
  }, [entries, now, stage]);
  if (!entries) return <div aria-busy="true" className="flex flex-col gap-3 p-5">{[0, 1].map((i) => <span key={i} className="mx-blank !block !h-14 !w-full !rounded-2xl" />)}</div>;
  const rows = stageRows(entries, now);
  const current = stage ?? "verify";
  const fx = (f: boolean) => (f ? ` · ${C.fixtureTag[lang]}` : "");
  const since = (iso?: string) => <span className="w-16 text-right text-small text-ink-soft">{now && iso ? waited(iso, now) : ""}</span>;
  let list: ReactNode;
  if (current === "verify") {
    list = rows.verify.map(({ session: s, fixture, o }) => {
      const high = o.checks.filter((c) => c.severity === "high").length;
      const openN = openHighChecks(o).length;
      const mod = o.checks.length - high;
      return (
        <Row key={`${s.id}-${o.id}`} href={`/pharmacy/${s.id}#order-${o.id}`}>
          <Disc icon={high ? "triangle-alert" : "pill"} tone={high ? "signal" : "ocean"} />
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-lead font-bold">{orderTitle(o)} <span className="text-small font-medium text-ink-soft">{o.route} · {o.frequency}</span></span>
            <span className="block text-small text-ink-soft">{s.code} · {o.orderedBy}{fx(fixture)}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {high > 0 && <Badge tone="signalOutline">{openN > 0 ? OL.highNoOverride(openN)[lang] : OL.highN(high)[lang]}</Badge>}
            {o.overrides.length > 0 && <Badge tone="pencil">{OL.override[lang]}</Badge>}
            {mod > 0 && <Badge tone="outline">{OL.toCheck(mod)[lang]}</Badge>}
            {o.checks.some((c) => c.alternatives?.length) && <Badge tone="outline" icon={<Icon name="clipboard-list" size={14} />}>{OL.optionsTitle[lang]}</Badge>}
            {o.checks.length === 0 && <span className="text-small text-ink-soft">{OL.noRule[lang]}</span>}
            {since(o.at)}
          </span>
        </Row>
      );
    });
  } else if (current === "dispense") {
    list = rows.dispense.map(({ session: s, fixture, o }) => {
      const mine = samePerson(o.pharmacist?.by, reviewer);
      return (
        <Row key={`${s.id}-${o.id}`} href={`/pharmacy/${s.id}#order-${o.id}`}>
          <Disc icon={mine ? "user" : "pill"} tone={mine ? "warn" : "ocean"} />
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-lead font-bold">{orderTitle(o)} <span className="text-small font-medium text-ink-soft">{o.route} · {o.frequency}</span></span>
            <span className="block text-small text-ink-soft">{s.code} · {OL.verifiedBy[lang]} {o.pharmacist?.by}{o.pharmacist ? `, ${clock(o.pharmacist.at)}` : ""}{fx(fixture)}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {mine ? <Badge tone="pencil" icon={<Icon name="user" size={14} />}>{OL.needsSecond[lang]}</Badge> : <Badge tone="outline">{OL.readyToPick[lang]}</Badge>}
            {since(o.pharmacist?.at)}
          </span>
        </Row>
      );
    });
  } else {
    const pick = current === "call" ? rows.call : current === "ready" ? rows.ready : rows.collected;
    list = pick.map(({ session: s, fixture }) => {
      const p = s.pickup;
      const dispensed = activeOrders(s);
      const lastDispense = dispensed.map((o) => o.dispense?.at ?? "").sort().at(-1);
      return (
        <Row key={s.id} href={`/pharmacy/${s.id}#pickup`}>
          <Disc icon={current === "collected" ? "check" : "bell"} tone={current === "collected" ? "teal" : "ocean"} />
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-title font-extrabold tabular-nums">{s.code}</span>
            <span className="block text-small text-ink-soft">
              {current === "call" ? OL.dispensedN(dispensed.length)[lang]
                : current === "ready" && p ? `${p.counter ? `${OL.counter(p.counter)[lang]} · ` : ""}${OL.calledBy[lang]} ${p.calledBy}, ${clock(p.calledAt)}`
                : p ? `${OL.collectedBy[lang]} ${p.collectedBy ?? "?"}${p.collectedAt ? `, ${clock(p.collectedAt)}` : ""}` : ""}
              {fx(fixture)}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {current === "call" && <Badge tone="teal">{OL.allDispensed[lang]}</Badge>}
            {current === "ready" && <Badge tone="ocean" icon={<Icon name="bell" size={14} />}>{OL.called[lang]}</Badge>}
            {current === "collected" && <Badge tone="teal" icon={<Icon name="check" size={14} />}>{OL.collected[lang]}</Badge>}
            {current === "call" ? since(lastDispense) : current === "ready" ? since(p?.calledAt) : since(undefined)}
          </span>
        </Row>
      );
    });
  }
  const empty = (current === "verify" ? rows.verify : current === "dispense" ? rows.dispense : rows[current]).length === 0;
  return (
    <div className="flex flex-col gap-3 p-4 pt-1">
      <div role="group" aria-label={OL.stages[lang]} className="flex flex-wrap gap-2">
        {STAGES.map((k) => <Pill key={k} active={current === k} count={rows[k].length} onClick={() => setStage(k)}>{STAGE_LABEL[k][lang]}</Pill>)}
      </div>
      <p className="text-small text-ink-soft">{OL.stageHint[current][lang]}</p>
      {empty ? <EmptyState icon={<Icon name="inbox" />} title={OL.stageEmpty[current][lang]} body={OL.stageEmptyBody[lang]} /> : <ul className="flex flex-col gap-3">{list}</ul>}
    </div>
  );
}

export { ordersOf };
