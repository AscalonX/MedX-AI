// Synthetic-only probes against the existing server. No reset, restart or model reconfiguration.
// node apps/web/lib/pipeline/__tests__/wave15-live.mjs [base-url]
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://localhost:3000';
let calls = 0;
function curl(path, value, expected = 200, patient = false) {
  const args = ['-sS', '--max-time', '45', '-w', '\n%{http_code}', base + path];
  if (value !== undefined) args.push('-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(value));
  if (patient) args.push('-H', 'x-medx-client: patient');
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  calls++;
  const at = out.lastIndexOf('\n'), status = Number(out.slice(at + 1));
  assert.equal(status, expected, `${path}: ${out.slice(0, 500)}`);
  return JSON.parse(out.slice(0, at));
}
function session(text) {
  const s = curl('/api/sessions', { patientLang: 'en' }, 201);
  return text ? curl(`/api/sessions/${s.id}/turns`, { text }) : s;
}
const dr = 'synthetic-w15-dr', nurse = 'synthetic-w15-nurse';
const draft = { orderedBy: dr, drugText: 'paracetamol', dose: '1500 mg', route: 'oral', frequency: 'daily' };
const note = (id, action, edits) => curl(`/api/sessions/${id}/consult/note`, { reviewerId: dr, mode: 'doctor', action, ...(edits ? { edits } : {}) });
const health = curl('/api/health');
console.log(`provider=${health.provider}; existing server=${base}`);

for (const text of ['Consider aspirin 300 mg for clinician review', 'Consider morphine 5 mg IV for clinician review', 'Consider giving aspirin for clinician review', 'Consider nitroglycerin spray for clinician review']) {
  const s = session(text), state = curl(`/api/sessions/${s.id}/consult?mode=doctor`);
  assert(!state.suggestions.some(x => x.source === 'model' && x.kind === 'consider'));
}
console.log('MF-1 PASS: four reviewer sentences through live consult; no model considerations. Adversarial provider-output rejection is covered by unit tests, not injectable through this mock API.');

{
  const s = session('Fever and sore throat.'), path = `/api/sessions/${s.id}`;
  curl(`${path}/consult?mode=doctor`);
  // Draft sees all rules, including considerations outside the displayed top three.
  const first = note(s.id, 'draft');
  const sepsis = first.note.lines.find(l => l.section === 'considerations' && /sepsis/i.test(l.text.en)); assert(sepsis);
  curl(`${path}/consult/suggestions/${encodeURIComponent(sepsis.id.slice('suggestion:'.length))}`, { reviewerId: dr, status: 'dismissed' });
  const q = first.note.lines.find(l => l.section === 'open_questions' && l.id.startsWith('suggestion:')); assert(q);
  curl(`${path}/consult/suggestions/${encodeURIComponent(q.id.slice('suggestion:'.length))}`, { reviewerId: dr, status: 'dismissed' });
  const d = note(s.id, 'draft'); assert(!d.note.lines.some(l => l.id === sepsis.id));
  assert.match(d.note.lines.find(l => l.id === q.id).text.en, /^Not asked \(dismissed\)/);
  const keep = d.note.lines.find(l => l.section === 'considerations'); assert(keep);
  const signed = note(s.id, 'sign', [{ lineId: keep.id, text: keep.text.en }]);
  assert.deepEqual(signed.note.lines.filter(l => l.section === 'considerations').map(l => l.id), [keep.id]);
  assert.deepEqual(curl(path).audit.at(-1).payload.keptConsiderationIds, [keep.id]);
  const s2 = session('Fever and sore throat.'); note(s2.id, 'draft');
  assert(!note(s2.id, 'sign').note.lines.some(l => l.section === 'considerations'));
  console.log('MF-2 PASS: dismissed sepsis absent; dismissed question retained; only explicitly kept line signed; no edits drops all considerations; audit records kept IDs.');
}
{
  const s = session(), path = `/api/sessions/${s.id}`;
  const normal = { heartRate: 70, systolicBP: 120, respRate: 16, tempC: 37, spo2: 98, consciousness: 'alert', onOxygen: false };
  curl(`${path}/vitals`, { recordedBy: nurse, vitals: normal });
  curl(`${path}/triage/confirm`, { reviewerId: nurse, level: 4 });
  const worse = curl(`${path}/vitals`, { recordedBy: nurse, vitals: { heartRate: 130, systolicBP: 88, respRate: 28, tempC: 39.2, spo2: 89, consciousness: 'new_confusion' } });
  assert.equal(worse.triage.warningScore, 16); assert.equal(worse.triage.suggestedLevel, 2);
  assert(worse.triage.reasons.some(r => /re-confirm/.test(r.en)));
  const partial = curl(`${path}/vitals`, { recordedBy: nurse, vitals: { tempC: 37.5 } });
  assert.equal(partial.triage.suggestedLevel, 2); assert.equal(partial.triage.warningScore, 14);
  assert.equal(partial.triage.vitalSources.spo2.entryId, worse.vitals.at(-1).id);
  assert.equal(partial.triage.vitalSources.tempC.entryId, partial.vitals.at(-1).id);
  const confirmed = curl(`${path}/triage/confirm`, { reviewerId: nurse, level: 2 });
  assert.equal(confirmed.triage.confirmed.level, 2); assert(!confirmed.triage.reasons.some(r => /re-confirm/.test(r.en)));
  assert.equal(curl(path).audit.filter(a => a.type === 'triage_confirmed').length, 2);
  console.log('MF-4 PASS: localized re-confirm reason; second confirmation clears warning; both confirmations audited.');
  console.log('MF-5 PASS: NEWS2 16 → temperature-only NEWS2 14, level 2 retained; parameter source entry IDs preserved.');
}
for (const [drugText, dose, frequency] of [['methotrexate', '10 mg', 'daily'], ['warfarin', '50 mg', 'daily'], ['ibuprofen', '800 mg x2', 'tid'], ['paracetamol', '1000 mg', 'every 4-6 hours prn'], ['insulin', '100 units', 'tid']]) {
  const s = session(), result = curl(`/api/sessions/${s.id}/orders/medications`, { ...draft, drugText, dose, frequency });
  const checks = result.orders.medications[0].checks;
  assert.equal(checks.filter(a => a.ruleId === 'MR-DOSE-UNCHECKED' && a.severity === 'moderate').length, 1);
  if (drugText === 'methotrexate') assert(checks.some(a => a.ruleId === 'MR-METHOTREXATE-DAILY' && a.severity === 'high'));
}
console.log('MF-6 PASS: all five reviewer orders get exactly one unchecked alert; daily methotrexate also gets high weekly-dosing caution.');
{
  const s = session(), result = curl(`/api/sessions/${s.id}/orders/medications`, { ...draft, drugText: 'amoxicillin', dose: '1 g', frequency: 'tid' });
  assert(result.orders.medications[0].checks.some(a => a.ruleId === 'MR-ALLERGY-UNKNOWN' && a.severity === 'moderate'));
  console.log('MF-7 PASS: amoxicillin 1 g tid with unrecorded allergies flags ask before prescribing.');
}
{
  const s = session(), path = `/api/sessions/${s.id}`, result = curl(`${path}/orders/medications`, draft), o = result.orders.medications[0];
  const alertId = o.checks.find(a => a.severity === 'high').id;
  for (const reason of ['.', '.....', 'a!b?c.d', '😀😀😀😀😀']) curl(`${path}/orders/medications/${o.id}/submit`, { orderedBy: dr, overrides: [{ alertId, reason }] }, 400);
  curl(`${path}/orders/medications/${o.id}/submit`, { orderedBy: dr, overrides: [{ alertId, reason: 'Synthetic clinician review' }] });
  assert.equal(curl(path).audit.at(-1).type, 'order_submitted');
  console.log('MF-8 PASS: punctuation, whitespace-equivalent and emoji rationales rejected HTTP 400; substantive reason submits with audit.');
}
{
  const s = session('Chest pain and I feel sweaty'), path = `/api/sessions/${s.id}`;
  curl(`${path}/review`, { reviewerId: dr, actions: [], redFlagActions: s.summary.redFlags.map(f => ({ ruleId: f.ruleId, action: 'acknowledge' })) });
  const d = note(s.id, 'draft'), flag = d.note.lines.find(l => l.section === 'red_flags'); assert(flag);
  curl(`${path}/consult/note`, { reviewerId: dr, mode: 'doctor', action: 'sign', edits: [{ lineId: flag.id, text: 'No flags' }] }, 400);
  const get = curl(`${path}?view=patient`); assert.deepEqual(Object.keys(get), ['session']);
  assert.deepEqual(Object.keys(get.session).sort(), ['code', 'id', 'patientLang', 'status', 'summary', 'turns']);
  assert.deepEqual(Object.keys(get.session.summary).sort(), ['abstained', 'nextQuestion', 'redFlags']);
  assert(get.session.turns.every(t => t.role === 'patient'));
  for (const f of get.session.summary.redFlags) assert.deepEqual(Object.keys(f).sort(), ['patientMessage', 'severity']);
  const another = session();
  const post = curl(`/api/sessions/${another.id}/turns`, { text: 'Fever. My phone is 0812345678.' }, 200, true);
  assert(!JSON.stringify(post).includes('0812345678')); assert(!('orders' in post)); assert(!('audit' in post));
  console.log('SHOULD-FIX PASS: red-flag edits HTTP 400; patient GET/POST allowlists omit clinical state/audit and redact phone.');
}
console.log(`PASS: ${calls} live curl requests; synthetic sessions retained; no reset/restart.`);
