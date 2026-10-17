import { describe, expect, it } from 'vitest';
import type { RedFlagRuleFile, Turn } from '@medx/shared';
import { redact } from '../redact';
import { checkRedFlags } from '../redflags';
import { norm, verifyDetailed, verifyEvidence } from '../verify';
const turn = (text: string, id = 'T1', lang: Turn['lang'] = 'en', role: Turn['role'] = 'patient'): Turn => ({ text, id, lang, role, at: '2026-10-17T00:00:00Z' });
const loc = { th: 'ทดสอบ', it: 'test', en: 'test' };
const file: RedFlagRuleFile = { version: 'test', negationCues: ['no ', 'not ', 'non ', 'ไม่มี', 'ไม่'], negationWindowChars: 16, rules: [{ id: 'test', severity: 'urgent', label: loc, action: loc, patientMessage: loc, source: 'synthetic unit test', match: [['chest pain', 'dolore al petto', 'เจ็บหน้าอก'], ['breathless', 'หายใจไม่ออก']] }] };
describe('redaction', () => {
  it.each([
    ['EMAIL', 'test.person@example.invalid'],
    ['PHONE', '081-234-5678'], ['PHONE', '+66 81 234 5678'], ['PHONE', '+39 333 123 4567'], ['PHONE', '333 123 4567'], ['PHONE', '+44 7700 900123'],
    ['ID', '1234567890123'], ['ID', '1-2345-67890-12-3'], ['ID', 'RSSMRA85T10A562S'],
    ['DOB', 'DOB: 21/10/1985'], ['DOB', 'nato il 21-10-1985'], ['DOB', 'เกิดวันที่ 21/10/2528'],
    ['NAME', 'my name is Jane Smith'], ['NAME', "I'm called Jane"], ['NAME', 'mi chiamo Mario Rossi'], ['NAME', 'sono Mario Rossi'],
    ['NAME', 'ฉันชื่อ สมชาย'], ['NAME', 'ผมชื่อ สมชาย'], ['NAME', 'ดิฉันชื่อ สมหญิง'],
  ])('redacts %s: %s', (type, input) => {
    const result = redact(input); expect(result.text).toBe(`[${type}_1]`); expect(result.replaced).toEqual([{ type, count: 1 }]);
  });
  it('numbers tokens and preserves surrounding clinical text', () => {
    const result = redact('my name is Jane Smith and I have a cough. a@example.invalid b@example.invalid');
    expect(result.text).toBe('[NAME_1] and I have a cough. [EMAIL_1] [EMAIL_2]');
  });
  it('does not re-redact placeholders or medical numbers', () => {
    expect(redact('[PHONE_1] I am 28 years old, pain 4/10, temperature 37.5').text).toBe('[PHONE_1] I am 28 years old, pain 4/10, temperature 37.5');
  });
  it('redacts phone numbers attached to Thai text without spaces', () => {
    expect(redact('เบอร์0812345678ค่ะ').text).toBe('เบอร์[PHONE_1]ค่ะ');
    expect(redact('โทร+66812345678ค่ะ').text).toBe('โทร[PHONE_1]ค่ะ');
  });
});
describe('rule-file semantics', () => {
  it('requires every OR group', () => {
    expect(checkRedFlags('CHEST   PAIN, breathless', undefined, file)).toHaveLength(1);
    expect(checkRedFlags('chest pain alone', undefined, file)).toHaveLength(0);
  });
  it.each(['no chest pain, breathless', 'non dolore al petto, breathless', 'ไม่มีเจ็บหน้าอก หายใจไม่ออก'])('negates %s', text => expect(checkRedFlags(text, undefined, file)).toEqual([]));
  it('handles Thai substring and original offsets', () => {
    const text = 'วันนี้เจ็บหน้าอกและหายใจไม่ออก';
    const hits = checkRedFlags([turn(text, 'thai', 'th')], undefined, file);
    expect(hits).toHaveLength(1);
    for (const e of hits[0].evidence) { expect(e.turnId).toBe('thai'); expect(text.slice(e.start, e.end)).toBe(e.quote); }
  });
  it('combines groups across patient turns but excludes assistants', () => {
    const turns = [turn('chest pain', 'p1'), turn('breathless', 'p2')];
    const hits = checkRedFlags(turns, undefined, file); expect(hits).toHaveLength(1); expect(hits[0].evidence.map(e => e.turnId)).toEqual(['p1', 'p2']);
    expect(checkRedFlags([turn('chest pain'), turn('breathless', 'a', 'en', 'assistant')], undefined, file)).toEqual([]);
  });
  it('finds a later unnegated occurrence', () => {
    expect(checkRedFlags('no chest pain yesterday. Today I have chest pain and breathless', undefined, file)).toHaveLength(1);
  });
  it('does not treat cue letters inside another word as a negation', () => {
    const bounded = { ...file, negationCues: [' no ', ' not '] };
    expect(checkRedFlags('unknown chest pain breathless', undefined, bounded)).toHaveLength(1);
    expect(checkRedFlags('no chest pain breathless', undefined, bounded)).toHaveLength(0);
  });
  it('also scans individual turns so a previous turn cannot negate a fresh positive', () => {
    const singleGroup = { ...file, rules: [{ ...file.rules[0], match: [['chest pain']] }] };
    expect(checkRedFlags([turn('no', 'p1'), turn('chest pain', 'p2')], undefined, singleGroup)).toHaveLength(1);
  });
  it('only applies requires when fields are supplied', () => {
    const conditional = { ...file, rules: [{ ...file.rules[0], requires: { pregnancy_status: 'pregnant' } }] };
    expect(checkRedFlags('chest pain breathless', undefined, conditional)).toHaveLength(1);
    expect(checkRedFlags('chest pain breathless', [], conditional)).toEqual([]);
    expect(checkRedFlags('chest pain breathless', [{ key: 'pregnancy_status', status: 'supported', value: { ...loc, en: 'pregnant' }, valueOriginal: 'pregnant', evidence: [], confidence: 0.9, required: true }], conditional)).toHaveLength(1);
  });
});
describe('evidence verifier', () => {
  it('returns original exact spans', () => {
    const t = turn('Today I have a headache.'); const e = verifyEvidence('a headache', [t]);
    expect(e).toEqual({ turnId: 'T1', quote: 'a headache', start: 13, end: 23 });
  });
  it('normalises punctuation, accents, width, whitespace and zero-width with offsets', () => {
    const t = turn('«PERCHÉ»  ho\u200b dolore Ａ');
    const hit = verifyDetailed('perche ho dolore a', [t]);
    expect(hit?.matchFactor).toBe(0.95);
    expect(hit?.evidence.quote).toBe('PERCHÉ»  ho\u200b dolore Ａ');
    const e = hit!.evidence; expect(t.text.slice(e.start, e.end)).toBe(e.quote);
  });
  it('keeps Thai vowels/tones and removes inconsistent Thai spaces', () => {
    expect(norm('ปวด หัว').t).toBe(norm('ปวดหัว').t);
    expect(norm('ไม่').t).not.toBe(norm('ไม').t);
    const t = turn('ฉันปวด หัวมาก', 'thai', 'th'); const e = verifyEvidence('ปวดหัวมาก', [t]);
    expect(e?.quote).toBe('ปวด หัวมาก');
  });
  it('uses multiset token overlap >= .8 for one window', () => {
    const t = turn('I have very bad head pain today.');
    const hit = verifyDetailed('have very bad head ache', [t]); expect(hit?.matchFactor).toBe(0.8);
    expect(hit?.evidence.quote).toContain('have very bad head');
    expect(t.text.slice(hit!.evidence.start, hit!.evidence.end)).toBe(hit!.evidence.quote);
  });
  it('segments Thai words for tolerant matching', () => {
    const t = turn('วันนี้ฉันมีอาการปวดหัวและคลื่นไส้มาก', 'thai', 'th');
    const hit = verifyDetailed('วันนี้ฉันมีอาการปวดหัวและคลื่นไส้น้อย', [t]);
    expect(hit?.matchFactor).toBe(0.8); expect(t.text.slice(hit!.evidence.start, hit!.evidence.end)).toBe(hit!.evidence.quote);
  });
  it('corrects a wrong turn id', () => {
    const hit = verifyDetailed('I have a cough', [turn('no medicines', 'p1'), turn('I have a cough', 'p2')], 'p1');
    expect(hit?.correctedTurn).toBe(true); expect(hit?.evidence.turnId).toBe('p2');
  });
  it.each(['', 'a', '[NAME_1]', '[PHONE_1] [ID_2]', 'I have an invented symptom'])('rejects invalid/unsupported quote %s', quote => expect(verifyEvidence(quote, [turn('I have a headache')])).toBeNull());
  it('never searches assistant turns or combines separate turn tokens', () => {
    expect(verifyEvidence('I have a cough', [turn('I have a cough', 'a', 'en', 'assistant')])).toBeNull();
    expect(verifyEvidence('one two three four five', [turn('one two three'), turn('four five', 'p2')])).toBeNull();
  });
});
