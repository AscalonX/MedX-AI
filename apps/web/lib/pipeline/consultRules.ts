import rules from '@medx/shared/src/consultrules.json';
import type { ConsultRuleFile, Localized } from '@medx/shared';
import { object } from './schema';

const loc = (x: unknown): x is Localized => object(x) && ['th', 'it', 'en'].every(k => typeof x[k] === 'string' && !!x[k]);
export function validateConsultRules(x: unknown): x is ConsultRuleFile {
  return object(x) && typeof x.version === 'string' && Array.isArray(x.rules) && x.rules.every(r => object(r) && typeof r.id === 'string' && typeof r.source === 'string' && Array.isArray(r.match) && r.match.every(g => Array.isArray(g) && g.every(t => typeof t === 'string')) && Array.isArray(r.questions) && r.questions.every(q => object(q) && typeof q.id === 'string' && loc(q.text) && loc(q.why) && Array.isArray(q.modes) && q.modes.every(m => m === 'nurse' || m === 'doctor')) && (r.considerations === undefined || (Array.isArray(r.considerations) && r.considerations.every(c => object(c) && typeof c.id === 'string' && loc(c.text) && loc(c.why)))));
}
/** Static import includes the Doctor-owned bank in production tracing and HMR. */
export function loadConsultRules(): ConsultRuleFile {
  if (!validateConsultRules(rules)) throw new Error('Invalid consult rule file');
  return rules;
}
