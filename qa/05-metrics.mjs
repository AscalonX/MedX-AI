// Metrics consistency vs recount, retried until the store is quiescent (other clients may be creating sessions).
import { req, check, done, STATUSES } from './lib.mjs';
let ok = false, last;
for (let i = 0; i < 20 && !ok; i++) {
  const [l, m] = await Promise.all([req('GET', '/api/sessions'), req('GET', '/api/metrics')]);
  const rc = Object.fromEntries(STATUSES.map(x => [x, l.json.filter(s => s.status === x).length]));
  last = { rc, by: m.json.byStatus, n: l.json.length };
  ok = STATUSES.every(k => rc[k] === m.json.byStatus[k]);
  if (!ok) await new Promise(r => setTimeout(r, 300));
}
check('M01', 'metrics.byStatus matches recount from /api/sessions (quiescent snapshot)', ok, last);
done();
