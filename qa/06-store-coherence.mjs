// Do all routes see the same store? A created session must be listed, and a turn/takeover must be visible in GET list immediately.
import { req, check, done, newSession, turn } from './lib.mjs';
// A session with no patient turn yet is intentionally hidden from the queue; it is listed from its first turn.
const s = await newSession('en');
await turn(s.id, 'headache since yesterday 7/10');
let l = (await req('GET', '/api/sessions')).json;
check('K01', 'session appears in GET /api/sessions after its first patient turn', l.some(x => x.id === s.id), { listed: l.length });
const x = l.find(x => x.id === s.id);
check('K02', 'list reflects new turn (turns.length >= 2)', x && x.turns.length >= 2, x && x.turns.length);
await req('POST', `/api/sessions/${s.id}/takeover`, { reviewerId: 'dr' });
l = (await req('GET', '/api/sessions')).json; const y = l.find(x => x.id === s.id);
check('K03', 'list reflects takeover status', y?.status === 'taken_over', y?.status);
const m = (await req('GET', '/api/metrics')).json; const total = Object.values(m.byStatus).reduce((a, b) => a + b, 0);
check('K04', 'metrics total == list length (same store in all routes)', total === l.length, { metrics: total, list: l.length });
const g = (await req('GET', '/api/sessions/' + s.id)).json;
check('K05', 'GET :id agrees with list on status', g.session.status === y?.status, [g.session.status, y?.status]);
done();
