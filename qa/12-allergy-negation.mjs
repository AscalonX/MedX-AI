// Negated allergy statements must not create allergy entries / conflict alerts; affirmed ones must.
import { check, done, newSession, turn } from './lib.mjs';
const cases = [
  ['en', 'I am not allergic to penicillin. I take Augmentin 625 mg twice a day. Sore throat since yesterday.', false],
  ['en', 'No allergy to penicillin, I take Augmentin. Sore throat since yesterday.', false],
  ['en', 'I have never been allergic to penicillin. I take amoxicillin. Cough since yesterday.', false],
  ['it', 'Non sono allergico alla penicillina. Prendo Augmentin. Ho mal di gola da ieri.', false],
  ['th', 'ไม่แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่อวาน', false],
  ['en', 'I am allergic to penicillin. I take Augmentin 625 mg twice a day. Sore throat since yesterday.', true],
  ['it', 'Sono allergico alla penicillina. Prendo Augmentin. Ho mal di gola da ieri.', true],
  ['th', 'แพ้เพนิซิลลิน กินออกเมนตินวันละสองครั้ง เจ็บคอตั้งแต่เมื่อวาน', true],
];
for (const [lang, text, expect] of cases) {
  const s = await newSession(lang); const r = await turn(s.id, text); const sm = r.json.summary;
  const has = (sm.allergies || []).some(a => a.allergenClass === 'penicillin') ; const alert = (sm.medAlerts || []).some(a => a.kind === 'allergy_conflict');
  check('A01', `${lang}: "${text.slice(0, 60)}" -> penicillin allergy entry ${expect ? 'PRESENT' : 'ABSENT'} and allergy_conflict alert ${expect ? 'PRESENT' : 'ABSENT'}`, has === expect && alert === expect, { allergies: sm.allergies?.map(a => a.allergenOriginal + '/' + a.allergenClass), alerts: sm.medAlerts?.map(a => a.ruleId), meds: sm.medications?.map(m => m.generic) });
}
done();
