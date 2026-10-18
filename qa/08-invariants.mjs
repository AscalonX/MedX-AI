// Data invariants over EVERY session currently in the store (run after seeding / after other scripts).
import { req, check, done } from './lib.mjs';
const list = (await req('GET', '/api/sessions')).json;
const bad = { offsets: [], supportedNoEv: [], loc: [], statusMismatch: [], ids: [], nq: [], audit: [], abstain: [], unsupportedShown: [] };
const L = v => v && ['th', 'it', 'en'].every(k => typeof v[k] === 'string' && v[k].trim());
for (const s of list) {
  const g = (await req('GET', `/api/sessions/${s.id}`)).json; const sum = g.session.summary; const T = Object.fromEntries(g.session.turns.map(t => [t.id, t]));
  const ev = (e, where) => { const t = T[e.turnId]; if (!t) return bad.offsets.push(`${s.code} ${where}: turn ${e.turnId} missing`); const sl = t.text.slice(e.start, e.end); if (sl !== e.quote && e.quote !== '[redacted]') bad.offsets.push(`${s.code} ${where}: "${e.quote}" != "${sl}"`); if (t.role !== 'patient') bad.offsets.push(`${s.code} ${where}: evidence on non-patient turn`); };
  if (g.session.turns.some((t, i, a) => i && t.at < a[i - 1].at)) bad.audit.push(`${s.code}: turns out of order`);
  const au = g.audit; if (au.some((a, i) => i && a.at < au[i - 1].at)) bad.audit.push(`${s.code}: audit out of order`); if (au[0]?.type !== 'session_created') bad.audit.push(`${s.code}: first audit is ${au[0]?.type}`);
  if (!sum) { if (!['collecting', 'taken_over'].includes(s.status)) bad.statusMismatch.push(`${s.code}: no summary but ${s.status}`); continue; }
  const ids = new Set();
  for (const f of sum.fields) {
    f.evidence.forEach(e => ev(e, f.key));
    if (f.status === 'supported' && (!f.evidence.length || !f.value)) bad.supportedNoEv.push(`${s.code} ${f.key}`);
    // Evidence may stay on an unsupported field for review (low match score, or an abstain downgrade); it must never
    // carry a supported-level confidence (extract.ts caps unsupported at 0.3; pipeline.ts abstain caps at 0.3).
    if (f.status === 'unsupported' && f.confidence > 0.3) bad.unsupportedShown.push(`${s.code} ${f.key} unsupported with confidence ${f.confidence}`);
    if (f.status === 'unsupported' && f.evidence.length && !sum.abstained && f.confidence >= 0.5) bad.unsupportedShown.push(`${s.code} ${f.key} unsupported but scored as supported`);
    if (f.value && !L(f.value)) bad.loc.push(`${s.code} ${f.key} ${JSON.stringify(f.value)}`);
    if (f.status === 'missing' && (f.value || f.evidence.length)) bad.unsupportedShown.push(`${s.code} ${f.key} missing but has value`);
    if (f.confidence < 0 || f.confidence > 1) bad.loc.push(`${s.code} ${f.key} confidence ${f.confidence}`);
  }
  for (const f of sum.redFlags) { f.evidence.forEach(e => ev(e, f.ruleId)); if (!L(f.label) || !L(f.action) || !L(f.patientMessage)) bad.loc.push(`${s.code} ${f.ruleId} localized`); }
  for (const m of sum.medications || []) { m.evidence.forEach(e => ev(e, 'med ' + m.nameOriginal)); if (ids.has(m.id)) bad.ids.push(`${s.code} dup ${m.id}`); ids.add(m.id); if (m.status === 'supported' && !m.evidence.length) bad.supportedNoEv.push(`${s.code} med ${m.id}`); }
  for (const a of sum.allergies || []) { a.evidence.forEach(e => ev(e, 'allergy')); if (ids.has(a.id)) bad.ids.push(`${s.code} dup ${a.id}`); ids.add(a.id); if (a.status === 'supported' && !a.evidence.length) bad.supportedNoEv.push(`${s.code} allergy ${a.id}`); }
  for (const a of sum.medAlerts || []) { a.evidence.forEach(e => ev(e, a.ruleId)); if (ids.has(a.id)) bad.ids.push(`${s.code} dup ${a.id}`); ids.add(a.id); if (!L(a.message) || !L(a.action)) bad.loc.push(`${s.code} alert ${a.ruleId} localized`); for (const mid of a.medIds) if (!(sum.medications || []).some(m => m.id === mid)) bad.ids.push(`${s.code} alert ${a.ruleId} refs missing med ${mid}`); }
  if (sum.nextQuestion && !L(sum.nextQuestion.text)) bad.loc.push(`${s.code} nextQuestion`);
  if (s.status === 'escalated' && !sum.redFlags.length) bad.statusMismatch.push(`${s.code}: escalated without red flag`);
  if (s.status !== 'escalated' && s.status !== 'taken_over' && sum.redFlags.length) bad.statusMismatch.push(`${s.code}: red flag present but status ${s.status}`);
  if (['escalated', 'approved', 'taken_over'].includes(s.status) && sum.nextQuestion) bad.nq.push(`${s.code}: nextQuestion present in ${s.status}`);
  if (s.status === 'needs_human' && !sum.abstained) bad.abstain.push(`${s.code}: needs_human but summary not abstained`);
  if (sum.abstained && !sum.abstainReason) bad.abstain.push(`${s.code}: abstained without reason`);
  if (s.status === 'approved' && !sum.fields.filter(f => f.required).every(f => ['approved', 'edited'].includes(f.status))) bad.statusMismatch.push(`${s.code}: approved but required fields not approved/edited`);
  if (s.status === 'awaiting_review' && (sum.abstained)) bad.statusMismatch.push(`${s.code}: awaiting_review but abstained`);
  const mc = sum.modelCalls.find(c => c.provider !== 'mock'); if (mc && !/amd/.test(mc.provider)) bad.audit.push(`${s.code}: unknown provider ${mc.provider}`);
}
for (const [k, v] of Object.entries(bad)) check('I-' + k, `invariant ${k} over ${list.length} sessions`, v.length === 0, v.slice(0, 6));
done();
