// Negated / past medications and pregnancy denial must not become current-medication facts or alerts.
import { check, done, newSession, turn } from './lib.mjs';
const cases = [
  ['en', 'I do not take warfarin. I take ibuprofen 400 mg. Knee pain since yesterday.', 'warfarin', 'MR-INT'],
  ['en', 'I never take ibuprofen, only paracetamol. Knee pain since yesterday.', 'ibuprofen', 'MR-INT'],
  ['it', 'Non prendo warfarin. Prendo ibuprofene. Dolore al ginocchio da ieri.', 'warfarin', 'MR-INT'],
  ['th', 'ไม่ได้กินวาร์ฟาริน กินไอบูโพรเฟน ปวดเข่ามาตั้งแต่เมื่อวาน', 'warfarin', 'MR-INT'],
];
for (const [lang, text, drug, rule] of cases) {
  const s = await newSession(lang); const r = await turn(s.id, text); const sm = r.json.summary;
  const present = (sm.medications || []).some(m => (m.generic || '').includes(drug) && m.status !== 'discontinued'); const alert = (sm.medAlerts || []).some(a => a.ruleId.startsWith(rule));
  check('N01', `${lang}: "${text.slice(0, 55)}" -> ${drug} NOT listed as current med, no ${rule} alert`, !present && !alert, { meds: sm.medications?.map(m => `${m.nameOriginal}/${m.generic}/${m.timing}`), alerts: sm.medAlerts?.map(a => a.ruleId) });
}
// Fail-safe since a1589c8 (w10): a medicine the patient says they stopped stays listed with its "stopped" timing and is
// still checked; the alert tells the pharmacist "patient says stopped, confirm". It is never silently dropped.
{ const s = await newSession('en'); const r = await turn(s.id, 'I stopped taking warfarin last year. I take ibuprofen. Knee pain since yesterday.'); const sm = r.json.summary;
  const w = (sm.medications || []).find(m => (m.generic || '').includes('warfarin')); const a = (sm.medAlerts || []).find(x => x.ruleId.startsWith('MR-INT'));
  check('N02', 'en: stopped warfarin stays listed with stopped timing, and the interaction alert asks to confirm (fail-safe)', !!w && /stop/i.test(w.timing || '') && !!a && /patient says stopped/.test(a.message.en), { med: w && `${w.nameOriginal}/${w.timing}`, alert: a?.message?.en }); }
done();
