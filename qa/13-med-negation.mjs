// Negated / past medications and pregnancy denial must not become current-medication facts or alerts.
import { check, done, newSession, turn } from './lib.mjs';
const cases = [
  ['en', 'I do not take warfarin. I take ibuprofen 400 mg. Knee pain since yesterday.', 'warfarin', 'MR-INT'],
  ['en', 'I never take ibuprofen, only paracetamol. Knee pain since yesterday.', 'ibuprofen', 'MR-INT'],
  ['en', 'I stopped taking warfarin last year. I take ibuprofen. Knee pain since yesterday.', 'warfarin', 'MR-INT'],
  ['it', 'Non prendo warfarin. Prendo ibuprofene. Dolore al ginocchio da ieri.', 'warfarin', 'MR-INT'],
  ['th', 'ไม่ได้กินวาร์ฟาริน กินไอบูโพรเฟน ปวดเข่ามาตั้งแต่เมื่อวาน', 'warfarin', 'MR-INT'],
];
for (const [lang, text, drug, rule] of cases) {
  const s = await newSession(lang); const r = await turn(s.id, text); const sm = r.json.summary;
  const present = (sm.medications || []).some(m => (m.generic || '').includes(drug) && m.status !== 'discontinued'); const alert = (sm.medAlerts || []).some(a => a.ruleId.startsWith(rule));
  check('N01', `${lang}: "${text.slice(0, 55)}" -> ${drug} NOT listed as current med, no ${rule} alert`, !present && !alert, { meds: sm.medications?.map(m => `${m.nameOriginal}/${m.generic}/${m.timing}`), alerts: sm.medAlerts?.map(a => a.ruleId) });
}
done();
