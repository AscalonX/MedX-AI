// Clinician edits/approvals must survive later patient turns; conflicts flagged; rejected values do not silently return.
import { req, check, done, newSession, turn, getS } from './lib.mjs';
const REV = (id, actions) => req('POST', `/api/sessions/${id}/review`, { reviewerId: 'dr-q', actions });
const F = (r, k) => (r.json?.summary || r.summary).fields.find(f => f.key === k);
let s = await newSession('en'); let r = await turn(s.id, 'I have a headache since yesterday, 7/10, I am 45 years old');
const rv = await REV(s.id, [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'migraine (clinician)' }, { fieldKey: 'age', action: 'approve' }]); check('V00', 'setup review accepted', rv.status === 200, rv.text.slice(0, 150));
r = await turn(s.id, 'I also have nausea and vomiting');
check('V01', 'edited value survives later patient turn', F(r, 'chief_complaint').status === 'edited' && F(r, 'chief_complaint').value.en === 'migraine (clinician)', F(r, 'chief_complaint'));
check('V02', 'approved value survives later patient turn', F(r, 'age').status === 'approved', F(r, 'age').status);
r = await REV(s.id, [{ fieldKey: 'onset', action: 'reject' }]);
check('V03', 'reject -> field missing', F(r, 'onset').status === 'missing' && F(r, 'onset').value === null, F(r, 'onset'));
r = await turn(s.id, 'my stomach also hurts');
check('V04', 'rejected value does not silently come back as supported on unrelated turn', F(r, 'onset').status !== 'supported', F(r, 'onset'));
// conflict: approved "no allergies" then patient says allergic
s = await newSession('en'); r = await turn(s.id, 'Headache since yesterday 7/10, I am 45, I have no allergies');
const al = F(r, 'allergies'); console.log('   (setup) allergies:', al.status, al.value?.en);
if (al.value) {
  await REV(s.id, [{ fieldKey: 'allergies', action: 'approve' }]);
  r = await turn(s.id, 'Actually I am allergic to penicillin');
  const a2 = F(r, 'allergies');
  check('V05', 'approved "no allergies" + later "allergic to penicillin": conflict surfaced (not silently kept approved)', a2.status !== 'approved' || (a2.reviewMemory?.flags || []).includes('conflict') || /penicillin/i.test(JSON.stringify(r.json.summary.allergies || [])), [a2.status, a2.value?.en, a2.reviewMemory, r.json.summary.allergies]);
  check('V05b', 'penicillin allergy appears in summary.allergies list for pharmacist', (r.json.summary.allergies || []).some(a => a.allergenClass === 'penicillin'), r.json.summary.allergies);
  check('V05c', 'status returned to awaiting_review (clinician must re-confirm)', ['awaiting_review', 'collecting'].includes(r.json.status), r.json.status);
}
done();
