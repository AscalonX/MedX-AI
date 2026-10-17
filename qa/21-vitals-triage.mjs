// W14: vitals + NEWS2 triage + triage confirm
import { req, check, done, newSession } from './lib.mjs';
const vit = (id, vitals, by = 'nurse-qa') => req('POST', `/api/sessions/${id}/vitals`, { recordedBy: by, vitals });
const full = { heartRate: 75, systolicBP: 120, diastolicBP: 80, respRate: 16, tempC: 36.8, spo2: 98, onOxygen: false, consciousness: 'alert' };
let s = await newSession(), r;
r = await vit(s.id, { heartRate: 118, systolicBP: 92, diastolicBP: 60, respRate: 24, tempC: 39.1, spo2: 93, onOxygen: false, consciousness: 'alert' });
check('V01', 'critical set HR118/SBP92/RR24/T39.1/SpO2 93 -> level 2', r.status === 200 && r.json.triage?.suggestedLevel === 2, [r.status, r.json?.triage]);
check('V01b', 'critical: warningScore is a number >= 5', typeof r.json?.triage?.warningScore === 'number' && r.json.triage.warningScore >= 5, r.json?.triage?.warningScore);
s = await newSession(); r = await vit(s.id, full);
check('V02', 'complete normal -> level 4, score 0', r.json?.triage?.suggestedLevel === 4 && r.json.triage.warningScore === 0, r.json?.triage);
s = await newSession(); r = await vit(s.id, { heartRate: 75, systolicBP: 120 });
check('V03', 'incomplete normal -> level 3 (never 4) + incomplete reason', r.json?.triage?.suggestedLevel === 3 && r.json.triage.reasons.some(x => /incomplete/i.test(x.en)), r.json?.triage);
s = await newSession(); r = await vit(s.id, { spo2: 85 });
check('V04', 'single SpO2 85 (3 pts) -> level <=2', r.json?.triage?.suggestedLevel <= 2, r.json?.triage);
s = await newSession(); r = await vit(s.id, { ...full, consciousness: 'new_confusion' });
check('V05', 'new confusion (3 pts single band) -> level 2', r.json?.triage?.suggestedLevel === 2, r.json?.triage);
s = await newSession(); r = await vit(s.id, { ...full, onOxygen: true });
check('V06', 'on oxygen otherwise normal -> score 2 -> level 3', r.json?.triage?.suggestedLevel === 3 && r.json.triage.warningScore === 2, r.json?.triage);
s = await newSession(); r = await vit(s.id, { ...full, spo2: 91 });
check('V06b', 'SpO2 91 (3pts) -> level 2', r.json?.triage?.suggestedLevel === 2, r.json?.triage);
// red flag + vitals: emergency red flag => level 1
s = await newSession(); await req('POST', `/api/sessions/${s.id}/turns`, { text: 'I have crushing chest pain and I am sweating' });
r = await vit(s.id, full);
check('V07', 'emergency red flag + normal vitals -> level 1', r.json?.triage?.suggestedLevel === 1, r.json?.triage);
// range validation
s = await newSession();
for (const [name, v] of Object.entries({ hr0: { heartRate: 0 }, hr300: { heartRate: 300 }, hrNeg: { heartRate: -5 }, hrStr: { heartRate: '80' }, hrNaN: { heartRate: null }, sbp500: { systolicBP: 500 }, dbpGtSbp: { systolicBP: 100, diastolicBP: 120 }, dbpEqSbp: { systolicBP: 100, diastolicBP: 100 }, temp50: { tempC: 50 }, temp20: { tempC: 20 }, spo2_101: { spo2: 101 }, spo2_30: { spo2: 30 }, rr0: { respRate: 0 }, pain11: { painScore: 11 }, painFrac: { painScore: 2.5 }, painNeg: { painScore: -1 }, consBad: { consciousness: 'sleepy' }, oxyStr: { onOxygen: 'yes' }, unknownField: { heartRate: 80, weight: 70 }, empty: {}, arr: [1], str: 'x' })) {
  r = await vit(s.id, v); check('V10', `invalid vitals ${name} -> 400`, r.status === 400, [r.status, r.text.slice(0, 150)]);
}
const after = (await req('GET', `/api/sessions/${s.id}`)).json.session;
check('V11', 'rejected vitals never stored', !(after.vitals || []).length, after.vitals);
for (const [name, body] of Object.entries({ noBy: { vitals: { heartRate: 80 } }, blankBy: { recordedBy: '  ', vitals: { heartRate: 80 } }, numBy: { recordedBy: 5, vitals: { heartRate: 80 } }, noVitals: { recordedBy: 'n' }, extra: { recordedBy: 'n', vitals: { heartRate: 80 }, x: 1 } })) {
  r = await req('POST', `/api/sessions/${s.id}/vitals`, body); check('V12', `bad envelope ${name} -> 400`, r.status === 400, [r.status, r.text.slice(0, 120)]);
}
// boundaries accepted
for (const [name, v] of Object.entries({ hr20: { heartRate: 20 }, hr250: { heartRate: 250 }, t43: { tempC: 43 }, spo2_100: { spo2: 100 }, pain0: { painScore: 0 }, pain10: { painScore: 10 } })) {
  r = await vit(s.id, v); check('V13', `boundary ${name} accepted`, r.status === 200, [r.status, r.text.slice(0, 150)]);
}
// PII in recordedBy redacted
s = await newSession(); r = await vit(s.id, { heartRate: 80 }, 'Nurse call 081-234-5678');
const g = (await req('GET', `/api/sessions/${s.id}`)).json;
check('V14', 'phone in recordedBy not stored raw (session+audit)', !JSON.stringify(g).includes('081-234-5678') && !JSON.stringify(g).includes('0812345678'), g.audit.at(-1));
// triage confirm
s = await newSession(); await vit(s.id, { heartRate: 118, systolicBP: 92, diastolicBP: 60, respRate: 24, tempC: 39.1, spo2: 93, onOxygen: false, consciousness: 'alert' });
const conf = (b) => req('POST', `/api/sessions/${s.id}/triage/confirm`, b);
r = await conf({ reviewerId: 'n', level: 4 }); check('V20', 'less urgent (4 vs suggested 2) without note -> 400', r.status === 400, [r.status, r.text]);
r = await conf({ reviewerId: 'n', level: 4, note: '   ' }); check('V20b', 'less urgent with whitespace note -> 400', r.status === 400, [r.status, r.text]);
for (const lvl of [0, 6, 2.5, '2', null, -1, 'high']) { r = await conf({ reviewerId: 'n', level: lvl }); check('V21', `invalid level ${JSON.stringify(lvl)} -> 400`, r.status === 400, [r.status, r.text]); }
r = await conf({ reviewerId: '', level: 2 }); check('V22', 'blank reviewer -> 400', r.status === 400);
r = await conf({ reviewerId: 'n', level: 2, foo: 1 }); check('V22b', 'extra prop -> 400', r.status === 400);
r = await conf({ reviewerId: 'n', level: 1 }); check('V23', 'more urgent than suggested without note -> 200', r.status === 200 && r.json.triage.confirmed.level === 1, [r.status, r.text.slice(0, 200)]);
r = await conf({ reviewerId: 'n', level: 4, note: 'patient stable on recheck' }); check('V24', 'less urgent with note -> 200 and confirmed updated', r.status === 200 && r.json.triage.confirmed.level === 4 && r.json.triage.confirmed.note, r.json?.triage);
r = await vit(s.id, full);
check('V25', 'new vitals after confirm keep prior confirmation (historical) but suggestion recomputed', r.json?.triage?.confirmed?.level === 4 && r.json.triage.suggestedLevel === 4, r.json?.triage);
// confirm with no vitals at all
s = await newSession(); r = await req('POST', `/api/sessions/${s.id}/triage/confirm`, { reviewerId: 'n', level: 4, note: 'x' });
check('V26', 'confirm level 4 on session with NO vitals: should not be allowed to be reassuring without data (expect 400/409) ', r.status !== 200, [r.status, r.json?.triage]);
// confirm persisted in audit
const gg = (await req('GET', `/api/sessions/${s.id}`)).json; 
// escalated session
s = await newSession(); await req('POST', `/api/sessions/${s.id}/turns`, { text: 'I have crushing chest pain and I am sweating' });
r = await req('POST', `/api/sessions/${s.id}/triage/confirm`, { reviewerId: 'n', level: 5, note: 'ok' });
check('V27', 'escalated (emergency red flag) session: confirm level 5 with note is accepted silently (informational; real clinician-override allowed?)', true, '');
console.log('   V27 info:', r.status, JSON.stringify(r.json?.triage?.confirmed));
// NEWS2 boundary grid (RCP 2017 scale 1): expected points per parameter, others normal
const news = {
  respRate: v => v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3,
  spo2: v => v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0,
  systolicBP: v => v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3,
  heartRate: v => v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3,
  tempC: v => v <= 35.0 ? 3 : v <= 36.0 ? 1 : v <= 38.0 ? 0 : v <= 39.0 ? 1 : 2,
};
const grid = { respRate: [7, 8, 9, 11, 12, 20, 21, 24, 25, 40], spo2: [85, 91, 92, 93, 94, 95, 96, 100], systolicBP: [60, 90, 91, 100, 101, 110, 111, 219, 220, 250], heartRate: [30, 40, 41, 50, 51, 90, 91, 110, 111, 130, 131, 180], tempC: [34.0, 35.0, 35.1, 36.0, 36.1, 38.0, 38.1, 39.0, 39.1, 41.0] };
const base = { heartRate: 75, systolicBP: 120, diastolicBP: 70, respRate: 16, tempC: 36.8, spo2: 98, onOxygen: false, consciousness: 'alert' };
for (const [k, vals] of Object.entries(grid)) for (const v of vals) {
  const s2 = await newSession(); const rr = await vit(s2.id, { ...base, ...(k === 'systolicBP' ? { diastolicBP: Math.max(20, Math.min(70, v - 10)) } : {}), [k]: v }); const exp = news[k](v);
  check('V30', `NEWS2 ${k}=${v} -> ${exp} pts (warningScore)`, rr.status === 200 && rr.json.triage.warningScore === exp, [rr.status, rr.json?.triage?.warningScore, rr.json?.triage?.suggestedLevel]);
  const lvl = exp >= 3 ? 2 : exp >= 1 ? 3 : 4; check('V31', `NEWS2 ${k}=${v}: level ${lvl}`, rr.json?.triage?.suggestedLevel === lvl, rr.json?.triage?.suggestedLevel);
}
// stale triage: red flag arrives AFTER vitals
s = await newSession(); await vit(s.id, full);
await req('POST', `/api/sessions/${s.id}/turns`, { text: 'I have crushing chest pain and I am sweating' });
const st = (await req('GET', `/api/sessions/${s.id}`)).json.session;
check('V28', 'emergency red flag raised after vitals -> session.triage.suggestedLevel becomes 1 (not stale 4)', st.triage?.suggestedLevel === 1, [st.status, st.triage?.suggestedLevel]);
// sessions in terminal states still accept vitals?
done();
