// Synthetic-only live curl checks. Uses the existing server without a restart/store reset.
// Run: node apps/web/lib/pipeline/__tests__/wave14-smoke.mjs
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const results = [];
function call(path, value, expected = 200) {
  const args = ['-sS', '--max-time', '45', '-w', '\n%{http_code}', `http://localhost:3000${path}`];
  if (value !== undefined) args.push('-H', 'Content-Type: application/json', '-X', 'POST', '--data-binary', JSON.stringify(value));
  const raw = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  const at = raw.lastIndexOf('\n'), status = Number(raw.slice(at + 1)), body = JSON.parse(raw.slice(0, at));
  assert.equal(status, expected, `${path}: ${JSON.stringify(body)}`);
  results.push({ path, status });
  return body;
}

call('/api/health');
const allergySession = call('/api/sessions', { patientLang: 'en' }, 201);
const allergyRoot = `/api/sessions/${allergySession.id}`;
call(`${allergyRoot}/turns`, { text: 'I take amoxicillin. I am allergic to penicillin.' });
const patient = call(allergyRoot).session;
const allergy = patient.summary.allergies.find(a => a.allergenClass === 'penicillin');
const med = patient.summary.medications.find(m => m.generic === 'amoxicillin');
assert(allergy?.evidence.length > 0);
assert(med?.evidence.length > 0);
const summaryAlert = patient.summary.medAlerts.find(a => a.kind === 'allergy_conflict');
for (const e of [...allergy.evidence, ...med.evidence]) assert(summaryAlert.evidence.some(v => JSON.stringify(v) === JSON.stringify(e)));
const draft = { orderedBy: 'synthetic-w14-doctor', drugText: 'amoxicillin', dose: '500 mg', frequency: 'daily', route: 'oral' };
const prescribed = call(`${allergyRoot}/orders/medications`, draft).orders.medications.at(-1);
const allergyAlert = prescribed.checks.find(a => a.kind === 'allergy_conflict');
assert.deepEqual(allergyAlert.evidence, allergy.evidence);
for (const e of allergyAlert.evidence) {
  const turn = patient.turns.find(t => t.id === e.turnId);
  assert.equal(turn.role, 'patient');
  assert.equal(turn.text.slice(e.start, e.end), e.quote);
}

const doseSession = call('/api/sessions', { patientLang: 'en' }, 201);
const root = `/api/sessions/${doseSession.id}`;
const doseDraft = { ...draft, drugText: 'paracetamol', dose: '1500 mg', frequency: 'every 6 hours' };
let o = call(`${root}/orders/medications`, doseDraft).orders.medications[0];
assert.equal(o.checks.length, 1);
const doseAlert = o.checks[0];
assert.equal(doseAlert.kind, 'dose_range'); assert.equal(doseAlert.severity, 'high');
assert(doseAlert.message.en.includes('single dose 1500 mg > 1000 mg'));
assert(doseAlert.message.en.includes('daily dose 6000 mg > 4000 mg'));
// The same order keeps one identity across daily-only, single-only, and both-limit edits.
for (const values of [
  { dose: '1000 mg', frequency: '5 times per day', detail: 'daily dose 5000 mg > 4000 mg', absent: 'single dose' },
  { dose: '1500 mg', frequency: 'daily', detail: 'single dose 1500 mg > 1000 mg', absent: 'daily dose' },
]) {
  o = call(`${root}/orders/medications`, { ...doseDraft, orderId: o.id, dose: values.dose, frequency: values.frequency }).orders.medications[0];
  assert.equal(o.checks.length, 1); assert.equal(o.checks[0].id, doseAlert.id);
  assert(o.checks[0].message.en.includes(values.detail)); assert(!o.checks[0].message.en.includes(values.absent));
}
o = call(`${root}/orders/medications`, { ...doseDraft, orderId: o.id }).orders.medications[0];
assert.equal(o.checks.length, 1); assert.equal(o.checks[0].id, doseAlert.id);
const orderRoot = `${root}/orders/medications/${o.id}`;
call(`${orderRoot}/submit`, { orderedBy: draft.orderedBy, overrides: [] }, 409);
const overrides = [{ alertId: doseAlert.id, reason: 'Synthetic clinician review for Wave 14 regression' }];
o = call(`${orderRoot}/submit`, { orderedBy: draft.orderedBy, overrides }).orders.medications[0];
assert.equal(o.status, 'submitted'); assert.equal(o.overrides.length, 1);
const saved = call(root);
assert(saved.audit.some(a => a.type === 'order_submitted' && a.payload.overrides.length === 1));
assert.equal(saved.session.orders.medications[0].checks.length, 1);
console.log(JSON.stringify({ passed: results.length, sessionIds: [allergySession.id, doseSession.id], allergyEvidence: allergyAlert.evidence, existingMedEvidenceCount: summaryAlert.evidence.length, doseAlert: { id: doseAlert.id, message: doseAlert.message.en }, assertions: 'all passed' }, null, 2));
