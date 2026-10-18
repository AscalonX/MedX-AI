// w20 QA (qa/08 I-audit): a patient turn that sends a verified order back for a re-check must keep the append-only
// audit log chronological; the order_recheck event used to carry a timestamp earlier than the turn's own events.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { medicationAction, medicationOrder } from '../orders';
import { addTurn, createSession } from '../pipeline';
import { getAudit, getSession } from '../store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-audit-order-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const doctor = 'Dr. Marco Bianchi', ph1 = 'Pharmacist Laura Conti';

describe('audit log stays chronological across a re-check', () => {
  it('a turn that raises a new high alert on a verified order appends order_recheck after its own events, never earlier', async () => {
    const s = await addTurn(createSession('en').id, 'I have a sore throat since yesterday, 5 out of 10. I am 30 years old. No allergies. I take no medicines.');
    const drafted = await medicationOrder(s.id, { orderedBy: doctor, drugText: 'clarithromycin', dose: '500 mg', route: 'oral', frequency: 'twice daily', duration: '5 days' });
    const order = drafted.orders!.medications.at(-1)!;
    await medicationAction(s.id, order.id, 'submit', { orderedBy: doctor, overrides: order.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed synthetic case' })) });
    await medicationAction(s.id, order.id, 'pharmacy', { reviewerId: ph1, action: 'verify' });
    await addTurn(s.id, 'Sorry, I forgot: I am allergic to clarithromycin, it gave me a rash.');
    const o = getSession(s.id)!.orders!.medications.find(x => x.id === order.id)!;
    expect(o.status).toBe('submitted'); expect(o.recheck?.reason).toBe('new_high_alert');
    const audit = getAudit(s.id);
    expect(audit.some(e => e.type === 'order_recheck')).toBe(true);
    for (let i = 1; i < audit.length; i++) expect(audit[i].at >= audit[i - 1].at, `${audit[i - 1].type} -> ${audit[i].type}`).toBe(true);
  });
});
