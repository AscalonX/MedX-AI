import { journeyStage, type IntakeSession, type JourneyStage, type SessionListItem } from '@medx/shared';
import { listSessions } from './pipeline';
import { getConsultRecord } from './store';

/** Journey stage of one session, read with its consult record (signed notes live outside IntakeSession). */
export function sessionStage(s: IntakeSession): JourneyStage {
  return journeyStage(s, getConsultRecord(s.id));
}

/** GET /api/sessions rows: the queue order of listSessions, each with its stage. */
export function listSessionItems(): SessionListItem[] {
  return listSessions().map(s => ({ ...s, stage: sessionStage(s) }));
}
