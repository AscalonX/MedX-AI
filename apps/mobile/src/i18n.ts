import type { Lang } from "@medx/shared";

export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };

type S = {
  pickTitle: string; pickSub: string; privacy: string; disclaimer: string; pickA11y: (l: string) => string;
  q1: string; hint: string; hintFollow: string; cont: string; sending: string; counter: (n: number) => string;
  told: string; placeholderA11y: string;
  doneTitle: string; doneCode: string; doneNext1: string; doneNext2: string; doneNext3: string; newIntake: string;
  humanTitle: string; humanBody: string;
  deskTitle: (code: string) => string; deskBody: string; retry: string; deskNoCode: string;
  rfShow: string; atDesk: string; atDeskDone: string; rfCode: string;
};

export const STR: Record<Lang, S> = {
  en: {
    pickTitle: "Tell us why you came in today.",
    pickSub: "A nurse will read it before your visit.",
    privacy: "Demo with made-up cases. Please do not type real names, phone numbers or ID numbers. A nurse reads what you write.",
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
    rfShow: "Show this screen to the staff at the desk.", atDesk: "I'm at the desk", atDeskDone: "A nurse is coming to you. Please keep this screen open.", rfCode: "Your code",
  },
  it: {
    pickTitle: "Ci dica perché è venuto oggi.",
    pickSub: "Un infermiere lo leggerà prima della visita.",
    privacy: "Demo con casi inventati. Non scriva nomi, numeri di telefono o documenti reali. Un infermiere legge ciò che scrive.",
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
    rfShow: "Mostri questa schermata al personale al banco.", atDesk: "Sono al banco", atDeskDone: "Un infermiere sta venendo da lei. Tenga aperta questa schermata.", rfCode: "Il suo codice",
  },
  th: {
    pickTitle: "บอกเราว่าวันนี้คุณมาด้วยเรื่องอะไร",
    pickSub: "พยาบาลจะอ่านคำตอบของคุณก่อนเรียกตรวจ",
    privacy: "นี่คือเดโมที่ใช้กรณีสมมติ กรุณาอย่าพิมพ์ชื่อ เบอร์โทร หรือเลขบัตรจริง พยาบาลจะอ่านสิ่งที่คุณเขียน",
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
    rfShow: "แสดงหน้าจอนี้ให้เจ้าหน้าที่ที่เคาน์เตอร์ดู", atDesk: "ฉันอยู่ที่เคาน์เตอร์แล้ว", atDeskDone: "พยาบาลกำลังมาหาคุณ กรุณาเปิดหน้าจอนี้ไว้", rfCode: "รหัสของคุณ",
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
