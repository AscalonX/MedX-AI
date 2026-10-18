import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatResult } from '../llm';
import { decideMedPhoto, suggestFromPhoto } from '../medPhoto';
import { addTurn, createSession } from '../pipeline';
import { validateMedPhoto } from '../schema';
import { getAudit, getSession } from '../store';
import { deriveTrace } from '../trace';
import { POST as postPhoto } from '../../../app/api/sessions/[id]/med-photo/route';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-photo-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const ph = 'Pharmacist Laura Conti';
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const image = (b = jpeg, mime = 'image/jpeg') => ({ mime, base64: b.toString('base64') });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function patient() { return (await addTurn(createSession('en').id, 'I have a headache since today. No allergies.')).id; }
const fail = (failure: 'provider_error' | 'schema_error'): ChatResult => ({ data: null, failure, call: { step: 'extract', provider: 'amd-tokenfactory', model: 'x', latencyMs: 5, ok: false, error: 'boom' } });
const ok = (data: unknown): ChatResult => ({ data, call: { step: 'extract', provider: 'amd-tokenfactory', model: 'x', latencyMs: 5, ok: true } });
const meds = (id: string) => getSession(id)!.summary!.medications ?? [];

describe('validateMedPhoto', () => {
  it('accepts the strict shape and trims', () => {
    expect(validateMedPhoto({ items: [{ name: ' Tylenol ', strength: '500 mg', form: null }] })).toEqual([{ name: 'Tylenol', strength: '500 mg', form: null }]);
  });
  it('drops extra item keys that small vision models add', () => {
    expect(validateMedPhoto({ items: [{ name: 'AMOXIL', strength: '500 mg', form: 'Capsules', quantity: '21 capsules' }] })).toEqual([{ name: 'AMOXIL', strength: '500 mg', form: 'Capsules' }]);
  });
  it.each([null, [], { items: 'x' }, { items: [{ name: 'a' }] }, { items: [{ name: '', strength: null, form: null }] }, 
    { items: [{ name: 'a', strength: null, form: null }], note: 'x' }, { items: [{ name: '<b>x</b>', strength: null, form: null }] }, { items: Array(7).fill({ name: 'a', strength: null, form: null }) }])('rejects %j', v => {
    expect(validateMedPhoto(v)).toBeNull();
  });
});

describe('suggestFromPhoto', () => {
  it('mock mode returns a deterministic suggestion; known names match the dictionary, unknown are unverified', async () => {
    const id = await patient();
    const r = await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    expect(r.outcome).toBe('suggested');
    expect(r.suggestions.map(s => [s.name, s.status, s.generic])).toEqual([['Paracetamol', 'matched', 'paracetamol'], ['Zorbexin', 'unverified', null]]);
  });

  it('is a suggestion only: no medicine, alert or order changes until confirmed', async () => {
    const id = await patient();
    const before = JSON.stringify([meds(id), getSession(id)!.summary!.medAlerts, getSession(id)!.orders]);
    await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    expect(JSON.stringify([meds(id), getSession(id)!.summary!.medAlerts, getSession(id)!.orders])).toBe(before);
    expect(getSession(id)!.medPhoto).toHaveLength(2);
  });

  it('audits the suggestion with names only, never the image', async () => {
    const id = await patient();
    await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    const ev = getAudit(id).find(e => e.type === 'med_photo_suggested')!;
    expect(ev.actorId).toBe(ph);
    expect(ev.payload.outcome).toBe('suggested');
    expect(JSON.stringify(ev)).not.toContain(jpeg.toString('base64'));
    expect(JSON.stringify(getSession(id))).not.toContain(jpeg.toString('base64'));
  });

  it('sends the image as a data URL to the vision model, defaulting the model id', async () => {
    const id = await patient(); let seen: ChatRequest | undefined;
    await suggestFromPhoto(id, { reviewerId: ph, image: image() }, async req => { seen = req; return ok({ items: [{ name: 'Ibuprofen', strength: '400 mg', form: 'tablet' }] }); });
    expect(seen!.images![0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(seen!.model).toBe('MiniCPM-V-4.7-35B-A3B');
    expect(seen!.timeoutMs).toBe(75_000);
    vi.stubEnv('AMD_MODEL_VISION', 'MiniCPM-V-4.7-1B');
    await suggestFromPhoto(id, { reviewerId: ph, image: image() }, async req => { seen = req; return ok({ items: [{ name: 'Ibuprofen', strength: null, form: null }] }); });
    expect(seen!.model).toBe('MiniCPM-V-4.7-1B');
  });

  it.each([['provider_error', fail('provider_error')], ['schema_error', fail('schema_error')], ['invalid shape', ok({ items: [{ name: 5 }] })], ['empty read', ok({ items: [] })]] as const)('%s -> needs human review, no guess', async (_n, result) => {
    const id = await patient();
    const r = await suggestFromPhoto(id, { reviewerId: ph, image: image() }, async () => result);
    expect(r.outcome).toBe('needs_human_review'); expect(r.suggestions).toEqual([]);
    expect(getSession(id)!.medPhoto).toBeUndefined(); expect(meds(id)).toEqual([]);
    expect(getAudit(id).find(e => e.type === 'med_photo_suggested')!.payload.outcome).toBe('needs_human_review');
  });

  it('a throwing client is a provider failure, not a crash', async () => {
    const id = await patient();
    const r = await suggestFromPhoto(id, { reviewerId: ph, image: image() }, async () => { throw new Error('x'); });
    expect(r.outcome).toBe('needs_human_review');
  });

  it('rejects wrong type, oversize, mismatched content and bad base64', async () => {
    const id = await patient();
    const go = (i: unknown) => suggestFromPhoto(id, { reviewerId: ph, image: i });
    await expect(go(image(jpeg, 'image/gif'))).rejects.toMatchObject({ status: 415 });
    await expect(go(image(Buffer.alloc(100, 7), 'image/png'))).rejects.toMatchObject({ status: 415 });
    await expect(go(image(Buffer.concat([jpeg, Buffer.alloc(4 * 1024 * 1024)])))).rejects.toMatchObject({ status: 413 });
    await expect(go({ mime: 'image/jpeg', base64: '***' })).rejects.toThrow();
    await expect(go(null)).rejects.toThrow();
    expect(getAudit(id).some(e => e.type === 'med_photo_suggested')).toBe(false);
  });

  it('only pharmacists may suggest', async () => {
    const id = await patient();
    await expect(suggestFromPhoto(id, { reviewerId: 'Dr. Marco Bianchi', image: image() })).rejects.toMatchObject({ status: 403 });
  });
});

describe('decideMedPhoto', () => {
  it('confirm adds the entry through the normal checks: matched is verified, unknown is unmatched with an unknown-medicine alert', async () => {
    const id = await patient();
    const { suggestions } = await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    await decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[0].id, action: 'confirm' });
    // Pack strength is kept in the name; the patient's actual dose stays unknown until asked.
    expect(meds(id).map(m => [m.generic, m.status, m.dose, m.nameOriginal.includes('500 mg')])).toEqual([['paracetamol', 'verified', null, true]]);
    await decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[1].id, action: 'confirm' });
    const s = getSession(id)!;
    expect(s.summary!.medications!.at(-1)).toMatchObject({ generic: null, status: 'unmatched', dose: null }); expect(s.summary!.medications!.at(-1)!.nameOriginal.startsWith('Zorbexin')).toBe(true);
    expect(s.summary!.medAlerts!.some(a => a.ruleId === 'MR-UNKNOWN-01')).toBe(true);
    expect(s.medPhoto!.map(x => x.status)).toEqual(['confirmed', 'confirmed']);
    expect(s.pharmacyStatus).toBe('in_review');
  });

  it('a confirmed duplicate runs the duplicate-therapy check', async () => {
    const id = await patient();
    const { suggestions } = await suggestFromPhoto(id, { reviewerId: ph, image: image() }, async () => ok({ items: [{ name: 'Paracetamol', strength: '500 mg', form: null }, { name: 'Tylenol', strength: null, form: null }] }));
    for (const s of suggestions) await decideMedPhoto(id, { reviewerId: ph, suggestionId: s.id, action: 'confirm' });
    expect(getSession(id)!.summary!.medAlerts!.some(a => a.kind === 'max_dose_risk' || a.kind === 'duplicate_therapy')).toBe(true);
  });

  it('discard leaves the list untouched, and a decided suggestion cannot be decided again', async () => {
    const id = await patient();
    const { suggestions } = await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    await decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[0].id, action: 'discard' });
    expect(meds(id)).toEqual([]); expect(getSession(id)!.medPhoto![0].status).toBe('discarded');
    await expect(decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[0].id, action: 'confirm' })).rejects.toMatchObject({ status: 409 });
    await expect(decideMedPhoto(id, { reviewerId: ph, suggestionId: 'nope', action: 'confirm' })).rejects.toMatchObject({ status: 404 });
    await expect(decideMedPhoto(id, { reviewerId: 'Nurse Anna Rossi', suggestionId: suggestions[1].id, action: 'confirm' })).rejects.toMatchObject({ status: 403 });
    expect(meds(id)).toEqual([]);
  });

  it('writes both the suggestion and each decision to the audit, and the trace shows a model step', async () => {
    const id = await patient();
    const { suggestions } = await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    await decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[0].id, action: 'confirm' });
    await decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[1].id, action: 'discard' });
    const audit = getAudit(id);
    expect(audit.filter(e => e.type === 'med_photo_decision').map(e => e.payload.action)).toEqual(['confirm', 'discard']);
    const trace = deriveTrace(getSession(id)!, audit);
    const photo = trace.nodes.find(n => n.label.en.startsWith('Medicine photo read'))!;
    expect(photo.actor).toBe('model'); expect(photo.detail.en).toContain('2 suggested');
    expect(trace.nodes.some(n => n.label.en.startsWith('Pharmacist decided on photo'))).toBe(true);
  });

  it('no decisions once medicines are reconciled', async () => {
    const id = await patient();
    const { suggestions } = await suggestFromPhoto(id, { reviewerId: ph, image: image() });
    const s = getSession(id)!; s.pharmacyStatus = 'reconciled'; (await import('../store')).saveSession(s);
    await expect(decideMedPhoto(id, { reviewerId: ph, suggestionId: suggestions[0].id, action: 'confirm' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('POST /api/sessions/:id/med-photo', () => {
  const json = (id: string, value: unknown, headers: Record<string, string> = {}) => postPhoto(new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) }), ctx(id));
  it('JSON upload then confirm', async () => {
    const id = await patient();
    const up = await json(id, { reviewerId: ph, mime: 'image/jpeg', imageBase64: jpeg.toString('base64') });
    expect(up.status).toBe(200);
    const body = await up.json();
    expect(body.outcome).toBe('suggested');
    const dec = await json(id, { reviewerId: ph, action: 'confirm', suggestionId: body.suggestions[0].id });
    expect(dec.status).toBe(200); expect(meds(id)).toHaveLength(1);
  });
  it('multipart upload works', async () => {
    const id = await patient(); const form = new FormData();
    form.set('reviewerId', ph); form.set('image', new Blob([jpeg], { type: 'image/jpeg' }), 'a.jpg');
    const res = await postPhoto(new Request('http://localhost/api', { method: 'POST', body: form }), ctx(id));
    expect(res.status).toBe(200); expect((await res.json()).outcome).toBe('suggested');
  });
  it('rejects oversize bodies (header and stream), wrong types, unknown keys and non-pharmacists', async () => {
    const id = await patient();
    expect((await json(id, { reviewerId: ph }, { 'content-length': String(6 * 1024 * 1024) })).status).toBe(413);
    expect((await json(id, { reviewerId: ph, mime: 'image/jpeg', imageBase64: Buffer.alloc(5 * 1024 * 1024, 1).toString('base64') })).status).toBe(413);
    expect((await json(id, { reviewerId: ph, mime: 'application/pdf', imageBase64: jpeg.toString('base64') })).status).toBe(415);
    expect((await json(id, { reviewerId: ph, mime: 'image/jpeg', imageBase64: jpeg.toString('base64'), x: 1 })).status).toBe(400);
    expect((await json(id, { reviewerId: 'Dr. Marco Bianchi', mime: 'image/jpeg', imageBase64: jpeg.toString('base64') })).status).toBe(403);
    expect((await json('nope', { reviewerId: ph, mime: 'image/jpeg', imageBase64: jpeg.toString('base64') })).status).toBe(404);
    expect(getAudit(id).some(e => e.type === 'med_photo_suggested')).toBe(false);
  });
});
