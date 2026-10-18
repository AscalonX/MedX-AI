// w20 M-08 / S-04: the /patient export (apps/web/public/patient) must be built from the CURRENT patient app and shared
// sources, and the "Try saying" examples it offers must do what the phone promises on the mock provider.
// Rebuild with: bash scripts/build-patient-web.sh (never hand-edit the export).
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shared from '@medx/shared';
import { DEMO_SAMPLES, type FieldKey } from '@medx/shared';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '../lib/pipeline/store';
import { POST as createRoute } from './api/sessions/route';
import { POST as turnsRoute } from './api/sessions/[id]/turns/route';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const EXPORT = path.join(ROOT, 'apps/web/public/patient');

/**
 * The real apps/mobile/src/samples.ts, transpiled here: Vite cannot load it directly (its tsconfig extends
 * expo/tsconfig.base, which Vite's tsconfig loader does not resolve). It may import only @medx/shared.
 */
function loadSamples(): typeof import('../../mobile/src/samples') {
  const src = readFileSync(path.join(ROOT, 'apps/mobile/src/samples.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => { if (id === '@medx/shared') return shared; throw new Error(`samples.ts may import only @medx/shared, got ${id}`); };
  new Function('require', 'module', 'exports', js)(req, mod, mod.exports);
  return mod.exports as unknown as typeof import('../../mobile/src/samples');
}
const { findSample, parseLaunch, samplesFor } = loadSamples();

/** Same algorithm as scripts/build-patient-web.sh (see the comment there). */
function sourceSha(): string {
  const walk = (rel: string): string[] => readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.')) return [];
    const p = `${rel}/${e.name}`;
    return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
  });
  const files = ['apps/mobile/src', 'packages/shared/src'].flatMap(walk).sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(`${f}\n`);
    h.update(Buffer.from(readFileSync(path.join(ROOT, f)).toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
    h.update('\n');
  }
  return h.digest('hex');
}

describe('/patient export freshness stamp', () => {
  it('source.sha matches apps/mobile/src + packages/shared/src (CRLF-normalised); otherwise run scripts/build-patient-web.sh', () => {
    const stamp = path.join(EXPORT, 'source.sha');
    expect(existsSync(stamp), 'apps/web/public/patient/source.sha is missing: run bash scripts/build-patient-web.sh').toBe(true);
    expect(readFileSync(stamp, 'utf8').trim(), 'the /patient export is stale: run bash scripts/build-patient-web.sh').toBe(sourceSha());
  });

  it('ignores line endings: the stamp algorithm hashes CRLF and LF copies the same', () => {
    const norm = (s: string) => Buffer.from(Buffer.from(s, 'utf8').toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    expect(norm('a\r\nb ไทย\r\n').equals(norm('a\nb ไทย\n'))).toBe(true);
  });

  it('every bundle index.html loads exists, and the bundles carry the w20 strings and the seenByStaff field', () => {
    const html = readFileSync(path.join(EXPORT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/src="\/patient\/([^"]+\.js)"/g)].map(m => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(existsSync(path.join(EXPORT, s)), s).toBe(true);
    const dir = path.join(EXPORT, '_expo/static/js/web');
    const js = readdirSync(dir).filter(f => f.endsWith('.js')).map(f => readFileSync(path.join(dir, f), 'utf8')).join('\n');
    for (const needle of ['Synthetic data only. Do not enter real patient information.', 'Synthetic example', 'Try saying', 'seenByStaff']) expect(js.includes(needle), `export bundles lack "${needle}": run bash scripts/build-patient-web.sh`).toBe(true);
  });
});

describe('patient deep link and "Try saying" examples (apps/mobile/src/samples.ts)', () => {
  it('/patient/?new=1&lang=it&sample=it01 starts a fresh Italian visit with the IT-01 sentence (not sent)', () => {
    const l = parseLaunch('?new=1&lang=it&sample=it01');
    expect(l.fresh).toBe(true);
    expect(l.lang).toBe('it');
    expect(l.sample?.id).toBe('IT-01');
    expect(l.sample?.text).toBe(DEMO_SAMPLES.find(s => s.id === 'IT-01')!.text);
  });
  it('a sample implies a fresh visit and its own language wins; bad values are ignored', () => {
    expect(parseLaunch('?sample=DEMO-GOLD')).toMatchObject({ fresh: true, lang: 'en', sample: { id: 'DEMO-GOLD' } });
    expect(parseLaunch('?new=1&lang=en&sample=it_01')).toMatchObject({ fresh: true, lang: 'it', sample: { id: 'IT-01' } });
    expect(parseLaunch('?new=1')).toEqual({ fresh: true, lang: null, sample: null });
    expect(parseLaunch('?lang=th')).toEqual({ fresh: false, lang: 'th', sample: null });
    expect(parseLaunch('?lang=xx&sample=nope')).toEqual({ fresh: false, lang: null, sample: null });
    expect(parseLaunch('')).toEqual({ fresh: false, lang: null, sample: null });
    expect(findSample('th05')?.redFlag).toBe(true);
  });
  it('offers only examples written in the visit language, all synthetic', () => {
    expect(samplesFor('en').map(s => s.id)).toEqual(['EN-01', 'EN-02', 'DEMO-GOLD']);
    expect(samplesFor('it').map(s => s.id)).toEqual(['IT-01']);
    expect(samplesFor('th').map(s => [s.id, s.redFlag])).toEqual([['TH-01', false], ['TH-05', true]]);
    // w20: the landing's Thai chip (sample=TH-01) prefills like the English and Italian ones.
    expect(parseLaunch('?new=1&lang=th&sample=TH-01')).toMatchObject({ fresh: true, lang: 'th', sample: { id: 'TH-01', redFlag: false } });
    expect(DEMO_SAMPLES.every(s => s.synthetic)).toBe(true);
  });
});

describe('"Try saying" examples on the mock provider, through the same routes the phone uses', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-samples-'));
    vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json'));
    vi.stubEnv('MODEL_PROVIDER', 'mock');
    vi.stubEnv('DEMO_SEED', '');
  });
  afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

  const headers = { 'content-type': 'application/json', 'x-medx-client': 'patient' };
  async function send(lang: string, text: string) {
    const created = await createRoute(new Request('http://localhost/api/sessions', { method: 'POST', headers, body: JSON.stringify({ patientLang: lang }) }));
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const res = await turnsRoute(new Request(`http://localhost/api/sessions/${id}/turns`, { method: 'POST', headers, body: JSON.stringify({ text, inputMode: 'text', clientTurnId: `sample-${id}` }) }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    return { id, view: await res.json() as { status: string; summary: { redFlags: { severity: string }[] } | null; seenByStaff: boolean } };
  }
  const status = (id: string, key: FieldKey) => getSession(id)!.summary!.fields.find(f => f.key === key)?.status;

  for (const sample of DEMO_SAMPLES.filter(s => s.lang === 'en')) {
    it(`${sample.id} (English chip) reaches awaiting_review with chief complaint and onset supported`, async () => {
      const { id, view } = await send('en', sample.text);
      expect(view.status).toBe('awaiting_review');
      expect(status(id, 'chief_complaint')).toBe('supported');
      expect(status(id, 'onset')).toBe('supported');
      expect(view.seenByStaff).toBe(false);
    });
  }

  it('IT-01 (Italian chip, the deep-link example) reaches awaiting_review with chief complaint and onset supported', async () => {
    const { id, view } = await send('it', findSample('it01')!.text);
    expect(view.status).toBe('awaiting_review');
    expect(status(id, 'chief_complaint')).toBe('supported');
    expect(status(id, 'onset')).toBe('supported');
  });

  it('TH-05 (Thai red-flag chip) escalates: the phone goes to the red-flag screen', async () => {
    const { view } = await send('th', findSample('TH-05')!.text);
    expect(view.status).toBe('escalated');
    expect(view.summary?.redFlags.length).toBeGreaterThan(0);
  });
});
