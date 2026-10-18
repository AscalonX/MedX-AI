import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AuditEvent, AuditType, IntakeSession, ConsultMode, ConsultNote, ConsultSuggestion, ModelCall } from '@medx/shared';
import { backendFromEnv, storeKey, type RemoteBackend } from './kvStore';

export interface ConsultRecord {
  suggestions: ConsultSuggestion[];
  notes: Partial<Record<ConsultMode, ConsultNote>>;
  modelRevision?: string;
  modelSuggestions: ConsultSuggestion[];
  modelCalls: ModelCall[];
  /** Turn count when each question was asked; only later patient evidence answers it. */
  askedAfterTurn?: Record<string, number>;
}

/*
 * Two modes, one synchronous API.
 *
 * file (default; local dev, Docker, Render, vitest): the whole store lives in memory and is written to
 * MEDX_STORE_PATH (or apps/web/.data/store.json; os.tmpdir()/medx/store.json on Vercel) on every write.
 *
 * shared (Vercel; owner decision 6): the same snapshot lives in Neon Postgres (or Upstash) as one row with a
 * version. handle() calls syncStore() before a route and flushStore() after it. Writes are staged in
 * write-sets: one per request (handle) and one per withSessionLock, and land with compare-and-set on the
 * version. On a version conflict the row is re-read and the write-set merged on top: sessions by id, audit
 * events as a union by id (invariant 4), B-0xx codes of newly created sessions reassigned on collision. When
 * another instance changed the same session in between (per-session revision check), the locked function is
 * replayed on fresh state instead of overwriting that change. After 5 retries the request gets 503
 * 'Store busy, retry'. Any database error fails safe with 503: nothing is guessed, and a write that cannot
 * land is never reported as saved.
 */

/** Optimistic concurrency could not land a write within the retry budget. The route answers 503. */
export class StoreBusyError extends Error { readonly status = 503; constructor() { super('Store busy, retry'); this.name = 'StoreBusyError'; } }
/** The shared store could not be reached, or returned an unreadable snapshot (fails closed, like a corrupt file). */
export class StoreUnavailableError extends Error {
  readonly status = 503;
  constructor(readonly reason: 'unreachable' | 'corrupt' = 'unreachable') { super('Shared store unavailable'); this.name = 'StoreUnavailableError'; }
}
/** Internal: a session in this write-set was changed by another instance after this write-set read it. */
class ReplayNeeded extends Error { constructor(readonly sessionId: string) { super('Session changed on another instance'); } }

interface Committed { sessions: Map<string, IntakeSession>; consults: Map<string, ConsultRecord>; turnIds: Map<string, string[]>; audit: AuditEvent[]; rev: Map<string, number> }
/** Writes staged by one request or one locked function. `base` holds per-session revisions as first read. */
interface WriteSet { sessions: Map<string, IntakeSession>; consults: Map<string, ConsultRecord>; turnIds: Map<string, string[]>; audit: AuditEvent[]; reset: boolean; base?: Map<string, number> }
/** `lockId`: the withSessionLock key, revision-checked and bumped with the scope's writes (the cross-instance lock). */
interface Scope { ws: WriteSet; parent?: Scope; reassigned: Map<string, string>; lockId?: string; closed?: boolean }
interface Link { ws: WriteSet; lockId?: string }
interface Remote { backend: RemoteBackend; key: string; version: number; rev: Map<string, number>; root: WriteSet; rootFlush?: ReturnType<typeof setTimeout> }
interface State { sessions: Map<string, IntakeSession>; consults: Map<string, ConsultRecord>; clientTurnIds?: Map<string, string[]>; turnIdsMigrated?: boolean; audit: AuditEvent[]; file: string; locks: Map<string, Promise<unknown>>; writes?: number; remote?: Remote }
type Slot = { medxStore?: State };
type Globals = typeof globalThis & Slot & { medxStoreScopes?: AsyncLocalStorage<Scope>; medxStoreInstances?: AsyncLocalStorage<Slot>; medxStoreBackend?: { id: string; backend: RemoteBackend } };
const globalThisStore = globalThis as Globals;
// On globalThis like the store itself: route bundles may each carry a copy of this module.
const scopes = (globalThisStore.medxStoreScopes ||= new AsyncLocalStorage<Scope>());
const instances = (globalThisStore.medxStoreInstances ||= new AsyncLocalStorage<Slot>());
/**
 * Test hook: a simulated server instance with its own memory (sharing only the injected backend), so two
 * instances can run concurrently in one process. Production never enters one: the slot is globalThis.
 */
export function newStoreInstance() {
  const slot: Slot = {};
  // exit(): an instance never inherits the caller's request or lock scope.
  return { run: <T>(fn: () => T): T => instances.run(slot, () => scopes.exit(fn)) };
}

const SEED_LOCK = 'dev-demo-seed';
/** Retry budget and timings; tests may shorten them. */
export const storeTuning = { retries: 5, backoffMs: 40, leaseTtlMs: 120_000, leaseWaitMs: 30_000, leasePollMs: 250 };
/** Above this the flush prunes non-demo sessions older than 24 h, then idle per-visitor demo cases (audit events always stay). */
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
/** A per-visitor demo case (POST /api/demo/start) idle this long may be pruned when the snapshot is over the cap. */
export const DEMO_START_PRUNE_AFTER_MS = 90 * 60 * 1000;

/** Test hook: route the store through an injected backend (fake driver). null returns to the environment. */
export function setStoreBackend(backend: RemoteBackend | null) {
  if (backend) globalThisStore.medxStoreBackend = { id: `injected-${randomUUID()}`, backend }; else delete globalThisStore.medxStoreBackend;
}
function remoteConfig() { return globalThisStore.medxStoreBackend ?? backendFromEnv(); }
/** MEDX_STORE_PATH, else os.tmpdir()/medx/store.json on Vercel (the bundle at /var/task is read-only), else apps/web/.data. */
export function storeFilePath() {
  if (process.env.MEDX_STORE_PATH) return process.env.MEDX_STORE_PATH;
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'medx', 'store.json');
  const appRoot = path.basename(process.cwd()) === 'web' ? process.cwd() : path.join(process.cwd(), 'apps/web');
  return path.join(appRoot, '.data/store.json');
}
const emptyWriteSet = (base?: Map<string, number>): WriteSet => ({ sessions: new Map(), consults: new Map(), turnIds: new Map(), audit: [], reset: false, base });

function state(): State {
  const globalStore = instances.getStore() ?? globalThisStore;
  const remote = remoteConfig();
  if (remote) {
    const key = storeKey('snapshot'); const file = `remote:${remote.backend.kind}:${remote.id}:${key}`;
    if (!globalStore.medxStore || globalStore.medxStore.file !== file) {
      // Version -1: nothing read yet; the first syncStore() or commit reads the shared row.
      globalStore.medxStore = { sessions: new Map(), consults: new Map(), clientTurnIds: new Map(), turnIdsMigrated: true, audit: [], file, locks: new Map(), remote: { backend: remote.backend, key, version: -1, rev: new Map(), root: emptyWriteSet() } };
    }
    return globalStore.medxStore;
  }
  const file = storeFilePath();
  if (!globalStore.medxStore || globalStore.medxStore.file !== file) {
    // A corrupt store fails closed; it is never silently overwritten.
    const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { sessions: IntakeSession[]; audit: AuditEvent[]; consults?: [string, ConsultRecord][]; clientTurnIds?: [string, string[]][] } : { sessions: [], audit: [] };
    globalStore.medxStore = { sessions: new Map(saved.sessions.map(s => [s.id, s])), consults: new Map(saved.consults || []), clientTurnIds: saved.clientTurnIds ? new Map(saved.clientTurnIds) : undefined, audit: saved.audit, file, locks: new Map() };
  }
  // Upgrade the in-memory store on HMR without restarting the running server.
  globalStore.medxStore.consults ||= new Map();
  if (!globalStore.medxStore.turnIdsMigrated) {
    globalStore.medxStore.clientTurnIds ||= new Map();
    // Migrate disk and pre-fix HMR state without exposing internal retry IDs.
    for (const s of globalStore.medxStore.sessions.values()) for (const turn of s.turns) {
      const internal = turn as typeof turn & { clientTurnId?: string };
      if (internal.clientTurnId) {
        const ids = globalStore.medxStore.clientTurnIds.get(s.id) || [];
        ids.push(internal.clientTurnId); globalStore.medxStore.clientTurnIds.set(s.id, ids);
        delete internal.clientTurnId;
      }
    }
    globalStore.medxStore.turnIdsMigrated = true;
  }
  return globalStore.medxStore;
}
function persist() {
  const s = state(); mkdirSync(path.dirname(s.file), { recursive: true });
  const temp = `${s.file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify({ sessions: [...s.sessions.values()], consults: [...s.consults], clientTurnIds: [...s.clientTurnIds!], audit: s.audit }), { mode: 0o600 }); renameSync(temp, s.file);
  s.writes = (s.writes || 0) + 1;
}

// ---- Shared-mode views: innermost write-set first, then the instance root, then the committed snapshot ----
function layers(st: State): WriteSet[] {
  if (!st.remote) return [];
  const out: WriteSet[] = [];
  for (let scope = scopes.getStore(); scope; scope = scope.parent) out.push(scope.ws);
  out.push(st.remote.root);
  return out;
}
function lookup<T>(st: State, pick: (ws: WriteSet) => Map<string, T>, committed: Map<string, T> | undefined, id: string): T | undefined {
  for (const ws of layers(st)) { const m = pick(ws); if (m.has(id)) return m.get(id); if (ws.reset) return undefined; }
  return committed?.get(id);
}
function allSessions(st: State) {
  let all = new Map(st.sessions);
  for (const ws of layers(st).reverse()) { if (ws.reset) all = new Map(); for (const [id, s] of ws.sessions) all.set(id, s); }
  return [...all.values()];
}
function allAudit(st: State) {
  let all = st.audit;
  for (const ws of layers(st).reverse()) { if (ws.reset) all = []; if (ws.audit.length) all = all.concat(ws.audit); }
  return all;
}
/** Where a shared-mode write goes: the current request/lock scope, else the instance root (flushed by flushStore). */
function target(st: State): WriteSet {
  let scope = scopes.getStore(); const late = scope?.closed;
  while (scope?.closed) scope = scope.parent;
  const ws = scope?.ws ?? st.remote!.root; ws.base ||= new Map(st.remote!.rev);
  // A write after its request already answered (work scheduled with after()) must still land.
  if (late && !scope) scheduleRootFlush(st);
  return ws;
}
function scheduleRootFlush(st: State) {
  const r = st.remote!; if (r.rootFlush) return;
  r.rootFlush = setTimeout(() => {
    r.rootFlush = undefined;
    scopes.exit(() => commitChain(st)).catch(error => {
      if (error instanceof ReplayNeeded) Object.assign(r.root, emptyWriteSet());
      console.error('[medx-store] a write made after its response could not be saved:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
    });
  }, 0);
}
const same = (a: unknown, b: unknown) => a !== undefined && JSON.stringify(a) === JSON.stringify(b);

export function getSession(id: string): IntakeSession | undefined {
  const st = state(); const s = st.remote ? lookup(st, ws => ws.sessions, st.sessions, id) : st.sessions.get(id);
  return s ? structuredClone(s) : undefined;
}
export function getSessions() { const st = state(); return structuredClone(st.remote ? allSessions(st) : [...st.sessions.values()]); }
export function hasClientTurnId(id: string, clientTurnId: string) {
  const st = state(); const ids = st.remote ? lookup(st, ws => ws.turnIds, st.clientTurnIds, id) : st.clientTurnIds!.get(id);
  return ids?.includes(clientTurnId) || false;
}
export function saveSession(session: IntakeSession, clientTurnId?: string) {
  const s = state();
  if (s.remote) {
    const value = structuredClone(session);
    const current = lookup(s, ws => ws.sessions, s.sessions, session.id);
    const known = lookup(s, ws => ws.turnIds, s.clientTurnIds, session.id);
    const ws = target(s);
    // Rewriting identical content is not a change: polling reads must not rewrite the shared row.
    if (!same(current, value)) ws.sessions.set(session.id, value);
    if (clientTurnId !== undefined && !known?.includes(clientTurnId)) ws.turnIds.set(session.id, [...new Set([...(known || []), clientTurnId])]);
    return;
  }
  s.sessions.set(session.id, structuredClone(session));
  if (clientTurnId !== undefined) s.clientTurnIds!.set(session.id, [...new Set([...(s.clientTurnIds!.get(session.id) || []), clientTurnId])]);
  persist();
}
const emptyConsult = (): ConsultRecord => ({ suggestions: [], notes: {}, modelSuggestions: [], modelCalls: [] });
/** Kept outside IntakeSession: patient session routes never serialize consult notes. */
export function getConsultRecord(id: string): ConsultRecord {
  const st = state(); const record = st.remote ? lookup(st, ws => ws.consults, st.consults, id) : st.consults.get(id);
  return structuredClone(record || emptyConsult());
}
export function saveConsultRecord(id: string, record: ConsultRecord) {
  const st = state();
  if (st.remote) {
    const value = structuredClone(record); const ws = target(st);
    if (!same(lookup(st, w => w.consults, st.consults, id), value)) ws.consults.set(id, value);
    return;
  }
  st.consults.set(id, structuredClone(record)); persist();
}
export function appendAudit(sessionId: string, type: AuditType, actor: AuditEvent['actor'], payload: Record<string, unknown>, actorId?: string, at = new Date().toISOString()) {
  const event: AuditEvent = { id: randomUUID(), sessionId, type, actor, payload: structuredClone(payload), at, ...(actorId ? { actorId } : {}) };
  const st = state();
  if (st.remote) target(st).audit.push(event); else { st.audit.push(event); persist(); }
  return structuredClone(event);
}
export function getAudit(id?: string): AuditEvent[] {
  const st = state(); const all = st.remote ? allAudit(st) : st.audit;
  return structuredClone(all.filter(e => !id || e.sessionId === id));
}
/** Demo-only caller must hold the seed lock. Keep the lock map across resets. */
export function resetDemoStore() {
  const s = state();
  if ([...s.locks.keys()].some(id => id !== 'dev-demo-seed')) throw new Error('Store has active writes');
  if (s.remote) {
    // Staged like any write: the commit replaces the shared snapshot with what follows the reset.
    const ws = target(s); const base = ws.base;
    Object.assign(ws, emptyWriteSet(base), { reset: true });
    return;
  }
  s.sessions.clear(); s.consults.clear(); s.clientTurnIds!.clear(); s.audit = []; persist();
}
/**
 * Serialises patient turns and clinician writes on a session: in-process by a promise chain, across
 * instances (shared mode) by a per-session revision check at commit, with replay on conflict.
 */
export async function withSessionLock<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const st = state();
  const run = st.remote ? () => remoteLocked(id, fn) : fn;
  const locks = st.locks; const previous = locks.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(run); locks.set(id, next);
  try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
}

// ---- Shared mode: sync, scopes, commit -------------------------------------------------------------

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const backoff = (attempt: number) => sleep(storeTuning.backoffMs * (attempt + 1) * (0.5 + Math.random()));
function unavailable(op: string, error: unknown): Error {
  if (error instanceof StoreUnavailableError || error instanceof StoreBusyError || error instanceof ReplayNeeded) return error;
  // The message names the operation only: driver errors can carry hostnames, never echo them to clients.
  if (!process.env.VITEST) console.error(`[medx-store] ${op} failed:`, error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
  return new StoreUnavailableError();
}
const emptyCommitted = (): Committed => ({ sessions: new Map(), consults: new Map(), turnIds: new Map(), audit: [], rev: new Map() });
function parseCommitted(data: unknown): Committed {
  if (data === null || data === undefined) return emptyCommitted();
  const d = data as { sessions?: unknown; consults?: unknown; clientTurnIds?: unknown; audit?: unknown; rev?: unknown };
  if (typeof d !== 'object' || !Array.isArray(d.sessions) || !Array.isArray(d.audit) || (d.consults !== undefined && !Array.isArray(d.consults)) || (d.clientTurnIds !== undefined && !Array.isArray(d.clientTurnIds)) || (d.rev !== undefined && (typeof d.rev !== 'object' || d.rev === null))) throw new StoreUnavailableError('corrupt');
  return {
    sessions: new Map((d.sessions as IntakeSession[]).map(s => [s.id, s])),
    consults: new Map((d.consults || []) as [string, ConsultRecord][]),
    turnIds: new Map((d.clientTurnIds || []) as [string, string[]][]),
    audit: d.audit as AuditEvent[],
    rev: new Map(Object.entries((d.rev || {}) as Record<string, number>)),
  };
}
const serialize = (c: Committed) => JSON.stringify({ sessions: [...c.sessions.values()], consults: [...c.consults], clientTurnIds: [...c.turnIds], audit: c.audit, rev: Object.fromEntries(c.rev) });
const committedOf = (st: State): Committed => ({ sessions: st.sessions, consults: st.consults, turnIds: st.clientTurnIds!, audit: st.audit, rev: st.remote!.rev });
function adopt(st: State, c: Committed, version: number) {
  st.sessions = c.sessions; st.consults = c.consults; st.clientTurnIds = c.turnIds; st.audit = c.audit;
  st.remote!.rev = c.rev; st.remote!.version = version;
}
const isEmpty = (ws: WriteSet) => !ws.reset && !ws.sessions.size && !ws.consults.size && !ws.turnIds.size && !ws.audit.length;
const touched = ({ ws, lockId }: Link) => new Set([...ws.sessions.keys(), ...ws.consults.keys(), ...ws.turnIds.keys(), ...(lockId ? [lockId] : [])]);
const codeFor = (n: number) => `B-${String(n).padStart(3, '0')}`;

/** Write-sets applied outer to inner on the latest snapshot. Pure: never mutates `base`. */
function merge(base: Committed, links: Link[]) {
  let sessions = new Map(base.sessions), consults = new Map(base.consults), turnIds = new Map(base.turnIds), audit = base.audit.slice(), rev = new Map(base.rev);
  let seen = new Set(audit.map(e => e.id));
  const ids = new Set<string>(); const created: string[] = [];
  for (const { ws, lockId } of links) {
    if (lockId) ids.add(lockId);
    if (ws.reset) { sessions = new Map(); consults = new Map(); turnIds = new Map(); audit = []; rev = new Map(); seen = new Set(); }
    for (const [id, s] of ws.sessions) { if (!base.sessions.has(id) && !created.includes(id)) created.push(id); sessions.set(id, s); ids.add(id); }
    for (const [id, c] of ws.consults) { consults.set(id, c); ids.add(id); }
    for (const [id, t] of ws.turnIds) { turnIds.set(id, t); ids.add(id); }
    // Invariant 4: the audit log is a union by event id; nothing another instance appended is dropped.
    for (const e of ws.audit) if (!seen.has(e.id)) { seen.add(e.id); audit.push(e); }
  }
  for (const id of ids) rev.set(id, (rev.get(id) ?? 0) + 1);
  // Two instances can hand out the same B-0xx code at once: the session already shared keeps it.
  const reassigned = new Map<string, string>(); const holders = new Map<string, string>();
  for (const [id, s] of sessions) if (!created.includes(id) && s.code) holders.set(s.code, id);
  for (const id of created) {
    const s = sessions.get(id); if (!s || !s.code) continue;
    if (!holders.has(s.code)) { holders.set(s.code, id); continue; }
    let n = 1; while (holders.has(codeFor(n))) n++;
    const code = codeFor(n); sessions.set(id, { ...s, code }); holders.set(code, id); reassigned.set(id, code);
  }
  return { next: { sessions, consults, turnIds, audit, rev } as Committed, reassigned, ids };
}
/**
 * Snapshot cap: prune non-demo sessions older than 24 h. When that is not enough, prune the per-visitor cases from
 * POST /api/demo/start (session_created payload.demoStart) idle for DEMO_START_PRUNE_AFTER_MS, oldest first, until the
 * snapshot fits (they would otherwise live until the daily reset). Seeded demo cases and sessions this commit wrote
 * are never pruned. Audit events always stay (invariant 4).
 */
function capped(next: Committed, keep: Set<string>, now = Date.now()) {
  const json = serialize(next);
  let bytes = Buffer.byteLength(json, 'utf8');
  if (bytes <= MAX_SNAPSHOT_BYTES) return json;
  const created = next.audit.filter(e => e.type === 'session_created');
  const demo = new Set(created.filter(e => e.payload?.demoCaseId).map(e => e.sessionId));
  const started = new Set(created.filter(e => typeof e.payload?.demoStart === 'string').map(e => e.sessionId));
  const lastActive = (s: IntakeSession) => Math.max(Date.parse(s.updatedAt) || 0, Date.parse(s.createdAt) || 0);
  // Bytes this session's entries take in serialize(): the session, its [id, consult] and [id, turnIds] pairs, commas.
  const entry = (v: unknown) => (v === undefined ? 0 : Buffer.byteLength(JSON.stringify(v), 'utf8') + 1);
  const size = (id: string) => entry(next.sessions.get(id)) + (next.consults.has(id) ? entry([id, next.consults.get(id)]) : 0) + (next.turnIds.has(id) ? entry([id, next.turnIds.get(id)]) : 0);
  const drop = (id: string) => { bytes -= size(id); next.sessions.delete(id); next.consults.delete(id); next.turnIds.delete(id); next.rev.delete(id); };
  let pruned = 0;
  for (const [id, s] of [...next.sessions]) {
    if (demo.has(id) || keep.has(id)) continue;
    if (now - lastActive(s) > PRUNE_AFTER_MS) { drop(id); pruned++; }
  }
  if (bytes > MAX_SNAPSHOT_BYTES) {
    const idle = [...next.sessions.values()].filter(s => started.has(s.id) && !keep.has(s.id) && now - lastActive(s) > DEMO_START_PRUNE_AFTER_MS).sort((a, b) => lastActive(a) - lastActive(b));
    for (const s of idle) { if (bytes <= MAX_SNAPSHOT_BYTES) break; drop(s.id); pruned++; }
  }
  return pruned ? serialize(next) : json;
}

function chainOf(st: State, scope?: Scope) { const out: Link[] = []; for (let s = scope; s; s = s.parent) out.push({ ws: s.ws, lockId: s.lockId }); out.push({ ws: st.remote!.root }); return out; }
/** Lands a scope's write-set together with its not-yet-committed ancestors (they happened before it). */
async function commitChain(st: State, scope?: Scope) {
  const r = st.remote!; const sets = chainOf(st, scope).filter(link => !isEmpty(link.ws));
  if (!sets.length) return;
  let base = committedOf(st); let version = r.version;
  for (let attempt = 0; attempt <= storeTuning.retries; attempt++) {
    if (version < 0 || attempt > 0) {
      try {
        const row = await r.backend.read(r.key);
        base = parseCommitted(row?.data); version = row?.version ?? 0;
        if (version > r.version) adopt(st, base, version);
      } catch (error) { throw unavailable('read', error); }
    }
    for (const link of sets) if (!link.ws.reset) for (const id of touched(link)) if ((base.rev.get(id) ?? 0) !== (link.ws.base?.get(id) ?? 0)) throw new ReplayNeeded(id);
    const { next, reassigned, ids } = merge(base, [...sets].reverse());
    const json = capped(next, ids);
    let ok: boolean;
    try { ok = await r.backend.write(r.key, version, json); } catch (error) { throw unavailable('write', error); }
    if (ok) {
      if (version + 1 > r.version) adopt(st, next, version + 1);
      for (const { ws } of sets) Object.assign(ws, emptyWriteSet(ws === r.root ? undefined : new Map(next.rev)));
      // Ancestors with nothing staged now know these sessions at the revision just written (no false conflicts later).
      for (const { ws } of chainOf(st, scope)) if (ws.base) for (const id of ids) ws.base.set(id, next.rev.get(id) ?? 0);
      for (const [id, code] of reassigned) scope?.reassigned.set(id, code);
      return;
    }
    if (attempt < storeTuning.retries) await backoff(attempt);
  }
  throw new StoreBusyError();
}

/** Pulls the shared snapshot when its version moved. No-op in file mode. Throws StoreUnavailableError. */
export async function syncStore(): Promise<void> {
  const st = state(); const r = st.remote; if (!r) return;
  try {
    const known = r.version; const head = await r.backend.head(r.key);
    if (head === known) return;
    const row = await r.backend.read(r.key);
    const version = row?.version ?? 0;
    // Monotonic, except when the row went backwards (an operator reset the table).
    if (version > r.version || head < known) adopt(st, parseCommitted(row?.data), version);
  } catch (error) { throw unavailable('sync', error); }
}
/** Lands the current scope's staged writes (or the instance root outside any scope). No-op in file mode. */
export async function flushStore(): Promise<void> {
  const st = state(); if (!st.remote) return;
  const scope = scopes.getStore();
  try { await commitChain(st, scope); } catch (error) {
    if (!(error instanceof ReplayNeeded)) throw error;
    // No function to replay here: a write that conflicts with another instance is refused (503), never merged over it.
    for (const { ws } of chainOf(st, scope)) Object.assign(ws, emptyWriteSet(ws === st.remote.root ? undefined : new Map(st.remote.rev)));
    throw new StoreBusyError();
  }
}
/** Runs a request in its own write-set (shared mode). `reassigned` lists B-0xx codes changed by a merge. */
export async function storeScope<T>(fn: (scope: { reassigned: ReadonlyMap<string, string> }) => Promise<T> | T): Promise<T> {
  const st = state();
  if (!st.remote) return fn({ reassigned: new Map() });
  const parent = scopes.getStore();
  const scope: Scope = { ws: emptyWriteSet(new Map(st.remote.rev)), parent, reassigned: parent?.reassigned ?? new Map() };
  try { return await scopes.run(scope, () => fn(scope)); }
  finally {
    // Whatever did not land with the request is not shown to later readers; later writes go to the root.
    scope.closed = true; Object.assign(scope.ws, emptyWriteSet());
  }
}
async function remoteLocked<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const parent = scopes.getStore();
  // Seeded-once guard: a row-level lease, so only one instance seeds or resets at a time; the seed itself
  // reuses demo cases it finds after the refresh below, so a waiting instance never duplicates them.
  const lease = id === SEED_LOCK ? await acquireSeedLease() : undefined;
  try {
    for (let attempt = 0; ; attempt++) {
      await syncStore();
      const st = state();
      const scope: Scope = { ws: emptyWriteSet(new Map(st.remote!.rev)), parent, reassigned: parent?.reassigned ?? new Map(), lockId: id };
      let value: T | undefined; let failure: unknown; let failed = false;
      try { value = await scopes.run(scope, fn); } catch (error) { failed = true; failure = error; }
      // Writes made before an error land too, as in file mode (an abstention is recorded, then reported).
      // A closed scope is empty: what did not land is never shown to later readers.
      const close = () => { scope.closed = true; Object.assign(scope.ws, emptyWriteSet()); };
      try { await commitChain(st, scope); } catch (error) {
        close();
        if (!(error instanceof ReplayNeeded)) throw error;
        if (attempt >= storeTuning.retries) throw new StoreBusyError();
        await backoff(attempt); continue;
      }
      close();
      if (failed) throw failure;
      return value as T;
    }
  } finally { if (lease) await lease.release(); }
}
async function acquireSeedLease() {
  const r = state().remote!; const key = storeKey('seed-lease'); const owner = randomUUID();
  const deadline = Date.now() + storeTuning.leaseWaitMs;
  for (;;) {
    let ok: boolean;
    try { ok = await r.backend.acquireLease(key, owner, storeTuning.leaseTtlMs); } catch (error) { throw unavailable('lease', error); }
    if (ok) return { release: async () => { try { await r.backend.releaseLease(key, owner); } catch { /* the lease expires on its own */ } } };
    if (Date.now() >= deadline) throw new StoreBusyError();
    await sleep(storeTuning.leasePollMs);
  }
}

/** Patches B-0xx codes a merge reassigned into a route result (plain JSON data, a few levels deep). */
export function applyReassignedCodes<T>(value: T, reassigned: ReadonlyMap<string, string>): T {
  if (!reassigned.size) return value;
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 4 || v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1));
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return v;
    const o = v as Record<string, unknown>; const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = walk(x, depth + 1);
    if (typeof o.id === 'string' && typeof o.code === 'string' && reassigned.has(o.id)) out.code = reassigned.get(o.id);
    return out;
  };
  return walk(value, 0) as T;
}

export type StoreKind = 'postgres' | 'redis' | 'tmp-ephemeral' | 'file';
/** For /api/health: kind, reachability, version and a session count. Never patient data. */
export async function storeInfo(): Promise<{ kind: StoreKind; ok: boolean; version: number | null; sessions: number | null }> {
  let st: State;
  try { st = state(); } catch { return { kind: 'file', ok: false, version: null, sessions: null }; }
  if (st.remote) {
    const kind = st.remote.backend.kind;
    try { await syncStore(); return { kind, ok: true, version: st.remote.version, sessions: st.sessions.size }; }
    catch { return { kind, ok: false, version: null, sessions: null }; }
  }
  const tmp = path.resolve(os.tmpdir()); const file = path.resolve(st.file);
  const ephemeral = file.startsWith(tmp + path.sep) || st.file.startsWith('/tmp/');
  return { kind: ephemeral ? 'tmp-ephemeral' : 'file', ok: true, version: st.writes ?? 0, sessions: st.sessions.size };
}
