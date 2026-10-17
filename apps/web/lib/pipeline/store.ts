import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AuditEvent, AuditType, IntakeSession } from '@medx/shared';

interface State { sessions: Map<string, IntakeSession>; audit: AuditEvent[]; file: string; locks: Map<string, Promise<unknown>> }
const globalStore = globalThis as typeof globalThis & { medxStore?: State };
function state(): State {
  const appRoot = path.basename(process.cwd()) === 'web' ? process.cwd() : path.join(process.cwd(), 'apps/web');
  const file = process.env.MEDX_STORE_PATH || path.join(appRoot, '.data/store.json');
  if (!globalStore.medxStore || globalStore.medxStore.file !== file) {
    // A corrupt store fails closed; it is never silently overwritten.
    const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { sessions: IntakeSession[]; audit: AuditEvent[] } : { sessions: [], audit: [] };
    globalStore.medxStore = { sessions: new Map(saved.sessions.map(s => [s.id, s])), audit: saved.audit, file, locks: new Map() };
  }
  return globalStore.medxStore;
}
function persist() {
  const s = state(); mkdirSync(path.dirname(s.file), { recursive: true });
  const temp = `${s.file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify({ sessions: [...s.sessions.values()], audit: s.audit }), { mode: 0o600 }); renameSync(temp, s.file);
}
export function getSession(id: string): IntakeSession | undefined { const s = state().sessions.get(id); return s ? structuredClone(s) : undefined; }
export function getSessions() { return structuredClone([...state().sessions.values()]); }
export function saveSession(session: IntakeSession) { state().sessions.set(session.id, structuredClone(session)); persist(); }
export function appendAudit(sessionId: string, type: AuditType, actor: AuditEvent['actor'], payload: Record<string, unknown>, actorId?: string, at = new Date().toISOString()) {
  const event: AuditEvent = { id: randomUUID(), sessionId, type, actor, payload: structuredClone(payload), at, ...(actorId ? { actorId } : {}) };
  state().audit.push(event); persist(); return structuredClone(event);
}
export function getAudit(id?: string): AuditEvent[] { return structuredClone(state().audit.filter(e => !id || e.sessionId === id)); }
/** Serialises patient turns and clinician writes on a session within this single process. */
export async function withSessionLock<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const locks = state().locks; const previous = locks.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(fn); locks.set(id, next);
  try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
}
