// Clinician summary field `medications` should reflect meds the patient stated (pharmacist list already has them).
import { check, done, newSession, turn } from './lib.mjs';
for (const [lang, text] of [['en', 'Headache since yesterday 7/10. I am 45 years old. I take ibuprofen 400 mg twice a day.'], ['it', 'Mal di testa da ieri, 7/10. Ho 45 anni. Prendo ibuprofene 400 mg due volte al giorno.'], ['th', 'ปวดหัวตั้งแต่เมื่อวาน 7/10 อายุ 45 ปี กินไอบูโพรเฟน 400 มก. วันละสองครั้ง']]) {
  const s = await newSession(lang); const r = await turn(s.id, text); const sm = r.json.summary; const f = sm.fields.find(f => f.key === 'medications');
  check('F01', `${lang}: medications stated (${sm.medications?.length} in pharmacist list) -> summary field medications is supported (was ${f.status}); next question != medications`, f.status === 'supported' && sm.nextQuestion?.field !== 'medications', { field: f.status, next: sm.nextQuestion?.field, meds: sm.medications?.map(m => m.generic) });
}
done();
