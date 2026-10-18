// Shared helpers for QA scripts. Usage: BASE=http://localhost:3000 node qa/NN-*.mjs
export const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
export const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
// The POST rate limit (30/min per x-forwarded-for hop by default) would throttle these suites on a local
// `next start`; locally each request gets its own TEST-NET address (QA_SPREAD_IP=0 turns that off). On Vercel
// the edge overwrites x-forwarded-for, so the header has no effect there.
const SPREAD = process.env.QA_SPREAD_IP ? process.env.QA_SPREAD_IP === '1' : LOCAL;
let ipSeq = Math.floor(Math.random() * 200) * 250;
export const spreadIp = () => { ipSeq++; return `198.19.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`; };
export async function req(method, path, body, { raw, headers = {} } = {}) {
  const init = { method, headers: { ...(SPREAD && !headers['x-forwarded-for'] ? { 'x-forwarded-for': spreadIp() } : {}), ...headers } };
  if (body !== undefined) { init.body = raw ? body : JSON.stringify(body); if (!headers['content-type']) init.headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + path, init);
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}
export const results = [];
export function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${id}] ${name}${ok || detail === undefined ? '' : '\n       -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 700)}`);
  return !!ok;
}
export function done() {
  const f = results.filter(r => !r.ok).length;
  console.log(`\nSUMMARY ${results.length - f}/${results.length} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
}
export const newSession = async (lang = 'en') => (await req('POST', '/api/sessions', { patientLang: lang })).json;
export const turn = (id, text, extra = {}) => req('POST', `/api/sessions/${id}/turns`, { text, ...extra });
export const getS = async id => (await req('GET', `/api/sessions/${id}`)).json;
// ---- shape checkers (mirror packages/shared/src/types.ts) ----
const is = (v, t) => t === 'array' ? Array.isArray(v) : t === 'null' ? v === null : typeof v === t;
export function shapeErrors(v, spec, path = '$') {
  const errs = [];
  for (const [k, t] of Object.entries(spec)) {
    const opt = k.endsWith('?'); const key = opt ? k.slice(0, -1) : k;
    if (!(key in v) || v[key] === undefined) { if (!opt) errs.push(`${path}.${key} missing`); continue; }
    const types = t.split('|');
    if (!types.some(x => x.startsWith('=') ? v[key] === x.slice(1) : is(v[key], x))) errs.push(`${path}.${key} expected ${t} got ${JSON.stringify(v[key])?.slice(0, 40)}`);
  }
  return errs;
}
export const SESSION = { id: 'string', code: 'string', patientLang: 'string', status: 'string', turns: 'array', summary: 'object|null', 'pharmacyStatus?': 'string', createdAt: 'string', updatedAt: 'string' };
export const TURN = { id: 'string', role: 'string', lang: 'string', text: 'string', at: 'string', 'inputMode?': 'string' };
export const FIELD = { key: 'string', value: 'object|null', valueOriginal: 'string|null', evidence: 'array', confidence: 'number', status: 'string', required: 'boolean' };
export const SUMMARY = { sessionId: 'string', fields: 'array', redFlags: 'array', nextQuestion: 'object|null', abstained: 'boolean', modelCalls: 'array', generatedAt: 'string' };
export const AUDIT = { id: 'string', sessionId: 'string', at: 'string', actor: 'string', type: 'string', payload: 'object' };
export const METRICS = { sessionsToday: 'number', byStatus: 'object', escalations: 'number', autoCapturedRate: 'number', abstainRate: 'number', medianReviewSeconds: 'number|null', modelLatencyMs: 'object', provider: 'object' };
export function sessionShape(s) {
  let e = shapeErrors(s, SESSION);
  s.turns?.forEach((t, i) => e.push(...shapeErrors(t, TURN, `turns[${i}]`)));
  if (s.summary) { e.push(...shapeErrors(s.summary, SUMMARY, 'summary')); s.summary.fields?.forEach((f, i) => e.push(...shapeErrors(f, FIELD, `fields[${i}]`))); }
  return e;
}
export const STATUSES = ['collecting', 'escalated', 'awaiting_review', 'needs_human', 'approved', 'taken_over'];
