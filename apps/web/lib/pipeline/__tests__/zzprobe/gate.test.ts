import { test } from 'vitest';
import { modelSuggestions } from '/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/apps/web/lib/pipeline/consult';
import { prescribingChecks, parsePrescription } from '/Users/king_phuripol/AI-Engineer/Workstreams/medx-bridge/apps/web/lib/pipeline/orders';
test('probe', () => {
  const s: any = { id: 'x', patientLang: 'en', status: 'awaiting_review', turns: [{ id: 't1', role: 'patient', lang: 'en', text: 'I have crushing chest pain since this morning', at: '' }], summary: null };
  const mk = (en: string) => ({ suggestions: [{ kind: 'consider', text: { en, it: en, th: en }, why: { en: 'Chest pain pattern.', it: 'x', th: 'x' }, turn: 'T1', quote: 'crushing chest pain', confidence: 0.9 }] });
  for (const t of ['Consider aspirin 300 mg for clinician review', 'Consider nitroglycerin spray for clinician review', 'Consider giving aspirin for clinician review', 'Consider ACS for clinician review', 'Consider morphine 5 mg IV for clinician review'])
    console.log(JSON.stringify(t), '->', (modelSuggestions(mk(t), s) || []).length ? 'ACCEPTED' : 'rejected');
});
