import type { FieldKey, ExtractedField, Lang } from '@medx/shared';

export const FIELD_KEYS: FieldKey[] = ['chief_complaint', 'onset', 'duration', 'severity', 'location', 'associated_symptoms', 'medications', 'allergies', 'medical_history', 'pregnancy_status', 'age', 'sex'];
export const REQUIRED_FIELDS: FieldKey[] = ['chief_complaint', 'onset', 'severity', 'associated_symptoms', 'medications', 'allergies', 'pregnancy_status', 'age'];
export const LANG_NAMES: Record<Lang, string> = { th: 'Thai', it: 'Italian', en: 'English' };
export const isPresent = (f: ExtractedField) => ['supported', 'approved', 'edited'].includes(f.status);
export function emptyFields(): ExtractedField[] {
  return FIELD_KEYS.map(key => ({ key, value: null, valueOriginal: null, evidence: [], confidence: 0, status: 'missing', required: REQUIRED_FIELDS.includes(key) }));
}
export function providerInfo() {
  const mock = process.env.MODEL_PROVIDER === 'mock';
  return { name: mock ? 'mock' : 'amd-tokenfactory', model: mock ? 'deterministic-mock' : process.env.AMD_MODEL || 'unconfigured', hardware: mock ? 'mock' : 'AMD Instinct (ROCm) via AMD Developer Cloud' };
}
