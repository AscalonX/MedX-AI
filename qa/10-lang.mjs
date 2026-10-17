// Patient-facing language consistency.
import { check, done, newSession, turn } from './lib.mjs';
const hasThai = s => /[฀-๿]/.test(s), hasIt = s => /\b(Quando|Hai|Puoi|Potresti|Da quanto|Qual|Come|Dove|Prendi|Soffri|Quanti|Qual è)\b/i.test(s);
for (const [lang, text] of [['th', 'ปวดหัวตั้งแต่เมื่อวาน ระดับ 7/10'], ['it', 'Ho mal di testa da ieri, 7/10'], ['en', 'Headache since yesterday 7/10']]) {
  const s = await newSession(lang); const r = await turn(s.id, text); const a = r.json.turns.filter(t => t.role === 'assistant').at(-1);
  const ok = lang === 'th' ? hasThai(a?.text || '') : lang === 'it' ? hasIt(a?.text || '') || !/\b(Could|What|When|How)\b/.test(a?.text || '') : !hasThai(a?.text || '');
  check('L01', `assistant question for ${lang} session is in ${lang}: "${a?.text}"`, ok && a?.lang === lang, a);
}
for (const [lang, text] of [['th', 'เจ็บหน้าอกมาก เหงื่อออก'], ['it', 'Ho forte dolore al petto e sudo freddo'], ['en', 'crushing chest pain and sweating']]) {
  const s = await newSession(lang); const r = await turn(s.id, text); const m = r.json.summary?.redFlags?.[0]?.patientMessage;
  check('L02', `${lang}: escalation patientMessage present in ${lang} and nextQuestion null`, !!m?.[lang] && (lang !== 'th' || hasThai(m.th)) && r.json.summary.nextQuestion === null, m);
}
// Thai session with English text: reply language
{ const s = await newSession('th'); const r = await turn(s.id, 'I have a headache'); const a = r.json.turns.at(-1); check('L03', 'th session: assistant reply still Thai even if patient typed English', hasThai(a.text), a.text); }
// patient turn lang tag
{ const s = await newSession('it'); const r = await turn(s.id, 'Ho mal di testa'); check('L04', 'patient turn lang == session lang', r.json.turns[0].lang === 'it', r.json.turns[0].lang); }
done();
