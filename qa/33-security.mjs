// Public-URL hardening: security headers, CORS, POST rate limit (429), demo reset / seed / cron guarded, honest health.
//   BASE=http://localhost:3133 node qa/33-security.mjs
// Env: QA_RATE_LIMIT (expected per-minute budget, default 30), EXPECT_STORE (default postgres on a non-local BASE),
// QA_DEMO_TOKEN (optional: the server's DEMO_TOKEN; the LAST step then resets the demo store and expects 200/202).
import { BASE, LOCAL, spreadIp, req, check, done } from './lib.mjs';

const hdr = (r, k) => r.headers.get(k) || '';
// ---------- security headers on a page, an API route and a static file ----------
for (const path of ['/', '/review', '/api/health', '/patient/index.html']) {
  const r = await fetch(BASE + path); await r.arrayBuffer();
  const csp = hdr(r, 'content-security-policy');
  const directives = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([k, ...v]) => [k, v]));
  check('SH01', `${path}: CSP default-src 'self', object-src 'none', frame-ancestors 'self', base-uri 'self', form-action 'self', connect-src 'self'`,
    directives['default-src']?.join(' ') === "'self'" && directives['object-src']?.join(' ') === "'none'" && directives['frame-ancestors']?.join(' ') === "'self'" && directives['base-uri']?.join(' ') === "'self'" && directives['form-action']?.join(' ') === "'self'" && directives['connect-src']?.[0] === "'self'", csp || 'no CSP header');
  check('SH02', `${path}: production CSP has no 'unsafe-eval' and no ws: source`, csp && !csp.includes("'unsafe-eval'") && !/\sws:/.test(csp), csp);
  const hsts = /max-age=(\d+)/.exec(hdr(r, 'strict-transport-security'))?.[1];
  const pp = hdr(r, 'permissions-policy');
  const ok = hdr(r, 'x-content-type-options') === 'nosniff' && hdr(r, 'referrer-policy') === 'strict-origin-when-cross-origin' && hdr(r, 'x-frame-options') === 'SAMEORIGIN'
    && /camera=\(\)/.test(pp) && /microphone=\(self\)/.test(pp) && /geolocation=\(\)/.test(pp) && Number(hsts) >= 31536000 && hdr(r, 'cross-origin-opener-policy') === 'same-origin' && !r.headers.has('x-powered-by');
  check('SH03', `${path}: nosniff, strict-origin-when-cross-origin, SAMEORIGIN, Permissions-Policy (mic self, no camera/geo), HSTS >= 1 year, COOP same-origin, no X-Powered-By`, ok,
    { nosniff: hdr(r, 'x-content-type-options'), referrer: hdr(r, 'referrer-policy'), frame: hdr(r, 'x-frame-options'), pp, hsts: hdr(r, 'strict-transport-security'), coop: hdr(r, 'cross-origin-opener-policy'), poweredBy: hdr(r, 'x-powered-by') });
}
{ const r = await req('GET', '/api/sessions'); check('SH04', 'API JSON responses are Cache-Control: no-store', /no-store/.test(hdr(r, 'cache-control')), hdr(r, 'cache-control')); }

// ---------- CORS: a foreign origin is never reflected ----------
{ const r = await fetch(BASE + '/api/sessions', { headers: { Origin: 'https://evil.example' } }); await r.arrayBuffer();
  check('CO01', 'GET with Origin https://evil.example: no Access-Control-Allow-Origin', !r.headers.has('access-control-allow-origin'), hdr(r, 'access-control-allow-origin'));
  const p = await fetch(BASE + '/api/sessions', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } }); await p.arrayBuffer();
  check('CO02', 'preflight from a foreign origin: 204 without Access-Control-Allow-Origin', p.status === 204 && !p.headers.has('access-control-allow-origin'), [p.status, hdr(p, 'access-control-allow-origin')]); }

// ---------- demo reset, dev seed and cron are guarded ----------
{ let r = await req('GET', '/api/demo/reset'); check('DR01', 'GET /api/demo/reset -> 405 (reset is never a GET)', r.status === 405, r.status);
  r = await req('POST', '/api/demo/reset', {}); check('DR02', 'POST /api/demo/reset without x-demo-token -> 403 (404 when DEMO_SEED is off)', [403, 404].includes(r.status), [r.status, r.text.slice(0, 100)]);
  r = await req('POST', '/api/demo/reset', {}, { headers: { 'x-demo-token': 'wrong-token-qa' } }); check('DR03', 'POST /api/demo/reset with a wrong token -> 403 (404 when DEMO_SEED is off)', [403, 404].includes(r.status), [r.status, r.text.slice(0, 100)]);
  r = await req('POST', '/api/dev/seed', {}); check('DR04', 'POST /api/dev/seed without x-demo-token -> 403/404', [403, 404].includes(r.status), [r.status, r.text.slice(0, 100)]);
  r = await req('GET', '/api/cron/reset'); check('CR01', 'GET /api/cron/reset without Authorization -> 401', r.status === 401, [r.status, r.text.slice(0, 100)]);
  r = await req('GET', '/api/cron/reset', undefined, { headers: { authorization: 'Bearer wrong-qa-secret' } }); check('CR02', 'GET /api/cron/reset with a wrong bearer -> 401', r.status === 401, [r.status, r.text.slice(0, 100)]); }

// ---------- /api/health: honest, credential-free, store kind ----------
{ const r = await req('GET', '/api/health');
  const KEYS = ['status', 'provider', 'model', 'hardware', 'providerConfigured', 'store', 'storeOk', 'storeVersion', 'sessions', 'commit', 'region'];
  check('HL01', '/api/health -> 200 with exactly the documented 11 keys', r.status === 200 && Object.keys(r.json || {}).sort().join() === [...KEYS].sort().join(), Object.keys(r.json || {}));
  const expectStore = process.env.EXPECT_STORE ? [process.env.EXPECT_STORE] : LOCAL ? ['file', 'tmp-ephemeral'] : ['postgres'];
  check('HL02', `/api/health store kind is one of [${expectStore.join(', ')}] and storeOk (got ${r.json?.store}, ${r.json?.storeOk})`, expectStore.includes(r.json?.store) && r.json?.storeOk === true && ['postgres', 'redis', 'tmp-ephemeral', 'file'].includes(r.json?.store), r.json);
  check('HL03', '/api/health carries no credential-shaped value (postgres URL, npg_, sk-, bearer, token)', !/postgres(ql)?:\/\/|npg_|\bsk-|bearer|token|password/i.test(r.text), r.text);
  check('HL04', '/api/health commit is a 7-char sha or "unknown"; sessions is a count only', /^([0-9a-f]{7}|unknown)$/.test(String(r.json?.commit)) && Number.isInteger(r.json?.sessions), [r.json?.commit, r.json?.sessions]); }

// ---------- strict staff roles (production sets MEDX_STRICT_ROLES=1, M-13) ----------
// Closes the two-person alias gap from the code review: a name outside STAFF ("Laura Conti") cannot verify or dispense.
{ const strict = process.env.EXPECT_STRICT_ROLES ?? (LOCAL ? '' : '1');
  if (strict === '1') {
    const s = await req('POST', '/api/sessions', { patientLang: 'en' });
    const r = await req('POST', `/api/sessions/${s.json?.id}/vitals`, { recordedBy: 'qa-not-in-staff', vitals: { heartRate: 80 } });
    check('RO01', 'strict roles: a clinical write by an actor outside STAFF -> 403 (refused, nothing stored)', s.status === 201 && r.status === 403, [s.status, r.status, r.text.slice(0, 120)]);
  } else console.log('SKIP [RO01] strict roles (set EXPECT_STRICT_ROLES=1 when the server runs MEDX_STRICT_ROLES=1)');
}

// ---------- POST rate limit: 429 after the per-minute budget ----------
{ const limit = Number(process.env.QA_RATE_LIMIT || 30);
  // One fixed client address for the whole burst (locally it sets the bucket; Vercel replaces it with the real client IP).
  const ip = spreadIp().replace(/^198\.19\./, '198.51.');
  const max = LOCAL ? limit + 5 : limit * 4;
  // Fixed one-minute windows: do not start the burst in the last 15 s of a minute (local clock = server clock locally).
  if (LOCAL && Date.now() % 60000 > 45000) await new Promise(res => setTimeout(res, 60000 - (Date.now() % 60000) + 500));
  const codes = []; let limited;
  for (let i = 0; i < max; i++) {
    const r = await req('POST', '/api/sessions', { patientLang: 'xx' }, { headers: { 'x-forwarded-for': ip } });
    codes.push(r.status); if (r.status === 429) { limited = r; break; }
  }
  const first429 = codes.indexOf(429);
  check('RL01', `hammered POST (invalid body, one client) gets 429 after the budget (${LOCAL ? `exactly request ${limit + 1}` : `within ${max}`}; got request ${first429 + 1})`, !!limited && (LOCAL ? first429 === limit : first429 >= 1), codes.join(','));
  check('RL02', 'requests before the limit were plain 400s (never 5xx); the 429 has Retry-After 1..60 and a JSON error', codes.slice(0, Math.max(0, first429)).every(c => c === 400) && !!limited && Number(hdr(limited, 'retry-after')) >= 1 && Number(hdr(limited, 'retry-after')) <= 60 && typeof limited.json?.error === 'string', { retryAfter: limited && hdr(limited, 'retry-after'), body: limited?.text?.slice(0, 120) });
  const g = await req('GET', '/api/sessions', undefined, { headers: { 'x-forwarded-for': ip } });
  check('RL03', 'GET from the limited client is not rate limited', g.status === 200, g.status);
  if (LOCAL) { const o = await req('POST', '/api/sessions', { patientLang: 'xx' }, { headers: { 'x-forwarded-for': '198.51.100.250' } }); check('RL04', 'another client address is unaffected (400, not 429)', o.status === 400, o.status); }
  else console.log('SKIP [RL04] another client address is unaffected (Vercel sets x-forwarded-for; cannot vary the client from one machine)'); }

// ---------- optional, LAST: demo reset with the real token ----------
if (process.env.QA_DEMO_TOKEN) {
  const r = await req('POST', '/api/demo/reset', {}, { headers: { 'x-demo-token': process.env.QA_DEMO_TOKEN } });
  check('DR05', 'POST /api/demo/reset with the demo token -> 200 (mock) or 202 (real provider seed in the background)', r.status === 200 || r.status === 202, [r.status, r.text.slice(0, 160)]);
  const h = await req('GET', '/api/health');
  console.log(`   after reset: sessions=${h.json?.sessions} storeVersion=${h.json?.storeVersion}`);
}
done();
