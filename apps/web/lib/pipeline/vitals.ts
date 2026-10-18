import { randomUUID } from 'node:crypto';
import { WRITE_ROLES } from '@medx/shared';
import type { TriageAssessment, VitalSigns } from '@medx/shared';
import { invalid, optionalText, properties, requireStaffRole, sessionFor, text, written } from './clinicalWrites';
import { withSessionLock } from './store';
import { assessTriage } from './triage';

const ranges = { heartRate: [20, 250], systolicBP: [40, 300], diastolicBP: [20, 200], respRate: [4, 70], tempC: [30, 43], spo2: [50, 100], painScore: [0, 10] };
export function recordVitals(id: string, req: unknown) {
  properties(req, ['recordedBy', 'vitals']); const actor = text(req.recordedBy, 'recordedBy', 200);
  requireStaffRole(req.recordedBy, WRITE_ROLES.vitals, 'record vitals');
  const v = req.vitals; properties(v, [...Object.keys(ranges), 'onOxygen', 'consciousness']);
  if (!Object.keys(v).length) invalid('Enter at least one vital');
  for (const [key, value] of Object.entries(v)) {
    if (key === 'onOxygen') { if (typeof value !== 'boolean') invalid('Invalid onOxygen'); }
    else if (key === 'consciousness') { if (typeof value !== 'string' || !['alert', 'new_confusion', 'voice', 'pain', 'unresponsive'].includes(value)) invalid('Invalid consciousness'); }
    else {
      const [min, max] = ranges[key as keyof typeof ranges];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (key === 'painScore' && !Number.isInteger(value))) invalid(`Invalid ${key}`);
    }
  }
  if (typeof v.diastolicBP === 'number' && typeof v.systolicBP === 'number' && v.diastolicBP >= v.systolicBP) invalid('Diastolic must be lower than systolic');
  return withSessionLock(id, () => {
    const s = sessionFor(id); const vital = { ...v, id: randomUUID(), at: new Date().toISOString(), recordedBy: actor } as VitalSigns;
    (s.vitals ||= []).push(vital); s.triage = assessTriage(s);
    return written(s, 'vitals_recorded', actor, { vitalId: vital.id, vitals: v, suggestedLevel: s.triage.suggestedLevel });
  });
}
export function confirmTriage(id: string, req: unknown) {
  properties(req, ['reviewerId', 'level', 'note']); const actor = text(req.reviewerId, 'reviewerId', 200);
  requireStaffRole(req.reviewerId, WRITE_ROLES.triage, 'confirm triage');
  const note = optionalText(req.note, 'note');
  if (typeof req.level !== 'number' || !Number.isInteger(req.level) || req.level < 1 || req.level > 5) invalid('Invalid level');
  const level = req.level as TriageAssessment['suggestedLevel'];
  return withSessionLock(id, () => {
    const s = sessionFor(id); s.triage = assessTriage(s);
    if (level > s.triage.suggestedLevel && !note) invalid('Note required for less urgent confirmation');
    s.triage.confirmed = { level, by: actor, at: new Date().toISOString(), ...(note ? { note } : {}) };
    s.triage = assessTriage(s);
    return written(s, 'triage_confirmed', actor, { ...s.triage.confirmed, suggestedLevel: s.triage.suggestedLevel });
  });
}
