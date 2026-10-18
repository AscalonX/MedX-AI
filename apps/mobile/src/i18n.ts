import type { Lang } from "@medx/shared";

export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };

type S = {
  pickTitle: string; pickSub: string; privacy: string; disclaimer: string; pickA11y: (l: string) => string;
  q1: string; hint: string; hintFollow: string; cont: string; sending: string; counter: (n: number) => string;
  told: string; placeholderA11y: string;
  doneTitle: string; doneCode: string; doneNext1: string; doneNext2: string; doneNext3: string; newIntake: string;
  humanTitle: string; humanBody: string;
  deskTitle: (code: string) => string; deskBody: string; retry: string; deskNoCode: string;
  tabHome: string; tabVisit: string; tabHelp: string; tabNew: string; langLocked: string; offlineRed: string; offlineNote: string; chipYes: string; chipNo: string; chipUnknown: string; reviewedTitle: string; reviewedNext: string; reviewingNote: string; stepAt: (t: string) => string; micStart: string; micStop: string; listening: string; confirmTitle: string; confirmSub: string; send: string; tryAgain: string; speakToggle: string; micDenied: string; micUnavailable: string; noSpeech: string; tabLang: string; hello: string; greetSub: string; heroTitle: string; heroSub: string; start: string;
  howTitle: string; how: [string, string][]; privacyTitle: string; pill: (n: number) => string;
  chipNone: string; chipToday: string; chipYesterday: string; chipWeek: string; chipSeverityA11y: (n: number) => string;
  helpTitle: string; helpBody: string; helpEmergency: string; stepSent: string; stepReview: string; stepReviewed: string; nextTitle: string; sentTitle: string;
  rfShow: string; atDesk: string; atDeskDone: string; rfCode: string;
  // Medicine pickup (status only: never drug names, staff ids or notes).
  pickupEyebrow: string; pickupPreparingTitle: string; pickupPreparingBody: string;
  pickupReadyTitle: string; pickupReadyBody: (code: string, counter?: string) => string; pickupCounter: string;
  pickupCollectedTitle: string; pickupCollectedBody: string; stepPreparing: string; stepReady: string; stepCollected: string;
  // Synthetic-data notice and "Try saying" examples (DEMO_SAMPLES: synthetic fixture sentences, never sent without the patient pressing Send).
  synthetic: string; samplesTitle: string; samplesSub: string; sampleLabel: string; sampleRedFlag: string; sampleA11yHint: string;
  sampleConfirmTitle: string; sampleClear: string;
  // Staff have seen the case (seenByStaff): one boolean, never who or what.
  seenTitle: string; seenNext: string; stepSeen: string;
  // Home with a visit on this phone, and "Start a new visit" (clears this phone only; the care team keeps what was sent).
  heroVisitTitle: string; heroVisitSub: (code: string) => string; openVisit: string;
  newVisit: string; newVisitSub: string; newVisitTitle: string; newVisitBody: string; newVisitCode: (code: string) => string;
  newVisitPickup: string; newVisitConfirm: string; newVisitKeep: string; newVisitDone: string;
};

export const STR: Record<Lang, S> = {
  en: {
    micStart: "Tap to speak", micStop: "Stop listening", listening: "Listening", confirmTitle: "Is this what you said?", confirmSub: "Check the words and fix any mistake before sending.", send: "Send", tryAgain: "Try again", speakToggle: "Read questions aloud",
    micDenied: "The microphone is off. You can type your answer instead.", micUnavailable: "Voice is not available here. You can type your answer instead.", noSpeech: "We did not hear anything. Try again, or type your answer.",
    chipYes: "Yes", chipNo: "No", chipUnknown: "Not sure", reviewedTitle: "A nurse has reviewed your answers.", reviewedNext: "A nurse will call you.", reviewingNote: "Your answers are waiting for a nurse.", stepAt: (t) => `at ${t}`,
    offlineRed: "Offline: showing your last instruction.", offlineNote: "Offline: showing your last saved screen.",
    langLocked: "Language is set for this visit.",
    tabHome: "Home", tabVisit: "My visit", tabHelp: "Help", tabNew: "New intake", tabLang: "Language", hello: "Hello", greetSub: "Welcome to MedX",
    heroTitle: "Tell us what brings you in today", heroSub: "A nurse will read it before your visit.", start: "Start",
    howTitle: "How it works", how: [["Describe", "Write in your own words."], ["A nurse reviews", "Before your visit."], ["You're called", "At the desk."]],
    privacyTitle: "Please note", pill: (n) => `${n} of up to 3`,
    chipNone: "None", chipToday: "Since today", chipYesterday: "Since yesterday", chipWeek: "This week", chipSeverityA11y: (n) => `${n} out of 10`,
    helpTitle: "Need help now?", helpBody: "Go to the front desk and show your code to the staff.", helpEmergency: "Not at the clinic? Call 1669 in Thailand or 112 in Europe.",
    stepSent: "Sent", stepReview: "Waiting for a nurse", stepReviewed: "Reviewed", nextTitle: "What happens next", sentTitle: "Your answers are in",
    pickTitle: "Tell us why you came in today.",
    pickSub: "A nurse will read it before your visit.",
    privacy: "Please do not type real names, phone numbers or ID numbers. A nurse reads what you write. If you use the microphone, your voice is processed by your phone's speech service (Apple or Google).",
    disclaimer: "This does not replace a doctor. In an emergency, go to the desk now.",
    pickA11y: (l) => `Continue in ${l}`,
    q1: "What brings you in today?", hint: "Write in your own words. Short is fine.", hintFollow: "A few words are enough.",
    cont: "Continue", sending: "Sending", counter: (n) => `Question ${n} of up to 3`,
    told: "What you told us", placeholderA11y: "Your answer",
    doneTitle: "A nurse will review this.", doneCode: "Your code",
    doneNext1: "Keep this code. Tell the staff at the desk when you arrive.",
    doneNext2: "A nurse will read your answers before you are called.",
    doneNext3: "If you feel worse, tell the staff at the desk right away.",
    newIntake: "Start a new demo intake",
    humanTitle: "A nurse will talk to you directly.", humanBody: "This intake needs a person to review it. Please go to the desk and show your code.",
    deskTitle: (c) => `Please go to the desk and show code ${c}.`,
    deskBody: "We could not send your answers. Nothing is lost: the staff will help you in person.",
    deskNoCode: "Please go to the desk and tell the staff you started this form.",
    retry: "Try again",
    rfShow: "Show this screen to the staff at the desk.", atDesk: "I'm at the desk", atDeskDone: "Show this screen to the staff now. If no one is helping you, tell any member of staff straight away.", rfCode: "Your code",
    pickupEyebrow: "Pharmacy",
    pickupPreparingTitle: "Your prescription is being prepared.",
    pickupPreparingBody: "The pharmacy team is checking and preparing your medicine. This screen will tell you when it is ready.",
    pickupReadyTitle: "Your medicine is ready.",
    pickupReadyBody: (code, counter) => (counter ? `Please go to pharmacy counter ${counter} and show code ${code}.` : `Please go to the pharmacy counter and show code ${code}.`),
    pickupCounter: "Counter",
    pickupCollectedTitle: "You have collected your medicine.",
    pickupCollectedBody: "If you have a question about your medicine, ask the pharmacist before you leave.",
    stepPreparing: "Preparing your medicine", stepReady: "Ready to collect", stepCollected: "Medicine collected",
    synthetic: "Synthetic data only. Do not enter real patient information.",
    samplesTitle: "Try saying",
    samplesSub: "Synthetic examples for this demo. Tap one to fill the box, check it, then press Send.",
    sampleLabel: "Synthetic example", sampleRedFlag: "Synthetic example, red flag",
    sampleA11yHint: "Fills the answer box. Nothing is sent until you press Send.",
    sampleConfirmTitle: "Check this example before you send it.", sampleClear: "Clear",
    seenTitle: "The care team has seen your answers.", seenNext: "Please wait to be called.", stepSeen: "Seen by the care team",
    heroVisitTitle: "Your visit is open", heroVisitSub: (c) => `Code ${c}. See where things are.`, openVisit: "Open my visit",
    newVisit: "Start a new visit", newVisitSub: "Sharing this phone? Clear this visit so the next person can start fresh.",
    newVisitTitle: "Start a new visit?", newVisitBody: "This clears your visit from this phone. Answers you already sent stay with the care team.",
    newVisitCode: (c) => `Your code is ${c}. Write it down if you still need it.`,
    newVisitPickup: "You have not collected your medicine yet. After clearing, this phone will not tell you when it is ready. Show your code at the pharmacy.",
    newVisitConfirm: "Clear and start again", newVisitKeep: "Keep my visit", newVisitDone: "This phone is ready for a new visit.",
  },
  it: {
    micStart: "Tocchi per parlare", micStop: "Smetti di ascoltare", listening: "In ascolto", confirmTitle: "È questo che ha detto?", confirmSub: "Controlli le parole e corregga eventuali errori prima di inviare.", send: "Invia", tryAgain: "Riprova", speakToggle: "Leggi le domande ad alta voce",
    micDenied: "Il microfono è spento. Può scrivere la risposta.", micUnavailable: "La voce non è disponibile qui. Può scrivere la risposta.", noSpeech: "Non abbiamo sentito nulla. Riprovi o scriva la risposta.",
    chipYes: "Sì", chipNo: "No", chipUnknown: "Non so", reviewedTitle: "Un infermiere ha letto le sue risposte.", reviewedNext: "Un infermiere la chiamerà.", reviewingNote: "Le sue risposte sono in attesa di un infermiere.", stepAt: (t) => `alle ${t}`,
    offlineRed: "Senza connessione: la sua ultima indicazione.", offlineNote: "Senza connessione: l'ultima schermata salvata.",
    langLocked: "La lingua è impostata per questa visita.",
    tabHome: "Home", tabVisit: "Visita", tabHelp: "Aiuto", tabNew: "Nuova scheda", tabLang: "Lingua", hello: "Ciao", greetSub: "Benvenuto in MedX",
    heroTitle: "Ci dica perché è venuto oggi", heroSub: "Un infermiere lo leggerà prima della visita.", start: "Inizia",
    howTitle: "Come funziona", how: [["Descriva", "Scriva con parole sue."], ["Lo legge un infermiere", "Prima della visita."], ["La chiamano", "Al banco."]],
    privacyTitle: "Da sapere", pill: (n) => `${n} di max 3`,
    chipNone: "Nessuno", chipToday: "Da oggi", chipYesterday: "Da ieri", chipWeek: "Questa settimana", chipSeverityA11y: (n) => `${n} su 10`,
    helpTitle: "Serve aiuto adesso?", helpBody: "Vada al banco e mostri il suo codice al personale.", helpEmergency: "Non è in clinica? Chiami il 1669 in Thailandia o il 112 in Europa.",
    stepSent: "Inviato", stepReview: "In attesa di un infermiere", stepReviewed: "Letto", nextTitle: "Cosa succede ora", sentTitle: "Le sue risposte sono arrivate",
    pickTitle: "Ci dica perché è venuto oggi.",
    pickSub: "Un infermiere lo leggerà prima della visita.",
    privacy: "Non scriva nomi, numeri di telefono o documenti reali. Un infermiere legge ciò che scrive. Se usa il microfono, la sua voce viene elaborata dal servizio vocale del telefono (Apple o Google).",
    disclaimer: "Non sostituisce un medico. In caso di emergenza, vada subito al banco.",
    pickA11y: (l) => `Continua in ${l}`,
    q1: "Che cosa la porta qui oggi?", hint: "Scriva con parole sue. Basta poco.", hintFollow: "Bastano poche parole.",
    cont: "Continua", sending: "Invio in corso", counter: (n) => `Domanda ${n} di massimo 3`,
    told: "Cosa ci ha detto", placeholderA11y: "La sua risposta",
    doneTitle: "Un infermiere leggerà le sue risposte.", doneCode: "Il suo codice",
    doneNext1: "Conservi questo codice. Lo dica al personale quando arriva al banco.",
    doneNext2: "Un infermiere leggerà le sue risposte prima della visita.",
    doneNext3: "Se si sente peggio, lo dica subito al personale.",
    newIntake: "Inizia una nuova demo",
    humanTitle: "Un infermiere parlerà direttamente con lei.", humanBody: "Questa scheda deve essere letta da una persona. Vada al banco e mostri il suo codice.",
    deskTitle: (c) => `Vada al banco e mostri il codice ${c}.`,
    deskBody: "Non siamo riusciti a inviare le sue risposte. Non si perde nulla: il personale la aiuterà di persona.",
    deskNoCode: "Vada al banco e dica al personale che ha iniziato questo modulo.",
    retry: "Riprova",
    rfShow: "Mostri questa schermata al personale al banco.", atDesk: "Sono al banco", atDeskDone: "Mostri questa schermata al personale adesso. Se nessuno la sta aiutando, lo dica subito a qualsiasi membro del personale.", rfCode: "Il suo codice",
    pickupEyebrow: "Farmacia",
    pickupPreparingTitle: "La sua prescrizione è in preparazione.",
    pickupPreparingBody: "La farmacia sta controllando e preparando i suoi medicinali. Questa schermata le dirà quando sono pronti.",
    pickupReadyTitle: "I suoi medicinali sono pronti.",
    pickupReadyBody: (code, counter) => (counter ? `Vada allo sportello ${counter} della farmacia e mostri il codice ${code}.` : `Vada allo sportello della farmacia e mostri il codice ${code}.`),
    pickupCounter: "Sportello",
    pickupCollectedTitle: "Ha ritirato i suoi medicinali.",
    pickupCollectedBody: "Se ha domande sui medicinali, chieda al farmacista prima di andare via.",
    stepPreparing: "Preparazione dei medicinali", stepReady: "Pronti da ritirare", stepCollected: "Medicinali ritirati",
    synthetic: "Solo dati sintetici. Non inserisca informazioni reali di pazienti.",
    samplesTitle: "Provi a dire",
    samplesSub: "Esempi sintetici per questa demo. Ne tocchi uno per riempire il campo, lo controlli, poi prema Invia.",
    sampleLabel: "Esempio sintetico", sampleRedFlag: "Esempio sintetico, segnale d'allarme",
    sampleA11yHint: "Riempie il campo della risposta. Non viene inviato nulla finché non preme Invia.",
    sampleConfirmTitle: "Controlli questo esempio prima di inviarlo.", sampleClear: "Cancella",
    seenTitle: "Il personale sanitario ha visto le sue risposte.", seenNext: "Attenda la chiamata.", stepSeen: "Visto dal personale sanitario",
    heroVisitTitle: "La sua visita è aperta", heroVisitSub: (c) => `Codice ${c}. Veda a che punto è.`, openVisit: "Apri la mia visita",
    newVisit: "Inizia una nuova visita", newVisitSub: "Usa un telefono condiviso? Cancelli questa visita così la prossima persona può iniziare da capo.",
    newVisitTitle: "Iniziare una nuova visita?", newVisitBody: "La visita verrà cancellata da questo telefono. Le risposte già inviate restano al personale sanitario.",
    newVisitCode: (c) => `Il suo codice è ${c}. Lo annoti se le serve ancora.`,
    newVisitPickup: "Non ha ancora ritirato i suoi medicinali. Dopo la cancellazione, questo telefono non le dirà quando sono pronti. Mostri il suo codice in farmacia.",
    newVisitConfirm: "Cancella e ricomincia", newVisitKeep: "Mantieni la mia visita", newVisitDone: "Questo telefono è pronto per una nuova visita.",
  },
  th: {
    micStart: "แตะเพื่อพูด", micStop: "หยุดฟัง", listening: "กำลังฟัง", confirmTitle: "คุณพูดแบบนี้ใช่ไหม", confirmSub: "ตรวจดูคำและแก้ไขที่ผิดก่อนส่ง", send: "ส่ง", tryAgain: "ลองอีกครั้ง", speakToggle: "อ่านคำถามออกเสียง",
    micDenied: "ไมโครโฟนปิดอยู่ คุณพิมพ์คำตอบแทนได้", micUnavailable: "ใช้เสียงไม่ได้ในที่นี้ คุณพิมพ์คำตอบแทนได้", noSpeech: "ไม่ได้ยินเสียง ลองอีกครั้ง หรือพิมพ์คำตอบ",
    chipYes: "ใช่", chipNo: "ไม่ใช่", chipUnknown: "ไม่แน่ใจ", reviewedTitle: "พยาบาลตรวจดูคำตอบของคุณแล้ว", reviewedNext: "พยาบาลจะเรียกคุณ", reviewingNote: "คำตอบของคุณรอพยาบาลอยู่", stepAt: (t) => `เวลา ${t}`,
    offlineRed: "ออฟไลน์: แสดงคำแนะนำล่าสุดของคุณ", offlineNote: "ออฟไลน์: แสดงหน้าจอที่บันทึกไว้ล่าสุด",
    langLocked: "ภาษาถูกกำหนดไว้สำหรับการมาครั้งนี้",
    tabHome: "หน้าแรก", tabVisit: "การมาพบ", tabHelp: "ช่วยเหลือ", tabNew: "เริ่มแบบฟอร์มใหม่", tabLang: "ภาษา", hello: "สวัสดี", greetSub: "ยินดีต้อนรับสู่ MedX",
    heroTitle: "บอกเราว่าวันนี้คุณมาด้วยเรื่องอะไร", heroSub: "พยาบาลจะอ่านคำตอบของคุณก่อนเรียกตรวจ", start: "เริ่ม",
    howTitle: "ทำงานอย่างไร", how: [["เล่าอาการ", "เขียนด้วยคำพูดของคุณเอง"], ["พยาบาลตรวจดู", "ก่อนเรียกตรวจ"], ["เรียกชื่อคุณ", "ที่เคาน์เตอร์"]],
    privacyTitle: "โปรดทราบ", pill: (n) => `${n} จากไม่เกิน 3`,
    chipNone: "ไม่มี", chipToday: "ตั้งแต่วันนี้", chipYesterday: "ตั้งแต่เมื่อวาน", chipWeek: "สัปดาห์นี้", chipSeverityA11y: (n) => `${n} จาก 10`,
    helpTitle: "ต้องการความช่วยเหลือตอนนี้?", helpBody: "ไปที่เคาน์เตอร์และแสดงรหัสของคุณให้เจ้าหน้าที่", helpEmergency: "ไม่ได้อยู่ที่คลินิก? โทร 1669 ในประเทศไทย หรือ 112 ในยุโรป",
    stepSent: "ส่งแล้ว", stepReview: "รอพยาบาล", stepReviewed: "ตรวจดูแล้ว", nextTitle: "ขั้นตอนต่อไป", sentTitle: "ได้รับคำตอบของคุณแล้ว",
    pickTitle: "บอกเราว่าวันนี้คุณมาด้วยเรื่องอะไร",
    pickSub: "พยาบาลจะอ่านคำตอบของคุณก่อนเรียกตรวจ",
    privacy: "กรุณาอย่าพิมพ์ชื่อ เบอร์โทร หรือเลขบัตรจริง พยาบาลจะอ่านสิ่งที่คุณเขียน หากคุณใช้ไมโครโฟน เสียงของคุณจะถูกประมวลผลโดยบริการเสียงของโทรศัพท์ (Apple หรือ Google)",
    disclaimer: "ไม่ได้ใช้แทนแพทย์ หากฉุกเฉิน กรุณาไปที่เคาน์เตอร์ทันที",
    pickA11y: (l) => `ใช้ภาษา ${l} ต่อ`,
    q1: "วันนี้คุณมาด้วยเรื่องอะไร", hint: "เขียนด้วยคำพูดของคุณเอง สั้น ๆ ก็ได้", hintFollow: "ตอบสั้น ๆ ก็พอ",
    cont: "ต่อไป", sending: "กำลังส่ง", counter: (n) => `คำถามที่ ${n} จากไม่เกิน 3 ข้อ`,
    told: "สิ่งที่คุณบอกเรา", placeholderA11y: "คำตอบของคุณ",
    doneTitle: "พยาบาลจะตรวจดูคำตอบของคุณ", doneCode: "รหัสของคุณ",
    doneNext1: "เก็บรหัสนี้ไว้ แล้วแจ้งเจ้าหน้าที่ที่เคาน์เตอร์เมื่อมาถึง",
    doneNext2: "พยาบาลจะอ่านคำตอบของคุณก่อนเรียกตรวจ",
    doneNext3: "หากรู้สึกแย่ลง กรุณาแจ้งเจ้าหน้าที่ทันที",
    newIntake: "เริ่มเดโมใหม่",
    humanTitle: "พยาบาลจะคุยกับคุณโดยตรง", humanBody: "แบบฟอร์มนี้ต้องให้เจ้าหน้าที่ตรวจดู กรุณาไปที่เคาน์เตอร์และแสดงรหัสของคุณ",
    deskTitle: (c) => `กรุณาไปที่เคาน์เตอร์และแสดงรหัส ${c}`,
    deskBody: "ส่งคำตอบของคุณไม่สำเร็จ ไม่มีอะไรหาย เจ้าหน้าที่จะช่วยคุณโดยตรง",
    deskNoCode: "กรุณาไปที่เคาน์เตอร์และแจ้งเจ้าหน้าที่ว่าคุณเริ่มกรอกแบบฟอร์มนี้แล้ว",
    retry: "ลองอีกครั้ง",
    rfShow: "แสดงหน้าจอนี้ให้เจ้าหน้าที่ที่เคาน์เตอร์ดู", atDesk: "ฉันอยู่ที่เคาน์เตอร์แล้ว", atDeskDone: "แสดงหน้าจอนี้ให้เจ้าหน้าที่ดูทันที หากยังไม่มีใครช่วยคุณ กรุณาแจ้งเจ้าหน้าที่คนใดก็ได้ทันที", rfCode: "รหัสของคุณ",
    pickupEyebrow: "ห้องยา",
    pickupPreparingTitle: "กำลังจัดเตรียมยาตามใบสั่งของคุณ",
    pickupPreparingBody: "เภสัชกรกำลังตรวจสอบและจัดเตรียมยาของคุณ หน้าจอนี้จะแจ้งเมื่อยาพร้อมให้รับ",
    pickupReadyTitle: "ยาของคุณพร้อมแล้ว",
    pickupReadyBody: (code, counter) => (counter ? `กรุณาไปที่ช่องรับยาหมายเลข ${counter} และแสดงรหัส ${code}` : `กรุณาไปที่ช่องรับยาและแสดงรหัส ${code}`),
    pickupCounter: "ช่องรับยา",
    pickupCollectedTitle: "คุณรับยาเรียบร้อยแล้ว",
    pickupCollectedBody: "หากมีคำถามเกี่ยวกับยา กรุณาสอบถามเภสัชกรก่อนกลับ",
    stepPreparing: "กำลังจัดยา", stepReady: "พร้อมรับยา", stepCollected: "รับยาแล้ว",
    synthetic: "ใช้ข้อมูลสมมติเท่านั้น กรุณาอย่ากรอกข้อมูลผู้ป่วยจริง",
    samplesTitle: "ลองพูดว่า",
    samplesSub: "ตัวอย่างสมมติสำหรับเดโมนี้ แตะหนึ่งข้อเพื่อใส่ข้อความในช่อง ตรวจดู แล้วกดส่ง",
    sampleLabel: "ตัวอย่างสมมติ", sampleRedFlag: "ตัวอย่างสมมติ สัญญาณอันตราย",
    sampleA11yHint: "ใส่ข้อความในช่องคำตอบ จะยังไม่ส่งจนกว่าคุณจะกดส่ง",
    sampleConfirmTitle: "ตรวจดูตัวอย่างนี้ก่อนส่ง", sampleClear: "ล้าง",
    seenTitle: "เจ้าหน้าที่ดูคำตอบของคุณแล้ว", seenNext: "กรุณารอเรียกชื่อ", stepSeen: "เจ้าหน้าที่ดูแล้ว",
    heroVisitTitle: "การมาพบของคุณยังเปิดอยู่", heroVisitSub: (c) => `รหัส ${c} ดูว่าถึงขั้นตอนไหนแล้ว`, openVisit: "เปิดการมาพบของฉัน",
    newVisit: "เริ่มการมาพบครั้งใหม่", newVisitSub: "ใช้โทรศัพท์ร่วมกับผู้อื่น? ล้างการมาพบนี้เพื่อให้คนถัดไปเริ่มใหม่ได้",
    newVisitTitle: "เริ่มการมาพบครั้งใหม่ใช่ไหม", newVisitBody: "ระบบจะล้างการมาพบนี้ออกจากโทรศัพท์เครื่องนี้ คำตอบที่ส่งไปแล้วยังอยู่กับทีมดูแลรักษา",
    newVisitCode: (c) => `รหัสของคุณคือ ${c} จดไว้หากยังต้องใช้`,
    newVisitPickup: "คุณยังไม่ได้รับยา หลังล้างข้อมูล โทรศัพท์เครื่องนี้จะไม่แจ้งเมื่อยาพร้อม กรุณาแสดงรหัสของคุณที่ห้องยา",
    newVisitConfirm: "ล้างและเริ่มใหม่", newVisitKeep: "เก็บการมาพบไว้", newVisitDone: "โทรศัพท์เครื่องนี้พร้อมสำหรับการมาพบครั้งใหม่แล้ว",
  },
};

const HIDDEN: Record<Lang, Record<string, string>> = {
  en: { NAME: "name hidden", PHONE: "phone number hidden", EMAIL: "email hidden", ID: "ID number hidden", DOB: "date of birth hidden", _: "hidden" },
  it: { NAME: "nome nascosto", PHONE: "numero di telefono nascosto", EMAIL: "email nascosta", ID: "numero di documento nascosto", DOB: "data di nascita nascosta", _: "nascosto" },
  th: { NAME: "ซ่อนชื่อ", PHONE: "ซ่อนเบอร์โทร", EMAIL: "ซ่อนอีเมล", ID: "ซ่อนเลขบัตร", DOB: "ซ่อนวันเกิด", _: "ซ่อนข้อมูล" },
};
/** Redacted tokens from the API ([NAME_1], [PHONE_2]) shown as friendly text. */
export const friendly = (t: string, lang: Lang) =>
  t.replace(/\[([A-Z]+)_\d+\]/g, (_, k: string) => `(${HIDDEN[lang][k] ?? HIDDEN[lang]._})`);
