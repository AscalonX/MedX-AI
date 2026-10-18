// w20 M-04: deterministic demo ids, the golden English case, GET /api/demo/cases and POST /api/demo/start (mock provider).
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PERSONAS, JOURNEY_STAGES, type IntakeSession, type JourneyStage } from '@medx/shared';
import { createSession, demoSessionId } from '../pipeline';
import { dispenseOrder } from '../orders';
import { sessionStage } from '../journey';
import { DEMO_START_LIMIT, demoCaseSession, demoSeedProgress, ensureDemoSeed, PERSONA_CASES, seedDemo, startDemoSeed } from '../seed';
import { appendAudit, getAudit, getConsultRecord, getSession, getSessions } from '../store';
import { deriveTrace } from '../trace';
import { GET as getCases } from '../../../app/api/demo/cases/route';
import { POST as postStart } from '../../../app/api/demo/start/route';
import { POST as postReset } from '../../../app/api/demo/reset/route';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-demo-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
  vi.stubEnv('DEMO_SEED', '1'); vi.stubEnv('DEMO_TOKEN', 'w20-token'); vi.stubEnv('DEMO_AUTOSEED', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });

const ph1 = 'Pharmacist Laura Conti', ph2 = 'Pharmacist Nattaya Wong';
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };
const gold = JSON.parse(readFileSync(new URL('../../../../../data/cases/DEMO-GOLD.json', import.meta.url), 'utf8'));
const expectedId = (caseId: string) => { const h = createHash('sha256').update('medx-demo:' + caseId).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
const start = (stage: unknown, client = 'visitor-1') => postStart(new Request('http://localhost/api/demo/start', { method: 'POST', headers: { 'x-forwarded-for': client }, body: JSON.stringify({ stage }) }));
const reset = () => postReset(new Request('http://localhost/api/demo/reset', { method: 'POST', headers: { 'x-demo-token': 'w20-token' } }));
const types = (id: string) => getAudit(id).map(e => e.type);

describe('(a) deterministic demo ids', () => {
  it('derives a seeded id from sha256("medx-demo:" + demoCaseId); two resets give the same EN-05 id', async () => {
    expect(demoSessionId('EN-05')).toBe(expectedId('EN-05'));
    expect((await reset()).status).toBe(200);
    const first = demoCaseSession('EN-05')!; expect(first.id).toBe(expectedId('EN-05'));
    expect((await reset()).status).toBe(200);
    const second = demoCaseSession('EN-05')!; expect(second.id).toBe(first.id);
    // A fresh record, not a reused one: the audit was rebuilt by the second reset.
    expect(getAudit(second.id).filter(e => e.type === 'session_created')).toHaveLength(1);
    for (const s of getSessions()) expect(s.id).toBe(expectedId(String(getAudit(s.id)[0].payload.demoCaseId)));
  });
  it('patient-created sessions stay random and never carry a demo case id', () => {
    const a = createSession('en'), b = createSession('en');
    expect(a.id).not.toBe(b.id); expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getAudit(a.id)[0].payload).toEqual({ patientLang: 'en' });
  });
  it('a deterministic id never silently replaces an existing record', () => {
    createSession('en', { demoCaseId: 'EN-05' });
    expect(() => createSession('en', { demoCaseId: 'EN-05' })).toThrow(/already exists/);
  });
});

describe('(b) seeded pharmacy-stage cases follow the whole visit', () => {
  it('EN-01, IT-01 and MED-01 have vitals, confirmed triage, a nurse consult turn and a signed doctor note before the medication order', async () => {
    const result = await seedDemo();
    expect(result.mismatches).toEqual([]); expect(result.stageMismatches).toEqual([]);
    const expected: Record<string, JourneyStage> = { 'EN-01': 'ready_for_pickup', 'IT-01': 'pharmacy_dispense', 'MED-01': 'pharmacy_verify' };
    for (const [caseId, stage] of Object.entries(expected)) {
      const s = demoCaseSession(caseId)!; const audit = getAudit(s.id);
      expect(sessionStage(s)).toBe(stage);
      expect(s.vitals?.length).toBeGreaterThan(0); expect(s.triage?.confirmed).toBeDefined();
      expect(getConsultRecord(s.id).notes.doctor?.signed).toBeDefined();
      const firstOrder = audit.findIndex(e => e.type === 'order_drafted');
      const at = (pred: (e: (typeof audit)[number]) => boolean) => audit.findIndex(pred);
      for (const idx of [at(e => e.type === 'vitals_recorded'), at(e => e.type === 'triage_confirmed'), at(e => e.type === 'consult_turn' && e.payload.mode === 'nurse'), at(e => e.type === 'consult_note_signed')]) {
        expect(idx).toBeGreaterThanOrEqual(0); expect(idx).toBeLessThan(firstOrder);
      }
      expect(s.turns.some(t => t.role === 'clinician')).toBe(true);
    }
    // No case waits for pickup while its intake still waits for review.
    for (const s of getSessions()) if (['ready_for_pickup', 'collected'].includes(sessionStage(s))) expect(s.status).not.toBe('awaiting_review');
    expect(demoCaseSession('EN-01')!.status).toBe('approved');
  });
});

describe('(c) DEMO-GOLD golden English case', () => {
  it('is a synthetic uncomplicated sore throat (white spots on the tonsils) with a penicillin rash allergy; no quinsy features', () => {
    expect(gold).toMatchObject({ id: 'DEMO-GOLD', lang: 'en', synthetic: true });
    const text: string = gold.turns[0].text;
    for (const part of ['sore throat', 'white spots on my tonsils', 'allergic to penicillin', 'rash']) expect(text).toContain(part);
    // w20 (claims-safety): a quinsy picture must not end in oral antibiotics and a trip home (NICE NG84 says refer).
    for (const part of ['one side', "can't open my mouth", 'trismus', 'drool', 'muffled']) expect(text).not.toContain(part);
    expect(gold.gold.consultConsiderations).toEqual(['CR-THROAT-05-C1']);
    expect(gold.demo.doctor.keepConsiderations).toEqual(['consider:CR-THROAT-05:CR-THROAT-05-C1']);
  });
  it('runs through the real pipeline with red-flag rules first, and is seeded at nurse-, doctor- and pharmacist-1-ready', async () => {
    await seedDemo();
    const stages: Record<string, JourneyStage> = { 'DEMO-GOLD:intake': 'intake', 'DEMO-GOLD:nurse_done': 'nurse_done', 'DEMO-GOLD:pharmacy_verify': 'pharmacy_verify' };
    for (const [caseId, stage] of Object.entries(stages)) {
      const s = demoCaseSession(caseId)!;
      expect(s.id).toBe(expectedId(caseId)); expect(sessionStage(s)).toBe(stage); expect(s.patientLang).toBe('en');
      expect(s.summary!.redFlags).toEqual([]); expect(s.summary!.modelCalls.length).toBeGreaterThan(0);
      const nodes = deriveTrace(s, getAudit(s.id)).nodes.map(n => n.kind);
      expect(nodes.indexOf('red_flag_rules')).toBeGreaterThanOrEqual(0); expect(nodes.indexOf('red_flag_rules')).toBeLessThan(nodes.indexOf('extract'));
    }
    expect(demoCaseSession('DEMO-GOLD:intake')!.status).toBe('awaiting_review');
    const doctorReady = demoCaseSession('DEMO-GOLD:nurse_done')!;
    expect(doctorReady.status).toBe('approved'); expect(doctorReady.triage?.confirmed?.by).toBe('Nurse Anna Rossi');
    // FeverPAIN prompt from the curated consult rules (doctor mode), never the quinsy one; MR-ALLERGY-PEN on the amoxicillin order.
    const pharmacist1 = demoCaseSession('DEMO-GOLD:pharmacy_verify')!;
    const consider = getConsultRecord(pharmacist1.id).suggestions.find(x => x.id === 'consider:CR-THROAT-05:CR-THROAT-05-C1');
    expect(consider).toMatchObject({ kind: 'consider', source: 'rule', status: 'asked' }); // kept by the doctor
    expect(getConsultRecord(doctorReady.id).suggestions.some(x => x.id === 'consider:CR-THROAT-05:CR-THROAT-05-C1')).toBe(true);
    for (const s of [pharmacist1, doctorReady]) expect(getConsultRecord(s.id).suggestions.some(x => x.id.includes('CR-THROAT-03'))).toBe(false);
    expect(getConsultRecord(pharmacist1.id).notes.doctor!.lines.some(l => l.section === 'considerations' && /tonsillitis/i.test(l.text.en))).toBe(true);
    const o = pharmacist1.orders!.medications[0];
    expect(o).toMatchObject({ status: 'submitted', generic: 'amoxicillin', orderedBy: 'Dr. Marco Bianchi' });
    const pen = o.checks.find(c => c.ruleId === 'MR-ALLERGY-PEN')!;
    expect(pen.severity).toBe('high'); expect(o.overrides.map(x => x.alertId)).toContain(pen.id);
    expect(getConsultRecord(pharmacist1.id).notes.doctor!.signed!.reviewerId).toBe('Dr. Marco Bianchi');
    // No bloods for an uncomplicated sore throat: the quinsy workup (FBC, CRP) went with the quinsy picture; a throat swab.
    expect(pharmacist1.orders!.investigations.map(i => i.code)).toEqual(['throat_swab']);
  });
});

describe('(d) GET /api/demo/cases', () => {
  it('maps every persona to its seeded case with id, code, status and stage when DEMO_SEED=1', async () => {
    await seedDemo();
    const r = await getCases(new Request('http://localhost/api/demo/cases')); expect(r.status).toBe(200);
    const body = await r.json();
    expect(Object.keys(body)).toEqual(DEMO_PERSONAS.map(p => p.id));
    for (const p of DEMO_PERSONAS) {
      expect(Object.keys(body[p.id]).sort()).toEqual(['code', 'id', 'stage', 'status']);
      expect(body[p.id].id).toBe(expectedId(PERSONA_CASES[p.id]));
      expect(body[p.id].stage).toBe(p.stage);
      expect(body[p.id].code).toBe(getSession(body[p.id].id)!.code);
    }
    // The patient's phone and the nurse's queue show one record.
    expect(body.patient.id).toBe(body['nurse-rossi'].id);
  });
  it('is 404 when DEMO_SEED is unset, and null per persona before any seed', async () => {
    vi.stubEnv('DEMO_SEED', '');
    expect((await getCases(new Request('http://localhost/api/demo/cases'))).status).toBe(404);
    vi.stubEnv('DEMO_SEED', '1');
    const body = await (await getCases(new Request('http://localhost/api/demo/cases'))).json();
    expect(Object.values(body).every(v => v === null)).toBe(true);
  });
  it('auto-seeds the missing persona cases when DEMO_AUTOSEED=1, even beside visitor sessions', async () => {
    vi.stubEnv('DEMO_AUTOSEED', '1');
    createSession('en'); // a visitor's session already exists
    const body = await (await getCases(new Request('http://localhost/api/demo/cases'))).json();
    expect(body['pharm-conti'].stage).toBe('pharmacy_verify');
    expect(Object.values(body).every(v => v !== null)).toBe(true);
  });
});

describe('(e) POST /api/demo/start', () => {
  it.each(JOURNEY_STAGES)('creates a new golden session at %s through the real pipeline', async stage => {
    const r = await start(stage); expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ id: expect.any(String), code: expect.stringMatching(/^B-\d{3}$/), stage });
    const s = getSession(body.id)!;
    expect(sessionStage(s)).toBe(stage);
    expect(s.turns[0]).toMatchObject({ role: 'patient', text: gold.turns[0].text });
    expect(getAudit(s.id)[0]).toMatchObject({ type: 'session_created', payload: { demoStart: stage } });
    expect(Object.values(PERSONA_CASES).map(expectedId)).not.toContain(s.id);
    expect(types(s.id)).toContain('turn_added');
    if (stage === 'collected') for (const t of ['review', 'vitals_recorded', 'triage_confirmed', 'consult_turn', 'consult_note_signed', 'order_drafted', 'order_submitted', 'order_pharmacy_action', 'order_dispensed', 'pickup_called', 'pickup_collected'] as const) expect(types(s.id)).toContain(t);
  });
  it('pharmacy_dispense: verified by Laura Conti, so Nattaya Wong can dispense and Laura is blocked by the two-person check', async () => {
    const { id } = await (await start('pharmacy_dispense')).json();
    const s = getSession(id)!; const o = s.orders!.medications[0];
    // Golden journey: pharmacist 1 returned amoxicillin with an option for prescriber review; the doctor re-ordered.
    expect(o).toMatchObject({ status: 'verified', generic: 'clarithromycin', pharmacist: { action: 'verify', by: ph1 } });
    expect(getAudit(id).filter(e => e.type === 'order_pharmacy_action').map(e => e.payload.action)).toEqual(['return', 'verify']);
    expect(getAudit(id).find(e => e.payload.action === 'return')!.payload.report).toEqual({ alertIds: [expect.stringMatching(/^MR-ALLERGY-PEN-/)], suggestedGenerics: ['clarithromycin'] });
    await expect(dispenseOrder(id, o.id, { reviewerId: ph1, checklist: ALL })).rejects.toMatchObject({ status: 409 });
    expect((await dispenseOrder(id, o.id, { reviewerId: ph2, checklist: ALL })).orders!.medications[0].status).toBe('dispensed');
  });
  it('returns 429 once the demo-start cap is reached', async () => {
    for (let i = 0; i < DEMO_START_LIMIT - 1; i++) appendAudit(`synthetic-${i}`, 'session_created', 'patient', { patientLang: 'en', demoStart: 'intake' });
    expect((await start('intake', 'visitor-a')).status).toBe(200); // the 150th
    const refused = await start('intake', 'visitor-b');
    expect(refused.status).toBe(429); expect((await refused.json()).error).toMatch(/limit/i);
    expect(getAudit().filter(e => e.type === 'session_created' && e.payload.demoStart)).toHaveLength(DEMO_START_LIMIT);
  });
  it('limits one client per window, rejects unknown stages and bodies, and is 404 without DEMO_SEED', async () => {
    const bad = await start('everything'); expect(bad.status).toBe(400); expect((await bad.json()).error).toContain('intake');
    expect((await postStart(new Request('http://localhost/api/demo/start', { method: 'POST', body: JSON.stringify({ stage: 'intake', id: 'x' }) }))).status).toBe(400);
    let last = 200;
    for (let i = 0; i < 21 && last === 200; i++) last = (await start('intake', 'one-busy-client')).status;
    expect(last).toBe(429);
    expect((await start('intake', 'another-client')).status).toBe(200);
    vi.stubEnv('DEMO_SEED', '');
    expect((await start('intake', 'third-client')).status).toBe(404);
  });
});

describe('(f) ensureDemoSeed', () => {
  it('logs a failed auto-seed with console.error and keeps serving', async () => {
    vi.stubEnv('DEMO_AUTOSEED', '1');
    // A store path under a regular file cannot be written: the seed fails on the first save.
    writeFileSync(path.join(dir, 'blocker'), 'x');
    vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'blocker', 'store.json'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(ensureDemoSeed()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('[medx] demo auto-seed failed', expect.any(Error));
  });
});

describe('(g) long demo routes', () => {
  it('demo/reset and dev/seed export maxDuration = 300 and pass next/server after to startDemoSeed', async () => {
    vi.resetModules();
    const after = vi.fn();
    const startSpy = vi.fn(() => ({ id: 'job', status: 'running', progressUrl: '/api/dev/seed' }));
    vi.doMock('next/server', () => ({ after }));
    vi.doMock('../seed', () => ({ startDemoSeed: startSpy, seedDemo: vi.fn(), demoSeedProgress: vi.fn() }));
    try {
      vi.stubEnv('MODEL_PROVIDER', 'amd');
      const resetRoute = await import('../../../app/api/demo/reset/route');
      const seedRoute = await import('../../../app/api/dev/seed/route');
      expect(resetRoute.maxDuration).toBe(300); expect(seedRoute.maxDuration).toBe(300);
      const headers = { 'x-demo-token': 'w20-token' };
      expect((await resetRoute.POST(new Request('http://localhost/api/demo/reset', { method: 'POST', headers }))).status).toBe(202);
      expect((await seedRoute.POST(new Request('http://localhost/api/dev/seed', { method: 'POST', headers }))).status).toBe(202);
      expect(startSpy).toHaveBeenNthCalledWith(1, { reset: true }, after);
      expect(startSpy).toHaveBeenNthCalledWith(2, {}, after);
    } finally { vi.doUnmock('next/server'); vi.doUnmock('../seed'); vi.resetModules(); }
  });
  it('startDemoSeed hands its task to keepAlive, and survives a keepAlive that throws outside a request scope', async () => {
    const keep = vi.fn();
    startDemoSeed({ reset: true }, keep);
    expect(keep).toHaveBeenCalledWith(expect.any(Promise));
    await keep.mock.calls[0][0];
    expect(demoSeedProgress()).toMatchObject({ status: 'done', completed: 14 });
    const outside = () => { throw new Error('`after` was called outside a request scope'); };
    expect(startDemoSeed({ reset: true }, outside)).toMatchObject({ status: 'running' });
    // The task still runs in this process; wait for it so it cannot touch the next test's store.
    await vi.waitFor(() => expect(demoSeedProgress()).toMatchObject({ status: 'done', completed: 14 }), { timeout: 20000, interval: 20 });
  });
  it('the long engine routes export maxDuration = 60; demo/start replays a whole intake on the real model (180)', async () => {
    const routes = await Promise.all([
      import('../../../app/api/sessions/[id]/turns/route'), import('../../../app/api/sessions/[id]/consult/route'),
      import('../../../app/api/sessions/[id]/consult/turns/route'), import('../../../app/api/sessions/[id]/consult/note/route'),
      import('../../../app/api/sessions/[id]/orders/medications/route'),
    ]);
    for (const r of routes) expect(r.maxDuration).toBe(60);
    expect((await import('../../../app/api/demo/start/route')).maxDuration).toBe(180);
  });
});

describe('demo cases stay synthetic', () => {
  it('golden and demo-start sessions carry only the synthetic fixture text plus named demo staff speech', async () => {
    await seedDemo(); const { id } = await (await start('collected')).json();
    const golden: IntakeSession[] = [...['DEMO-GOLD:intake', 'DEMO-GOLD:nurse_done', 'DEMO-GOLD:pharmacy_verify'].map(c => demoCaseSession(c)!), getSession(id)!];
    expect(getSessions()).toHaveLength(15);
    for (const s of golden) {
      expect(s.turns.filter(t => t.role === 'patient').map(t => t.text)).toEqual([gold.turns[0].text]);
      for (const t of s.turns.filter(t => t.role === 'clinician')) expect(t.text).toBe(gold.demo.nurse.consultLine);
    }
  });
});
