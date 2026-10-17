import type { FieldKey, Localized } from '@medx/shared';
export const QUESTIONS: Record<FieldKey, Localized> = {
  chief_complaint: { en: 'What is the main problem that brought you here today?', th: 'วันนี้มาพบแพทย์ด้วยอาการอะไรเป็นหลักคะ', it: 'Qual è il problema principale che la porta qui oggi?' },
  onset: { en: 'When did this start?', th: 'อาการเริ่มเมื่อไรคะ', it: 'Da quando ha questo disturbo?' },
  duration: { en: 'How long has it lasted?', th: 'มีอาการมานานเท่าไรแล้วคะ', it: 'Quanto dura?' },
  severity: { en: 'How bad is it, from 0 (none) to 10 (worst)?', th: 'อาการรุนแรงแค่ไหน จาก 0 คือไม่มีอาการ ถึง 10 คือรุนแรงที่สุด', it: 'Quanto è forte il dolore, da 0 a 10?' },
  location: { en: 'Where on your body is it?', th: 'มีอาการตรงส่วนไหนของร่างกายคะ', it: 'In quale parte del corpo avverte il disturbo?' },
  associated_symptoms: { en: 'Have you noticed any other symptoms?', th: 'มีอาการอื่นร่วมด้วยไหม', it: 'Ha notato altri sintomi?' },
  medications: { en: 'Are you taking any medicines, including ones for this problem?', th: 'กำลังใช้ยาอะไรอยู่บ้าง รวมถึงยาสำหรับอาการนี้คะ', it: 'Prende dei farmaci, anche per questo problema?' },
  allergies: { en: 'Do you have any allergies to medicines or foods?', th: 'มีประวัติแพ้ยาหรืออาหารอะไรไหม', it: 'Ha allergie a farmaci o alimenti?' },
  medical_history: { en: 'Do you have any ongoing illnesses or past operations?', th: 'มีโรคประจำตัวหรือเคยผ่าตัดไหม', it: 'Ha malattie in corso o ha subito operazioni?' },
  pregnancy_status: { en: 'Could you be pregnant?', th: 'มีโอกาสตั้งครรภ์ไหม', it: 'Potrebbe essere incinta?' },
  age: { en: 'How old are you?', th: 'อายุเท่าไรคะ', it: 'Quanti anni ha?' },
  sex: { en: 'What sex were you assigned at birth?', th: 'เพศที่ระบุเมื่อแรกเกิดคืออะไรคะ', it: 'Quale sesso le è stato assegnato alla nascita?' },
};
