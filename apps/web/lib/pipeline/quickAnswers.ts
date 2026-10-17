import type { FieldKey, Localized } from '@medx/shared';
import type { ModelExtraction, ModelField } from './schema';

const denials: Partial<Record<FieldKey, Localized>> = {
  allergies: { en: 'no known allergies', it: 'nessuna allergia nota', th: 'ไม่มีประวัติแพ้' },
  medications: { en: 'no medicines', it: 'nessun farmaco', th: 'ไม่ได้กินยา' },
  medical_history: { en: 'no medical history reported', it: 'nessun precedente medico riferito', th: 'ไม่มีประวัติการเจ็บป่วยที่รายงาน' },
  associated_symptoms: { en: 'no other symptoms', it: 'nessun altro sintomo', th: 'ไม่มีอาการอื่น' },
  pregnancy_status: { en: 'not pregnant', it: 'non in gravidanza', th: 'ไม่ตั้งครรภ์' },
};
const onset: [RegExp, Localized][] = [
  [/^(?:since today|da oggi|ตั้งแต่วันนี้)$/i, { en: 'since today', it: 'da oggi', th: 'ตั้งแต่วันนี้' }],
  [/^(?:since yesterday|da ieri|ตั้งแต่เมื่อวาน)$/i, { en: 'since yesterday', it: 'da ieri', th: 'ตั้งแต่เมื่อวาน' }],
  [/^(?:this week|questa settimana|สัปดาห์นี้)$/i, { en: 'this week', it: 'questa settimana', th: 'สัปดาห์นี้' }],
];

/** Exact, whole-answer chip meanings, scoped to the application's asked field. */
export function quickAnswer(field: FieldKey, text: string): Pick<ModelField, 'value' | 'certainty'> | undefined {
  const answer = text.trim().replace(/[.!?]$/, '').trim();
  if (/^(?:no|none|nessun[oa]?|niente|nulla|ไม่|ไม่มี|ไม่ใช่)$/i.test(answer) && denials[field]) return { value: denials[field]!, certainty: 'medium' };
  // The mobile app offers the same time chips for onset and duration. Keep the
  // stated time phrase; never turn "this week" into an invented number of days.
  if (field === 'onset' || field === 'duration') {
    const match = onset.find(([re]) => re.test(answer));
    if (match) return { value: match[1], certainty: 'high' };
  }
  if (field === 'severity' && /^(?:10|[0-9])$/.test(answer)) {
    const n = `${answer}/10`;
    return { value: { en: n, it: n, th: `ระดับ ${n}` }, certainty: 'high' };
  }
}

/** Called only after schema validation on the real path. Evidence still goes
 * through the normal verifier; failures are never repaired into a summary. */
export function applyQuickAnswer(model: ModelExtraction, field: FieldKey, text: string, turn: string) {
  const answer = quickAnswer(field, text);
  if (!answer) return;
  const quote = text.trim();
  // A bare answer cannot evidence a different field even if a provider says so.
  for (const [key, proposed] of Object.entries(model.fields)) {
    if (key === field || !proposed) continue;
    proposed.evidence = proposed.evidence.filter(e => e.turn !== turn);
    if (!proposed.evidence.length) model.fields[key as FieldKey] = null;
  }
  model.fields[field] = { ...answer, value_original: quote, evidence: [{ turn, quote }] };
  model.medications = model.medications?.filter(m => m.turn !== turn);
  model.allergies = model.allergies?.filter(a => a.turn !== turn);
  if (model.noKnownAllergies?.turn === turn) model.noKnownAllergies = null;
  if (field === 'allergies') model.noKnownAllergies = { turn, quote };
}
