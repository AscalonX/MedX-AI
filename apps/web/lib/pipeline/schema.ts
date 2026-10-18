import type { FieldKey, Localized } from '@medx/shared';
import { FIELD_KEYS } from './config';
export interface ModelField { value_original: string; value: Localized; evidence: { turn: string; quote: string }[]; certainty: 'high' | 'medium' | 'low' }
export interface ModelMedicine { nameOriginal: string; dose: string | null; frequency: string | null; timing: string | null; turn: string; quote: string }
export interface ModelAllergy { allergenOriginal: string; reaction: string | null; turn: string; quote: string }
export interface ModelExtraction { language_detected: 'th' | 'it' | 'en' | 'mixed' | 'other'; fields: Record<FieldKey, ModelField | null>; medications?: ModelMedicine[]; allergies?: ModelAllergy[]; noKnownAllergies?: { turn: string; quote: string } | null }
export const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const shortString = (x: unknown, max = 300): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export const localized = (x: unknown): x is Localized => object(x) && ['th', 'it', 'en'].every(l => shortString(x[l])) && Object.keys(x).every(k => ['th', 'it', 'en'].includes(k));
export function languageOK(value: Localized) {
  const numericUnits = /^[\p{N}\s.,/%+−-]+(?:\s*(?:°\s*[CF]|mg|g|kg|ml|mmHg|bpm))?$/iu;
  const neutral = numericUnits.test(value.th) || [value.en, value.it].every(v => v.trim().normalize('NFC') === value.th.trim().normalize('NFC'));
  return (neutral || /\p{Script=Thai}/u.test(value.th)) && !/\p{Script=Thai}/u.test(value.en + value.it);
}
export function validateExtraction(data: unknown): { data: ModelExtraction | null; errors: string[]; ignored: string[] } {
  const errors: string[] = []; const ignored: string[] = [];
  if (!object(data) || !object(data.fields) || !['th', 'it', 'en', 'mixed', 'other'].includes(String(data.language_detected))) return { data: null, errors: ['Expected fields object and language_detected enum'], ignored };
  if (Object.keys(data).some(k => !['fields', 'language_detected', 'medications', 'allergies', 'noKnownAllergies'].includes(k))) errors.push('Unexpected top-level key');
  const evidence = (x: Record<string, unknown>) => typeof x.turn === 'string' && /^T\d+$/.test(x.turn) && shortString(x.quote, 400);
  const nullable = (x: unknown) => x === null || shortString(x);
  if ('medications' in data && (!Array.isArray(data.medications) || data.medications.length > 40 || !data.medications.every(m => object(m) && shortString(m.nameOriginal) && ['dose', 'frequency', 'timing'].every(k => nullable(m[k])) && evidence(m) && Object.keys(m).every(k => ['nameOriginal', 'dose', 'frequency', 'timing', 'turn', 'quote'].includes(k))))) errors.push('Invalid medications');
  if ('allergies' in data && (!Array.isArray(data.allergies) || data.allergies.length > 40 || !data.allergies.every(a => object(a) && shortString(a.allergenOriginal) && nullable(a.reaction) && evidence(a) && Object.keys(a).every(k => ['allergenOriginal', 'reaction', 'turn', 'quote'].includes(k))))) errors.push('Invalid allergies');
  if ('noKnownAllergies' in data && data.noKnownAllergies !== null && (!object(data.noKnownAllergies) || !evidence(data.noKnownAllergies) || Object.keys(data.noKnownAllergies).some(k => !['turn', 'quote'].includes(k)))) errors.push('Invalid noKnownAllergies');
  const fields = {} as ModelExtraction['fields'];
  for (const key of Object.keys(data.fields)) if (!FIELD_KEYS.includes(key as FieldKey)) ignored.push(key);
  for (const key of FIELD_KEYS) {
    const f = data.fields[key];
    if (f === null || f === undefined) { fields[key] = null; continue; }
    if (!object(f) || !shortString(f.value_original) || !localized(f.value) || !['high', 'medium', 'low'].includes(String(f.certainty)) || !Array.isArray(f.evidence) || f.evidence.length < 1 || f.evidence.length > 3 || !f.evidence.every(e => object(e) && /^T\d+$/.test(String(e.turn)) && shortString(e.quote, 400) && Object.keys(e).every(k => ['turn', 'quote'].includes(k))) || Object.keys(f).some(k => !['value_original', 'value', 'evidence', 'certainty'].includes(k))) errors.push(`Invalid field: ${key}`);
    else fields[key] = f as unknown as ModelField;
  }
  return { data: errors.length ? null : { language_detected: data.language_detected as ModelExtraction['language_detected'], fields, medications: data.medications as ModelMedicine[] | undefined ?? [], allergies: data.allergies as ModelAllergy[] | undefined ?? [], noKnownAllergies: data.noKnownAllergies as ModelExtraction['noKnownAllergies'] ?? null }, errors, ignored };
}
const str = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const loc = { type: 'object', additionalProperties: false, required: ['th', 'it', 'en'], properties: { th: str(300), it: str(300), en: str(300) } };
export const CONSULT_SCHEMA = { type: 'object', additionalProperties: false, required: ['suggestions'], properties: { suggestions: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['kind', 'text', 'why', 'turn', 'quote', 'confidence'], properties: { kind: { type: 'string', enum: ['ask_next', 'consider'] }, text: loc, why: loc, turn: str(40), quote: str(400), confidence: { type: 'number', minimum: 0, maximum: 1 } } } } } };
const field = { type: 'object', additionalProperties: false, required: ['value_original', 'value', 'evidence', 'certainty'], properties: { value_original: str(300), value: loc, certainty: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['turn', 'quote'], properties: { turn: { type: 'string', pattern: '^T\\d+$' }, quote: str(400) } } } } };
export const EXTRACTION_SCHEMA = { type: 'object', additionalProperties: false, required: ['language_detected', 'fields'], properties: { language_detected: { type: 'string', enum: ['th', 'it', 'en', 'mixed', 'other'] }, fields: { type: 'object', additionalProperties: false, required: FIELD_KEYS, properties: Object.fromEntries(FIELD_KEYS.map(k => [k, { anyOf: [{ type: 'null' }, field] }])) } } };
const quoteProperties = { turn: { type: 'string', pattern: '^T\\d+$' }, quote: str(400) };
const nullableText = { anyOf: [{ type: 'null' }, str(300)] };
Object.assign(EXTRACTION_SCHEMA.properties, {
  medications: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['nameOriginal', 'dose', 'frequency', 'timing', 'turn', 'quote'], properties: { nameOriginal: str(300), dose: nullableText, frequency: nullableText, timing: nullableText, ...quoteProperties } } },
  allergies: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['allergenOriginal', 'reaction', 'turn', 'quote'], properties: { allergenOriginal: str(300), reaction: nullableText, ...quoteProperties } } },
  noKnownAllergies: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['turn', 'quote'], properties: quoteProperties }] },
});
EXTRACTION_SCHEMA.required.push('medications', 'allergies', 'noKnownAllergies');
const nullStr = { anyOf: [{ type: 'null' }, str(60)] };
export const MED_PHOTO_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['name', 'strength', 'form'], properties: { name: str(120), strength: nullStr, form: nullStr } } } } };
export interface MedPhotoItem { name: string; strength: string | null; form: string | null }
/** `{ items: [{ name, strength, form }] }`; extra keys on an item are dropped (small vision models add some), a missing key or wrong type is null (caller abstains). Control characters are rejected. */
export function validateMedPhoto(data: unknown): MedPhotoItem[] | null {
  if (!object(data) || Object.keys(data).some(k => k !== 'items') || !Array.isArray(data.items) || data.items.length > 6) return null;
  const clean = (x: unknown, max: number) => x === null || (shortString(x, max) && !/[\u0000-\u001f<>]/.test(x));
  if (!data.items.every(i => object(i) && clean(i.name, 120) && i.name !== null && clean(i.strength, 60) && clean(i.form, 60))) return null;
  return (data.items as MedPhotoItem[]).map(i => ({ name: i.name.trim(), strength: i.strength?.trim() ?? null, form: i.form?.trim() ?? null }));
}
export const QUESTION_SCHEMA = { type: 'object', additionalProperties: false, required: ['field', 'question'], properties: { field: { type: 'string', enum: FIELD_KEYS }, question: loc } };
export const SCREEN_CATEGORIES = ['CHEST', 'STROKE', 'BREATH', 'ANAPH', 'SUICIDE', 'BLEED', 'PREG', 'HEAD', 'SEIZ', 'MENING', 'CONSC', 'SYNC', 'ABD', 'FEVER-INF'] as const;
export type ScreenCategory = typeof SCREEN_CATEGORIES[number];
export interface ModelScreenFlag { category: ScreenCategory; turn: string; quote: string; certainty: 'high' | 'medium' | 'low' }
export const SCREEN_SCHEMA = { type: 'object', additionalProperties: false, required: ['flags'], properties: { flags: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['category', 'turn', 'quote', 'certainty'], properties: { category: { type: 'string', enum: SCREEN_CATEGORIES }, turn: { type: 'string', pattern: '^T\\d+$' }, quote: str(400), certainty: { type: 'string', enum: ['high', 'medium', 'low'] } } } } } };
export function validateScreen(data: unknown): { flags: ModelScreenFlag[]; invalid: number[] } | null {
  if (!object(data) || Object.keys(data).some(k => k !== 'flags') || !Array.isArray(data.flags) || data.flags.length > 3) return null;
  const flags: ModelScreenFlag[] = []; const invalid: number[] = [];
  data.flags.forEach((f, i) => {
    if (!object(f) || typeof f.category !== 'string' || !SCREEN_CATEGORIES.includes(f.category as ScreenCategory) || typeof f.turn !== 'string' || !/^T\d+$/.test(f.turn) || !shortString(f.quote, 400) || typeof f.certainty !== 'string' || !['high', 'medium', 'low'].includes(f.certainty) || Object.keys(f).some(k => !['category', 'turn', 'quote', 'certainty'].includes(k))) invalid.push(i);
    else flags.push(f as unknown as ModelScreenFlag);
  });
  return { flags, invalid };
}
