// API contract conformance: statuses, shapes, ApiError, CORS, 404/405, malformed JSON.
import { req, check, done, newSession, turn, sessionShape, shapeErrors, AUDIT, METRICS, STATUSES, BASE } from './lib.mjs';
const isErr = r => r.json && typeof r.json.error === 'string' && ['bad_request', 'not_found', 'provider_error', 'internal'].includes(r.json.code);
const s = await newSession('en');
check('C01', 'POST /api/sessions -> 201 + IntakeSession shape', s.id && sessionShape(s).length === 0 && s.status === 'collecting', sessionShape(s));
const created = await req('POST', '/api/sessions', { patientLang: 'th' });
check('C02', 'POST /api/sessions status code is 201', created.status === 201, created.status);
for (const [n, b] of [['bad lang', { patientLang: 'fr' }], ['missing lang', {}], ['number lang', { patientLang: 1 }], ['extra key', { patientLang: 'en', x: 1 }], ['array body', []], ['null body', null], ['string body', '"x"']]) {
  const r = await req('POST', '/api/sessions', b);
  check('C03', `POST /api/sessions ${n} -> 400 ApiError`, r.status === 400 && isErr(r), [r.status, r.text.slice(0, 200)]);
}
let r = await req('POST', '/api/sessions', '{bad json', { raw: true });
check('C04', 'malformed JSON -> 400 ApiError', r.status === 400 && isErr(r), [r.status, r.text.slice(0, 200)]);
r = await req('POST', '/api/sessions', '', { raw: true });
check('C05', 'empty body -> 400 ApiError', r.status === 400 && isErr(r), [r.status, r.text.slice(0, 200)]);
r = await req('POST', '/api/sessions', '{"patientLang":"en"}', { raw: true, headers: { 'content-type': 'text/plain' } });
check('C06', 'wrong content-type with valid JSON (informational: either 201 or 4xx ApiError)', r.status === 201 || (r.status >= 400 && isErr(r)), [r.status, r.text.slice(0, 120)]);
r = await req('GET', '/api/sessions');
check('C07', 'GET /api/sessions -> 200 array of sessions', r.status === 200 && Array.isArray(r.json) && r.json.every(x => sessionShape(x).length === 0), r.json?.map?.(sessionShape).flat().slice(0, 3));
const order = r.json.map(x => x.status === 'escalated');
const firstNon = order.indexOf(false); check('C08', 'escalated sessions pinned on top', firstNon === -1 || !order.slice(firstNon).includes(true));
const sorted = r.json.filter(x => x.status !== 'escalated').every((x, i, a) => i === 0 || a[i - 1].createdAt >= x.createdAt); check('C09', 'non-escalated newest first', sorted);
r = await req('GET', `/api/sessions/${s.id}`);
check('C10', 'GET /api/sessions/:id -> {session,audit}', r.status === 200 && r.json.session?.id === s.id && Array.isArray(r.json.audit) && r.json.audit.every(a => shapeErrors(a, AUDIT).length === 0), r.text.slice(0, 300));
for (const id of ['nope', '00000000-0000-0000-0000-000000000000', '..%2F..%2Fetc%2Fpasswd', '%00', 'a'.repeat(3000)]) {
  for (const [m, p, b] of [['GET', '', undefined], ['POST', '/turns', { text: 'hi' }], ['POST', '/review', { reviewerId: 'dr', actions: [{ fieldKey: 'age', action: 'approve' }] }], ['POST', '/takeover', { reviewerId: 'dr' }], ['POST', '/pharmacy-review', { reviewerId: 'rx', medActions: [], alertActions: [], complete: true }]]) {
    const x = await req(m, `/api/sessions/${id}${p}`, b);
    check('C11', `${m} /api/sessions/${id.slice(0, 20)}${p} unknown id -> 404 not_found`, x.status === 404 && x.json?.code === 'not_found', [x.status, x.text.slice(0, 160)]);
  }
}
r = await req('GET', '/api/metrics');
check('C12', 'GET /api/metrics shape', r.status === 200 && shapeErrors(r.json, METRICS).length === 0 && STATUSES.every(k => typeof r.json.byStatus[k] === 'number'), [shapeErrors(r.json, METRICS), r.json]);
r = await req('GET', '/api/health');
check('C13', 'GET /api/health -> {provider,model}', r.status === 200 && r.json.provider && r.json.model, r.text);
for (const [m, p] of [['DELETE', '/api/sessions'], ['PUT', '/api/sessions'], ['PATCH', `/api/sessions/${s.id}`], ['DELETE', `/api/sessions/${s.id}`], ['GET', `/api/sessions/${s.id}/turns`], ['GET', `/api/sessions/${s.id}/review`], ['GET', `/api/sessions/${s.id}/takeover`], ['GET', `/api/sessions/${s.id}/pharmacy-review`], ['POST', '/api/metrics'], ['POST', '/api/health']]) {
  const x = await req(m, p, m === 'GET' ? undefined : {});
  check('C14', `${m} ${p.replace(s.id, ':id')} -> 405`, x.status === 405, [x.status, x.text.slice(0, 100)]);
}
// CORS
for (const [origin, expectAllow] of [['http://localhost:3000', true], ['http://localhost:8081', true], ['https://evil.example', false]]) {
  const x = await fetch(BASE + '/api/sessions', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  const allow = x.headers.get('access-control-allow-origin');
  check('C15', `OPTIONS preflight origin=${origin} -> 204, allow-origin ${expectAllow ? origin : 'absent'}`, x.status === 204 && (expectAllow ? allow === origin : !allow) && /POST/.test(x.headers.get('access-control-allow-methods') || '') && /content-type/i.test(x.headers.get('access-control-allow-headers') || ''), [x.status, allow]);
}
for (const p of ['/api/sessions/' + s.id, '/api/sessions/' + s.id + '/turns', '/api/sessions/' + s.id + '/review', '/api/sessions/' + s.id + '/takeover', '/api/sessions/' + s.id + '/pharmacy-review', '/api/metrics', '/api/health']) {
  const x = await fetch(BASE + p, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } });
  check('C16', `OPTIONS ${p.replace(s.id, ':id')} -> 204 w/ CORS`, x.status === 204 && x.headers.get('access-control-allow-origin') === 'http://localhost:8081', [x.status, x.headers.get('access-control-allow-origin')]);
}
// Error responses must carry CORS for allowed origin (browser clients need to read the error)
const e = await fetch(BASE + '/api/sessions/nope', { headers: { Origin: 'http://localhost:8081' } });
check('C17', '404 error response carries CORS header for allowed origin', e.headers.get('access-control-allow-origin') === 'http://localhost:8081', e.headers.get('access-control-allow-origin'));
const cc = (await req('GET', '/api/sessions')).headers.get('cache-control'); check('C18', 'Cache-Control: no-store on list', /no-store/.test(cc || ''), cc);
// body size
const big = await req('POST', `/api/sessions/${s.id}/turns`, JSON.stringify({ text: 'a'.repeat(70000) }), { raw: true });
check('C19', '70KB body -> 413 ApiError', big.status === 413 && isErr(big), [big.status, big.text.slice(0, 120)]);
// Demo endpoints must be guarded
for (const [m, p] of [['GET', '/api/demo/reset'], ['POST', '/api/demo/reset'], ['GET', '/api/dev/seed'], ['POST', '/api/dev/seed']]) {
  const before = (await req('GET', '/api/sessions')).json.length;
  // NOTE: POST without token must NOT reset. Verified by session count unchanged.
  const x = await req(m, p, m === 'POST' ? {} : undefined);
  const after = (await req('GET', '/api/sessions')).json.length;
  check('C20', `${m} ${p} without token -> 403/404/405 and no data loss`, [403, 404, 405].includes(x.status) && after >= before, [x.status, x.text.slice(0, 120), before, after]);
}
// turn field validation
for (const [n, b, st] of [['text number', { text: 5 }, 400], ['missing text', {}, 400], ['bad inputMode', { text: 'hi', inputMode: 'smoke' }, 400], ['extra key', { text: 'hi', foo: 1 }, 400], ['inputMode null', { text: 'hi', inputMode: null }, 400]]) {
  const x = await req('POST', `/api/sessions/${s.id}/turns`, b);
  check('C21', `turn ${n} -> ${st} ApiError`, x.status === st && isErr(x), [x.status, x.text.slice(0, 160)]);
}
const s2 = await newSession('en');
for (const [n, b] of [['no reviewerId', { actions: [] }], ['actions not array', { reviewerId: 'dr', actions: 1 }], ['empty actions', { reviewerId: 'dr', actions: [] }], ['unknown fieldKey', { reviewerId: 'dr', actions: [{ fieldKey: 'zzz', action: 'approve' }] }], ['unknown action', { reviewerId: 'dr', actions: [{ fieldKey: 'age', action: 'delete' }] }], ['edit w/o newValue', { reviewerId: 'dr', actions: [{ fieldKey: 'age', action: 'edit' }] }], ['blank reviewer', { reviewerId: '  ', actions: [{ fieldKey: 'age', action: 'approve' }] }], ['unknown rf', { reviewerId: 'dr', actions: [], redFlagActions: [{ ruleId: 'RF-NOPE', action: 'acknowledge' }] }]]) {
  const x = await req('POST', `/api/sessions/${s2.id}/review`, b);
  check('C22', `review ${n} -> 400 ApiError`, x.status === 400 && isErr(x), [x.status, x.text.slice(0, 160)]);
}
for (const [n, b] of [['no reviewer', {}], ['reviewer number', { reviewerId: 5 }], ['reason number', { reviewerId: 'dr', reason: 5 }], ['extra', { reviewerId: 'dr', z: 1 }]]) {
  const x = await req('POST', `/api/sessions/${s2.id}/takeover`, b);
  check('C23', `takeover ${n} -> 400 ApiError`, x.status === 400 && isErr(x), [x.status, x.text.slice(0, 160)]);
}
done();
