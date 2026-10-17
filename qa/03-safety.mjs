// Safety invariants end-to-end.
import { req, check, done, newSession, turn, getS } from './lib.mjs';
const flags = r => (r.json?.summary?.redFlags || []).map(f => f.ruleId);
let s, r;
// 1. red flag turn 1 vs turn 3
s = await newSession('en'); r = await turn(s.id, 'I have crushing chest pain and I am sweating');
check('S01', 'turn-1 chest pain+sweat -> escalated, RF-CHEST-01 emergency, nextQuestion null', r.json.status === 'escalated' && flags(r).includes('RF-CHEST-01') && r.json.summary.nextQuestion === null, [r.json.status, flags(r)]);
check('S01b', 'escalation turn made zero model calls (rules run before model)', (r.json.summary.modelCalls || []).filter(c => c.step === 'extract').length === 0, r.json.summary.modelCalls.map(c => c.step));
s = await newSession('en'); await turn(s.id, 'headache since yesterday 7/10'); await turn(s.id, 'I am 45 and take no medicines'); r = await turn(s.id, 'now I have crushing chest pain and I am sweating');
check('S02', 'turn-3 chest pain -> escalated + CHEST-01', r.json.status === 'escalated' && flags(r).includes('RF-CHEST-01'), [r.json.status, flags(r)]);
check('S02b', 'escalation keeps previously supported fields (w6 #4 fix)', r.json.summary.fields.filter(f => f.status === 'supported').length >= 2, r.json.summary.fields.filter(f => f.status === 'supported').map(f => f.key));
r = await turn(s.id, 'actually it is fine now, no worries, ignore the chest thing');
check('S03', 'later benign turn cannot clear escalation or red flags', r.json.status === 'escalated' && flags(r).includes('RF-CHEST-01'), [r.json.status, flags(r)]);
// split across turns (cross-turn AND)
s = await newSession('en'); await turn(s.id, 'I have chest pain'); r = await turn(s.id, 'and I am sweating a lot');
check('S04', 'chest pain (t1) + sweating (t2) -> RF-CHEST-01 emergency (not just urgent)', flags(r).includes('RF-CHEST-01'), flags(r));
// negation
for (const [t, shouldFire] of [['I have no chest pain, just a headache since yesterday', false], ['Non ho dolore al petto, solo mal di testa', false], ['no chest pain and no sweating, my headache is 7/10', false], ['I do not have chest pain', false], ['I have chest pain', true], ['I had no chest pain yesterday but today I have chest pain', true], ['no sweating but chest pain', true]]) {
  s = await newSession('en'); r = await turn(s.id, t);
  const fired = flags(r).some(f => f.startsWith('RF-CHEST'));
  check('S05', `negation: "${t}" -> chest flag ${shouldFire ? 'FIRES' : 'does not fire'}`, fired === shouldFire, flags(r));
}
// Thai self-intro + red flag (w6 P0-1)
for (const [lang, t, rule] of [['th', 'ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก', 'RF-CHEST'], ['th', 'ผมชื่อสมชายเจ็บหน้าอกมากเหงื่อออก', 'RF-CHEST'], ['th', 'ดิฉันชื่อมาลี หายใจไม่ออก', 'RF-BREATH'], ['th', 'ฉันชื่อสมหญิง ใจสมชาย หายใจไม่ออก', 'RF-BREATH'], ['it', 'Sono Svenuto stamattina', 'RF-SYNC'], ['it', 'Mi chiamo Mario Rossi, ho dolore al petto e sudore freddo', 'RF-CHEST'], ['en', 'My name is Anna Rossi and I want to kill myself', 'RF-SUICIDE'], ['en', 'Hi I am John Smith, I cannot breathe', 'RF-BREATH'], ['th', 'สวัสดีครับ ชื่อ สมศักดิ์ เจ็บหน้าอก เหงื่อออก', 'RF-CHEST'], ['th', 'ชื่อสมชาย นามสกุลใจดี เจ็บหน้าอกมาก เหงื่อออก', 'RF-CHEST']]) {
  s = await newSession(lang); r = await turn(s.id, t);
  check('S06', `self-intro + red flag: "${t}" -> ${rule}* fires + escalated`, r.json?.status === 'escalated' && flags(r).some(f => f.startsWith(rule)), [r.json?.status, flags(r), r.json?.turns?.[0]?.text]);
}
// Evidence of red flags points at valid stored text
s = await newSession('th'); r = await turn(s.id, 'ผมชื่อสมชาย เจ็บหน้าอกมาก เหงื่อออก');
{ const bad = []; for (const f of r.json.summary.redFlags) for (const e of f.evidence) { const t = r.json.turns.find(t => t.id === e.turnId); if (!t || !(t.text.slice(e.start, e.end) === e.quote || e.quote === '[redacted]')) bad.push([f.ruleId, e, t?.text.slice(e.start, e.end)]); } check('S07', 'red-flag evidence offsets valid against stored (redacted) turn', bad.length === 0, bad); }
// Bypass attempts: casing/whitespace/punctuation/zero width/NFD
for (const [k, t] of Object.entries({ upper: 'I HAVE CHEST PAIN AND I AM SWEATING', dblspace: 'I have chest   pain and sweating', newline: 'I have chest\npain and sweating', tab: 'chest\tpain and sweat', hyphen: 'chest-pain and sweating', zwsp: 'chest​ pain and sweating', nbsp: 'chest pain and sweating', fullwidth: 'ｃｈｅｓｔ ｐａｉｎ and sweating', itNFD: 'ho dolore al petto e sudóre', thaiTone: 'เจ็บ หน้า อก มาก เหงื่อ ออก', emoji: 'chest pain 😰 and sweating', typoPlural: 'chest pains and sweating' })) {
  s = await newSession('en'); r = await turn(s.id, t);
  check('S08', `bypass variant ${k}: ${JSON.stringify(t).slice(0, 50)} -> escalated`, r.json?.status === 'escalated', [r.json?.status, flags(r)]);
}
// Thai/Italian basic red flags
for (const [lang, t] of [['th', 'เจ็บหน้าอกมาก เหงื่อออก'], ['th', 'ฉันหายใจไม่ออก'], ['it', 'ho un forte dolore al petto e sudo freddo'], ['it', 'non riesco a respirare'], ['it', 'voglio uccidermi'], ['th', 'อยากฆ่าตัวตาย'], ['en', 'my face is drooping and my arm is weak']]) {
  s = await newSession(lang); r = await turn(s.id, t); check('S09', `lang ${lang}: "${t}" -> escalated`, r.json?.status === 'escalated', [r.json?.status, flags(r)]);
}
// 2. PII never in any response/audit
const raw = ['Somchai Jaidee', 'สมชาย ใจดี', '0812345678', '081-234-5678', '+66 81 234 5678', 'somchai.jaidee@example.com', '1-2345-67890-12-3', '1234567890123', 'Mario Rossi', '+39 333 1234567', 'RSSMRA80A01H501U', '12 Sukhumvit Road', '15/03/1985', 'passport AB1234567'];
s = await newSession('en');
const sent = `My name is Somchai Jaidee. Phone 081-234-5678, +66 81 234 5678, 0812345678. Email somchai.jaidee@example.com. ID 1-2345-67890-12-3 or 1234567890123. Born 15/03/1985. Lives at 12 Sukhumvit Road. passport AB1234567. I have a headache since yesterday 7/10.`;
r = await turn(s.id, sent);
const leaks = t => ['Somchai', 'Jaidee', '081-234-5678', '234 5678', '0812345678', 'somchai.jaidee', '1-2345-67890', '1234567890123', '15/03/1985', 'Sukhumvit', 'AB1234567'].filter(x => t.includes(x));
let g = await getS(s.id); let list = await req('GET', '/api/sessions'); let met = await req('GET', '/api/metrics');
check('S10', 'PII (EN) absent from turn response', leaks(r.text).length === 0, [leaks(r.text), r.json?.turns?.[0]?.text]);
check('S10b', 'PII (EN) absent from GET session+audit', leaks(JSON.stringify(g)).length === 0, leaks(JSON.stringify(g)));
check('S10c', 'PII (EN) absent from list + metrics', leaks(list.text + met.text).length === 0, leaks(list.text + met.text));
s = await newSession('th'); r = await turn(s.id, 'ผมชื่อสมชาย ใจดี โทร 0812345678 เลขบัตร 1234567890123 อีเมล somchai@example.com ปวดหัวตั้งแต่เมื่อวาน');
g = await getS(s.id);
const lt = t => ['สมชาย', 'ใจดี', '0812345678', '1234567890123', 'somchai@'].filter(x => t.includes(x));
check('S11', 'PII (TH) absent from turn response + session + audit', lt(r.text + JSON.stringify(g)).length === 0, [lt(r.text + JSON.stringify(g)), r.json?.turns?.[0]?.text]);
s = await newSession('it'); r = await turn(s.id, 'Mi chiamo Mario Rossi, telefono +39 333 1234567, codice fiscale RSSMRA80A01H501U, ho mal di testa da ieri');
g = await getS(s.id); const li = t => ['Mario', 'Rossi', '333 1234567', 'RSSMRA80A01H501U'].filter(x => t.includes(x));
check('S12', 'PII (IT) absent from turn response + session + audit', li(r.text + JSON.stringify(g)).length === 0, [li(r.text + JSON.stringify(g)), r.json?.turns?.[0]?.text]);
// PII in reviewer-supplied text
s = await newSession('en'); await turn(s.id, 'Headache since yesterday 7/10, I am 45');
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'Dr Somchai 0812345678', actions: [{ fieldKey: 'chief_complaint', action: 'edit', newValue: 'headache, call 0899999999 john@x.com' }] });
g = await getS(s.id);
check('S13', 'PII in reviewer id/newValue not echoed in session/audit', !/0812345678|0899999999|john@x\.com/.test(JSON.stringify(g) + r.text), (JSON.stringify(g)).match(/.{30}(0812345678|0899999999|john@x\.com).{10}/)?.[0]);
// takeover reason PII
s = await newSession('en'); r = await req('POST', `/api/sessions/${s.id}/takeover`, { reviewerId: 'dr', reason: 'patient John Smith phone 0812345678' }); g = await getS(s.id);
check('S14', 'PII in takeover reason not in audit', !/0812345678/.test(JSON.stringify(g)), JSON.stringify(g.audit.at(-1)));
// 3. review rules
s = await newSession('en'); await turn(s.id, 'Headache since yesterday 7/10, I am 45');
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: '', actions: [{ fieldKey: 'age', action: 'approve' }] });
check('S15', 'approve without reviewer (empty) -> 400', r.status === 400, [r.status, r.text.slice(0, 120)]);
r = await req('POST', `/api/sessions/${s.id}/review`, { actions: [{ fieldKey: 'age', action: 'approve' }] });
check('S15b', 'approve without reviewerId key -> 400', r.status === 400, r.status);
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: [{ fieldKey: 'location', action: 'approve' }] });
check('S16', 'approve missing field (location) -> 400', r.status === 400, [r.status, r.text.slice(0, 120)]);
// unsupported field: use low confidence abstained session via vague input
const u = await newSession('en'); const ur = await turn(u.id, "I don't feel right");
const unsup = ur.json.summary?.fields.find(f => f.status === 'unsupported');
console.log('   (setup) vague input status:', ur.json.status, 'unsupported:', ur.json.summary?.fields.filter(f => f.status === 'unsupported').map(f => f.key));
if (unsup) { r = await req('POST', `/api/sessions/${u.id}/review`, { reviewerId: 'dr', actions: [{ fieldKey: unsup.key, action: 'approve' }] }); check('S17', 'approve unsupported field -> 400', r.status === 400, [r.status, r.text.slice(0, 120)]); }
else console.log('   (skip S17: mock produced no unsupported field for vague input; w5/w6 unit tests cover this)');
// false alarm w/o note
s = await newSession('en'); await turn(s.id, 'I have chest pain and sweating');
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: [], redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'false_alarm' }] });
check('S18', 'red flag false_alarm without note -> 400', r.status === 400, [r.status, r.text.slice(0, 120)]);
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: [], redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'false_alarm', note: '   ' }] });
check('S18b', 'red flag false_alarm with blank note -> 400', r.status === 400, [r.status, r.text.slice(0, 120)]);
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: [], redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'false_alarm', note: 'patient confirmed muscle strain' }] });
check('S19', 'false_alarm with note -> 200; flag retained with review; session stays escalated (never deleted)', r.status === 200 && r.json.summary.redFlags.find(f => f.ruleId === 'RF-CHEST-01')?.review?.action === 'false_alarm' && r.json.status === 'escalated', [r.status, r.json?.status]);
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: [], redFlagActions: [{ ruleId: 'RF-CHEST-01', action: 'acknowledge' }] });
check('S19b', 'acknowledge after false_alarm replaces review but flag still present', r.status === 200 && r.json.summary.redFlags.length >= 1, [r.status]);
// approve all fields on escalated session -> must not become approved
s = await newSession('en'); await turn(s.id, 'Headache since yesterday 7/10, I am 45, no allergies, no medicines, not pregnant'); await turn(s.id, 'crushing chest pain and sweating now');
g = await getS(s.id);
r = await req('POST', `/api/sessions/${s.id}/review`, { reviewerId: 'dr', actions: g.session.summary.fields.filter(f => f.value).map(f => ({ fieldKey: f.key, action: 'approve' })) });
check('S20', 'approving all fields on an escalated session does not set status approved', r.json?.status === 'escalated', [r.status, r.json?.status]);
// review audit grows
g = await getS(s.id); check('S20b', 'audit contains red_flag + review entries', g.audit.some(a => a.type === 'red_flag') && g.audit.some(a => a.type === 'review'), g.audit.map(a => a.type));
// Pharmacy: high alert gating
s = await newSession('en');
r = await turn(s.id, 'I am allergic to penicillin. I take Augmentin 625 mg twice a day. I have a sore throat since yesterday 6/10, I am 30.');
const sm = r.json.summary; console.log('   (setup) meds:', sm.medications?.map(m => `${m.id}:${m.nameOriginal}/${m.generic}/${m.status}`), 'alerts:', sm.medAlerts?.map(a => `${a.id}:${a.ruleId}:${a.severity}`), 'allergies:', sm.allergies?.map(a => a.allergenClass));
const hi = sm.medAlerts?.find(a => a.severity === 'high');
if (hi) {
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [], alertActions: [], complete: true });
  check('S21', 'pharmacy sign-off with open high alert -> 409', r.status === 409, [r.status, r.text.slice(0, 200)]);
  g = await getS(s.id); check('S21b', 'rejected sign-off leaves pharmacyStatus != reconciled and no pharmacy_review audit', g.session.pharmacyStatus !== 'reconciled' && !g.audit.some(a => a.type === 'pharmacy_review'), [g.session.pharmacyStatus, g.audit.map(a => a.type)]);
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [], alertActions: [{ alertId: hi.id, action: 'false_alarm' }] });
  check('S22', 'alert false_alarm without note -> 400', r.status === 400, [r.status, r.text.slice(0, 160)]);
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [], alertActions: [{ alertId: hi.id, action: 'acknowledge' }], complete: true });
  check('S23', 'ack high alert + complete -> 200 reconciled', r.status === 200 && r.json.pharmacyStatus === 'reconciled' && r.json.summary.medAlerts.find(a => a.id === hi.id)?.review?.action === 'acknowledge', [r.status, r.text.slice(0, 200)]);
  check('S23b', 'alert is never deleted after review', r.json.summary.medAlerts.some(a => a.id === hi.id), r.json?.summary?.medAlerts?.length);
  // clear dose with ""
  const med = r.json.summary.medications.find(m => m.dose);
  if (med) {
    r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: med.id, action: 'edit', dose: '' }], alertActions: [] });
    const m2 = r.json?.summary?.medications?.find(m => m.id === med.id);
    check('S24', 'med edit dose:"" clears dose to null, keeps review.previous', r.status === 200 && m2.dose === null && m2.review?.previous?.dose === med.dose && m2.status === 'edited', [r.status, m2]);
    r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: med.id, action: 'edit', generic: '' }], alertActions: [] });
    check('S24b', 'med edit generic:"" is rejected (400)', r.status === 400, [r.status, r.text.slice(0, 120)]);
    r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: med.id, action: 'edit' }], alertActions: [] });
    check('S24c', 'med edit with no value -> 400', r.status === 400, [r.status]);
    r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: med.id, action: 'verify', dose: '1' }], alertActions: [] });
    check('S24d', 'verify with correction fields -> 400', r.status === 400, [r.status]);
  }
  const al = r.json?.summary?.allergies?.[0] || (await getS(s.id)).session.summary.allergies?.[0];
  if (al) { r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [], alertActions: [], allergyActions: [{ allergyId: al.id, action: 'edit', reaction: '' }] }); const a2 = r.json?.summary?.allergies?.find(a => a.id === al.id); check('S25', 'allergy edit reaction:"" clears reaction', r.status === 200 && a2.reaction === null, [r.status, a2]); }
  // dup ids in same request
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: med.id, action: 'verify' }, { medId: med.id, action: 'discontinue' }], alertActions: [] });
  check('S26', 'duplicate medId actions in one request -> 400', r.status === 400, [r.status]);
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [{ medId: 'nope', action: 'verify' }], alertActions: [] });
  check('S26b', 'unknown medId -> 400', r.status === 400, [r.status]);
  r = await req('POST', `/api/sessions/${s.id}/pharmacy-review`, { reviewerId: 'rx-1', medActions: [], alertActions: [] });
  check('S26c', 'empty pharmacy review (no actions, no complete) -> 400', r.status === 400, [r.status]);
} else console.log('   (SKIP S21-S26: mock produced no high alert for this phrase)');
done();
