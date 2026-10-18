import type { FieldKey, ExtractedField, Lang } from '@medx/shared';

export const FIELD_KEYS: FieldKey[] = ['chief_complaint', 'onset', 'duration', 'severity', 'location', 'associated_symptoms', 'medications', 'allergies', 'medical_history', 'pregnancy_status', 'age', 'sex'];
export const REQUIRED_FIELDS: FieldKey[] = ['chief_complaint', 'onset', 'severity', 'age', 'allergies', 'medications'];
export const QUESTION_PRIORITY: FieldKey[] = ['chief_complaint', 'onset', 'severity', 'pregnancy_status', 'allergies', 'medications', 'age'];
export const MAX_FOLLOW_UPS = 3;
export const LANG_NAMES: Record<Lang, string> = { th: 'Thai', it: 'Italian', en: 'English' };
export const isPresent = (f: ExtractedField) => ['supported', 'approved', 'edited'].includes(f.status);
export function emptyFields(): ExtractedField[] {
  return applyRequiredFields(FIELD_KEYS.map(key => ({ key, value: null, valueOriginal: null, evidence: [], confidence: 0, status: 'missing', required: false })));
}
/** Only verified or clinician-entered demographics may relax the pregnancy requirement. */
export function applyRequiredFields(fields: ExtractedField[]): ExtractedField[] {
  const text = (key: FieldKey) => {
    const f = fields.find(f => f.key === key && isPresent(f));
    return (f?.value?.en || f?.valueOriginal || '').normalize('NFC').toLowerCase().trim();
  };
  const male = /^(?:male|man|maschio|uomo|ชาย|เพศชาย)$/.test(text('sex'));
  const numbers = text('age').match(/\d+(?:\.\d+)?/g);
  const age = numbers?.length === 1 ? Number(numbers[0]) : undefined;
  const pregnancyRequired = !male && (age === undefined || (age >= 12 && age <= 55));
  return fields.map(f => ({ ...f, required: REQUIRED_FIELDS.includes(f.key) || (f.key === 'pregnancy_status' && pregnancyRequired) }));
}
export function providerInfo() {
  const mock = process.env.MODEL_PROVIDER === 'mock';
  // extractModel: set when AMD_EXTRACT_MODEL routes the structured extraction to a second Token Factory model.
  const extractModel = !mock && process.env.AMD_EXTRACT_MODEL ? process.env.AMD_EXTRACT_MODEL : undefined;
  return { name: mock ? 'mock' : 'amd-tokenfactory', model: mock ? 'deterministic-mock' : process.env.AMD_MODEL || 'unconfigured', ...(extractModel ? { extractModel } : {}), hardware: mock ? '\u2014' : process.env.AMD_HARDWARE_LABEL || 'AMD (via Token Factory)' };
}
