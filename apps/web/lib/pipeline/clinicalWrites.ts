import { roleOf, type StaffRole } from '@medx/shared';
import type { AuditType, IntakeSession } from '@medx/shared';
import { PipelineError } from './errors';
import { redact, redactActor } from './redact';
import { object, shortString } from './schema';
import { appendAudit, getSession, saveSession } from './store';

export function invalid(message = 'Invalid request'): never { throw new PipelineError(message, 'bad_request'); }
export function conflict(message: string): never { throw new PipelineError(message, 'bad_request', 409); }
export function properties(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).some(k => !allowed.includes(k))) invalid();
}
export function text(value: unknown, name: string, max = 2000): string {
  if (!shortString(value, max)) invalid(`Invalid ${name}`);
  return redact(value.trim()).text;
}
export function actorId(value: unknown, name: string): string {
  if (!shortString(value, 80)) invalid(`Invalid ${name}`);
  return redactActor(value);
}
export function optionalText(value: unknown, name: string, max = 2000): string | undefined {
  return value === undefined ? undefined : text(value, name, max);
}
const ROLE_NAME: Record<StaffRole, string> = { nurse: 'a nurse', doctor: 'a doctor', pharmacist: 'a pharmacist', ops: 'clinic operations' };
/**
 * Server-side role check for clinical writes (the UI selector is not a security boundary). A STAFF member, matched
 * by name or id with the shared roleOf, must hold one of `roles`: anyone else gets 403. An actor not in STAFF is
 * allowed (synthetic test reviewers) unless MEDX_STRICT_ROLES=1. Call it with the raw actor, before any redaction.
 */
export function requireStaffRole(actor: unknown, roles: readonly StaffRole[], action = 'perform this action'): void {
  const role = roleOf(actor);
  if (role ? roles.includes(role) : process.env.MEDX_STRICT_ROLES !== '1') return;
  const needed = roles.map(r => ROLE_NAME[r]).join(' or ');
  throw new PipelineError(role ? `Only ${needed} can ${action}` : `Unknown staff member: only ${needed} can ${action}`, 'bad_request', 403);
}
export function sessionFor(id: string): IntakeSession {
  const s = getSession(id); if (!s) throw new PipelineError('Session not found', 'not_found'); return s;
}
export function written(s: IntakeSession, type: AuditType, actor: string, payload: Record<string, unknown>) {
  s.updatedAt = new Date().toISOString(); saveSession(s);
  appendAudit(s.id, type, 'clinician', payload, actor, s.updatedAt);
  return s;
}
