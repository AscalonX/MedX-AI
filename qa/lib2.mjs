import { req, newSession, turn } from './lib.mjs';
export const med = (id, o) => req('POST', `/api/sessions/${id}/orders/medications`, { orderedBy: 'dr-qa', route: 'oral', ...o });
export const act = (id, oid, a, b) => req('POST', `/api/sessions/${id}/orders/medications/${oid}/${a}`, b);
export const sub = (id, oid, overrides = [], by = 'dr-qa') => act(id, oid, 'submit', { orderedBy: by, overrides });
export const ph = (id, oid, action, note, by = 'pharm-qa') => act(id, oid, 'pharmacy', { reviewerId: by, action, ...(note !== undefined ? { note } : {}) });
export const last = r => r.json?.orders?.medications?.at(-1);
export const ord = (r, oid) => r.json?.orders?.medications?.find(o => o.id === oid);
export const sess = async id => (await req('GET', `/api/sessions/${id}`)).json;
export { newSession, turn, req };
