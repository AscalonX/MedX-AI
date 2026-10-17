import type { ConsultRuleFile, Localized } from '@medx/shared';
const loc = (en: string): Localized => ({ en, it: en, th: en });
/** Two-rule synthetic fixture, independent of the Doctor's evolving question bank. */
export const consultRules: ConsultRuleFile = { version: 'test-2', rules: [
  { id: 'CR-HEAD', match: [['headache', 'ปวดหัว', 'mal di testa']], questions: [{ id: 'sudden', text: loc('Was the headache sudden or gradual?'), why: loc('Clarify onset for clinician review.'), modes: ['nurse', 'doctor'] }], considerations: [{ id: 'primary', text: loc('Primary headache causes'), why: loc('Review patient history.') }], source: 'synthetic fixture' },
  { id: 'CR-COUGH', match: [['cough', 'ไอ', 'tosse'], ['fever', 'ไข้', 'febbre']], questions: [{ id: 'breath', text: loc('Have you had trouble breathing?'), why: loc('Clarify associated symptoms.'), modes: ['nurse', 'doctor'] }], source: 'synthetic fixture' },
] };
