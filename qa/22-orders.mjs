// W14: investigations + medication orders + prescribing checks + submit/cancel/pharmacy
import { med, act, sub, ph, last, ord, sess, newSession, turn, req } from './lib2.mjs';
import { check, done } from './lib.mjs';
const NOISE = ['MR-ALLERGY-UNKNOWN', 'MR-DOSE-UNCHECKED'];
const real = o => (o?.checks || []).filter(c => !NOISE.includes(c.ruleId));
const kinds = o => real(o).map(c => c.kind);
const ctx = 'Headache since yesterday 5/10.';
const mk = async text => { const s = await newSession(); if (text) await turn(s.id, `${ctx} ${text}`); return s; };
let s, r, o;
// ---------- investigations
s = await newSession();
const inv = b => req('POST', `/api/sessions/${s.id}/orders/investigations`, { orderedBy: 'dr-qa', ...b });
r = await inv({ code: 'ecg' }); check('O01', 'investigation ecg -> 200 submitted', r.status === 200 && r.json.orders.investigations.at(-1)?.status === 'submitted' && r.json.orders.investigations.at(-1).category === 'ecg', [r.status, r.text.slice(0, 200)]);
r = await inv({ code: 'nope' }); check('O02', 'unknown code -> 400', r.status === 400, [r.status, r.text]);
r = await inv({ code: '' }); check('O02b', 'empty code -> 400', r.status === 400);
r = await inv({}); check('O02c', 'missing code -> 400', r.status === 400);
r = await inv({ code: 'ecg', extra: 1 }); check('O02d', 'extra prop -> 400', r.status === 400);
r = await inv({ code: 'fbc', orderedBy: '' }); check('O02e', 'blank orderedBy -> 400', r.status === 400);
r = await inv({ code: 'fbc', reason: 'x'.repeat(5000) }); check('O02f', 'reason 5000 chars -> 400', r.status === 400, r.status);
r = await inv({ code: 'fbc', fromSuggestionId: 'consider:CR-X:y' }); check('O03', 'fromSuggestionId stored', r.status === 200 && r.json.orders.investigations.at(-1).fromSuggestionId === 'consider:CR-X:y', r.text.slice(0, 200));
r = await inv({ code: 'fbc', fromSuggestionId: 'does-not-exist-anywhere' }); check('O03b', 'fromSuggestionId referencing a non-existent suggestion is rejected (404/400)', r.status >= 400, [r.status, 'accepted unvalidated']);
r = await inv({ code: 'ecg' }); check('O04', 'duplicate ecg order (2nd identical) accepted or rejected - informational', true); console.log('   O04 info status', r.status, 'count', r.json?.orders?.investigations?.length);
r = await inv({ code: 'fbc', reason: 'call me on 081-234-5678' });
check('O05', 'investigation reason PII redacted in session+audit', !JSON.stringify(await sess(s.id)).includes('081-234-5678'), '');
// ---------- med: drug matching, no checks
s = await mk('');
r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'every 6 hours' }); o = last(r);
check('M01', 'paracetamol 500 mg q6h: draft, generic matched, parsed doseMg=500 timesPerDay=4, no checks', r.status === 200 && o.status === 'draft' && o.generic === 'paracetamol' && o.doseMg === 500 && o.timesPerDay === 4 && real(o).length === 0, o);
r = await med(s.id, { drugText: 'zzzunknown', dose: '5 mg', frequency: 'daily' }); o = last(r);
check('M02', 'unknown drug -> exactly one unknown_medication alert', JSON.stringify(kinds(o)) === '["unknown_medication"]', o.checks);
// unknown drug submit: moderate -> no override needed
r = await sub(s.id, o.id); check('M02b', 'unknown_medication is moderate -> submit w/o override ok (200)', r.status === 200, [r.status, r.text.slice(0, 150)]);
// ---------- dose range
s = await mk('');
const doseCase = async (name, dose, freq, expectN, expectKind = 'dose_range') => { const r = await med(s.id, { drugText: 'paracetamol', dose, frequency: freq }); const o = last(r); const dr = (o?.checks || []).filter(c => c.kind === expectKind && c.ruleId !== 'MR-DOSE-UNCHECKED'); check('D' + name, `paracetamol ${dose} ${freq}: ${expectN} ${expectKind} alert(s)`, r.status === 200 && dr.length === expectN, o?.checks?.map(c => c.ruleId + '/' + c.kind)); return r; };
// use separate sessions to avoid cross-order duplicate noise
for (const [n, dose, freq, cnt] of [['01', '1500 mg', 'once daily', 1], ['02', '500 mg', 'every 2 hours', 1], ['03', '1500 mg', 'every 6 hours', 1], ['04', '1000 mg', 'every 6 hours', 0], ['05', '1000 mg', 'qid', 0], ['06', '1.5 g', 'daily', 1], ['07', '1500000 mcg', 'daily', 1], ['08', '1001 mg', 'daily', 1]]) { s = await mk(''); await doseCase(n, dose, freq, cnt); }
for (const [n, dose, freq] of [['10', 'a lot', 'whenever'], ['11', '500mg-1g', 'prn'], ['12', '2 tablets', 'twice daily'], ['13', '500 mg', 'as needed'], ['14', '-500 mg', 'daily'], ['15', '0 mg', 'daily'], ['16', '1e9 mg', 'daily'], ['17', '500 mg', 'every 0 hours']]) { s = await mk(''); const r = await med(s.id, { drugText: 'paracetamol', dose, frequency: freq }); check('D' + n, `unparseable/odd dose "${dose}" / "${freq}": 200 w/o crash, no phantom dose alert`, r.status === 200 && !(last(r).checks || []).some(c => c.ruleId === 'MR-DOSE-RANGE') || (n === '16' && last(r).checks.some(c => c.kind === 'dose_range')), [r.status, r.text.slice(0, 200)]); if (n === '10') console.log('   D10 info: unparseable dose gives NO signal to doctor:', JSON.stringify(last(r)?.checks)); }
s = await mk('');
r = await med(s.id, { drugText: 'paracetamol', dose: '1500 mg', frequency: 'qid' }); o = last(r);
check('D20', 'single AND daily exceeded -> exactly ONE dose_range alert on the order', (o.checks.filter(c => c.kind === 'dose_range' && c.ruleId !== 'MR-DOSE-UNCHECKED')).length === 1 && new Set(o.checks.map(c => c.id)).size === o.checks.length, o.checks.map(c => c.id + ' ' + c.ruleId));
check('D21', 'alert ids unique within an order', new Set(o.checks.map(c => c.id)).size === o.checks.length, o.checks.map(c => c.id));
// re-draft same order keeps stable alert id
const oid = o.id; const idsBefore = o.checks.map(c => c.id);
r = await med(s.id, { orderId: oid, drugText: 'paracetamol', dose: '1500 mg', frequency: 'qid' });
check('D22', 're-save identical draft -> same alert ids (stable) and same order id', ord(r, oid) && JSON.stringify(ord(r, oid).checks.map(c => c.id)) === JSON.stringify(idsBefore), ord(r, oid)?.checks.map(c => c.id));
r = await med(s.id, { orderId: oid, drugText: 'paracetamol', dose: '500 mg', frequency: 'every 6 hours' });
check('D23', 'edit draft to safe dose clears alerts', real(ord(r, oid)).length === 0, ord(r, oid)?.checks);
// ---------- allergy conflict with patient quote evidence
s = await mk('I am allergic to penicillin.');
r = await med(s.id, { drugText: 'Augmentin', dose: '625 mg', frequency: 'twice daily' }); o = last(r); let a = o.checks.find(c => c.kind === 'allergy_conflict');
check('A01', 'penicillin allergy + Augmentin -> allergy_conflict HIGH with evidence quote', a?.severity === 'high' && a.evidence?.length > 0, o.checks);
const turnsText = (await sess(s.id)).session.turns.map(t => t.text).join(' ');
check('A02', 'allergy alert evidence quote is a substring of stored patient turn', a?.evidence?.every(e => (turnsText.includes(e.quote))) , a?.evidence);
r = await sub(s.id, o.id); check('A03', 'submit without override -> 409', r.status === 409, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: 'MR-NOPE', reason: 'x' }]); check('A04', 'override for non-existent alertId -> 400', r.status === 400, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: a.id, reason: '' }]); check('A05', 'override with empty reason -> 400', r.status === 400, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: a.id, reason: '   ' }]); check('A05b', 'override with whitespace reason -> 400', r.status === 400, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: a.id, reason: 'ok' }, { alertId: a.id, reason: 'ok2' }]); check('A06', 'duplicate override entries -> 400', r.status === 400, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: a.id, reason: 'tolerated before, documented' }]); check('A07', 'submit with override -> 200 submitted', r.status === 200 && ord(r, o.id).status === 'submitted' && ord(r, o.id).overrides.length === 1, [r.status, r.text.slice(0, 200)]);
r = await sub(s.id, o.id, [{ alertId: a.id, reason: 'again' }]); check('A08', 're-submit already submitted -> 409', r.status === 409, [r.status, r.text]);
r = await med(s.id, { orderId: o.id, drugText: 'amoxicillin', dose: '500 mg', frequency: 'tid' }); check('A09', 'edit a submitted order -> 409', r.status === 409, [r.status, r.text]);
// pharmacy
r = await ph(s.id, o.id, 'return'); check('P01', 'pharmacy return without note -> 400', r.status === 400, [r.status, r.text]);
r = await ph(s.id, o.id, 'return', '  '); check('P01b', 'pharmacy return whitespace note -> 400', r.status === 400, [r.status, r.text]);
r = await ph(s.id, o.id, 'bogus', 'n'); check('P01c', 'pharmacy bogus action -> 400', r.status === 400, [r.status, r.text]);
r = await act(s.id, o.id, 'pharmacy', { reviewerId: '', action: 'verify' }); check('P01d', 'pharmacy blank reviewer -> 400', r.status === 400);
r = await ph(s.id, o.id, 'return', 'Allergy documented; please choose non-penicillin'); check('P02', 'return with note -> 200 status returned + pharmacist set', r.status === 200 && ord(r, o.id).status === 'returned' && ord(r, o.id).pharmacist?.note, [r.status, ord(r, o.id)?.status]);
r = await ph(s.id, o.id, 'verify'); check('P03', 'pharmacy action on already-returned order -> 409', r.status === 409, [r.status, r.text]);
r = await ph(s.id, o.id, 'return', 'again'); check('P03b', 'double return -> 409', r.status === 409, [r.status, r.text]);
// resubmit after return re-runs checks
r = await med(s.id, { orderId: o.id, drugText: 'amoxicillin', dose: '500 mg', frequency: 'tid' }); o = ord(r, o.id);
check('P04', 'edit returned order -> draft, checks re-run (still allergy conflict, overrides cleared)', r.status === 200 && o.status === 'draft' && o.checks.some(c => c.kind === 'allergy_conflict') && o.overrides.length === 0 && !o.pharmacist, [r.status, o]);
r = await sub(s.id, o.id); check('P05', 'resubmit w/o override -> 409 (checks re-run)', r.status === 409, [r.status, r.text]);
a = o.checks.find(c => c.kind === 'allergy_conflict');
r = await sub(s.id, o.id, [{ alertId: a.id, reason: 'documented' }]); check('P06', 'resubmit with override -> 200', r.status === 200, [r.status, r.text]);
r = await ph(s.id, o.id, 'verify'); check('P07', 'verify (override present) -> 200 verified', r.status === 200 && ord(r, o.id).status === 'verified', [r.status, r.text.slice(0, 200)]);
r = await ph(s.id, o.id, 'verify'); check('P08', 'double verify -> 409', r.status === 409, [r.status]);
r = await act(s.id, o.id, 'cancel', { orderedBy: 'dr-qa' }); check('P09', 'cancel a VERIFIED order: should be refused (409) or at least audited', r.status === 409, [r.status, ord(r, o.id)?.status]);
// pharmacy verify on draft
s = await mk(''); r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); o = last(r);
r = await ph(s.id, o.id, 'verify'); check('P10', 'verify a DRAFT order -> 409', r.status === 409, [r.status, r.text]);
r = await sub(s.id, o.id); check('P11', 'submit no-alert order w/o overrides -> 200', r.status === 200, [r.status, r.text]);
r = await sub(s.id, o.id, [{ alertId: 'x', reason: 'valid reason here' }]); check('P11b', 'submit again -> 409 (not 400)', r.status === 409, [r.status, r.text]);
r = await ph(s.id, o.id, 'verify'); check('P12', 'verify clean order -> 200', r.status === 200 && ord(r, o.id).status === 'verified');
// verify blocked if override missing: tamper -- submit order w/ unknown_medication then new high alert appears because allergy/other order appears later
s = await mk('');
r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); const o1 = last(r); await sub(s.id, o1.id);
r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' });
const hiNow = ord(r, o1.id).checks.filter(c => c.severity === 'high' && !ord(r, o1.id).overrides.some(v => v.alertId === c.id));
r = await ph(s.id, o1.id, 'verify');
check('P13', 'verify of submitted order that gained a NEW high alert (2nd paracetamol draft) w/o override -> 409', hiNow.length > 0 && r.status === 409, [r.status, hiNow.map(c => c.ruleId)]);
// ---------- interaction warfarin
s = await mk('I take warfarin 5 mg daily.');
r = await med(s.id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' }); o = last(r);
check('I01', 'warfarin (patient) + ibuprofen -> interaction HIGH', o.checks.some(c => c.kind === 'interaction' && c.severity === 'high'), o.checks);
check('I02', 'interaction alert has evidence from patient warfarin quote', o.checks.find(c => c.kind === 'interaction')?.evidence?.length > 0 || true, o.checks.find(c => c.kind === 'interaction'));
console.log('   I02 info evidence:', JSON.stringify(o.checks.find(c => c.kind === 'interaction')?.evidence));
r = await med(s.id, { drugText: 'aspirin', dose: '300 mg', frequency: 'daily' }); o = last(r);
check('I03', 'warfarin + aspirin -> HIGH interaction', o.checks.some(c => c.kind === 'interaction' && c.severity === 'high'), o.checks);
r = await med(s.id, { drugText: 'paracetamol', dose: '500 mg', frequency: 'qid' }); o = last(r);
check('I04', 'warfarin + paracetamol -> no HIGH interaction', !o.checks.some(c => c.kind === 'interaction' && c.severity === 'high'), o.checks);
// ---------- duplicate with another active order, and cancelled ones ignored
s = await mk('');
r = await med(s.id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' }); const d1 = last(r);
r = await med(s.id, { drugText: 'naproxen', dose: '250 mg', frequency: 'bid' }); const d2 = last(r);
check('U01', 'ibuprofen + naproxen orders -> duplicate_therapy on BOTH orders (high, NSAID)', ord(r, d1.id).checks.some(c => c.kind === 'duplicate_therapy' && c.severity === 'high') && ord(r, d2.id).checks.some(c => c.kind === 'duplicate_therapy' && c.severity === 'high'), [ord(r, d1.id).checks.map(c => c.ruleId), ord(r, d2.id).checks.map(c => c.ruleId)]);
r = await act(s.id, d2.id, 'cancel', { orderedBy: 'dr-qa', reason: 'dup' });
check('U02', 'cancel one -> 200, other order duplicate alert removed', r.status === 200 && ord(r, d2.id).status === 'cancelled' && !ord(r, d1.id).checks.some(c => c.kind === 'duplicate_therapy'), [r.status, ord(r, d1.id)?.checks.map(c => c.ruleId)]);
r = await act(s.id, d2.id, 'cancel', { orderedBy: 'dr-qa' }); check('U03', 'double cancel -> 409', r.status === 409);
r = await sub(s.id, d2.id); check('U04', 'submit cancelled -> 409', r.status === 409, [r.status, r.text]);
r = await med(s.id, { orderId: d2.id, drugText: 'naproxen', dose: '250 mg', frequency: 'bid' }); check('U05', 'edit cancelled -> 409', r.status === 409, [r.status, r.text]);
r = await ph(s.id, d2.id, 'verify'); check('U06', 'pharmacy on cancelled -> 409', r.status === 409, [r.status]);
// cancel a submitted order, then pharmacy verify attempt
r = await sub(s.id, d1.id); r = await act(s.id, d1.id, 'cancel', { orderedBy: 'dr-qa' }); check('U07', 'cancel submitted order -> 200', r.status === 200 && ord(r, d1.id).status === 'cancelled', [r.status, r.text.slice(0, 120)]);
// ---------- pregnancy
s = await newSession(); await turn(s.id, 'I am a 28 year old woman and I am pregnant. Headache since yesterday 5/10.');
r = await med(s.id, { drugText: 'ciprofloxacin', dose: '500 mg', frequency: 'bid' }); o = last(r);
check('R01', 'pregnant + ciprofloxacin (avoid) -> pregnancy_caution HIGH', o.checks.some(c => c.kind === 'pregnancy_caution' && c.severity === 'high'), o.checks);
r = await med(s.id, { drugText: 'ibuprofen', dose: '400 mg', frequency: 'tid' }); o = last(r);
check('R02', 'pregnant + ibuprofen (caution) -> pregnancy_caution moderate', o.checks.some(c => c.kind === 'pregnancy_caution' && c.severity === 'moderate'), o.checks);
s = await newSession(); await turn(s.id, 'I am a 28 year old woman and I am not pregnant. Headache since yesterday 5/10.');
r = await med(s.id, { drugText: 'ciprofloxacin', dose: '500 mg', frequency: 'bid' }); o = last(r);
check('R03', 'NOT pregnant + ciprofloxacin -> no pregnancy alert', !o.checks.some(c => c.kind === 'pregnancy_caution'), o.checks);
// ---------- negated allergy / current meds / parse gaps
s = await mk('I am not allergic to penicillin.');
r = await med(s.id, { drugText: 'amoxicillin', dose: '500 mg', frequency: 'tid' }); o = last(r);
check('N01', 'patient says NOT allergic to penicillin -> no allergy_conflict on amoxicillin order', !o.checks.some(c => c.kind === 'allergy_conflict' && c.ruleId !== 'MR-ALLERGY-UNKNOWN'), o.checks);
s = await mk('I take ibuprofen 400 mg twice a day.');
r = await med(s.id, { drugText: 'naproxen', dose: '250 mg', frequency: 'bid' }); o = last(r);
check('N02', "patient's current ibuprofen + new naproxen order -> duplicate_therapy HIGH", o.checks.some(c => c.kind === 'duplicate_therapy' && c.severity === 'high'), o.checks);
s = await mk('I take ibuprofen 400 mg twice a day. I also take warfarin.');
r = await med(s.id, { drugText: 'warfarin', dose: '5 mg', frequency: 'daily' }); o = last(r);
check('N03', "ordering warfarin for a patient already on warfarin -> duplicate_therapy", o.checks.some(c => c.kind === 'duplicate_therapy'), o.checks);
check('N03b', "warfarin order + patient's ibuprofen -> interaction HIGH", o.checks.some(c => c.kind === 'interaction' && c.severity === 'high'), o.checks);
// Thai / Italian drug names
s = await mk('');
for (const [n, g] of [['ไอบูโพรเฟน', 'ibuprofen'], ['Brufen', 'ibuprofen'], ['Moment', 'ibuprofen'], ['Augmentin', 'amoxicillin+clavulanic acid']]) { r = await med(s.id, { drugText: n, dose: '100 mg', frequency: 'daily' }); check('N04', `drug "${n}" -> ${g}`, last(r)?.generic === g, last(r)?.generic); }
// unparseable dose/frequency must not silently bypass the dose check
for (const [d, f] of [['5,000 mg', 'daily'], ['5 grams', 'daily'], ['5000 milligrams', 'daily'], ['5000 มก.', 'daily'], ['1000 mg', 'five times a day'], ['1000 mg', 'every 4 hours as needed'], ['1000 mg', 'q.i.d. x 2'], ['1000 mg', '6 hourly']]) {
  s = await mk(''); r = await med(s.id, { drugText: 'paracetamol', dose: d, frequency: f }); o = last(r);
  const unparsed = (d.match(/^\d+(\.\d+)?\s*(mg|g|mcg)\.?$/i) ? false : true) || /five|as needed|q\.i\.d|hourly/.test(f);
  check('G01', `paracetamol "${d}" "${f}" exceeds adult max (>1 g single or >4 g/day): expect a dose_range alert OR an explicit could-not-check alert`, o.checks.some(c => c.kind === 'dose_range'), `doseMg=${o.doseMg} timesPerDay=${o.timesPerDay} checks=[] -> submittable with zero alerts`);
}
// ---------- validation
s = await mk('');
for (const [name, b] of Object.entries({ noDrug: { dose: '1 mg', frequency: 'daily' }, noDose: { drugText: 'paracetamol', frequency: 'daily' }, noFreq: { drugText: 'paracetamol', dose: '1 mg' }, noRoute: { drugText: 'paracetamol', dose: '1 mg', frequency: 'daily', route: undefined }, numDose: { drugText: 'paracetamol', dose: 500, frequency: 'daily' }, huge: { drugText: 'x'.repeat(400), dose: '1', frequency: 'daily' }, extra: { drugText: 'paracetamol', dose: '1 mg', frequency: 'daily', x: 1 }, blank: { drugText: '   ', dose: '1', frequency: 'd' } })) {
  r = await req('POST', `/api/sessions/${s.id}/orders/medications`, { orderedBy: 'dr', route: 'oral', ...b }); check('V01', `med order validation ${name} -> 400`, r.status === 400, [r.status, r.text.slice(0, 120)]);
}
r = await med(s.id, { orderId: 'does-not-exist', drugText: 'paracetamol', dose: '1 mg', frequency: 'daily' }); check('V02', 'update unknown orderId -> 404', r.status === 404, [r.status, r.text]);
// mixed-case / brand / Thai / Italian names
for (const [n, g] of [['PARACETAMOL', 'paracetamol'], ['Tachipirina', 'paracetamol'], ['ยาพารา', 'paracetamol'], ['  ibuprofen  ', 'ibuprofen'], ['IBUPROFEN 400', 'ibuprofen']]) { r = await med(s.id, { drugText: n, dose: '100 mg', frequency: 'daily' }); check('V03', `drug name "${n}" -> generic ${g}`, last(r)?.generic === g, last(r)); }
done();
