// Review / pharmacy / takeover state machine, audit append-only, metrics consistency.
import { req, check, done, newSession, turn, getS, STATUSES } from './lib.mjs';
const REV = (id, actions, extra = {}, who = 'dr-x') => req('POST', `/api/sessions/${id}/review`, { reviewerId: who, actions, ...extra });
const TAKE = (id, who = 'dr-x', reason) => req('POST', `/api/sessions/${id}/takeover`, { reviewerId: who, ...(reason ? { reason } : {}) });
const full = 'Headache since yesterday 7/10. I am 45 years old. I am not pregnant. I have no allergies. I take no medications.';
const approveAll = async id => { const g = await getS(id); return REV(id, g.session.summary.fields.filter(f => ['supported', 'edited', 'approved'].includes(f.status) && f.value).map(f => ({ fieldKey: f.key, action: 'approve' }))); };
let s, r, g;
// fresh session (no summary)
s = await newSession('en');
r = await REV(s.id, [{ fieldKey: 'age', action: 'approve' }]); check('T01', 'review on session without summary -> 400', r.status === 400, [r.status, r.text.slice(0, 100)]);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: [], alertActions: [], complete: true }); check('T02', 'pharmacy-review on session without summary -> 400', r.status === 400, [r.status, r.text.slice(0, 100)]);
// collecting -> partial approve stays awaiting_review/collecting, not approved
s = await newSession('en'); await turn(s.id, 'Headache since yesterday 7/10, I am 45');
g = await getS(s.id); const st0 = g.session.status;
r = await REV(s.id, [{ fieldKey: 'chief_complaint', action: 'approve' }]);
check('T03', `partial approve (1 of required) does not reach approved (was ${st0}, now ${r.json?.status})`, r.status === 200 && r.json.status !== 'approved', [r.status, r.json?.status]);
check('T03b', 'review moved a collecting session to awaiting_review? (status after partial approve is a defined state)', STATUSES.includes(r.json?.status), r.json?.status);
// full approve
s = await newSession('en'); await turn(s.id, full); r = await approveAll(s.id);
check('T04', 'approve all supported required -> approved', r.json?.status === 'approved' && r.json.summary.nextQuestion === null, [r.json?.status]);
const aprId = s.id;
// edit after approved
r = await REV(aprId, [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'migraine' }]);
check('T05', 'edit after approved -> 200 and status remains approved (all required still approved/edited)', r.status === 200 && r.json.status === 'approved', [r.status, r.json?.status]);
r = await REV(aprId, [{ fieldKey: 'chief_complaint', action: 'reject' }]);
check('T06', 'reject a required field after approved -> status leaves approved (re-opens review)', r.status === 200 && r.json.status !== 'approved', [r.status, r.json?.status]);
r = await turn(aprId, 'one more thing'); check('T06b', 'after re-open, turn accepted again (not approved => 200) or 409; never 5xx', [200, 409].includes(r.status), r.status);
// approved then takeover
s = await newSession('en'); await turn(s.id, full); await approveAll(s.id); r = await TAKE(s.id);
check('T07', 'takeover on an APPROVED session is rejected (409) or at least keeps approval record (informational)', r.status === 409 || r.json?.status === 'approved', [r.status, r.json?.status]);
// takeover twice
s = await newSession('en'); await turn(s.id, 'headache since yesterday'); r = await TAKE(s.id, 'dr-a'); const r2 = await TAKE(s.id, 'dr-b'); g = await getS(s.id);
check('T08', 'takeover twice: 200 then 200/409; audit takeover count == number of 200s', [200, 409].includes(r2.status) && g.audit.filter(a => a.type === 'takeover').length === [r, r2].filter(x => x.status === 200).length, [r2.status, g.audit.filter(a => a.type === 'takeover').length]);
check('T08b', 'takeover by second reviewer does not silently re-assign (informational: audit actorIds)', true, g.audit.filter(a => a.type === 'takeover').map(a => a.actorId));
r = await REV(s.id, [{ fieldKey: 'chief_complaint', action: 'approve' }]); check('T09', 'review on taken_over keeps status taken_over', r.status === 200 && r.json.status === 'taken_over', [r.status, r.json?.status]);
r = await turn(s.id, 'x'); check('T09b', 'turn on taken_over -> 409', r.status === 409, r.status);
// takeover from escalated: red flags retained
s = await newSession('en'); await turn(s.id, 'chest pain and sweating'); r = await TAKE(s.id, 'dr-a', 'calling patient');
check('T10', 'takeover of escalated session retains red flags in summary', r.status === 200 && r.json.summary.redFlags.length > 0 && r.json.status === 'taken_over', [r.status, r.json?.status, r.json?.summary?.redFlags?.length]);
check('T10b', 'takeover keeps turns/complaint visible (UX audit: complaint lost)', r.json.turns.length >= 1 && r.json.turns[0].text.includes('chest pain'), r.json.turns.map(t => t.text));
// takeover on session with no summary
s = await newSession('en'); r = await TAKE(s.id); check('T11', 'takeover on brand-new session -> 200 taken_over', r.status === 200 && r.json.status === 'taken_over', [r.status, r.text.slice(0, 100)]);
// edge: duplicate actions in single review
s = await newSession('en'); await turn(s.id, full);
r = await REV(s.id, [{ fieldKey: 'age', action: 'approve' }, { fieldKey: 'age', action: 'reject' }, { fieldKey: 'age', action: 'edit', newValue: '46' }]); check('T12', 'duplicate fieldKey actions in one review -> no 5xx; final state deterministic', r.status < 500, [r.status, r.json?.summary?.fields?.find(f => f.key === 'age')?.status]);
r = await REV(s.id, [{ fieldKey: 'age', action: 'edit', newValue: 'x'.repeat(301) }]); check('T13', 'edit newValue >300 chars -> 400', r.status === 400, r.status);
r = await REV(s.id, [{ fieldKey: 'age', action: 'edit', newValue: '   ' }]); check('T13b', 'edit blank newValue -> 400', r.status === 400, r.status);
r = await REV(s.id, Array.from({ length: 25 }, () => ({ fieldKey: 'age', action: 'approve' }))); check('T13c', '25 actions -> 400', r.status === 400, r.status);
r = await REV(s.id, [{ fieldKey: 'age', action: 'approve', newValue: 'x', extra: 1 }]); check('T13d', 'unknown action prop -> 400', r.status === 400, r.status);
r = await REV(s.id, [{ fieldKey: 'age', action: 'approve' }], {}, 'x'.repeat(201)); check('T13e', 'reviewerId >200 chars -> 400', r.status === 400, r.status);
// edited then field value in summary
r = await REV(s.id, [{ fieldKey: 'age', action: 'edit', newValue: '46 years' }]); const af = r.json.summary.fields.find(f => f.key === 'age');
check('T14', 'edit sets status edited, value in all 3 langs, evidence retained for audit/UI', af.status === 'edited' && af.value.en === '46 years' && af.value.th === '46 years', af);
// red-flag review on session without flags
r = await REV(s.id, [], { redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'acknowledge' }] }); check('T15', 'red flag action on session without that flag -> 400', r.status === 400, [r.status]);
// redflag-only review on escalated: audit red_flag_review, not review
s = await newSession('en'); await turn(s.id, 'chest pain and sweating'); r = await REV(s.id, [], { redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'acknowledge' }] }); g = await getS(s.id);
check('T16', 'red-flag-only review: audit has red_flag_review, no empty review event', g.audit.some(a => a.type === 'red_flag_review') && !g.audit.some(a => a.type === 'review'), g.audit.map(a => a.type));
check('T16b', 'red_flag_review audit actor is clinician with actorId', g.audit.find(a => a.type === 'red_flag_review')?.actor === 'clinician' && g.audit.find(a => a.type === 'red_flag_review')?.actorId === 'dr-x', g.audit.find(a => a.type === 'red_flag_review'));
// audit append-only + ordering
s = await newSession('en'); const snaps = [];
const snap = async () => snaps.push((await getS(s.id)).audit);
await snap(); await turn(s.id, 'headache since yesterday 7/10'); await snap(); await REV(s.id, [{ fieldKey: 'chief_complaint', action: 'approve' }]); await snap(); await TAKE(s.id); await snap();
let appendOnly = true, grows = true, ordered = true;
for (let i = 1; i < snaps.length; i++) { if (snaps[i].length <= snaps[i - 1].length) grows = false; if (JSON.stringify(snaps[i].slice(0, snaps[i - 1].length)) !== JSON.stringify(snaps[i - 1])) appendOnly = false; }
for (const a of snaps.at(-1)) { if (a.at < (snaps.at(-1)[0].at)) ordered = false; }
for (let i = 1; i < snaps.at(-1).length; i++) if (snaps.at(-1)[i].at < snaps.at(-1)[i - 1].at) ordered = false;
check('T17', 'audit grows after each action', grows, snaps.map(x => x.length));
check('T17b', 'audit earlier entries unchanged (append-only)', appendOnly);
check('T17c', 'audit timestamps non-decreasing', ordered);
const ids = snaps.at(-1).map(a => a.id); check('T17d', 'audit ids unique', new Set(ids).size === ids.length);
check('T17e', 'audit has types session_created, turn_added, summary_generated, review, takeover', ['session_created', 'turn_added', 'summary_generated', 'review', 'takeover'].every(t => snaps.at(-1).some(a => a.type === t)), snaps.at(-1).map(a => a.type));
check('T17f', 'failed (400) review leaves audit unchanged', await (async () => { const b = (await getS(s.id)).audit.length; await REV(s.id, [{ fieldKey: 'zzz', action: 'approve' }]); await turn(s.id, ''); return (await getS(s.id)).audit.length === b; })());
// pharmacy transitions
s = await newSession('en'); await turn(s.id, 'I take ibuprofen 400 mg and paracetamol 500 mg. Headache since yesterday 5/10, I am 30. No allergies.');
g = await getS(s.id); const meds = g.session.summary.medications || [];
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: meds.slice(0, 1).map(m => ({ medId: m.id, action: 'verify' })), alertActions: [] });
check('T18', 'pharmacy partial review -> pharmacyStatus in_review', r.status === 200 && r.json.pharmacyStatus === 'in_review' && r.json.pharmacyReviewerId === 'rx', [r.status, r.json?.pharmacyStatus]);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: [], alertActions: [], complete: true });
check('T19', 'sign-off with no high alerts/unmatched meds -> reconciled', r.status === 200 && r.json.pharmacyStatus === 'reconciled', [r.status, r.text.slice(0, 200)]);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx2', medActions: [{ medId: meds[0].id, action: 'discontinue' }], alertActions: [] });
check('T20', 'pharmacy review after reconciled: documented behaviour (reopens to in_review?)', r.status === 200 || r.status === 409, [r.status, r.json?.pharmacyStatus]);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: [], alertActions: [], bogus: 1 }); check('T21', 'pharmacy unknown top-level key -> 400', r.status === 400, r.status);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: 'x', alertActions: [] }); check('T21b', 'pharmacy medActions wrong type -> 400', r.status === 400, r.status);
r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx', medActions: [], alertActions: [], complete: 'yes' }); check('T21c', 'pharmacy complete non-boolean -> 400', r.status === 400, r.status);
// pharmacy on escalated/taken_over (should it block?) informational
// Metrics recount
const list = (await req('GET', '/api/sessions')).json; const m = (await req('GET', '/api/metrics')).json;
const rc = Object.fromEntries(STATUSES.map(x => [x, list.filter(s => s.status === x).length]));
check('T22', 'metrics.byStatus == recount from /api/sessions', JSON.stringify(rc) === JSON.stringify(Object.fromEntries(STATUSES.map(k => [k, m.byStatus[k]]))), [rc, m.byStatus]);
check('T22b', 'metrics.escalations == sessions with >=1 red flag', m.escalations === list.filter(s => s.summary?.redFlags?.length).length, [m.escalations, list.filter(s => s.summary?.redFlags?.length).length]);
const today = new Date().toISOString().slice(0, 10);
check('T22c', 'metrics.sessionsToday == sessions created today (UTC)', m.sessionsToday === list.filter(s => s.createdAt.startsWith(today)).length, [m.sessionsToday]);
const sums = list.filter(s => s.summary); check('T22d', 'abstainRate == abstained/summaries', Math.abs(m.abstainRate - sums.filter(s => s.summary.abstained).length / sums.length) < 1e-9, [m.abstainRate, sums.filter(s => s.summary.abstained).length, sums.length]);
check('T22e', 'sum(byStatus) == sessions listed', Object.values(m.byStatus).reduce((a, b) => a + b, 0) === list.length, [Object.values(m.byStatus).reduce((a, b) => a + b, 0), list.length]);
check('T22f', 'autoCapturedRate in [0,1]; p50<=p95; medianReviewSeconds>=0', m.autoCapturedRate >= 0 && m.autoCapturedRate <= 1 && (m.modelLatencyMs.p50 === null || m.modelLatencyMs.p50 <= m.modelLatencyMs.p95) && (m.medianReviewSeconds === null || m.medianReviewSeconds >= 0), m);
// recount calls from audit for latency
{ const ids = list.map(s => s.id); let calls = []; for (const id of ids) { const a = (await getS(id)).audit; for (const e of a) if (e.type === 'summary_generated' && !e.payload.event) calls.push(...(e.payload.modelCalls || [])); }
  const ls = calls.map(c => c.latencyMs).sort((a, b) => a - b); const q = p => ls.length ? ls[Math.max(0, Math.ceil(ls.length * p) - 1)] : null;
  check('T22g', 'latency p50/p95 match recount from audit modelCalls', m.modelLatencyMs.p50 === q(0.5) && m.modelLatencyMs.p95 === q(0.95), [m.modelLatencyMs, q(0.5), q(0.95)]); }
// hardware claim
check('T23', 'metrics.provider honest in mock mode (name mock, hardware not claiming Instinct/ROCm)', /mock/.test(m.provider.name + m.provider.model) && !/Instinct|ROCm/i.test(m.provider.hardware), m.provider);
done();
