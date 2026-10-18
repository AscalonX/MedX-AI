// Deploy coherence (M-12): parallel reads must all see the same shared store, whichever server instance answers.
// Locally this exercises one process; on Vercel (BASE=https://medx.areazeroai.com) parallel requests fan out over
// instances that share the Neon snapshot. Synthetic data only.
import { BASE, req, check, done } from './lib.mjs';

const ids = rows => new Set((rows || []).map(s => s.id));
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const many = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

const health = await req('GET', '/api/health');
check('D00', `GET /api/health -> 200, storeOk (store=${health.json?.store}, region=${health.json?.region}, commit=${health.json?.commit})`, health.status === 200 && health.json?.storeOk === true, [health.status, health.text.slice(0, 200)]);

// Make sure the queue holds at least one listed session (sessions appear in the list from their first patient turn).
const seed = (await req('POST', '/api/sessions', { patientLang: 'en' })).json;
const seedTurn = await req('POST', `/api/sessions/${seed?.id}/turns`, { text: 'QA coherence check: headache since this morning, 3 out of 10.' });
check('D01', 'setup: create a synthetic session and add its first patient turn', !!seed?.id && seedTurn.status === 200, [seedTurn.status, seedTurn.text.slice(0, 160)]);

// 1. 16 parallel GET /api/sessions return the same id set. A session created by another visitor DURING the burst may
//    appear in later reads only; it must never be missing from a read that started after it existed.
const burstStart = new Date().toISOString();
const lists = await many(16, () => req('GET', '/api/sessions'));
const okLists = lists.every(r => r.status === 200 && Array.isArray(r.json));
const sets = lists.map(r => ids(r.json));
const union = new Set(sets.flatMap(s => [...s]));
const created = new Map(lists.flatMap(r => (r.json || []).map(s => [s.id, s.createdAt])));
const lateOnly = [...union].filter(id => !sets.every(s => s.has(id)));
const explained = lateOnly.every(id => (created.get(id) || '') >= burstStart);
check('D02', `16 parallel GET /api/sessions -> 200 with the same id set (${sets[0]?.size ?? 0} ids${lateOnly.length ? `, ${lateOnly.length} created during the burst` : ''})`, okLists && sets.every(s => s.has(seed.id)) && (sets.every(s => same(s, sets[0])) || explained), { statuses: lists.map(r => r.status), sizes: sets.map(s => s.size), missingSeed: sets.filter(s => !s.has(seed.id)).length, lateOnly });

// 2. 12 parallel patient views of listed sessions all return 200.
const listed = [...(lists[0].json || [])].slice(0, 12);
while (listed.length < 12 && listed.length) listed.push(listed[listed.length % Math.max(1, listed.length)]);
const views = await many(12, i => req('GET', `/api/sessions/${listed[i % listed.length].id}?view=patient`));
check('D03', '12 parallel GET /api/sessions/:id?view=patient -> 200 with the patient projection', views.every(r => r.status === 200 && r.json?.session?.id && !('audit' in (r.json || {}))), views.map(r => r.status));

// 3. A freshly created session is readable by 8 parallel GETs (every instance sees the new row).
const fresh = await req('POST', '/api/sessions', { patientLang: 'en' });
const gets = await many(8, () => req('GET', `/api/sessions/${fresh.json?.id}`));
check('D04', 'POST /api/sessions then 8 parallel GET /api/sessions/:id -> all 200, same code', fresh.status === 201 && gets.every(r => r.status === 200 && r.json?.session?.code === fresh.json.code), { create: fresh.status, gets: gets.map(r => r.status), codes: [...new Set(gets.map(r => r.json?.session?.code))] });

// 4. A patient turn is visible in parallel list reads right after it is written.
const text = 'QA coherence check: sore throat since yesterday, 4 out of 10.';
const t = await req('POST', `/api/sessions/${fresh.json?.id}/turns`, { text });
const after = await many(8, () => req('GET', '/api/sessions'));
const rows = after.map(r => (r.json || []).find(s => s.id === fresh.json?.id));
check('D05', 'patient turn written, then 8 parallel GET /api/sessions all list the session with that turn', t.status === 200 && rows.every(x => x && x.turns.some(tt => tt.role === 'patient' && tt.text === text)), { turn: t.status, listed: rows.map(x => !!x), withTurn: rows.map(x => !!x?.turns?.some(tt => tt.text === text)) });

// 5. Metrics agree with the list (same store behind every route).
const [l2, m2] = await Promise.all([req('GET', '/api/sessions'), req('GET', '/api/metrics')]);
const total = Object.values(m2.json?.byStatus || {}).reduce((a, b) => a + b, 0);
check('D06', `metrics byStatus total == queue length (${total} vs ${l2.json?.length})`, m2.status === 200 && total === l2.json?.length, { metrics: total, list: l2.json?.length });

console.log(`   BASE ${BASE}`);
done();
