import type { ExtractedField, IntakeSession, NextQuestion } from '@medx/shared';
import { isPresent, MAX_FOLLOW_UPS, QUESTION_PRIORITY } from './config';
import type { EngineContext } from './extract';
import { invoke } from './extract';
import { QUESTION_SYSTEM, questionPrompt } from './prompts';
import { languageOK, localized, object } from './schema';
import { QUESTIONS } from './templates';
import { words } from './verify';
export async function nextQuestion(session: IntakeSession, fields: ExtractedField[], ctx: EngineContext): Promise<NextQuestion | null> {
  if (session.summary?.redFlags.length || session.status === 'escalated' || session.turns.filter(t => t.role === 'assistant').length >= MAX_FOLLOW_UPS) return null;
  const field = QUESTION_PRIORITY.find(k => fields.some(f => f.key === k && f.required && !isPresent(f)));
  if (!field) return null;
  const result = await invoke({ step: 'next_question', system: QUESTION_SYSTEM, user: questionPrompt(session, field), schemaName: 'intake_next_question' }, ctx);
  const data = result.data;
  if (result.call.ok && object(data) && Object.keys(data).every(k => ['field', 'question'].includes(k)) && data.field === field && localized(data.question) && languageOK(data.question) && words(data.question[session.patientLang], session.patientLang).length <= 20 && !session.turns.some(t => t.role === 'assistant' && t.text === (data.question as Record<string, string>)[session.patientLang])) return { field, text: data.question };
  result.call.ok = false; result.call.error ||= 'Next-question schema or language check failed; static fallback';
  return { field, text: QUESTIONS[field] };
}
