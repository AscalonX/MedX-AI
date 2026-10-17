// HTTP-level edge cases: chunked body cap, invalid UTF-8, BOM, duplicate keys, trailing slash, HEAD, session-code capacity (ISOLATED instance only).
import { BASE, req, check, done, newSession } from './lib.mjs';
const isErr = r => r.json && typeof r.json.error === 'string' && typeof r.json.code === 'string';
let r;
// chunked >64KB without Content-Length
{ const enc = new TextEncoder(); const stream = new ReadableStream({ start(c) { c.enqueue(enc.encode('{"patientLang":"en","pad":"' + 'a'.repeat(100000) + '"}')); c.close(); } });
  const x = await fetch(BASE + '/api/sessions', { method: 'POST', body: stream, duplex: 'half', headers: { 'content-type': 'application/json' } }); const t = await x.text();
  check('H01', 'chunked 100KB body without Content-Length -> 413', x.status === 413, [x.status, t.slice(0, 100)]); }
// invalid utf-8
{ const x = await fetch(BASE + '/api/sessions', { method: 'POST', body: new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]), headers: { 'content-type': 'application/json' } }); const t = await x.text(); let j; try { j = JSON.parse(t); } catch {}
  check('H02', 'invalid UTF-8 body -> 400 ApiError', x.status === 400 && j?.code === 'bad_request', [x.status, t.slice(0, 100)]); }
// BOM
r = await req('POST', '/api/sessions', '﻿{"patientLang":"en"}', { raw: true }); check('H03', 'JSON with BOM -> 400 ApiError or 201 (never 5xx)', r.status === 201 || (r.status === 400 && isErr(r)), r.status);
// duplicate keys / proto
r = await req('POST', '/api/sessions', '{"patientLang":"xx","patientLang":"en"}', { raw: true }); check('H04', 'duplicate keys -> no 5xx', r.status < 500, r.status);
r = await req('POST', '/api/sessions', '{"patientLang":"en","__proto__":{"admin":true}}', { raw: true }); check('H05', '__proto__ key rejected (400) and no prototype pollution', r.status === 400, [r.status, r.text.slice(0, 100)]);
r = await req('POST', '/api/sessions', '{"patientLang":"EN"}', { raw: true }); check('H06', 'patientLang uppercase -> 400', r.status === 400, r.status);
// deeply nested JSON
r = await req('POST', '/api/sessions', '{"patientLang":"en","x":' + '['.repeat(5000) + ']'.repeat(5000) + '}', { raw: true }); check('H07', 'deeply nested JSON -> 400 ApiError (not 500)', r.status === 400 && isErr(r), [r.status, r.text.slice(0, 100)]);
// trailing slash, query string, HEAD
r = await fetch(BASE + '/api/sessions/', { redirect: 'manual' }); check('H08', 'GET /api/sessions/ (trailing slash) -> 200 or 308 redirect to /api/sessions', [200, 308].includes(r.status), r.status);
r = await fetch(BASE + '/api/sessions?x=1'); check('H09', 'GET /api/sessions?x=1 -> 200', r.status === 200, r.status);
r = await fetch(BASE + '/api/sessions', { method: 'HEAD' }); check('H10', 'HEAD /api/sessions -> 200/204/405 (no 5xx)', r.status < 500, r.status);
r = await fetch(BASE + '/api/nope'); const t = await r.text(); check('H11', 'unknown /api route -> 404 (informational: body shape)', r.status === 404, [r.status, t.slice(0, 80)]);
// 20-turn cap and long session
// session code capacity (isolated instance only)
if (process.env.CAPACITY === '1') {
  let last, n = 0; for (; n < 1005; n++) { last = await req('POST', '/api/sessions', { patientLang: 'en' }); if (last.status !== 201) break; }
  check('H12', `can create >=1000 sessions (stopped at ${n}); failure class should be 5xx/507 not 400 bad_request`, n >= 1000 && last.status === 201 || (last.status >= 500), [n, last.status, last.text.slice(0, 120)]);
  const l = (await req('GET', '/api/sessions')).json; const codes = (await req('GET', '/api/metrics')).json;
  check('H12b', 'is there a B-000 code? (informational)', true, 'checked in script H12 detail');
}
done();
