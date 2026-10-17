import type { IntakeSession } from '@medx/shared';
import { redact } from './redact';

/** Explicit allowlist: never serialize clinician state or audit to a patient client. */
export function patientView(s: IntakeSession) {
  return {
    id: s.id, code: s.code, patientLang: s.patientLang, status: s.status,
    turns: s.turns.filter(t => t.role === 'patient').map(t => ({
      id: t.id, role: t.role, lang: t.lang, text: redact(t.text).text, at: t.at,
      ...(t.inputMode ? { inputMode: t.inputMode } : {}),
    })),
    summary: s.summary ? {
      nextQuestion: s.summary.nextQuestion ? { field: s.summary.nextQuestion.field, text: s.summary.nextQuestion.text } : null,
      redFlags: s.summary.redFlags.map(f => ({ patientMessage: f.patientMessage, severity: f.severity })),
      abstained: s.summary.abstained,
    } : null,
  };
}
