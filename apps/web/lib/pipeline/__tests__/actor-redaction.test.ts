// w20 QA regression (qa/03 S13, qa/23 X10): free-text actor ids must never store raw contact details or ids,
// while STAFF names and ids stay exactly as given (w17 P0-1).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAFF } from '@medx/shared';
import { redactActor } from '../redact';
import { investigationOrder, medicationAction, medicationOrder } from '../orders';
import { addTurn, createSession, review, takeover } from '../pipeline';
import { getAudit, getSession } from '../store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-w20-actor-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STRICT_ROLES', '');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const PII = ['0812345678', '081-234-5678', 'somchai@example.com', '1-2345-67890-12-3'];
const dirty = 'Somchai call 081-234-5678 mail somchai@example.com id 1-2345-67890-12-3';
const stored = (id: string) => JSON.stringify(getSession(id)) + JSON.stringify(getAudit(id));

describe('redactActor', () => {
  it.each(STAFF.flatMap(s => [s.name, s.id, s.name.toUpperCase(), `  ${s.name}  `]))('keeps STAFF identity %s', actor => {
    expect(redactActor(actor)).toBe(actor.trim());
  });
  it('redacts contact details and ids in any other actor string', () => {
    const out = redactActor(dirty);
    for (const p of PII) expect(out).not.toContain(p);
    expect(out).toContain('[PHONE_1]'); expect(out).toContain('[EMAIL_1]');
  });
  it('keeps plain synthetic reviewer ids unchanged', () => {
    for (const actor of ['dr-qa', 'pharm-qa', 'synthetic-dr', 'nurse-1', 'Pharmacist Third Person']) expect(redactActor(actor)).toBe(actor);
  });
});

describe('free-text actors are redacted before storage on every write path', () => {
  it('review, takeover, orders and pharmacy actions store no raw PII from the actor', async () => {
    const s = await addTurn(createSession('en').id, 'Headache since yesterday 7/10. I am 45 years old.');
    await review(s.id, 'Dr Somchai 0812345678', [{ fieldKey: 'chief_complaint', action: 'approve' }]);
    await investigationOrder(s.id, { orderedBy: dirty, code: 'fbc' });
    const drafted = await medicationOrder(s.id, { orderedBy: dirty, drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours' });
    const order = drafted.orders!.medications.at(-1)!;
    await medicationAction(s.id, order.id, 'submit', { orderedBy: dirty, overrides: order.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: 'Reviewed synthetic case' })) });
    await medicationAction(s.id, order.id, 'pharmacy', { reviewerId: dirty, action: 'return', note: 'Please check the dose' });
    const other = await addTurn(createSession('en').id, 'Sore throat since today.');
    await takeover(other.id, dirty, 'Needs a human');
    for (const p of PII) { expect(stored(s.id)).not.toContain(p); expect(stored(other.id)).not.toContain(p); }
  });
  it('STAFF actors are stored verbatim', async () => {
    const s = await addTurn(createSession('en').id, 'Headache since yesterday 7/10. I am 45 years old.');
    const out = await medicationOrder(s.id, { orderedBy: 'Dr. Somchai Chaiyo', drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours' });
    expect(out.orders!.medications.at(-1)!.orderedBy).toBe('Dr. Somchai Chaiyo');
    expect(getAudit(s.id).at(-1)!.actorId).toBe('Dr. Somchai Chaiyo');
  });
});
