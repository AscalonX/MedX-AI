import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '@medx/shared';
import redFlagRules from '@medx/shared/src/redflags.json';
import { addTurn, createSession, listSessions, metrics, runTurn, takeover } from '../pipeline';
import { getAudit, getSession, saveSession } from '../store';
import { redact } from '../redact';
import { checkRedFlags } from '../redflags';
import { checkMedRules } from '../medrules';
import { mockPharmacy, pharmacyEntries } from '../pharmacyExtraction';
import { mockJSON } from '../mock';
import type { ModelClient } from '../llm';
import type { ModelExtraction } from '../schema';
import { POST as takeRoute } from '../../../app/api/sessions/[id]/takeover/route';
import { POST as turnRoute } from '../../../app/api/sessions/[id]/turns/route';
import { OPTIONS } from '../../../app/api/_http';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w9-'));
  vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });

describe('P0-2 Thai given name and surname', () => {
  it.each([
    ['ผมชื่อสมชาย ใจดี เจ็บหน้าอก', '[NAME_1] เจ็บหน้าอก'],
    ['ดิฉันชื่อ มาลี รักสุข อายุ 30 ปี ปวดท้อง', '[NAME_1] อายุ 30 ปี ปวดท้อง'],
    ['ฉันชื่อสมหญิง หายใจไม่ออก', '[NAME_1] หายใจไม่ออก'],
    ['ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก', '[NAME_1]เจ็บหน้าอกมากเหงื่อออก'],
    ['สวัสดีครับ ชื่อ สมศักดิ์ ปวดหัว', '[NAME_1] ปวดหัว'],
    ['ผมชื่อสมชาย ใจดี คำที่สาม', '[NAME_1] คำที่สาม'],
  ])('%s', (raw, expected) => { expect(redact(raw).text).toBe(expected); });
  it.each(['เจ็บ', 'ปวด', 'หายใจ', 'เหงื่อ', 'แพ้', 'ไข้', 'ไอ', 'แน่น', 'เวียน', 'หมดสติ', 'ไม่', 'กินยา', 'ตั้งครรภ์', 'อายุ', 'ชา', 'อ่อนแรง', 'เลือด', 'อาเจียน', 'ชัก'])('retains symptom/stop stem %s', stem => {
    expect(redact(`ผมชื่อสมชาย ${stem}`).text).toBe(`[NAME_1] ${stem}`);
  });
  it('retains every Thai clinical dictionary term following an introduction', () => {
    const terms = new Set(redFlagRules.rules.flatMap(r => r.match.flat()).filter(t => /^\p{Script=Thai}/u.test(t)));
    for (const term of terms) expect(redact(`ผมชื่อสมชาย ${term}`).text, term).toBe(`[NAME_1] ${term}`);
  });
  it('checks raw symptoms before redaction, persists no surname, and never calls a model', async () => {
    const client = vi.fn<ModelClient>();
    const s = await runTurn(createSession('th', { persist: false }), 'ผมชื่อสมชาย ใจดี เจ็บหน้าอก เหงื่อออก', { client });
    expect(s.status).toBe('escalated'); expect(client).not.toHaveBeenCalled();
    expect(JSON.stringify(s)).not.toMatch(/สมชาย|ใจดี/);
    const stored = await addTurn(createSession('th').id, 'ผมชื่อสมชาย ใจดี เจ็บหน้าอก เหงื่อออก');
    expect(readFileSync(path.join(dir, 'store.json'), 'utf8')).not.toMatch(/สมชาย|ใจดี/);
    expect(getAudit(stored.id).some(e => e.type === 'pii_redacted')).toBe(true);
  });
});

describe('P1-6 DOB and addresses', () => {
  it.each(['born 15/03/1985', 'date of birth is 15 March 1985', 'DOB: 1985-03-15', 'nato il 15 marzo 1985', 'nata il 1985-03-15', 'เกิดวันที่ 15/03/1985'])('redacts %s', raw => {
    expect(redact(raw).text).toBe('[DOB_1]');
  });
  it.each(['123 Main Street', '12 Sukhumvit Road', 'via Roma 12', 'บ้านเลขที่ 123/45', 'ซอย สุขุมวิท 12', 'ถนน สุขุมวิท'])('redacts %s', raw => {
    expect(redact(`${raw}, headache`).text).toBe('[ADDRESS_1], headache');
  });
  it('numbers repeated dates/addresses and preserves raw symptom offsets after replacement', async () => {
    const raw = 'born 15/03/1985, DOB 1986-04-16, 123 Main Street, via Roma 12, chest-pain';
    expect(redact(raw).text).toBe('[DOB_1], [DOB_2], [ADDRESS_1], [ADDRESS_2], chest-pain');
    const s = await runTurn(createSession('en', { persist: false }), raw);
    expect(s.status).toBe('escalated');
    for (const e of s.summary!.redFlags.flatMap(f => f.evidence)) expect(s.turns[0].text.slice(e.start, e.end)).toBe(e.quote);
  });
  it('retains dosage and a date without DOB context', () => {
    expect(redact('I take 500 mg on 2026-10-17').text).toBe('I take 500 mg on 2026-10-17');
  });
});

const deniedAllergies: [Lang, string][] = [
  ['en', 'I am not allergic to penicillin. I take Augmentin.'],
  ['en', 'No allergy to penicillin, I take Augmentin.'],
  ['en', 'I have never been allergic to penicillin. I take Augmentin.'],
  ['it', 'Non sono allergico alla penicillina. Prendo Augmentin.'],
  ['th', 'ไม่แพ้เพนิซิลลิน กินออกเมนติน'],
  ['th', 'ไม่แพ้ยาเพนิซิลลิน กินออกเมนติน'],
];
describe('P1-1 allergy negation', () => {
  it.each(deniedAllergies)('%s %s', async (lang, text) => {
    const s = await runTurn(createSession(lang, { persist: false }), text);
    expect(s.summary!.allergies).toEqual([]); expect(s.summary!.noKnownAllergiesEvidence).toEqual([]);
    expect(s.summary!.medAlerts?.some(a => a.kind === 'allergy_conflict')).toBe(false);
  });
  it.each(['No known allergies.', 'Nessuna allergia.', 'ไม่มีประวัติแพ้ยา', 'ไม่แพ้ยา'])('global denial has evidence: %s', async text => {
    const s = await runTurn(createSession('en', { persist: false }), text);
    expect(s.summary!.noKnownAllergiesEvidence?.length).toBeGreaterThan(0);
  });
  it.each(['Not allergic to aspirin, allergic to penicillin.', 'Non allergico ad aspirina ma allergico alla penicillina.', 'ไม่แพ้แอสไพริน แต่แพ้เพนิซิลลิน'])('denial stays clause bounded: %s', text => {
    expect(mockPharmacy([{ alias: 'T1', text }]).allergies?.map(a => a.allergenOriginal)).toHaveLength(1);
  });
  it('guards verified provider quotes against an omitted negation in the full turn', () => {
    const s = createSession('en', { persist: false });
    s.turns = [{ id: 'p', role: 'patient', lang: 'en', at: '', text: 'I am not allergic to penicillin' }];
    const model = { allergies: [{ allergenOriginal: 'penicillin', reaction: null, turn: 'T1', quote: 'allergic to penicillin' }], noKnownAllergies: { turn: 'T1', quote: 'not allergic to penicillin' } };
    const out = pharmacyEntries(model, s);
    expect(out.allergies).toEqual([]); expect(out.noKnownAllergiesEvidence).toEqual([]);
  });
});

describe('P1-2 medications: negated, stopped, and span-local timing', () => {
  it.each([
    'I do not take warfarin. I take ibuprofen 400 mg.',
    'I never take warfarin, only ibuprofen.',
    'Non prendo warfarin. Prendo ibuprofene.',
    'ไม่ได้กินวาร์ฟาริน กินไอบูโพรเฟน',
  ])('denied medicine cannot trigger an interaction: %s', async text => {
    const s = await runTurn(createSession('en', { persist: false }), text);
    expect(s.summary!.medications?.map(m => m.generic)).not.toContain('warfarin');
    expect(s.summary!.medications).toHaveLength(1);
    expect(s.summary!.medAlerts?.some(a => a.kind === 'interaction')).toBe(false);
  });
  it.each([
    ['I stopped taking warfarin last week. I take ibuprofen.', 'stopped taking'],
    ['Ho smesso di prendere warfarin. Prendo ibuprofene.', 'smesso di prendere'],
    ['หยุดกินวาร์ฟาริน กินไอบูโพรเฟน', 'หยุดกิน'],
  ])('stopped timing stays attached to warfarin: %s', async (text, timing) => {
    const s = await runTurn(createSession('en', { persist: false }), text);
    expect(s.summary!.medications?.find(m => m.generic === 'warfarin')).toMatchObject({ status: 'supported', timing: expect.stringContaining(timing) });
    expect(s.summary!.medications?.find(m => m.generic === 'ibuprofen')).toMatchObject({ status: 'supported', timing: null });
    expect(s.summary!.medAlerts?.some(a => a.kind === 'interaction')).toBe(true);
  });
  it('checks patient-stopped medicines for duplicate/max-dose/pregnancy rules too', async () => {
    const s = await runTurn(createSession('en', { persist: false }), 'I stopped taking paracetamol. I take Tylenol. I stopped taking ibuprofen. I am pregnant.');
    expect(s.summary!.medAlerts?.some(a => a.kind === 'max_dose_risk')).toBe(true);
    expect(checkMedRules(s.summary!.medications!, [], 'pregnant').some(a => a.kind === 'pregnancy_caution')).toBe(true);
  });
  it('does not infer discontinued status from a negated stopping action', async () => {
    const s = await runTurn(createSession('en', { persist: false }), 'I have not stopped taking warfarin. I take ibuprofen.');
    expect(s.summary!.medications?.find(m => m.generic === 'warfarin')?.status).toBe('supported');
    expect(s.summary!.medAlerts?.some(a => a.kind === 'interaction')).toBe(true);
  });
  it('a Thai symptom denial does not deny a later taking action', () => {
    const extracted = mockPharmacy([{ alias: 'T1', text: 'เมื่อเช้ากินซาร่าไป 2 เม็ด พอตอนบ่ายยังไม่หาย เลยกินทิฟฟี่เพิ่มอีก 2 เม็ด' }]);
    expect(extracted.medications).toHaveLength(2);
  });
  it('retains an unreviewed interaction after a later stopped-medication statement', async () => {
    const first = await runTurn(createSession('en', { persist: false }), 'Headache. I take warfarin. I take ibuprofen.');
    expect(first.summary!.medAlerts?.some(a => a.kind === 'interaction')).toBe(true);
    const next = await runTurn(first, 'I stopped taking warfarin last week.');
    expect(next.summary!.medications?.find(m => m.generic === 'warfarin')?.status).toBe('supported');
    expect(next.summary!.medAlerts?.some(a => a.kind === 'interaction')).toBe(true);
  });
});

describe('P1-3 and P1-4 session states and metrics', () => {
  it('approved takeover returns HTTP 409 without changing status or audit', async () => {
    const s = createSession('en'); s.status = 'approved'; saveSession(s);
    const before = getAudit(s.id);
    const response = await takeRoute(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ reviewerId: 'dr' }) }), { params: Promise.resolve({ id: s.id }) });
    expect(response.status).toBe(409); expect(getSession(s.id)?.status).toBe('approved'); expect(getAudit(s.id)).toEqual(before);
    await expect(takeover(s.id, 'dr')).rejects.toMatchObject({ status: 409 });
  });
  it('all metrics use queue visibility while empty starts remain addressable', async () => {
    const empty = createSession('en');
    await addTurn(createSession('en').id, 'headache');
    await addTurn(createSession('en').id, 'chest pain');
    const m = metrics();
    expect(Object.values(m.byStatus).reduce((a, b) => a + b, 0)).toBe(listSessions().length);
    expect(m.sessionsToday).toBe(2); expect(getSession(empty.id)).toBeDefined();
  });
});

describe('P1-5 normalization preserves exact evidence offsets', () => {
  it.each(['chest-pain', 'chest–pain', 'chest—pain', 'chest\u200b pain', 'chest\u200c\u200d\ufeff pain', 'ｃｈｅｓｔ ｐａｉｎ', 'เจ็บ หน้า อก มาก เหงื่อ ออก', 'ฉัน หายใจ ไม่ ออก', '😀 ｃｈｅｓｔ—ｐａｉｎ'])('%s', async text => {
    const hits = checkRedFlags(text); expect(hits.length).toBeGreaterThan(0);
    for (const e of hits.flatMap(h => h.evidence)) expect(text.slice(e.start, e.end)).toBe(e.quote);
    const client = vi.fn<ModelClient>(); const s = await runTurn(createSession('th', { persist: false }), text, { client });
    expect(s.status).toBe('escalated'); expect(client).not.toHaveBeenCalled();
  });
  it.each(['no chest-pain', 'non ho ｄｏｌｏｒｅ ａｌ ｐｅｔｔｏ', 'ไม่มี อาการ เจ็บ หน้า อก'])('keeps negation: %s', text => { expect(checkRedFlags(text)).toEqual([]); });
});

describe('P1-7 clinician medication field', () => {
  it.each(['mock', 'provider'])('fills a missing field from verified pharmacy entries (%s)', async provider => {
    const client: ModelClient | undefined = provider === 'mock' ? undefined : async req => {
      const data = mockJSON(req) as ModelExtraction;
      if (req.step === 'extract') data.fields.medications = null;
      return { data, call: { step: req.step, provider: 'amd-tokenfactory', model: 'test', ok: true, latencyMs: 0 } };
    };
    const s = await runTurn(createSession('en', { persist: false }), 'Headache. I take ibuprofen 400 mg and metformin 500 mg.', { client });
    const f = s.summary!.fields.find(f => f.key === 'medications')!;
    expect(f.status).toBe('supported'); expect(f.value?.en).toMatch(/ibuprofen.*metformin/);
    expect(f.evidence.length).toBeGreaterThanOrEqual(2);
    for (const e of f.evidence) expect(s.turns[0].text.slice(e.start, e.end)).toBe(e.quote);
  });
});

describe('P2 blank input, codes, OPTIONS', () => {
  it.each(['\u200b', ' \u200c\u200d\ufeff\n\t ', '\u00a0\u200b'])('rejects invisible-only input %j before any model call', async text => {
    const s = createSession('en'); const client = vi.fn<ModelClient>();
    await expect(runTurn(s, text, { client })).rejects.toMatchObject({ code: 'bad_request' }); expect(client).not.toHaveBeenCalled();
    const response = await turnRoute(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ text }) }), { params: Promise.resolve({ id: s.id }) });
    expect(response.status).toBe(400); expect(getSession(s.id)?.turns).toEqual([]);
  });
  it('allocates B-1000 and B-1001 after B-999, without wraps or collisions', () => {
    const template = createSession('en', { persist: false });
    writeFileSync(path.join(dir, 'store.json'), JSON.stringify({ sessions: Array.from({ length: 999 }, (_, i) => ({ ...template, id: `s${i}`, code: `B-${String(i + 1).padStart(3, '0')}` })), audit: [] }));
    expect(createSession('en').code).toBe('B-1000'); expect(createSession('en').code).toBe('B-1001');
  });
  it('OPTIONS has the required Request signature and retains configured CORS', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://patient.example');
    const response = OPTIONS(new Request('http://localhost/api', { headers: { Origin: 'https://patient.example' } }));
    expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://patient.example');
    expect(readFileSync(path.resolve('app/api/_http.ts'), 'utf8')).toMatch(/function OPTIONS\(request: Request\)/);
  });
  it.each(['health', 'metrics', 'sessions'])('%s GET has a build-compatible required Request signature', route => {
    expect(readFileSync(path.resolve(`app/api/${route}/route.ts`), 'utf8')).toMatch(/function GET\(request: Request\)/);
  });
});
