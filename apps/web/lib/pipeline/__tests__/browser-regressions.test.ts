import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '@medx/shared';
import { addTurn, createSession } from '../pipeline';
import { addConsultTurn, consultNote } from '../consult';
import { getSession } from '../store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-browser-regression-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
  vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe('browser-discovered mock complaint negation', () => {
  it.each([
    ['en', 'No fever.'], ['en', 'No cough.'], ['en', 'I do not have a headache.'],
    ['it', 'Niente febbre.'], ['it', 'Non ho tosse.'],
    ['th', 'ไม่มีไข้'], ['th', 'ไม่ไอ'], ['th', 'ไม่มีอาการปวดหัว'],
  ] as [Lang, string][])('does not invent a complaint from a denial: %s %s', async (lang, text) => {
    const session = await addTurn(createSession(lang).id, text);
    const field = session.summary!.fields.find(f => f.key === 'chief_complaint')!;
    expect(field.value).toBeNull();
    expect(field.status).toBe('missing');
  });

  it('keeps the presenting complaint through a negative consult answer and note draft', async () => {
    const session = await addTurn(createSession('en').id, "I've had burning when I pee for two days. It's 4 out of 10. I'm a 31 year old woman, not pregnant, no allergies, and I take a daily multivitamin.");
    await addConsultTurn(session.id, { mode: 'doctor', speaker: 'patient', text: 'No fever or flank pain. No blood in my urine.' });
    const current = getSession(session.id)!;
    expect(current.summary!.fields.find(f => f.key === 'chief_complaint')!.value!.en).toBe('burning urination');
    const note = await consultNote(session.id, { mode: 'doctor', action: 'draft', reviewerId: 'synthetic-reviewer' });
    expect(JSON.stringify(note)).toContain('Presenting complaint: burning urination');
    expect(JSON.stringify(note)).not.toContain('Presenting complaint: fever');
  });

  it.each([
    ['en', 'No cough, but I have a cough now.', 'cough', 'but I have a cough'],
    ['it', 'Niente febbre, ma ora ho febbre.', 'fever', 'ma ora ho febbre'],
    ['th', 'ไม่มีไข้ แต่ตอนนี้มีไข้', 'fever', 'แต่ตอนนี้มีไข้'],
  ] as [Lang, string, string, string][])('still captures an affirmative mention after a denial: %s', async (lang, text, expected, affirmation) => {
    const session = await addTurn(createSession(lang).id, text);
    const field = session.summary!.fields.find(f => f.key === 'chief_complaint')!;
    expect(field.value!.en).toBe(expected);
    // The evidence must include the later affirmative mention, not only the
    // first identical symptom word inside the denial.
    expect(field.evidence[0].quote).toContain(affirmation);
    expect(field.evidence[0].end).toBe(text.indexOf(affirmation) + affirmation.length);
  });
});
