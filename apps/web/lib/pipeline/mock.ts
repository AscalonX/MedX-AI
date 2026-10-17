import type { FieldKey, Localized } from '@medx/shared';
import type { ChatRequest } from './llm';
import type { ModelExtraction } from './schema';
import { FIELD_KEYS } from './config';
import { QUESTIONS } from './templates';

/** Deliberately narrow deterministic demo extractor, not an evaluation oracle. */
export function mockJSON(req: ChatRequest): unknown {
  if (req.step === 'next_question') {
    const key = /Missing information: (\w+):/.exec(req.user)?.[1] as FieldKey;
    return { field: key, question: QUESTIONS[key] };
  }
  const lang = /Patient language: (Thai|Italian)/.exec(req.user)?.[1];
  const result: ModelExtraction = { language_detected: lang === 'Thai' ? 'th' : lang === 'Italian' ? 'it' : 'en', fields: Object.fromEntries(FIELD_KEYS.map(k => [k, null])) as ModelExtraction['fields'] };
  const turns = [...req.user.matchAll(/<patient_turn id="(T\d+)">([\s\S]*?)<\/patient_turn>/g)];
  const patterns: Partial<Record<FieldKey, [RegExp, Localized][]>> = {
    chief_complaint: [
      [/(?:headache|mal di testa|ปวดหัว|ปวดศีรษะ)/i, { en: 'headache', it: 'mal di testa', th: 'ปวดหัว' }],
      [/(?:stomach ache|stomach pain|mal di pancia|ปวดท้อง)/i, { en: 'stomach ache', it: 'mal di pancia', th: 'ปวดท้อง' }],
      [/(?:cough|tosse|ไอ)/i, { en: 'cough', it: 'tosse', th: 'ไอ' }],
    ],
    onset: [[/(?:since yesterday|started yesterday|da ieri|ตั้งแต่เมื่อวาน|เริ่มเมื่อวาน)/i, { en: 'since yesterday', it: 'da ieri', th: 'ตั้งแต่เมื่อวาน' }]],
    associated_symptoms: [[/(?:no other symptoms|nessun altro sintomo|ไม่มีอาการอื่น)/i, { en: 'no other symptoms', it: 'nessun altro sintomo', th: 'ไม่มีอาการอื่น' }], [/(?:nausea|คลื่นไส้)/i, { en: 'nausea', it: 'nausea', th: 'คลื่นไส้' }]],
    medications: [[/(?:no (?:medicines|medications)|nessun farmaco|non prendo farmaci|ไม่มียาที่ใช้|ไม่ได้กินยา)/i, { en: 'no medicines', it: 'nessun farmaco', th: 'ไม่ได้กินยา' }], [/(?:paracetamol(?:o)?|พาราเซตามอล)/i, { en: 'paracetamol', it: 'paracetamolo', th: 'พาราเซตามอล' }]],
    allergies: [[/(?:no (?:known )?allergies|nessuna allergia|ไม่มีประวัติแพ้|ไม่แพ้ยา)/i, { en: 'no known allergies', it: 'nessuna allergia nota', th: 'ไม่มีประวัติแพ้' }]],
    pregnancy_status: [[/(?:not pregnant|non sono incinta|ไม่ตั้งครรภ์|ไม่ได้ตั้งครรภ์)/i, { en: 'not pregnant', it: 'non in gravidanza', th: 'ไม่ตั้งครรภ์' }]],
  };
  for (const [, alias, text] of turns) {
    // Do not extract sentences containing instruction patterns.
    const safe = text.split(/(?<=[.!?\n])/).filter(s => !/ignore|output|say I|mark this|istruzion|คำสั่ง/i.test(s)).join(' ');
    const put = (key: FieldKey, quote: string, value: Localized) => { result.fields[key] = { value_original: quote, value, evidence: [{ turn: alias, quote }], certainty: 'high' }; };
    for (const [key, pairs] of Object.entries(patterns)) for (const [re, value] of pairs) { const m = re.exec(safe); if (m) { put(key as FieldKey, m[0], value); break; } }
    const severity = /\b(\d{1,2})\s*\/\s*10\b/.exec(safe);
    if (severity) put('severity', severity[0], { en: severity[0], it: severity[0], th: `ระดับ ${severity[0]}` });
    const age = /(?:\b(?:I am|I'm|ho)\s+(\d{1,3})\s*(?:years old|anni)|อายุ\s*(\d{1,3})\s*ปี)/i.exec(safe);
    if (age) { const n = age[1] || age[2]; put('age', age[0], { en: `${n} years`, it: `${n} anni`, th: `${n} ปี` }); }
  }
  return result;
}
