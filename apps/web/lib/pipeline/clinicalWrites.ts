import type { AuditType, IntakeSession } from '@medx/shared';
import { PipelineError } from './pipeline';
import { redact } from './redact';
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
export function optionalText(value: unknown, name: string, max = 2000): string | undefined {
  return value === undefined ? undefined : text(value, name, max);
}
export function sessionFor(id: string): IntakeSession {
  const s = getSession(id); if (!s) throw new PipelineError('Session not found', 'not_found'); return s;
}
export function written(s: IntakeSession, type: AuditType, actor: string, payload: Record<string, unknown>) {
  s.updatedAt = new Date().toISOString(); saveSession(s);
  appendAudit(s.id, type, 'clinician', payload, actor, s.updatedAt);
  return s;
}
