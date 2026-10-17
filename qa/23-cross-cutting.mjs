// W14: audit/PII, CORS, 404/405, concurrency, cross-session isolation for the new routes
import { med, act, sub, ph, last, ord, sess, newSession, turn, req } from './lib2.mjs';
import { check, done, BASE } from './lib.mjs';
let s, r;
const PII = ['081-234-5678', 'somchai@example.com', '1-2345-67890-12-3'];
const dirty = 'Somchai call 081-234-5678 mail somchai@example.com id 1-2345-67890-12-3';
s = await newSession(); await turn(s.id, 'Headache since yesterday 5/10.');
await req('POST', `/api/sessions/${s.id}/vitals`, { recordedBy: dirty, vitals: { heartRate: 80 } });
await req('POST', `/api/sessions/${s.id}/triage/confirm`, { reviewerId: dirty, level: 4, note: dirty });
await req('POST', `/api/sessions/${s.id}/orders/investigations`, { orderedBy: dirty, code: 'fbc', reason: dirty, fromSuggestionId: dirty });
r = await med(s.id, { orderedBy: dirty, drugText: 'ibuprofen ' + dirty, dose: '400 mg', frequency: 'tid', duration: dirty }); const o = last(r);
r = await med(s.id, { orderedBy: dirty, drugText: 'paracetamol', dose: '1500 mg', frequency: 'qid' }); const o2 = last(r);
await sub(s.id, o.id, [], dirty);
await sub(s.id, o2.id, o2.checks.filter(c => c.severity === 'high').map(c => ({ alertId: c.id, reason: dirty })), dirty);
await ph(s.id, o2.id, 'return', dirty, dirty);
await act(s.id, o.id, 'cancel', { orderedBy: dirty, reason: dirty });
await req('POST', `/api/sessions/${s.id}/consult/turns`, { speaker: 'clinician', text: dirty, mode: 'nurse' });
const cs = await req('GET', `/api/sessions/${s.id}/consult?mode=doctor`);
const sid = cs.json.suggestions[0]?.id;
await req('POST', `/api/sessions/${s.id}/consult/suggestions/${encodeURIComponent(sid)}`, { reviewerId: dirty, status: 'dismissed' });
await req('POST', `/api/sessions/${s.id}/consult/note`, { reviewerId: dirty, mode: 'doctor', action: 'draft' });
await req('POST', `/api/sessions/${s.id}/consult/note`, { reviewerId: dirty, mode: 'doctor', action: 'sign', edits: [] });
const dump = JSON.stringify(await sess(s.id)) + JSON.stringify((await req('GET', '/api/sessions')).json) + JSON.stringify((await req('GET', `/api/sessions/${s.id}/consult?mode=doctor`)).json);
for (const p of PII) check('X10', `raw PII "${p}" absent from session+audit+list+consult after all mutating routes`, !dump.includes(p) && !dump.includes(p.replace(/-/g, '')), (dump.match(new RegExp('.{60}' + p.slice(0, 6) + '.{40}'))?.[0]));
const g = await sess(s.id); const types = new Set(g.audit.map(e => e.type));
for (const t of ['vitals_recorded', 'triage_confirmed', 'order_submitted', 'order_drafted', 'order_pharmacy_action', 'consult_turn', 'consult_suggestion', 'consult_note_signed']) check('X11', `audit contains ${t}`, types.has(t), [...types]);
check('X11b', 'cancel is distinguishable in audit (action:cancel payload)', g.audit.some(e => e.payload?.action === 'cancel'), '');
check('X11c', 'every clinician audit row from new routes has actorId (consult_turn excluded: no reviewer in request)', g.audit.filter(e => e.actor === 'clinician' && e.type !== 'consult_turn').every(e => e.actorId), g.audit.filter(e => e.actor === 'clinician' && !e.actorId).map(e => e.type));
// ---- 404
const routes = [
  ['POST', 'vitals', { recordedBy: 'n', vitals: { heartRate: 80 } }], ['POST', 'triage/confirm', { reviewerId: 'n', level: 3 }],
  ['POST', 'orders/investigations', { orderedBy: 'd', code: 'ecg' }], ['POST', 'orders/medications', { orderedBy: 'd', drugText: 'x', dose: '1 mg', route: 'oral', frequency: 'daily' }],
  ['POST', 'orders/medications/abc/submit', { orderedBy: 'd', overrides: [] }], ['POST', 'orders/medications/abc/cancel', { orderedBy: 'd' }], ['POST', 'orders/medications/abc/pharmacy', { reviewerId: 'p', action: 'verify' }],
  ['GET', 'consult?mode=nurse'], ['POST', 'consult/turns', { speaker: 'patient', text: 'hi', mode: 'nurse' }], ['POST', 'consult/note', { reviewerId: 'd', mode: 'doctor', action: 'draft' }]];
for (const [m, p, b] of routes) { r = await req(m, `/api/sessions/no-such-session/${p}`, b); check('X20', `${m} ${p} unknown session -> 404 ApiError`, r.status === 404 && r.json?.code === 'not_found', [r.status, r.text.slice(0, 100)]); }
for (const p of ['submit', 'cancel', 'pharmacy']) { r = await req('POST', `/api/sessions/${s.id}/orders/medications/no-such-order/${p}`, p === 'pharmacy' ? { reviewerId: 'p', action: 'verify' } : p === 'submit' ? { orderedBy: 'd', overrides: [] } : { orderedBy: 'd' }); check('X21', `unknown order ${p} -> 404`, r.status === 404, [r.status, r.text]); }
// body-validation precedence: invalid body on unknown session
r = await req('POST', `/api/sessions/no-such-session/vitals`, { bad: 1 }); check('X22', 'invalid body on unknown session -> 4xx (400 or 404), never 500', r.status === 400 || r.status === 404, r.status);
// ---- 405
for (const [m, p] of [['GET', 'vitals'], ['GET', 'triage/confirm'], ['GET', 'orders/investigations'], ['GET', 'orders/medications'], ['PUT', 'orders/medications'], ['DELETE', 'orders/medications/abc/cancel'], ['GET', 'orders/medications/abc/submit'], ['GET', 'orders/medications/abc/pharmacy'], ['POST', 'consult'], ['DELETE', 'consult'], ['PUT', 'consult/note'], ['GET', 'consult/suggestions/abc']]) { r = await req(m, `/api/sessions/${s.id}/${p}`, m === 'GET' ? undefined : {}); check('X30', `${m} ${p} -> 405`, r.status === 405, r.status); }
// ---- CORS
const pre = async (path, origin, method = 'POST') => fetch(BASE + path, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' } });
for (const p of ['vitals', 'triage/confirm', 'orders/investigations', 'orders/medications', 'orders/medications/abc/submit', 'orders/medications/abc/cancel', 'orders/medications/abc/pharmacy', 'consult', 'consult/turns', 'consult/note', 'consult/suggestions/abc']) {
  const a = await pre(`/api/sessions/${s.id}/${p}`, 'http://localhost:8081'); const b = await pre(`/api/sessions/${s.id}/${p}`, 'https://evil.example');
  check('X40', `CORS preflight ${p}: allowed origin -> 204 + ACAO echo; evil origin -> no ACAO`, a.status === 204 && a.headers.get('access-control-allow-origin') === 'http://localhost:8081' && !b.headers.get('access-control-allow-origin'), [a.status, a.headers.get('access-control-allow-origin'), b.headers.get('access-control-allow-origin')]);
}
r = await req('POST', `/api/sessions/${s.id}/vitals`, { recordedBy: 'n', vitals: { heartRate: 80 } }, { headers: { Origin: 'http://localhost:8081' } });
check('X41', 'actual POST response carries ACAO for allowed origin', r.headers.get('access-control-allow-origin') === 'http://localhost:8081', r.headers.get('access-control-allow-origin'));
r = await req('POST', `/api/sessions/no-such/vitals`, { recordedBy: 'n', vitals: { heartRate: 80 } }, { headers: { Origin: 'http://localhost:8081' } });
check('X41b', 'error response also carries ACAO', r.headers.get('access-control-allow-origin') === 'http://localhost:8081', r.status);
// ---- oversized / malformed bodies
for (const p of ['vitals', 'triage/confirm', 'orders/investigations', 'orders/medications']) {
  r = await req('POST', `/api/sessions/${s.id}/${p}`, JSON.stringify({ x: 'a'.repeat(70000) }), { raw: true }); check('X50', `${p} 70KB body -> 413`, r.status === 413, r.status);
  r = await req('POST', `/api/sessions/${s.id}/${p}`, '{bad', { raw: true }); check('X50b', `${p} malformed JSON -> 400`, r.status === 400, r.status);
  r = await req('POST', `/api/sessions/${s.id}/${p}`, undefined); check('X50c', `${p} empty body -> 400`, r.status === 400, r.status);
}
// ---- cross-session isolation
const sA = await newSession(), sB = await newSession();
r = await med(sA.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); const oA = last(r);
r = await sub(sB.id, oA.id); check('X60', "submit session A's order via session B URL -> 404", r.status === 404, [r.status, r.text]);
r = await act(sB.id, oA.id, 'cancel', { orderedBy: 'd' }); check('X60b', 'cancel via wrong session -> 404', r.status === 404, r.status);
r = await med(sB.id, { orderId: oA.id, drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); check('X60c', 'edit via wrong session -> 404', r.status === 404, r.status);
check('X60d', "session A order untouched", ord(await req('GET', `/api/sessions/${sA.id}`).then(x => ({ json: x.json.session })), oA.id)?.status === 'draft');
// ---- concurrency
s = await newSession(); r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); const c1 = last(r);
let rs = await Promise.all(Array.from({ length: 10 }, () => sub(s.id, c1.id)));
check('K01', '10 parallel submits of same order -> exactly one 200, rest 409', rs.filter(x => x.status === 200).length === 1 && rs.filter(x => x.status === 409).length === 9, rs.map(x => x.status));
let a = (await sess(s.id)).audit.filter(e => e.type === 'order_submitted'); check('K01b', 'exactly one order_submitted audit row', a.length === 1, a.length);
rs = await Promise.all([ph(s.id, c1.id, 'verify'), ph(s.id, c1.id, 'return', 'n'), ph(s.id, c1.id, 'verify'), ph(s.id, c1.id, 'return', 'n2')]);
check('K02', 'parallel verify+return -> exactly one 200', rs.filter(x => x.status === 200).length === 1 && rs.filter(x => x.status === 409).length === 3, rs.map(x => x.status));
s = await newSession(); r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); const c2 = last(r);
rs = await Promise.all([sub(s.id, c2.id), act(s.id, c2.id, 'cancel', { orderedBy: 'd' }), sub(s.id, c2.id), act(s.id, c2.id, 'cancel', { orderedBy: 'd' })]);
const fin = ord(await req('GET', `/api/sessions/${s.id}`).then(x => ({ json: x.json.session })), c2.id);
check('K03', 'parallel submit/cancel x2 -> final state cancelled or submitted, one cancel + one submit max, no 5xx', rs.every(x => [200, 409].includes(x.status)) && rs.filter(x => x.status === 200).length <= 2 && ['submitted', 'cancelled'].includes(fin.status), [rs.map(x => x.status), fin.status]);
s = await newSession();
rs = await Promise.all(Array.from({ length: 12 }, (_, i) => med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' })));
const all = (await req('GET', `/api/sessions/${s.id}`)).json.session.orders.medications;
check('K04', '12 parallel new drafts -> 12 distinct orders, no lost writes', rs.every(x => x.status === 200) && all.length === 12 && new Set(all.map(o => o.id)).size === 12, [rs.map(x => x.status).join(''), all.length]);
check('K04b', 'every order has coherent duplicate/max-dose checks after parallel create (each has >=1 MR-MAXDOSE-01)', all.every(o => o.checks.some(c => c.ruleId === 'MR-MAXDOSE-01')), all.map(o => o.checks.length));
rs = await Promise.all(Array.from({ length: 10 }, (_, i) => req('POST', `/api/sessions/${s.id}/vitals`, { recordedBy: 'n', vitals: { heartRate: 60 + i } })));
check('K05', '10 parallel vitals -> all 200, 10 stored', rs.every(x => x.status === 200) && (await sess(s.id)).session.vitals.length === 10, rs.map(x => x.status));
rs = await Promise.all(Array.from({ length: 6 }, () => req('POST', `/api/sessions/${s.id}/orders/investigations`, { orderedBy: 'd', code: 'ecg' })));
check('K06', '6 parallel investigation orders -> 6 stored', (await sess(s.id)).session.orders.investigations.length === 6, '');
// mixed: consult turn + order concurrently on same session (lock sanity)
rs = await Promise.all([req('POST', `/api/sessions/${s.id}/consult/turns`, { speaker: 'patient', text: 'cough for a week', mode: 'nurse' }), med(s.id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' }), req('POST', `/api/sessions/${s.id}/vitals`, { recordedBy: 'n', vitals: { spo2: 97 } })]);
check('K07', 'consult turn + order + vitals concurrently -> all 200', rs.every(x => x.status === 200), rs.map(x => x.status));
const fs = (await sess(s.id)).session; check('K07b', 'no lost update: turn, 13 orders, 11 vitals all present', fs.turns.some(t => t.text === 'cough for a week') && fs.orders.medications.length === 13 && fs.vitals.length === 11, [fs.orders.medications.length, fs.vitals.length]);
// ---- terminal sessions
s = await newSession(); await turn(s.id, 'headache since yesterday'); await req('POST', `/api/sessions/${s.id}/takeover`, { reviewerId: 'dr' });
r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); console.log('   info: order on taken_over session ->', r.status);
r = await req('POST', `/api/sessions/${s.id}/vitals`, { recordedBy: 'n', vitals: { heartRate: 80 } }); console.log('   info: vitals on taken_over session ->', r.status);
done();
