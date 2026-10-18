#!/usr/bin/env node
// End-to-end journey against a REAL running MedX server (next start), synthetic data only.
//   BASE=http://localhost:3133 node scripts/e2e-journey.mjs
// One PASS/FAIL line per step, a SUMMARY line, and exit code 1 when any step fails.
//
// patient intake -> nurse vitals + triage confirm -> consult (nurse, doctor, and on an approved session)
// -> sign note -> order with alert + alternatives -> submit -> pharmacist 1 return (alertIds + suggestedGenerics)
// -> doctor edits to a suggested generic + resubmits -> pharmacist 1 verify -> pharmacist 1 dispense 409
// -> pharmacist 2 partial checklist 400, full 200 -> pickup collected-before-call 409 -> call counter 2
// -> patient view (pickup ready, seenByStaff, no drug names / ids / notes) -> collected -> role 403s
// -> trace nodes -> metrics.pharmacy -> audit types -> every page route 200.
//
// Local servers count the POST rate limit per x-forwarded-for hop (30/min by default); this script spreads its
// requests over TEST-NET addresses so the journey is not throttled (E2E_SPREAD_IP=0 turns that off). On Vercel the
// edge overwrites x-forwarded-for, so the header has no effect there.

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const SPREAD = process.env.E2E_SPREAD_IP ? process.env.E2E_SPREAD_IP === '1' : LOCAL;
let ipSeq = Math.floor(Math.random() * 200) * 250;
const nextIp = () => { ipSeq++; return `198.18.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`; };

async function req(method, path, body, headers = {}) {
  const init = { method, headers: { ...headers } };
  if (SPREAD) init.headers['x-forwarded-for'] = nextIp();
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
  const started = Date.now();
  const res = await fetch(BASE + path, init);
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json, ms: Date.now() - started };
}
const results = [];
function step(name, ok, detail) {
  results.push({ name, ok: !!ok });
  const tail = ok || detail === undefined ? '' : ' -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${String(results.length).padStart(2, '0')} ${name}${tail}`);
  return !!ok;
}
/** Hard stop: later steps depend on this one. */
function must(name, ok, detail) {
  if (step(name, ok, detail)) return;
  throw new Error(`journey stopped at: ${name}`);
}
function summary() {
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nSUMMARY ${results.length - failed}/${results.length} passed, ${failed} failed (BASE ${BASE})`);
  process.exitCode = failed ? 1 : 0;
}

// Synthetic staff (packages/shared/src/staff.ts) and the synthetic golden case (data/cases/DEMO-GOLD.json).
const NURSE = 'Nurse Anna Rossi', DOCTOR = 'Dr. Marco Bianchi', PH1 = 'Pharmacist Laura Conti', PH2 = 'Pharmacist Nattaya Wong', OPS = 'Head Nurse Elena Greco';
// Kept verbatim with data/cases/DEMO-GOLD.json (w20: uncomplicated sore throat, no quinsy features).
const GOLD = "I've had a sore throat for two days and I can see white spots on my tonsils. It hurts to swallow. It's about 7 out of 10. I'm a 24 year old man. I'm allergic to penicillin, it gave me a rash. I don't take any medication.";
const VITALS = { heartRate: 104, systolicBP: 128, diastolicBP: 78, respRate: 18, tempC: 38.4, spo2: 98, onOxygen: false, consciousness: 'alert', painScore: 7 };
const NURSE_LINE = 'Can you swallow your saliva? Any drooling, voice change or noisy breathing?';
const DOCTOR_PATIENT_LINE = 'Yes, I can swallow my saliva, and my voice is normal.';
const ORDER = { drugText: 'amoxicillin', dose: '500 mg', route: 'oral', frequency: 'three times daily', duration: '5 days' };
const REORDER = { drugText: 'clarithromycin', dose: '500 mg', route: 'oral', frequency: 'twice daily', duration: '5 days' };
const OVERRIDE = 'Synthetic QA case: rash history is old and unclear, asking pharmacy to review the allergy alert';
const RETURN_NOTE = 'Penicillin allergy with rash on record. Returned with an option for prescriber review.';
const DISPENSE_NOTE = 'QA synthetic dispense note, label checked';
const ALL = { rightPatient: true, rightDrug: true, rightDose: true, rightRoute: true, allergyRechecked: true, labelled: true };

const S = id => `/api/sessions/${id}`;
const meds = r => r.json?.orders?.medications || [];
const high = o => (o?.checks || []).filter(c => c.severity === 'high');
const overridesFor = o => high(o).map(a => ({ alertId: a.id, reason: OVERRIDE }));
const audit = async id => (await req('GET', S(id))).json?.audit || [];

try {
  // ---------- 0. server ----------
  const health = await req('GET', '/api/health');
  must('GET /api/health 200 with provider and store kind', health.status === 200 && typeof health.json?.provider === 'string' && typeof health.json?.store === 'string', [health.status, health.text.slice(0, 200)]);
  console.log(`     health: provider=${health.json.provider} model=${health.json.model} store=${health.json.store} storeOk=${health.json.storeOk} commit=${health.json.commit} region=${health.json.region}`);

  // ---------- 1. patient intake ----------
  let r = await req('POST', '/api/sessions', { patientLang: 'en' });
  must('patient: POST /api/sessions -> 201 with a B- code', r.status === 201 && /^B-\d+/.test(r.json?.code || ''), [r.status, r.text.slice(0, 200)]);
  const id = r.json.id, code = r.json.code;
  r = await req('POST', `${S(id)}/turns`, { text: GOLD, inputMode: 'voice', clientTurnId: `qa-${Date.now()}` });
  must('patient: intake turn -> 200, awaiting_review, no red flag', r.status === 200 && r.json?.status === 'awaiting_review' && (r.json?.summary?.redFlags || []).length === 0, [r.status, r.json?.status, r.json?.summary?.redFlags?.map(f => f.ruleId)]);
  const fields = r.json.summary.fields;
  step('patient: every supported field carries an evidence quote (invariant 2)', fields.filter(f => f.status === 'supported').every(f => f.evidence.length > 0 && f.evidence.every(e => typeof e.quote === 'string' && e.quote.length > 0)), fields.map(f => [f.key, f.status, f.evidence.length]));
  step('patient: allergy captured from the patient words (penicillin)', JSON.stringify(r.json.summary).toLowerCase().includes('penicillin'), fields.find(f => f.key === 'allergies'));

  // ---------- 2. nurse: vitals + triage confirm ----------
  r = await req('POST', `${S(id)}/vitals`, { recordedBy: NURSE, vitals: VITALS });
  must('nurse: vitals -> 200 with a suggested triage level and NEWS2-style score', r.status === 200 && [1, 2, 3, 4, 5].includes(r.json?.triage?.suggestedLevel) && typeof r.json?.triage?.warningScore === 'number', [r.status, r.json?.triage]);
  const suggested = r.json.triage.suggestedLevel;
  console.log(`     triage: suggestedLevel=${suggested} warningScore=${r.json.triage.warningScore} vitalAlerts=${r.json.triage.vitalAlerts.length}`);
  r = await req('POST', `${S(id)}/triage/confirm`, { reviewerId: NURSE, level: suggested });
  must('nurse: triage confirm at the suggested level -> 200, confirmed by the nurse', r.status === 200 && r.json?.triage?.confirmed?.level === suggested && r.json?.triage?.confirmed?.by === NURSE, [r.status, r.json?.triage?.confirmed]);

  // ---------- 3. consult: nurse then doctor ----------
  r = await req('POST', `${S(id)}/consult/turns`, { speaker: 'clinician', mode: 'nurse', text: NURSE_LINE, inputMode: 'voice' });
  must('consult (nurse): clinician line -> 200', r.status === 200 && Array.isArray(r.json?.suggestions), [r.status, r.text.slice(0, 200)]);
  r = await req('GET', `${S(id)}/consult?mode=nurse`);
  step('consult (nurse): GET consult?mode=nurse -> 200', r.status === 200 && Array.isArray(r.json?.suggestions), [r.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(id)}/consult/turns`, { speaker: 'patient', mode: 'doctor', text: DOCTOR_PATIENT_LINE, inputMode: 'voice' });
  must('consult (doctor): patient line -> 200 with suggestions', r.status === 200 && Array.isArray(r.json?.suggestions), [r.status, r.text.slice(0, 200)]);
  r = await req('GET', `${S(id)}/consult?mode=doctor`);
  const consider = (r.json?.suggestions || []).find(x => x.id === 'consider:CR-THROAT-05:CR-THROAT-05-C1');
  step('consult (doctor): rule-based consideration CR-THROAT-05-C1 (FeverPAIN prompt) suggested for review', r.status === 200 && !!consider, (r.json?.suggestions || []).map(x => x.id));
  step('consult (doctor): no quinsy consideration (CR-THROAT-03) for this uncomplicated sore throat', r.status === 200 && !(r.json?.suggestions || []).some(x => x.id.includes('CR-THROAT-03')), (r.json?.suggestions || []).map(x => x.id));
  if (consider) {
    r = await req('POST', `${S(id)}/consult/suggestions/${encodeURIComponent(consider.id)}`, { reviewerId: DOCTOR, status: 'asked' });
    step('consult (doctor): keep the consideration (asked) -> 200', r.status === 200, [r.status, r.text.slice(0, 200)]);
  }

  // ---------- 4. sign note ----------
  r = await req('POST', `${S(id)}/consult/note`, { reviewerId: DOCTOR, mode: 'doctor', action: 'draft' });
  must('note: doctor draft -> 200 with note lines', r.status === 200 && Array.isArray(r.json?.note?.lines) && r.json.note.lines.length > 0, [r.status, r.text.slice(0, 200)]);
  const edits = r.json.note.lines.filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed in this synthetic QA visit' }));
  r = await req('POST', `${S(id)}/consult/note`, { reviewerId: DOCTOR, mode: 'nurse', action: 'sign', edits });
  step('note: sign in nurse mode -> 403', r.status === 403, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/consult/note`, { reviewerId: NURSE, mode: 'doctor', action: 'sign', edits });
  step('note: sign by a nurse in doctor mode -> 403 (role)', r.status === 403, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/consult/note`, { reviewerId: DOCTOR, mode: 'doctor', action: 'sign', edits });
  must('note: doctor signs -> 200, signed by the doctor', r.status === 200 && r.json?.note?.signed?.reviewerId === DOCTOR, [r.status, r.json?.note?.signed, r.text.slice(0, 200)]);
  const kept = (r.json.note.lines || []).some(l => /CR-THROAT-05/.test(JSON.stringify(l)));
  step('note: kept consideration is in the signed note', kept, r.json.note.lines.map(l => l.id));

  // ---------- 5. investigations + medication order with alert + alternatives ----------
  r = await req('POST', `${S(id)}/orders/investigations`, { orderedBy: DOCTOR, code: 'throat_swab', ...(consider ? { fromSuggestionId: consider.id } : {}) });
  step('orders: investigation throat swab (from the kept consideration) -> 200', r.status === 200 && (r.json?.orders?.investigations || []).some(i => i.code === 'throat_swab'), [r.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(id)}/orders/medications`, { orderedBy: DOCTOR, ...ORDER });
  must('orders: draft amoxicillin -> 200, status draft', r.status === 200 && meds(r).at(-1)?.status === 'draft', [r.status, r.text.slice(0, 200)]);
  let order = meds(r).at(-1); const orderId = order.id;
  const allergyAlert = order.checks.find(c => c.kind === 'allergy_conflict' && c.severity === 'high');
  must('orders: deterministic high allergy_conflict alert (penicillin) raised', !!allergyAlert, order.checks.map(c => [c.ruleId, c.kind, c.severity]));
  step('orders: alert lists alternatives for prescriber review (clarithromycin among them)', Array.isArray(allergyAlert.alternatives) && allergyAlert.alternatives.includes('clarithromycin'), allergyAlert.alternatives);
  console.log(`     alert ${allergyAlert.ruleId}: alternatives=${JSON.stringify(allergyAlert.alternatives)}`);

  // ---------- 6. submit ----------
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/submit`, { orderedBy: DOCTOR, overrides: [] });
  step('submit: without an override reason for the high alert -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/submit`, { orderedBy: DOCTOR, overrides: overridesFor(order) });
  must('submit: with override reasons -> 200, status submitted', r.status === 200 && meds(r).find(o => o.id === orderId)?.status === 'submitted', [r.status, r.text.slice(0, 200)]);
  order = meds(r).find(o => o.id === orderId);

  // ---------- 7. pharmacist 1 return with report ----------
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: PH1, action: 'return' });
  step('pharmacist 1: return without a note -> 400', r.status === 400, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: PH1, action: 'return', note: RETURN_NOTE, alertIds: [allergyAlert.id], suggestedGenerics: ['not-a-real-drug'] });
  step('pharmacist 1: return suggesting a non-dictionary generic -> 400', r.status === 400, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: PH1, action: 'return', note: RETURN_NOTE, alertIds: ['unknown-alert'], suggestedGenerics: ['clarithromycin'] });
  step('pharmacist 1: return citing an alert id not on this order -> 400', r.status === 400, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: PH1, action: 'return', note: RETURN_NOTE, alertIds: [allergyAlert.id], suggestedGenerics: ['clarithromycin'] });
  order = meds(r).find(o => o.id === orderId);
  must('pharmacist 1: return with alertIds + suggestedGenerics -> 200, status returned', r.status === 200 && order?.status === 'returned', [r.status, r.text.slice(0, 200)]);
  step('pharmacist 1: report stored {alertIds, suggestedGenerics} and the order is unchanged (never auto-applied)',
    JSON.stringify(order.pharmacist?.report) === JSON.stringify({ alertIds: [allergyAlert.id], suggestedGenerics: ['clarithromycin'] }) && order.drugText === 'amoxicillin' && order.pharmacist?.by === PH1, order.pharmacist);

  // ---------- 8. doctor edits to the suggested generic + resubmits ----------
  r = await req('POST', `${S(id)}/orders/medications`, { orderedBy: DOCTOR, orderId, ...REORDER });
  order = meds(r).find(o => o.id === orderId);
  must('doctor: edit the returned order to clarithromycin -> 200, draft, same order id', r.status === 200 && order?.status === 'draft' && order?.generic === 'clarithromycin', [r.status, order?.status, order?.generic, r.text.slice(0, 200)]);
  step('doctor: re-run checks clear the penicillin allergy conflict', !order.checks.some(c => c.kind === 'allergy_conflict'), order.checks.map(c => [c.ruleId, c.kind, c.severity]));
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/submit`, { orderedBy: DOCTOR, overrides: overridesFor(order) });
  must('doctor: resubmit -> 200, status submitted', r.status === 200 && meds(r).find(o => o.id === orderId)?.status === 'submitted', [r.status, r.text.slice(0, 200)]);

  // ---------- 9. pharmacist 1 verify; pharmacist 1 cannot dispense ----------
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: PH1, action: 'verify' });
  must('pharmacist 1: verify -> 200, status verified', r.status === 200 && meds(r).find(o => o.id === orderId)?.status === 'verified', [r.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/dispense`, { reviewerId: PH1, checklist: ALL });
  step('pharmacist 1: dispense own verified order -> 409 (two-person check)', r.status === 409, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'call', counter: '2' });
  step('pickup: call before dispense -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);

  // ---------- 10. pharmacist 2 dispense ----------
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/dispense`, { reviewerId: PH2, checklist: { ...ALL, allergyRechecked: false } });
  step('pharmacist 2: partial checklist -> 400', r.status === 400, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/dispense`, { reviewerId: PH2, checklist: ALL, note: DISPENSE_NOTE });
  order = meds(r).find(o => o.id === orderId);
  must('pharmacist 2: full checklist -> 200, status dispensed, dispensed by pharmacist 2', r.status === 200 && order?.status === 'dispensed' && order?.dispense?.by === PH2 && order?.pharmacist?.by === PH1, [r.status, order?.status, order?.dispense, r.text.slice(0, 200)]);

  // ---------- 11. pickup ----------
  const metricsBefore = (await req('GET', '/api/metrics')).json?.pharmacy;
  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'collected' });
  step('pickup: collected before call -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'call', counter: '2' });
  must('pickup: call to counter 2 -> 200, pickup ready at counter 2', r.status === 200 && r.json?.pickup?.status === 'ready' && r.json?.pickup?.counter === '2', [r.status, r.json?.pickup, r.text.slice(0, 200)]);
  const metricsReady = (await req('GET', '/api/metrics')).json?.pharmacy;
  step('metrics.pharmacy: readyForPickup counts this patient', metricsReady && metricsReady.readyForPickup >= 1, metricsReady);

  // ---------- 12. patient view ----------
  r = await req('GET', `${S(id)}?view=patient`);
  const pv = r.json?.session;
  must('patient view: GET ?view=patient -> 200', r.status === 200 && !!pv, [r.status, r.text.slice(0, 200)]);
  step('patient view: pickup ready at counter 2 and seenByStaff true', pv.pickup?.status === 'ready' && pv.pickup?.counter === '2' && pv.seenByStaff === true, { pickup: pv.pickup, seenByStaff: pv.seenByStaff });
  const leak = ['amoxicillin', 'clarithromycin', orderId, allergyAlert.id, RETURN_NOTE, DISPENSE_NOTE, OVERRIDE, NURSE, DOCTOR, PH1, PH2, 'pharmacist', 'audit', 'orders', 'triage', 'vitals', 'notes']
    .filter(s => r.text.toLowerCase().includes(String(s).toLowerCase()));
  step('patient view: no drug names, order/alert ids, notes, staff names or clinician state', leak.length === 0, leak);
  step('patient view: allowlisted keys only', Object.keys(pv).every(k => ['id', 'code', 'patientLang', 'status', 'turns', 'summary', 'pickup', 'seenByStaff'].includes(k)) && pv.turns.every(t => t.role === 'patient'), Object.keys(pv));

  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'collected' });
  must('pickup: collected -> 200, status collected', r.status === 200 && r.json?.pickup?.status === 'collected' && r.json?.pickup?.collectedBy === PH2, [r.status, r.json?.pickup]);
  r = await req('GET', `${S(id)}?view=patient`);
  step('patient view: pickup collected', r.status === 200 && r.json?.session?.pickup?.status === 'collected', r.json?.session?.pickup);
  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'call', counter: '3' });
  step('pickup: call again after collection -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(id)}/orders/medications/${orderId}/cancel`, { orderedBy: DOCTOR, reason: 'QA synthetic cancel attempt' });
  step('orders: cancel a dispensed order -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);

  // ---------- 13. role enforcement (403, atomic) ----------
  const before = await audit(id);
  const sessionBefore = (await req('GET', S(id))).json?.session;
  const denied = [
    ['vitals by a doctor', `${S(id)}/vitals`, { recordedBy: DOCTOR, vitals: VITALS }],
    ['triage confirm by a pharmacist', `${S(id)}/triage/confirm`, { reviewerId: PH1, level: suggested }],
    ['medication order by a nurse', `${S(id)}/orders/medications`, { orderedBy: NURSE, ...REORDER }],
    ['investigation order by ops', `${S(id)}/orders/investigations`, { orderedBy: OPS, code: 'crp' }],
    ['submit by a pharmacist', `${S(id)}/orders/medications/${orderId}/submit`, { orderedBy: PH1, overrides: [] }],
    ['cancel by a nurse', `${S(id)}/orders/medications/${orderId}/cancel`, { orderedBy: NURSE, reason: 'QA role check' }],
    ['pharmacy verify by a doctor', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: DOCTOR, action: 'verify' }],
    ['pharmacy return by a nurse', `${S(id)}/orders/medications/${orderId}/pharmacy`, { reviewerId: NURSE, action: 'return', note: 'QA role check' }],
    ['dispense by a nurse', `${S(id)}/orders/medications/${orderId}/dispense`, { reviewerId: NURSE, checklist: ALL }],
    ['pickup call by a doctor', `${S(id)}/pickup`, { reviewerId: DOCTOR, action: 'call', counter: '1' }],
    ['pickup collected by ops', `${S(id)}/pickup`, { reviewerId: OPS, action: 'collected' }],
    ['medicine reconciliation by a doctor', `${S(id)}/pharmacy-review`, { reviewerId: DOCTOR, medActions: [], alertActions: [], complete: true }],
    ['note sign by a pharmacist', `${S(id)}/consult/note`, { reviewerId: PH1, mode: 'doctor', action: 'sign', edits: [] }],
  ];
  for (const [name, path, body] of denied) {
    r = await req('POST', path, body);
    step(`roles: ${name} -> 403`, r.status === 403 && r.json?.code === 'bad_request', [r.status, r.text.slice(0, 160)]);
  }
  // Production runs MEDX_STRICT_ROLES=1: an actor outside the STAFF directory is refused too.
  if (process.env.E2E_STRICT_ROLES === '1') {
    r = await req('POST', `${S(id)}/vitals`, { recordedBy: 'qa-unknown-nurse', vitals: VITALS });
    step('roles (strict): vitals by an actor outside STAFF -> 403', r.status === 403, [r.status, r.text.slice(0, 160)]);
    r = await req('POST', `${S(id)}/pickup`, { reviewerId: 'qa-unknown-pharmacist', action: 'call', counter: '1' });
    step('roles (strict): pickup by an actor outside STAFF -> 403', r.status === 403, [r.status, r.text.slice(0, 160)]);
  }
  const after = await audit(id);
  const sessionAfter = (await req('GET', S(id))).json?.session;
  step('roles: refused writes changed neither the session nor the audit log', after.length === before.length && JSON.stringify(sessionAfter) === JSON.stringify(sessionBefore), { auditBefore: before.length, auditAfter: after.length });

  // ---------- 14. trace ----------
  r = await req('GET', `${S(id)}/trace`);
  const kinds = new Set((r.json?.nodes || []).map(n => n.kind));
  // "output" nodes are emitted only for an escalation (checked on the escalated session in step 17).
  const wantKinds = ['input', 'redact', 'red_flag_rules', 'model_screen', 'extract', 'verify', 'next_question', 'consult_rules', 'vitals_news2', 'triage_confirm', 'med_rules', 'order_check', 'clinician_action', 'pharmacist_action'];
  step('trace: GET /trace -> 200 with nodes and edges', r.status === 200 && r.json?.nodes?.length > 0 && Array.isArray(r.json?.edges), [r.status, r.text.slice(0, 200)]);
  step(`trace: node kinds cover the journey (${wantKinds.join(', ')})`, wantKinds.every(k => kinds.has(k)), { missing: wantKinds.filter(k => !kinds.has(k)), have: [...kinds] });
  const pharmNodes = (r.json?.nodes || []).filter(n => n.kind === 'pharmacist_action').length;
  step('trace: pharmacist actions include return, verify, dispense and pickup (>= 5 nodes)', pharmNodes >= 5, pharmNodes);
  const digest1 = r.json?.auditDigest;
  r = await req('GET', `${S(id)}/trace`);
  step('trace: auditDigest is deterministic across two reads', typeof digest1 === 'string' && digest1.length > 0 && r.json?.auditDigest === digest1, [digest1, r.json?.auditDigest]);
  step('trace: carries no patient words, staff names or notes', ![GOLD.slice(0, 40), DOCTOR_PATIENT_LINE, NURSE_LINE, RETURN_NOTE, DISPENSE_NOTE, OVERRIDE, PH1, PH2].some(x => r.text.includes(x)), 'trace JSON contained patient text, a note or a staff name');

  // ---------- 15. metrics.pharmacy ----------
  r = await req('GET', '/api/metrics');
  const ph = r.json?.pharmacy;
  step('metrics: GET /api/metrics -> 200 with pharmacy {toVerify, toDispense, readyForPickup, collectedToday}', r.status === 200 && ph && ['toVerify', 'toDispense', 'readyForPickup', 'collectedToday'].every(k => Number.isInteger(ph[k]) && ph[k] >= 0), [r.status, ph]);
  step('metrics: collectedToday went up by one after collection', metricsBefore && ph && ph.collectedToday === metricsBefore.collectedToday + 1, { before: metricsBefore, after: ph });

  // ---------- 16. audit types ----------
  const types = new Set(after.map(e => e.type));
  const wantTypes = ['session_created', 'turn_added', 'summary_generated', 'vitals_recorded', 'triage_confirmed', 'consult_turn', 'consult_suggestion', 'consult_note_signed', 'order_drafted', 'order_submitted', 'order_pharmacy_action', 'order_dispensed', 'pickup_called', 'pickup_collected'];
  step(`audit: every journey event type is logged (${wantTypes.length} types)`, wantTypes.every(t => types.has(t)), { missing: wantTypes.filter(t => !types.has(t)) });
  step('audit: event ids unique, chronological, every event belongs to this session', new Set(after.map(e => e.id)).size === after.length && after.every((e, i) => i === 0 || e.at >= after[i - 1].at) && after.every(e => e.sessionId === id), after.length);
  const actorOf = t => after.filter(e => e.type === t).map(e => e.actorId);
  step('audit: pharmacy actions attributed to P1 (return, verify) and P2 (dispense, pickup)', actorOf('order_pharmacy_action').every(a => a === PH1) && actorOf('order_dispensed').every(a => a === PH2) && actorOf('pickup_called').concat(actorOf('pickup_collected')).every(a => a === PH2), { pharmacy: actorOf('order_pharmacy_action'), dispensed: actorOf('order_dispensed'), pickup: actorOf('pickup_called') });
  step('audit: no raw patient sentence in any payload (invariant 5 spot check)', !after.some(e => JSON.stringify(e.payload).includes(GOLD.slice(0, 60))), 'payload contained the raw intake sentence');

  // ---------- 16b. a new prescription after collection starts a new pickup cycle; drafts never block the call ----------
  r = await req('POST', `${S(id)}/orders/medications`, { orderedBy: DOCTOR, drugText: 'paracetamol', dose: '500 mg', route: 'oral', frequency: 'every 6 hours', duration: '3 days' });
  const second = meds(r).at(-1);
  r = await req('POST', `${S(id)}/orders/medications/${second?.id}/submit`, { orderedBy: DOCTOR, overrides: overridesFor(second) });
  step('new cycle: submitting a new order after collection -> 200, pickup cleared', r.status === 200 && !r.json?.pickup, [r.status, r.json?.pickup]);
  r = await req('GET', `${S(id)}?view=patient`);
  step('new cycle: patient view shows "preparing" again', r.json?.session?.pickup?.status === 'preparing', r.json?.session?.pickup);
  await req('POST', `${S(id)}/orders/medications/${second?.id}/pharmacy`, { reviewerId: PH1, action: 'verify' });
  await req('POST', `${S(id)}/orders/medications/${second?.id}/dispense`, { reviewerId: PH2, checklist: ALL });
  await req('POST', `${S(id)}/orders/medications`, { orderedBy: DOCTOR, drugText: 'ibuprofen', dose: '200 mg', route: 'oral', frequency: 'three times daily' }); // left as a draft
  r = await req('POST', `${S(id)}/pickup`, { reviewerId: PH2, action: 'call', counter: '3' });
  step('new cycle: with a draft still with the prescriber, calling the patient for the newly dispensed order -> 200, ready at counter 3', r.status === 200 && r.json?.pickup?.status === 'ready' && r.json?.pickup?.counter === '3', [r.status, r.json?.pickup, r.text.slice(0, 160)]);
  const cycleAudit = await audit(id);
  step('new cycle: audit order_submitted carries pickupReset and the new pickup_called lists only the new order', cycleAudit.some(e => e.type === 'order_submitted' && e.payload.pickupReset === true) && JSON.stringify(cycleAudit.filter(e => e.type === 'pickup_called').at(-1)?.payload.orderIds) === JSON.stringify([second?.id]), cycleAudit.filter(e => e.type === 'pickup_called').map(e => e.payload.orderIds));

  // ---------- 17. consult on an approved session; red flags still first ----------
  r = await req('POST', '/api/sessions', { patientLang: 'en' }); const a = r.json?.id;
  r = await req('POST', `${S(a)}/turns`, { text: GOLD });
  const required = (r.json?.summary?.fields || []).filter(f => f.required);
  r = await req('POST', `${S(a)}/review`, { reviewerId: NURSE, actions: required.map(f => ({ fieldKey: f.key, action: 'approve' })) });
  must('approved session: nurse approves every required field -> approved', r.status === 200 && r.json?.status === 'approved', [r.status, r.json?.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(a)}/consult/turns`, { speaker: 'patient', mode: 'doctor', text: DOCTOR_PATIENT_LINE });
  step('approved session: doctor consult turn -> 200, intake stays approved', r.status === 200 && (await req('GET', S(a))).json?.session?.status === 'approved', [r.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(a)}/turns`, { text: 'Also my ear hurts' });
  step('approved session: plain patient /turns -> 409', r.status === 409, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `${S(a)}/consult/note`, { reviewerId: DOCTOR, mode: 'doctor', action: 'draft' });
  const aEdits = (r.json?.note?.lines || []).filter(l => l.status === 'unsupported' && l.id !== 'missing:fields').map(l => ({ lineId: l.id, text: 'Not assessed in this synthetic QA visit' }));
  r = await req('POST', `${S(a)}/consult/note`, { reviewerId: DOCTOR, mode: 'doctor', action: 'sign', edits: aEdits });
  step('approved session: doctor signs the note -> 200', r.status === 200 && r.json?.note?.signed?.reviewerId === DOCTOR, [r.status, r.text.slice(0, 200)]);
  r = await req('POST', `${S(a)}/consult/turns`, { speaker: 'patient', mode: 'doctor', text: 'Now I have crushing chest pain and I am sweating' });
  const aAfter = (await req('GET', S(a))).json?.session;
  step('approved session: a red-flag consult line still escalates (rules before any model call)', r.status === 200 && aAfter?.status === 'escalated' && (aAfter?.summary?.redFlags || []).some(f => /CHEST/.test(f.ruleId)), [r.status, aAfter?.status, aAfter?.summary?.redFlags?.map(f => f.ruleId)]);
  const aTrace = (await req('GET', `${S(a)}/trace`)).json;
  const escalation = (aTrace?.nodes || []).find(n => n.kind === 'output' && n.status === 'escalated');
  const skippedModel = (aTrace?.nodes || []).filter(n => ['model_screen', 'extract'].includes(n.kind) && n.status === 'skipped').length;
  step('approved session: trace shows the escalation output and the model steps skipped', !!escalation && skippedModel >= 2, { output: escalation?.detail?.en, skippedModel });

  // ---------- 17b. a new high alert after verification sends the order back (no dispense without a re-check) ----------
  r = await req('POST', '/api/demo/start', { stage: 'pharmacy_dispense' });
  const v = r.json?.id;
  if (r.status === 200 && v) {
    const vOrder = meds(await req('GET', S(v)).then(x => ({ json: x.json?.session }))).at(-1);
    step('re-check: demo case at pharmacy_dispense has a verified order (verified by pharmacist 1)', vOrder?.status === 'verified' && vOrder?.pharmacist?.by === PH1, [vOrder?.status, vOrder?.pharmacist?.by]);
    await req('POST', `${S(v)}/consult/turns`, { speaker: 'patient', mode: 'doctor', text: `Also I remember now that I am allergic to ${vOrder?.generic}, it gave me a rash.` });
    const re = meds(await req('GET', S(v)).then(x => ({ json: x.json?.session }))).find(o => o.id === vOrder?.id);
    step('re-check: a newly stated allergy raises a high alert and the verified order goes back to pharmacist 1 (submitted + recheck)', re?.status === 'submitted' && re?.recheck?.reason === 'new_high_alert' && re.checks.some(c => c.severity === 'high' && c.kind === 'allergy_conflict'), [re?.status, re?.recheck, re?.checks?.map(c => c.ruleId)]);
    r = await req('POST', `${S(v)}/orders/medications/${vOrder?.id}/dispense`, { reviewerId: PH2, checklist: ALL });
    step('re-check: pharmacist 2 cannot dispense it (409 "Re-check needed")', r.status === 409 && /re-check/i.test(r.json?.error || ''), [r.status, r.text.slice(0, 160)]);
    step('re-check: the audit log records order_recheck (actor system)', (await audit(v)).some(e => e.type === 'order_recheck' && e.actor === 'system'), 'no order_recheck audit event');
  } else step('re-check: POST /api/demo/start {stage: pharmacy_dispense} -> 200', false, [r.status, r.text.slice(0, 160)]);

  // ---------- 18. redaction spot check (invariant 5) ----------
  r = await req('POST', '/api/sessions', { patientLang: 'en' }); const p = r.json?.id;
  r = await req('POST', `${S(p)}/turns`, { text: 'Headache since this morning, 4/10. Call me on 081 234 5678 or qa.patient@example.com.' });
  const stored = JSON.stringify((await req('GET', S(p))).json || {});
  step('redaction: phone number and email never stored or returned', r.status === 200 && !stored.includes('081 234 5678') && !stored.includes('qa.patient@example.com'), [r.status, stored.includes('081 234 5678'), stored.includes('qa.patient@example.com')]);

  // ---------- 19. page routes ----------
  const personas = ['patient', 'nurse-rossi', 'doctor-bianchi', 'pharm-conti', 'pharm-wong', 'ops-head'];
  const pages = ['/', '/th', '/it', '/demo', ...personas.map(x => `/demo/${x}`), '/home', '/review', `/review/${id}`, `/review/${id}/consult`, `/review/${id}/consult?mode=doctor`, `/review/${id}/vitals`, `/review/${id}/orders`, `/review/${id}/trace`, '/pharmacy', `/pharmacy/${id}`, '/ops', '/patient/', '/patient/index.html', '/robots.txt', '/sitemap.xml', '/opengraph-image.png'];
  // fetch follows redirects (e.g. /patient/ -> 308 -> /patient, rewritten to the Expo index.html); the hop is reported.
  const pageResults = await Promise.all(pages.map(async path => { const x = await fetch(BASE + path); await x.arrayBuffer(); return [path, x.status, x.redirected ? new URL(x.url).pathname + new URL(x.url).search : '']; }));
  for (const [path, status, to] of pageResults) step(`page: GET ${path} -> 200${to ? ` (redirected to ${to})` : ''}`, status === 200, status);
  console.log(`     journey session ${code} (${id})`);
} catch (error) {
  if (!String(error?.message).startsWith('journey stopped at')) { step('journey ran without an exception', false, String(error?.stack || error)); }
  else console.log(`     ${error.message} (later steps depend on it)`);
} finally {
  summary();
}
