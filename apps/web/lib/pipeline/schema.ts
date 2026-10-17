import type { FieldKey, Localized } from '@medx/shared';
import { FIELD_KEYS } from './config';
export interface ModelField { value_original: string; value: Localized; evidence: { turn: string; quote: string }[]; certainty: 'high' | 'medium' | 'low' }
export interface ModelExtraction { language_detected: 'th' | 'it' | 'en' | 'mixed' | 'other'; fields: Record<FieldKey, ModelField | null> }
export const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const shortString = (x: unknown, max = 300): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export const localized = (x: unknown): x is Localized => object(x) && ['th', 'it', 'en'].every(l => shortString(x[l])) && Object.keys(x).every(k => ['th', 'it', 'en'].includes(k));
export function languageOK(value: Localized) { return /\p{Script=Thai}/u.test(value.th) && !/\p{Script=Thai}/u.test(value.en + value.it); }
export function validateExtraction(data: unknown): { data: ModelExtraction | null; errors: string[]; ignored: string[] } {
  const errors: string[] = []; const ignored: string[] = [];
  if (!object(data) || !object(data.fields) || !['th', 'it', 'en', 'mixed', 'other'].includes(String(data.language_detected))) return { data: null, errors: ['Expected fields object and language_detected enum'], ignored };
  if (Object.keys(data).some(k => !['fields', 'language_detected'].includes(k))) errors.push('Unexpected top-level key');
  const fields = {} as ModelExtraction['fields'];
  for (const key of Object.keys(data.fields)) if (!FIELD_KEYS.includes(key as FieldKey)) ignored.push(key);
  for (const key of FIELD_KEYS) {
    const f = data.fields[key];
    if (f === null || f === undefined) { fields[key] = null; continue; }
    if (!object(f) || !shortString(f.value_original) || !localized(f.value) || !['high', 'medium', 'low'].includes(String(f.certainty)) || !Array.isArray(f.evidence) || f.evidence.length < 1 || f.evidence.length > 3 || !f.evidence.every(e => object(e) && /^T\d+$/.test(String(e.turn)) && shortString(e.quote, 400) && Object.keys(e).every(k => ['turn', 'quote'].includes(k))) || Object.keys(f).some(k => !['value_original', 'value', 'evidence', 'certainty'].includes(k))) errors.push(`Invalid field: ${key}`);
    else fields[key] = f as unknown as ModelField;
  }
  return { data: errors.length ? null : { language_detected: data.language_detected as ModelExtraction['language_detected'], fields }, errors, ignored };
}
const str = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const loc = { type: 'object', additionalProperties: false, required: ['th', 'it', 'en'], properties: { th: str(300), it: str(300), en: str(300) } };
const field = { type: 'object', additionalProperties: false, required: ['value_original', 'value', 'evidence', 'certainty'], properties: { value_original: str(300), value: loc, certainty: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['turn', 'quote'], properties: { turn: { type: 'string', pattern: '^T\\d+$' }, quote: str(400) } } } } };
export const EXTRACTION_SCHEMA = { type: 'object', additionalProperties: false, required: ['language_detected', 'fields'], properties: { language_detected: { type: 'string', enum: ['th', 'it', 'en', 'mixed', 'other'] }, fields: { type: 'object', additionalProperties: false, required: FIELD_KEYS, properties: Object.fromEntries(FIELD_KEYS.map(k => [k, { anyOf: [{ type: 'null' }, field] }])) } } };
export const QUESTION_SCHEMA = { type: 'object', additionalProperties: false, required: ['field', 'question'], properties: { field: { type: 'string', enum: FIELD_KEYS }, question: loc } };
