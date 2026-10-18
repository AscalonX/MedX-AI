import type { FieldKey, Localized } from '@medx/shared';
import type { ChatRequest } from './llm';
import type { ModelExtraction } from './schema';
import { FIELD_KEYS } from './config';
import { QUESTIONS } from './templates';
import { mockPharmacy } from './pharmacyExtraction';
import { applyQuickAnswer } from './quickAnswers';
import { negatedBefore } from './redflags';

/** Deliberately narrow deterministic demo extractor, not an evaluation oracle. */
export function mockJSON(req: ChatRequest): unknown {
  // Deterministic synthetic pack read (the image is ignored): one dictionary name, one name the dictionary does not know.
  if (req.schemaName === 'med_photo') return { items: [{ name: 'Paracetamol', strength: '500 mg', form: 'tablet' }, { name: 'Zorbexin', strength: '20 mg', form: 'capsule' }] };
  if (req.schemaName === 'consult_suggestions') {
    const turns = JSON.parse(req.user.split('Patient transcript as JSON data:\n')[1]) as { turn: string; text: string }[];
    const last = turns.at(-1);
    const end = last && [...new Intl.Segmenter('en', { granularity: 'word' }).segment(last.text)].filter(w => w.isWordLike && w.index + w.segment.length <= 400).at(-1);
    const quote = last && end ? last.text.slice(0, end.index + end.segment.length).trim() : '';
    return { suggestions: last && quote ? [{ kind: 'ask_next', text: { en: 'Ask how the symptoms affect daily activities?', it: 'Chiedere come i sintomi influiscono sulle attività quotidiane?', th: 'ถามว่าอาการส่งผลต่อกิจวัตรประจำวันอย่างไร' }, why: { en: 'Clarify the patient report for clinician review.', it: 'Chiarire quanto riferito per la revisione clinica.', th: 'ขอรายละเอียดที่ผู้ป่วยแจ้งเพื่อให้บุคลากรทบทวน' }, turn: last.turn, quote, confidence: 0.9 }] : [] };
  }
  if (req.step === 'red_flags') return { flags: [] };
  if (req.step === 'next_question') {
    const key = /Missing information: (\w+):/.exec(req.user)?.[1] as FieldKey;
    return { field: key, question: QUESTIONS[key] };
  }
  const lang = /Patient language: (Thai|Italian)/.exec(req.user)?.[1];
  const result: ModelExtraction = { language_detected: lang === 'Thai' ? 'th' : lang === 'Italian' ? 'it' : 'en', fields: Object.fromEntries(FIELD_KEYS.map(k => [k, null])) as ModelExtraction['fields'] };
  const turns = [...req.user.matchAll(/<patient_turn id="(T\d+)">([\s\S]*?)<\/patient_turn>/g)];
  const askedByTurn = new Map<string, FieldKey>();
  let asked: FieldKey | undefined;
  for (const [, role, alias, text] of req.user.matchAll(/<(patient|assistant)_turn id="([AT]\d+)">([\s\S]*?)<\/(?:patient|assistant)_turn>/g)) {
    if (role === 'assistant') asked = FIELD_KEYS.find(k => Object.values(QUESTIONS[k]).includes(text));
    else if (asked) { askedByTurn.set(alias, asked); asked = undefined; }
  }
  const context = /^Patient language: [^\n]*\n\nFOLLOW-UP CONTEXT\nAsked field: (\w+); answer turn: (T\d+)\n/.exec(req.user);
  if (context && FIELD_KEYS.includes(context[1] as FieldKey)) askedByTurn.set(context[2], context[1] as FieldKey);
  const patterns: Partial<Record<FieldKey, [RegExp, Localized][]>> = {
    chief_complaint: [
      [/(?:headache|mal di testa|ปวดหัว|ปวดศีรษะ)/i, { en: 'headache', it: 'mal di testa', th: 'ปวดหัว' }],
      [/(?:stomach ?ache|stomach pain|tummy ache|belly (?:ache|pain)|abdominal pain|mal di pancia|ปวดท้อง)/i, { en: 'stomach ache', it: 'mal di pancia', th: 'ปวดท้อง' }],
      [/(?:cough|tosse|ไอ)/i, { en: 'cough', it: 'tosse', th: 'ไอ' }],
      [/(?:burning when I pee)/i, { en: 'burning urination', it: 'bruciore quando urino', th: 'แสบเวลาปัสสาวะ' }],
      [/(?:rolled my left ankle)/i, { en: 'left ankle injury', it: 'trauma alla caviglia sinistra', th: 'ข้อเท้าซ้ายบาดเจ็บ' }],
      [/(?:mal di gola)/i, { en: 'sore throat', it: 'mal di gola', th: 'เจ็บคอ' }],
      [/(?:febbre)/i, { en: 'fever', it: 'febbre', th: 'มีไข้' }],
      [/\bsore throat\b|เจ็บคอ/i, { en: 'sore throat', it: 'mal di gola', th: 'เจ็บคอ' }],
      [/\bback ?pain\b|\bbackache\b|mal di schiena|ปวดหลัง/i, { en: 'back pain', it: 'mal di schiena', th: 'ปวดหลัง' }],
      [/\brash\b|\bhives\b|eruzione|ผื่น/i, { en: 'rash', it: 'eruzione cutanea', th: 'ผื่น' }],
      [/\bdizz(?:y|iness)\b|\blightheaded\b|capogiro|เวียนหัว/i, { en: 'dizziness', it: 'capogiro', th: 'เวียนหัว' }],
      [/\bfever\b|\bfeverish\b|ไข้/i, { en: 'fever', it: 'febbre', th: 'มีไข้' }],
    ],
    onset: [[/(?:since today|da oggi|ตั้งแต่วันนี้)/i, { en: 'since today', it: 'da oggi', th: 'ตั้งแต่วันนี้' }], [/(?:this week|questa settimana|สัปดาห์นี้)/i, { en: 'this week', it: 'questa settimana', th: 'สัปดาห์นี้' }], [/(?:since yesterday|started yesterday|da ieri|ตั้งแต่เมื่อวาน|เริ่มเมื่อวาน)/i, { en: 'since yesterday', it: 'da ieri', th: 'ตั้งแต่เมื่อวาน' }], [/(?:for two days|da due giorni)/i, { en: 'two days ago', it: 'da due giorni', th: 'สองวันก่อน' }], [/yesterday evening/i, { en: 'yesterday evening', it: 'ieri sera', th: 'เมื่อวานตอนเย็น' }], [/da stamattina/i, { en: 'this morning', it: 'da stamattina', th: 'เช้าวันนี้' }]],
    associated_symptoms: [[/(?:no other symptoms|nessun altro sintomo|ไม่มีอาการอื่น)/i, { en: 'no other symptoms', it: 'nessun altro sintomo', th: 'ไม่มีอาการอื่น' }], [/(?:nausea|คลื่นไส้)/i, { en: 'nausea', it: 'nausea', th: 'คลื่นไส้' }]],
    medications: [[/(?:no (?:medicines|medications)|don't take any medication|nessun farmaco|non prendo farmaci|ไม่มียาที่ใช้|ไม่ได้กินยา(?=$|[\s.,!?]))/i, { en: 'no medicines', it: 'nessun farmaco', th: 'ไม่ได้กินยา' }], [/daily multivitamin/i, { en: 'daily multivitamin', it: 'multivitaminico giornaliero', th: 'วิตามินรวมทุกวัน' }]],
    pregnancy_status: [[/(?:not pregnant|non sono incinta|ไม่ตั้งครรภ์|ไม่ได้ตั้งครรภ์)/i, { en: 'not pregnant', it: 'non in gravidanza', th: 'ไม่ตั้งครรภ์' }], [/(?:possibly pregnant|might be pregnant|maybe pregnant|late period|forse incinta|อาจตั้งครรภ์)/i, { en: 'possibly pregnant', it: 'possibile gravidanza', th: 'อาจตั้งครรภ์' }], [/(?:sono incinta|I am pregnant|I'm pregnant|ตั้งครรภ์)/i, { en: 'pregnant', it: 'in gravidanza', th: 'ตั้งครรภ์' }]],
    sex: [[/\b(?:male|man|uomo)\b/i, { en: 'male', it: 'maschio', th: 'ชาย' }], [/\b(?:female|woman|donna)\b/i, { en: 'female', it: 'femmina', th: 'หญิง' }]],
  };
  for (const [, alias, text] of turns) {
    // Do not extract sentences containing instruction patterns.
    // Mask rejected sentences without shifting the original evidence offsets.
    const safe = text.split(/(?<=[.!?\n])/).map(s => /ignore|output|say I|mark this|istruzion|คำสั่ง/i.test(s) ? ' '.repeat(s.length) : s).join('');
    const put = (key: FieldKey, quote: string, value: Localized) => { result.fields[key] = { value_original: quote, value, evidence: [{ turn: alias, quote }], certainty: 'high' }; };
    for (const [key, pairs] of Object.entries(patterns)) for (const [re, value] of pairs) {
      // A denied symptom is not a presenting complaint. Look past a denied
      // occurrence so a later affirmative mention can still be captured.
      const matches = [...safe.matchAll(new RegExp(re.source, `${re.flags}g`))];
      const m = key === 'chief_complaint'
        ? matches.find(hit => !negatedBefore(safe.slice(0, hit.index), ['ไม่มี', 'ไม่ได้', 'ไม่']))
        : matches[0];
      if (m) {
        // Repeated symptom words need context: a bare quote would resolve to
        // the first (possibly denied) occurrence in the evidence verifier.
        const quote = key === 'chief_complaint' && text.indexOf(m[0]) !== m.index
          ? text.slice(Math.max(0, m.index - 40), m.index + m[0].length).trim()
          : m[0];
        put(key as FieldKey, quote, value); break;
      }
    }
    const severity = /\b(\d{1,2})\s*(?:\/|out of|su)\s*10\b/.exec(safe);
    if (severity) { const n = `${severity[1]}/10`; put('severity', severity[0], { en: n, it: n, th: `ระดับ ${n}` }); }
    const age = /(?:\b(?:I am|I'm|ho)\s+(\d{1,3})\s*(?:years old|anni)|อายุ\s*(\d{1,3})\s*ปี|\b(?:I am|I'm)\s+(?:a\s+)?(\d{1,3})(?:\s+year old|(?=,\s*(?:male|female)))|\b(?:uomo|donna) di (\d{1,3}) anni)/i.exec(safe);
    if (age) { const n = age[1] || age[2] || age[3] || age[4]; put('age', age[0], { en: `${n} years`, it: `${n} anni`, th: `${n} ปี` }); }
    const field = askedByTurn.get(alias);
    const answer = safe.trim();
    // Only recognised answers are filled; unrelated or instruction text stays missing.
    if (field === 'onset' && /^(?:yesterday|ieri|เมื่อวาน)[.!]?$/i.test(answer)) {
      put(field, answer, { en: 'yesterday', it: 'ieri', th: 'เมื่อวาน' });
    }
    if (field) applyQuickAnswer(result, field, text, alias);
    if (field === 'age' && /^\d{1,3}(?:[.!])?$/.test(answer) && parseInt(answer, 10) <= 120) {
      const n = parseInt(answer, 10); put(field, answer, { en: `${n} years`, it: `${n} anni`, th: `${n} ปี` });
    }
    if (field === 'duration') {
      const days = /^(?:for\s+|da\s+)?(\d+)\s*(?:days?|giorn[oi]|วัน)[.!]?$/i.exec(answer);
      if (days) put(field, answer, { en: `${days[1]} days`, it: `${days[1]} giorni`, th: `${days[1]} วัน` });
    }
  }
  const pharmacy = mockPharmacy(turns.map(([, alias, text]) => ({ alias, text })));
  if (pharmacy.noKnownAllergies) result.fields.allergies = {
    value_original: pharmacy.noKnownAllergies.quote,
    value: { en: 'no known allergies', it: 'nessuna allergia nota', th: 'ไม่มีประวัติแพ้' },
    evidence: [pharmacy.noKnownAllergies], certainty: 'high',
  };
  return { ...result, ...pharmacy, noKnownAllergies: pharmacy.noKnownAllergies ?? result.noKnownAllergies ?? null };
}
