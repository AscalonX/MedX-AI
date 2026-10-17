import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTurn, createSession } from '../pipeline';
import { medicationAction, medicationOrder } from '../orders';
import { getAudit, getConsultRecord, getSession } from '../store';
import { deriveTrace } from '../trace';
import { GET } from '../../../app/api/sessions/[id]/trace/route';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'medx-trace-')); vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
const run = async (text: string) => { const s = await addTurn(createSession('en').id, text); return s.id; };
const trace = (id: string) => deriveTrace(getSession(id)!, getAudit(id), getConsultRecord(id));
const kinds = (t: ReturnType<typeof trace>) => t.nodes.map(n => n.kind);
const status = (t: ReturnType<typeof trace>, k: string) => t.nodes.filter(n => n.kind === k).map(n => n.status);

describe('case trace', () => {
  it('routine case: model nodes run, verify counts, next question', async () => {
    const t = trace(await run('I have a headache since today.'));
    expect(kinds(t)).toEqual(expect.arrayContaining(['input', 'redact', 'red_flag_rules', 'model_screen', 'extract', 'verify', 'next_question']));
    expect(status(t, 'red_flag_rules')).toEqual(['ok']); expect(status(t, 'model_screen')).toEqual(['ok']);
    expect(t.edges.every(e => t.nodes.some(n => n.id === e.from) && t.nodes.some(n => n.id === e.to))).toBe(true);
  });
  it('red-flag case stops early with model nodes skipped', async () => {
    const t = trace(await run('I have chest pain'));
    expect(status(t, 'red_flag_rules')).toEqual(['escalated']);
    expect(status(t, 'model_screen')).toEqual(['skipped']); expect(status(t, 'extract')).toEqual(['skipped']);
    expect(status(t, 'output')).toEqual(['escalated']); expect(kinds(t)).not.toContain('next_question');
    expect(t.nodes.find(n => n.kind === 'red_flag_rules')!.detail.en).toMatch(/^Fired: /);
  });
  it('abstain case', async () => {
    const id = await run('I have a headache.');
    const { appendAudit } = await import('../store');
    appendAudit(id, 'abstained', 'system', { reason: 'low_confidence' });
    const t = trace(id);
    expect(status(t, 'abstain')).toEqual(['abstained']); expect(t.nodes.find(n => n.kind === 'abstain')!.detail.en).toContain('low_confidence');
  });
  it('orders case branches into med_rules and order_check, pharmacist action hangs off orders', async () => {
    const id = await run('I have a headache. I take warfarin. I am allergic to penicillin.');
    await medicationOrder(id, { orderedBy: 'Dr. Marco Bianchi', drugText: 'ibuprofen', dose: '400 mg', route: 'oral', frequency: 'tid' });
    const o = getSession(id)!.orders!.medications[0];
    await medicationAction(id, o.id, 'submit', { orderedBy: 'Dr. Marco Bianchi', overrides: o.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed with patient' })) });
    await medicationAction(id, o.id, 'pharmacy', { reviewerId: 'Pharmacist Laura Conti', action: 'return', note: 'Check dose' });
    const t = trace(id);
    expect(kinds(t)).toEqual(expect.arrayContaining(['med_rules', 'order_check', 'pharmacist_action']));
    const oc = t.nodes.find(n => n.kind === 'order_check')!;
    expect(oc.detail.en).toMatch(/rules fired: MR-/); expect(t.edges.some(e => e.to === oc.id)).toBe(true);
    expect(kinds(trace(await run('I have a headache.')))).not.toContain('order_check');
  });
  it('is deterministic and the digest tracks the audit', async () => {
    const id = await run('I have a headache since today.');
    const a = trace(id), b = trace(id);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.auditDigest).toMatch(/^[0-9a-f]{64}$/);
    await addTurn(id, 'It is 7/10.');
    expect(trace(id).auditDigest).not.toBe(a.auditDigest);
  });
  it('contains no raw PII', async () => {
    const id = await run('My name is Maria Rossi, phone 081 234 5678, I have chest pain');
    const json = JSON.stringify(trace(id));
    expect(json).not.toMatch(/Maria|Rossi|081|5678/);
  });
  it('route: 200 for known, 404 for unknown', async () => {
    const id = await run('I have a headache.');
    const ok = await GET(new Request('http://localhost/api/x'), { params: Promise.resolve({ id }) });
    expect(ok.status).toBe(200); expect((await ok.json()).sessionId).toBe(id);
    const nf = await GET(new Request('http://localhost/api/x'), { params: Promise.resolve({ id: 'nope' }) });
    expect(nf.status).toBe(404);
  });
});
