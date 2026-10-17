import { createHash, randomUUID } from 'node:crypto';
import type { ConsultMode, ConsultNote, ConsultNoteLine, ConsultNoteReq, ConsultRuleFile, ConsultState, ConsultSuggestion, ConsultTurnReq, Evidence, IntakeSession, Localized } from '@medx/shared';
import redFlags from '@medx/shared/src/redflags.json';
import investigations from '@medx/shared/src/investigations.json';
import { emptyFields, isPresent, QUESTION_PRIORITY } from './config';
import { loadConsultRules } from './consultRules';
import { chatJSON, type ModelClient } from './llm';
import { MEDRULES } from './medrules';
import { addTurnInLock, PipelineError } from './pipeline';
import { aliases, CONSULT_SYSTEM, consultPrompt } from './prompts';
import { checkRedFlags } from './redflags';
import { redact, redactKeepStaff } from './redact';
import { localized, object, shortString } from './schema';
import { appendAudit, getConsultRecord, getSession, hasClientTurnId, saveConsultRecord, saveSession, withSessionLock, type ConsultRecord } from './store';
import { QUESTIONS } from './templates';
import { norm, verifyDetailed, words } from './verify';

const both: ConsultMode[] = ['nurse', 'doctor'];
const localizedText = (en: string, it = en, th = en): Localized => ({ en, it, th });
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
function sessionFor(id: string) { const s = getSession(id); if (!s) throw new PipelineError('Session not found', 'not_found'); return s; }
export function consultMode(value: unknown): ConsultMode {
  if (value !== 'nurse' && value !== 'doctor') throw new PipelineError('Invalid consult mode', 'bad_request');
  return value;
}
function reviewer(value: unknown): string {
  if (!shortString(value, 80)) throw new PipelineError('Invalid reviewerId', 'bad_request');
  return value.trim();
}
function evidenceFor(s: IntakeSession, evidence: Evidence[]): Evidence[] {
  return evidence.filter(e => {
    const verified = verifyDetailed(e.quote, s.turns, e.turnId, true, false);
    return verified?.evidence.turnId === e.turnId && verified.evidence.start === e.start && verified.evidence.end === e.end;
  });
}
function clinicalEvidence(s: IntakeSession, evidence: Evidence[]): Evidence[] {
  return evidence.flatMap(e => {
    if (evidenceFor(s, [e]).length) return [e];
    const turn = s.turns.find(t => t.id === e.turnId && t.role === 'patient');
    // Dictionary stems can end inside words (e.g. wheez in wheezing).
    // Verify the full redacted patient utterance, retaining the original meaning.
    if (!turn || turn.text.slice(e.start, e.end) !== e.quote) return [];
    const verified = verifyDetailed(turn.text, [turn], turn.id, false, false);
    return verified ? [verified.evidence] : [];
  });
}
export function ruleSuggestions(s: IntakeSession, rules: ConsultRuleFile): ConsultSuggestion[] {
  // Reuse AND-of-ORs, negation windows, cross-turn matching, Thai compaction,
  // NFKC/case/dash/zero-width normalization and original UTF-16 quote offsets.
  const hits = checkRedFlags(s.turns, undefined, { ...redFlags, rules: rules.rules.map(r => ({ id: r.id, match: r.match, severity: 'urgent', label: localizedText(r.id), action: localizedText('For clinician review'), patientMessage: localizedText(''), source: r.source })) });
  const mergedFlags = new Map<string, ConsultSuggestion>();
  for (const f of s.summary?.redFlags || []) {
    const evidence = clinicalEvidence(s, f.evidence);
    const prior = mergedFlags.get(f.ruleId);
    if (prior) prior.evidence = [...new Map([...prior.evidence, ...evidence].map(e => [JSON.stringify(e), e])).values()];
    else mergedFlags.set(f.ruleId, { id: `rule_out:flag:${f.ruleId}`, kind: 'rule_out', mode: both, text: { en: `Escalate: ${f.label.en}`, it: `Allertare il clinico: ${f.label.it}`, th: `แจ้งบุคลากรทันที: ${f.label.th}` }, why: localizedText('Record clinician review of this flag.', 'Registrare la revisione clinica di questo segnale.', 'บันทึกการทบทวนสัญญาณนี้โดยแพทย์'), evidence, ruleId: f.ruleId, source: 'rule', confidence: 1, status: 'open' });
  }
  const result = [...mergedFlags.values()];
  for (const r of rules.rules) {
    const hit = hits.find(h => h.ruleId === r.id); if (!hit) continue;
    const evidence = clinicalEvidence(s, hit.evidence); if (!evidence.length) continue;
    for (const q of r.questions) result.push({ id: `rule_out:${r.id}:${q.id}`, kind: 'rule_out', mode: q.modes, text: q.text, why: q.why, evidence, ruleId: r.id, source: 'rule', confidence: 1, status: 'open' });
  }
  const fields = s.summary?.fields || emptyFields();
  for (const key of QUESTION_PRIORITY) {
    const f = fields.find(f => f.key === key && f.required && !isPresent(f)); if (!f) continue;
    const q = QUESTIONS[f.key];
    const subject = f.key.replaceAll('_', ' ');
    result.push({ id: `ask_next:field:${f.key}`, kind: 'ask_next', mode: both, text: { en: `Ask about ${subject}: ${q.en}`, it: `Chiedere al paziente: ${q.it}`, th: `สอบถามผู้ป่วย: ${q.th}` }, why: localizedText('Required intake information is missing; ask the patient.', 'Manca un dato necessario; chiedere al paziente.', 'ข้อมูลที่จำเป็นยังขาดอยู่ กรุณาสอบถามผู้ป่วย'), evidence: [], field: f.key, source: 'rule', confidence: 1, status: 'open' });
  }
  // Considerations: only rules whose FIRST group (the presenting complaint) matches, strongest match first.
  const complaint = checkRedFlags(s.turns, undefined, { ...redFlags, rules: rules.rules.map(r => ({ id: r.id, match: r.match.slice(0, 1), severity: 'urgent', label: localizedText(r.id), action: localizedText(''), patientMessage: localizedText(''), source: r.source })) });
  const turnOrder = (e: Evidence) => s.turns.findIndex(t => t.id === e.turnId) * 1e6 + e.start;
  const ranked = rules.rules.flatMap((r, i) => {
    const hit = hits.find(h => h.ruleId === r.id); if (!hit || !complaint.some(h => h.ruleId === r.id)) return [];
    const evidence = clinicalEvidence(s, hit.evidence); if (!evidence.length) return [];
    // ponytail: strength = groups * 10 + distinct matched spans; weights are heuristic.
    return [{ r, i, evidence, strength: r.match.length * 10 + new Set(evidence.map(e => `${e.turnId}:${e.start}`)).size, first: Math.min(...evidence.map(turnOrder)) }];
  }).sort((a, b) => b.strength - a.strength || a.first - b.first || a.i - b.i);
  for (const { r, evidence } of ranked) {
    for (const c of r.considerations || []) result.push({ id: `consider:${r.id}:${c.id}`, kind: 'consider', mode: ['doctor'], text: { en: `Consider for clinician review: ${c.text.en}`, it: `Da considerare per revisione clinica: ${c.text.it}`, th: `ข้อพิจารณาสำหรับแพทย์ทบทวน: ${c.text.th}` }, why: c.why, evidence, ruleId: r.id, source: 'rule', confidence: 1, status: 'open', workup: (c.workup || []).flatMap(id => investigations.items.filter(i => i.id === id).map(i => ({ id: i.id, label: i.label }))), ...(c.guideline ? { guideline: c.guideline } : {}) });
  }
  return result;
}
// Gate all generated languages, including rationales; normalize obfuscated wording.
const forbidden = /\b(?:diagnos\w*|prescrib\w*|prescri\w*|you have|you are suffering|treat\w*|take\s+\d|take\s+(?:a|an|the|some)|(?:to|should|must)\s+(?:take|stop|start|increase|decrease|avoid|use|give)|start\s+(?:taking|medication|therapy)|recommend\w*|reassur\w*|rule[ds]? (?:out|in)|likely|probable|confirms|no urgency|not urgent|safe to|hai|ha una|avete)\b|วินิจฉัย|สั่งยา|คุณเป็น|รักษา|ไม่ฉุกเฉิน|ไม่เร่งด่วน|ไม่ต้องกังวล|assum\w*|terapia/iu;
const drugTerms = MEDRULES.drugs.flatMap(d => [d.generic, ...d.names]).map(t => norm(t).t).filter(Boolean);
function unsafeModelText(t: string) {
  const normalized = norm(t).t;
  return forbidden.test(normalized) || /%|\bpercent\b/iu.test(t) || drugTerms.some(term => normalized.includes(term)) || /\d+(?:[.,]\d+)?\s*(?:mg|mcg|[µμ]g|g|ml|units?|iu)\b|\b(?:mg|mcg|g|ml|units?|iu|iv|im|po|sc|tablets?|puffs?|give|giving|start|administer|prescribe|take|dose)\b|[µμ]g/iu.test(normalized);
}
export function modelSuggestions(data: unknown, s: IntakeSession): ConsultSuggestion[] | null {
  if (!object(data) || Object.keys(data).some(k => k !== 'suggestions') || !Array.isArray(data.suggestions) || data.suggestions.length > 3) return null;
  const result: ConsultSuggestion[] = [];
  for (const x of data.suggestions) {
    if (!object(x) || Object.keys(x).some(k => !['kind', 'text', 'why', 'turn', 'quote', 'confidence'].includes(k)) || !['ask_next', 'consider'].includes(String(x.kind)) || !localized(x.text) || !localized(x.why) || !shortString(x.quote, 400) || !shortString(x.turn, 40) || typeof x.confidence !== 'number' || !Number.isFinite(x.confidence) || x.confidence < 0 || x.confidence > 1) return null;
    if (x.kind === 'consider') continue;
    if (x.confidence < 0.7 || [...Object.values(x.text), ...Object.values(x.why)].some(unsafeModelText)) continue;
    if (x.kind === 'ask_next' && !/^(?:ask\b|clarify\b|confirm\b)/i.test(x.text.en)) continue;
    const turn = aliases(s).find(t => t.alias === x.turn && t.role === 'patient');
    if (!turn || !turn.text.includes(x.quote)) continue;
    const verified = verifyDetailed(x.quote, [turn], turn.id, false, false);
    if (!verified || verified.matchFactor !== 1) continue;
    const safe = (value: Localized): Localized => ({ en: redact(value.en).text, it: redact(value.it).text, th: redact(value.th).text });
    const text = x.text;
    const key = (['en', 'it', 'th'] as const).map(lang => norm(text[lang]).t);
    result.push({ id: `ask_next:model:${hash(['ask_next', key]).slice(0, 20)}`, kind: 'ask_next', mode: both, text: safe(x.text), why: safe(x.why), evidence: [verified.evidence], source: 'model', confidence: x.confidence, status: 'open' });
  }
  return result;
}
export interface ConsultOptions { rules?: ConsultRuleFile; client?: ModelClient }
const questionStops = new Set('a an the i you your we he she it they is am are was were be been do does did have has had how what when where which who would could can should please ask about clarify confirm or and of to for in on at any some mi ti si il lo la le gli un una di da del della e o che come ha hai avete sei sono per al alla chiedere paziente คุณ ผม ฉัน ครับ ค่ะ ที่ และ หรือ มี เป็น ได้ ไหม หรือไม่ อะไร อย่างไร'.split(' '));
function questionText(suggestion: ConsultSuggestion, lang: 'en' | 'it' | 'th') {
  return suggestion.text[lang].replace(/^.*?:\s*/u, '').replace(/^(?:ask|clarify|confirm|chiedere|สอบถามผู้ป่วย)\s*/iu, '');
}
function contentTokens(text: string, lang: 'en' | 'it' | 'th') {
  return new Set(words(norm(text).t, lang).map(w => w.segment === 'old' ? 'age' : w.segment).filter(w => !questionStops.has(w)));
}
function ruleAnswer(s: IntakeSession, suggestion: ConsultSuggestion, later: IntakeSession['turns'], rules: ConsultRuleFile) {
  const rule = rules.rules.find(r => r.id === suggestion.ruleId);
  if (!rule || suggestion.kind !== 'rule_out' || suggestion.id.startsWith('rule_out:flag:')) return false;
  // A repeated trigger (e.g. "headache") is not an answer to "sudden or gradual?".
  return (['en', 'it', 'th'] as const).some(lang => {
    const triggers = contentTokens(rule.match.flat().join(' '), lang);
    const answerTokens = [...contentTokens(questionText(suggestion, lang), lang)].filter(t => !triggers.has(t));
    return later.some(turn => answerTokens.some(token => contentTokens(turn.text, lang).has(token)) && !!verifyDetailed(turn.text, s.turns, turn.id, false, false));
  });
}
async function refresh(s: IntakeSession, record: ConsultRecord, options: ConsultOptions = {}) {
  const rules = options.rules || loadConsultRules();
  const patients = s.turns.filter(t => t.role === 'patient');
  const revision = hash(patients);
  const escalated = s.status === 'escalated' || !!s.summary?.redFlags.length;
  if (record.modelRevision !== revision) {
    record.modelRevision = revision; record.modelSuggestions = []; record.modelCalls = [];
    if (patients.length && !escalated && !s.summary?.abstained) {
      let failure: 'provider_error' | 'schema_error' | undefined;
      try {
        const response = await (options.client || chatJSON)({ step: 'next_question', schemaName: 'consult_suggestions', system: CONSULT_SYSTEM, user: consultPrompt(s), timeoutMs: 8000 });
        record.modelCalls.push(response.call);
        const suggestions = response.call.ok ? modelSuggestions(response.data, s) : null;
        if (suggestions === null) {
          failure = response.failure || (response.call.ok ? 'schema_error' : 'provider_error');
          response.call.ok = false; response.call.error = 'Consult suggestions unavailable; needs human review';
        }
        else record.modelSuggestions = suggestions;
      } catch { failure = 'provider_error'; }
      if (failure) {
        if (s.summary) { s.summary.abstained = true; s.summary.abstainReason = failure; s.summary.nextQuestion = null; }
        s.status = 'needs_human'; saveSession(s);
        appendAudit(s.id, 'abstained', 'system', { stage: 'consult', reason: failure });
      }
    }
  }
  // Revalidate cached model output too: HMR/persisted pre-fix suggestions cannot bypass the gate.
  const safeCached = (x: ConsultSuggestion) => x.source !== 'model' || (x.kind === 'ask_next' && ![...Object.values(x.text), ...Object.values(x.why)].some(unsafeModelText));
  record.modelSuggestions = record.modelSuggestions.filter(safeCached);
  const candidates = [...ruleSuggestions(s, rules), ...(escalated || s.summary?.abstained ? [] : record.modelSuggestions)];
  const old = new Map(record.suggestions.filter(safeCached).map(x => [x.id, x]));
  // Stable statuses survive re-ranking, changed rules, disappearing fields and reloads.
  record.suggestions = candidates.map(x => ({ ...x, status: old.get(x.id)?.status || 'open' }));
  for (const x of old.values()) if (x.status !== 'open' && !record.suggestions.some(c => c.id === x.id)) record.suggestions.push(x);
  for (const x of record.suggestions) if (x.status === 'asked') {
    const after = record.askedAfterTurn?.[x.id];
    if (after === undefined) continue;
    const later = s.turns.slice(after).filter(t => t.role === 'patient');
    const field = s.summary?.fields.find(f => f.key === x.field);
    const answered = field && isPresent(field) && field.value && evidenceFor(s, field.evidence).some(e => later.some(t => t.id === e.turnId));
    if (answered || ruleAnswer(s, x, later, rules)) {
      x.status = 'answered';
      appendAudit(s.id, 'consult_suggestion', 'system', { suggestionId: x.id, status: 'answered', trigger: 'patient_evidence' });
    }
  }
  // Model questions rank after required prompts; doctor rule considerations precede model items.
  const rank = (x: ConsultSuggestion) => x.id.startsWith('rule_out:flag:') ? 0 : x.kind === 'rule_out' ? 1 : x.source === 'rule' && x.kind === 'ask_next' ? 2 : x.source === 'rule' ? 3 : 4;
  record.suggestions.sort((a, b) => rank(a) - rank(b));
}
/** The only considerations a doctor sees (and orders/note may draw on): open, rule-ranked, at most 4. */
const MAX_CONSIDERATIONS = 4;
const shownConsiderations = (xs: ConsultSuggestion[]) => xs.filter(x => x.kind === 'consider' && x.status === 'open').slice(0, MAX_CONSIDERATIONS);
function state(s: IntakeSession, record: ConsultRecord, mode: ConsultMode): ConsultState {
  const candidates = record.suggestions.filter(x => x.mode.includes(mode) && (x.source !== 'model' || (x.kind === 'ask_next' && ![...Object.values(x.text), ...Object.values(x.why)].some(unsafeModelText))));
  // Reserve room for doctor considerations; missing-field prompts must not starve them.
  const considers = mode === 'doctor' ? shownConsiderations(candidates) : [];
  const rest = candidates.filter(x => x.status === 'open' && !considers.includes(x)).slice(0, 8 - considers.length);
  return structuredClone({ sessionId: s.id, mode, suggestions: candidates.filter(x => x.status !== 'open' || rest.includes(x) || considers.includes(x)), note: record.notes[mode] || null, modelCalls: record.modelCalls });
}
export async function getConsult(id: string, mode: ConsultMode, options: ConsultOptions = {}) {
  consultMode(mode);
  return withSessionLock(id, async () => {
    const s = sessionFor(id); const record = getConsultRecord(id);
    await refresh(s, record, options); saveConsultRecord(id, record); return state(s, record, mode);
  });
}
/** At least half of the unique content tokens, and at least one content token.
 * Stop-words and clinician prompt prefixes cannot mark small talk as asked.
 */
export function askedMatch(utterance: string, suggestion: ConsultSuggestion) {
  return (['en', 'it', 'th'] as const).some(lang => {
    const q = contentTokens(questionText(suggestion, lang), lang); const said = contentTokens(utterance, lang);
    const overlap = [...q].filter(w => said.has(w)).length;
    return overlap >= 1 && overlap / q.size >= 0.5;
  });
}
export async function addConsultTurn(id: string, req: ConsultTurnReq, options: ConsultOptions = {}) {
  consultMode(req.mode);
  if (!['patient', 'clinician'].includes(req.speaker) || !shortString(req.text, 4000) || !req.text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()) throw new PipelineError('Invalid consult utterance', 'bad_request');
  if (req.clientTurnId !== undefined && !shortString(req.clientTurnId, 200)) throw new PipelineError('Invalid clientTurnId', 'bad_request');
  return withSessionLock(id, async () => {
    let s = sessionFor(id); const record = getConsultRecord(id);
    const duplicate = req.clientTurnId && hasClientTurnId(id, req.clientTurnId);
    if (duplicate) return state(s, record, req.mode);
    if (!['collecting', 'awaiting_review', 'needs_human', 'escalated'].includes(s.status)) throw new PipelineError('Session no longer accepts consult turns', 'bad_request', 409);
    if (req.speaker === 'patient') s = await addTurnInLock(id, req.text, 'voice', req.clientTurnId);
    else {
      await refresh(s, record, options);
      const turn = { id: randomUUID(), role: 'clinician' as const, lang: s.patientLang, text: redactKeepStaff(req.text), at: new Date().toISOString(), inputMode: 'voice' as const };
      s.turns.push(turn); s.updatedAt = turn.at; saveSession(s, req.clientTurnId);
      for (const x of record.suggestions) if (x.status === 'open' && x.kind !== 'consider' && askedMatch(turn.text, x)) {
        x.status = 'asked'; (record.askedAfterTurn ||= {})[x.id] = s.turns.length;
        appendAudit(id, 'consult_suggestion', 'clinician', { suggestionId: x.id, status: 'asked', trigger: 'speech', turnId: turn.id });
      }
    }
    const turn = s.turns.filter(t => t.role === req.speaker).at(-1)!;
    appendAudit(id, 'consult_turn', req.speaker, { turnId: turn.id, speaker: req.speaker, mode: req.mode, inputMode: 'voice' });
    // New speech invalidates drafts; signed notes remain immutable historical records.
    for (const mode of both) if (!record.notes[mode]?.signed) delete record.notes[mode];
    await refresh(s, record, options); saveConsultRecord(id, record); return state(s, record, req.mode);
  });
}
export async function reviewConsultSuggestion(id: string, suggestionId: string, reviewerId: string, status: 'asked' | 'dismissed') {
  const actor = reviewer(reviewerId);
  if (!['asked', 'dismissed'].includes(status)) throw new PipelineError('Invalid suggestion status', 'bad_request');
  return withSessionLock(id, () => {
    const s = sessionFor(id); const record = getConsultRecord(id); const x = record.suggestions.find(x => x.id === suggestionId);
    if (!x) throw new PipelineError('Suggestion not found', 'not_found');
    if (x.status !== status) {
      x.status = status;
      if (status === 'asked') (record.askedAfterTurn ||= {})[x.id] = s.turns.length;
      saveConsultRecord(id, record); appendAudit(id, 'consult_suggestion', 'clinician', { suggestionId, status }, actor);
    }
    return state(s, record, x.mode.includes('nurse') ? 'nurse' : 'doctor');
  });
}
export function draftConsultNote(s: IntakeSession, suggestions: ConsultSuggestion[], mode: ConsultMode): ConsultNote {
  const lines: ConsultNoteLine[] = [];
  const add = (id: string, section: ConsultNoteLine['section'], text: Localized, raw: Evidence[], supported = true) => {
    const evidence = evidenceFor(s, raw);
    lines.push({ id, section, text, evidence, status: supported && evidence.length ? 'supported' : 'unsupported' });
  };
  const labels: Record<string, Localized> = {
    chief_complaint: localizedText('Presenting complaint', 'Motivo della visita', 'อาการสำคัญ'), onset: localizedText('Onset', 'Esordio', 'เริ่มมีอาการ'),
    duration: localizedText('Duration', 'Durata', 'ระยะเวลา'), severity: localizedText('Severity', 'Intensità', 'ความรุนแรง'), location: localizedText('Location', 'Sede', 'ตำแหน่ง'),
    associated_symptoms: localizedText('Associated symptoms', 'Sintomi associati', 'อาการร่วม'), medical_history: localizedText('Medical history', 'Anamnesi', 'ประวัติการรักษา'),
    pregnancy_status: localizedText('Pregnancy status', 'Stato di gravidanza', 'สถานะการตั้งครรภ์'), age: localizedText('Age', 'Età', 'อายุ'), sex: localizedText('Sex', 'Sesso', 'เพศ'),
    medications: localizedText('Medications', 'Farmaci', 'ยา'), allergies: localizedText('Allergies', 'Allergie', 'การแพ้'),
  };
  const missing: Localized[] = [];
  const fields = s.summary?.fields || emptyFields();
  // Presenting complaint comes only from the supported chief_complaint value. Escalation skips
  // extraction, so without one fall back to substantive patient reports (never short answers like "No").
  const complaint = fields.find(f => f.key === 'chief_complaint');
  if (!(complaint && isPresent(complaint) && complaint.value && evidenceFor(s, complaint.evidence).length)) {
    for (const [n, t] of s.turns.filter(t => t.role === 'patient').entries()) {
      if (n > 0 && words(norm(t.text).t, t.lang).length < 4) continue;
      const verified = verifyDetailed(t.text, [t], t.id, false, false);
      if (verified) add(`report:${t.id}`, 'presenting_complaint', localizedText(`Patient report: ${t.text}`, `Il paziente riferisce: ${t.text}`, `ผู้ป่วยแจ้ง: ${t.text}`), [verified.evidence]);
    }
  }
  for (const f of fields) {
    if (['medications', 'allergies'].includes(f.key)) continue;
    if (!isPresent(f) || !f.value || !evidenceFor(s, f.evidence).length) { missing.push(labels[f.key]); continue; }
    const value = f.value;
    add(`field:${f.key}`, f.key === 'chief_complaint' ? 'presenting_complaint' : 'history', { en: `${labels[f.key].en}: ${value.en}`, it: `${labels[f.key].it}: ${value.it}`, th: `${labels[f.key].th}: ${value.th}` }, f.evidence);
  }
  for (const section of ['medications', 'allergies'] as const) {
    const entries = s.summary?.[section] || [];
    for (const e of entries) {
      const text = 'nameOriginal' in e ? [e.generic || e.nameOriginal, e.dose, e.frequency, e.timing].filter(Boolean).join('; ') : [e.allergenOriginal, e.reaction].filter(Boolean).join('; ');
      add(`${section}:${e.id}`, section, localizedText(text), e.evidence, e.status !== 'unsupported');
    }
    const f = s.summary?.fields.find(f => f.key === section);
    if (!entries.length) {
      const noKnown = section === 'allergies' ? s.summary?.noKnownAllergiesEvidence || [] : [];
      if (noKnown.length) add('allergies:no-known', section, localizedText('Patient reports no known allergies', 'Il paziente riferisce nessuna allergia nota', 'ผู้ป่วยแจ้งว่าไม่มีประวัติแพ้'), noKnown);
      else if (f && isPresent(f) && f.value && evidenceFor(s, f.evidence).length) add(`field:${section}`, section, f.value, f.evidence);
      else missing.push(labels[section]);
    }
  }
  for (const f of s.summary?.redFlags || []) add(`flag:${f.ruleId}`, 'red_flags', { en: `Flag for clinician review: ${f.label.en}`, it: `Segnalazione per revisione clinica: ${f.label.it}`, th: `ข้อเตือนให้บุคลากรทบทวน: ${f.label.th}` }, f.evidence);
  const shown = new Set(shownConsiderations(suggestions.filter(x => x.mode.includes(mode))));
  for (const x of suggestions.filter(x => x.mode.includes(mode))) {
    if (x.kind === 'consider' && x.source === 'rule' && mode === 'doctor' && shown.has(x)) add(`suggestion:${x.id}`, 'considerations', x.text, x.evidence);
    else if (x.kind !== 'consider' && x.status !== 'answered' && !x.field && !x.id.startsWith('rule_out:flag:')) {
      const prefix = x.status === 'dismissed' ? localizedText('Not asked (dismissed): ', 'Non chiesto (scartato): ', 'ไม่ได้ถาม (ยกเลิก): ') : x.status === 'asked' ? localizedText('Asked, no answer recorded: ', 'Chiesto, nessuna risposta registrata: ', 'ถามแล้ว ยังไม่บันทึกคำตอบ: ') : localizedText('');
      add(`suggestion:${x.id}`, 'open_questions', { en: prefix.en + x.text.en, it: prefix.it + x.text.it, th: prefix.th + x.text.th }, x.evidence);
    }
  }
  if (missing.length) add('missing:fields', 'open_questions', { en: `Not yet asked: ${missing.map(x => x.en.toLowerCase()).join(', ')}`, it: `Da chiedere: ${missing.map(x => x.it.toLowerCase()).join(', ')}`, th: `ยังไม่ได้สอบถาม: ${missing.map(x => x.th).join(', ')}` }, [], false);
  const sections: ConsultNoteLine['section'][] = ['presenting_complaint', 'history', 'medications', 'allergies', 'red_flags', 'considerations', 'open_questions'];
  lines.sort((a, b) => sections.indexOf(a.section) - sections.indexOf(b.section));
  return { lines, generatedAt: new Date().toISOString(), disclaimer: localizedText('Draft for clinician review. Not a diagnosis.', 'Bozza per la revisione del clinico. Non è una diagnosi.', 'ร่างสำหรับให้แพทย์ทบทวน ไม่ใช่การวินิจฉัย') };
}
export async function consultNote(id: string, req: ConsultNoteReq, options: ConsultOptions = {}) {
  consultMode(req.mode); const actor = reviewer(req.reviewerId);
  if (!['draft', 'sign'].includes(req.action) || (req.edits !== undefined && (!Array.isArray(req.edits) || req.edits.length > 100 || req.edits.some(e => !object(e) || !shortString(e.lineId, 300) || !shortString(e.text, 2000) || Object.keys(e).some(k => !['lineId', 'text'].includes(k)))))) throw new PipelineError('Invalid note request', 'bad_request');
  if (req.action === 'draft' && req.edits?.length) throw new PipelineError('Edits require sign action', 'bad_request');
  if (req.action === 'sign' && req.mode !== 'doctor') throw new PipelineError('Only doctor mode can sign a consult note', 'bad_request', 403);
  return withSessionLock(id, async () => {
    const s = sessionFor(id); const record = getConsultRecord(id);
    if (req.action === 'sign' && s.summary?.redFlags.some(f => !f.review)) throw new PipelineError('Every red flag requires clinician review before signing', 'bad_request', 409);
    if (record.notes[req.mode]?.signed) throw new PipelineError('Note already signed', 'bad_request', 409);
    if (req.action === 'draft') {
      await refresh(s, record, options); record.notes[req.mode] = draftConsultNote(s, record.suggestions, req.mode);
      appendAudit(id, 'summary_generated', 'clinician', { event: 'consult_note_drafted', mode: req.mode, lineCount: record.notes[req.mode]!.lines.length }, actor);
    } else {
      const note = structuredClone(record.notes[req.mode]);
      if (!note) throw new PipelineError('Draft a note before signing', 'bad_request', 409);
      const ids = new Set<string>();
      for (const edit of req.edits || []) {
        const line = note.lines.find(l => l.id === edit.lineId);
        if (!line || ids.has(edit.lineId)) throw new PipelineError('Unknown or duplicate note line', 'bad_request');
        if (line.section === 'red_flags') throw new PipelineError('Red-flag note lines cannot be edited', 'bad_request');
        ids.add(edit.lineId); line.text = localizedText(redactKeepStaff(edit.text.trim())); line.status = 'edited';
      }
      // Only the missing-fields summary is informational. Every other unsupported
      // line needs an explicit doctor edit, including a resolution like "Not assessed".
      if (note.lines.some(l => l.status === 'unsupported' && !(l.id === 'missing:fields' && l.section === 'open_questions'))) throw new PipelineError('Resolve every unsupported note line with an edit before signing', 'bad_request', 409);
      note.lines = note.lines.filter(l => l.section !== 'considerations' || (ids.has(l.id) && record.suggestions.some(x => l.id === `suggestion:${x.id}` && x.kind === 'consider' && x.source === 'rule' && x.status !== 'dismissed')));
      const keptConsiderationIds = note.lines.filter(l => l.section === 'considerations').map(l => l.id);
      const at = new Date().toISOString(); note.signed = { reviewerId: actor, at };
      record.notes[req.mode] = note;
      appendAudit(id, 'consult_note_signed', 'clinician', { mode: req.mode, editedLineIds: [...ids], keptConsiderationIds, lineCount: note.lines.length }, actor, at);
    }
    saveConsultRecord(id, record); return state(s, record, req.mode);
  });
}
