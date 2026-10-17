import type { IntakeSession } from '@medx/shared';
import { redact } from './redact';

export type PatientPickup = { status: 'preparing' | 'ready' | 'collected'; counter?: string } | null;

/** Pickup status only: never drug names, pharmacist ids, notes or timestamps. */
export function patientPickup(s: IntakeSession): PatientPickup {
  if (s.pickup) return { status: s.pickup.status, ...(s.pickup.counter ? { counter: redact(s.pickup.counter).text } : {}) };
  return (s.orders?.medications || []).some(o => ['submitted', 'verified', 'dispensed'].includes(o.status)) ? { status: 'preparing' } : null;
}

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
    pickup: patientPickup(s),
  };
}
