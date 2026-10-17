// Synthetic-only curl verification against the existing server; no restart or store reset.
// Run: node apps/web/lib/pipeline/__tests__/wave13-smoke.mjs
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const results = [];
function call(path, value, expected = 200) {
  const args = ['-sS', '--max-time', '45', '-w', '\n%{http_code}', `http://localhost:3000${path}`];
  if (value !== undefined) args.push('-H', 'Content-Type: application/json', '-X', 'POST', '--data-binary', JSON.stringify(value));
  const raw = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  const at = raw.lastIndexOf('\n'), status = Number(raw.slice(at + 1));
  const body = JSON.parse(raw.slice(0, at));
  assert.equal(status, expected, `${path}: ${JSON.stringify(body)}`);
  results.push({ path, status });
  return body;
}

call('/api/health');
const s = call('/api/sessions', { patientLang: 'en' }, 201), root = `/api/sessions/${s.id}`;
const normal = { respRate: 16, spo2: 98, onOxygen: false, systolicBP: 120, heartRate: 70, consciousness: 'alert', tempC: 37 };
const cases = [
  ['reported', { heartRate: 118, systolicBP: 92, diastolicBP: 60, respRate: 24, tempC: 39.1, spo2: 93, consciousness: 'alert', painScore: 5 }, 2, 10],
  ['partial high score', { heartRate: 118, systolicBP: 92, respRate: 24, tempC: 38.5 }, 2, 7],
  ['incomplete normal', { heartRate: 70 }, 3, 0],
  ['complete normal', normal, 4, 0],
  ['single band three', { spo2: 88 }, 2, 3],
];
const assessments = [];
for (const [name, values, level, score] of cases) {
  const body = call(`${root}/vitals`, { recordedBy: 'synthetic-w13-nurse', vitals: values });
  assert.equal(body.triage.suggestedLevel, level, name);
  assert.equal(body.triage.warningScore, score, name);
  assert.equal(body.triage.confirmed, undefined);
  assert.equal(Object.hasOwn(body.triage, 'scoreComplete'), false);
  if (name === 'reported') {
    assert.equal(body.triage.vitalAlerts.length, 5);
    assert(body.triage.reasons.some(r => /assumed room air/.test(r.en)));
  }
  if (name === 'partial high score') assert(body.triage.reasons.some(r => /partial score from 5 of 7 parameters/.test(r.en)));
  if (name === 'incomplete normal') assert(body.triage.reasons.some(r => /partial score from 2 of 7 parameters/.test(r.en)));
  assessments.push({ name, ...body.triage });
}
const saved = call(root);
assert.equal(saved.audit.filter(a => a.type === 'vitals_recorded').length, cases.length);
assert.equal(saved.session.vitals.length, cases.length);
console.log(JSON.stringify({ passed: results.length, sessionId: s.id, assertions: 'all passed', assessments, routes: results }, null, 2));
