// Shared snapshot store (backlog M-02, C-01; owner decision 6: Neon Postgres primary, Upstash optional).
// Every scenario runs against a fake Neon driver (tagged SQL) and a fake Upstash REST fetch (GET, SET, INCR,
// EXPIRE, EVAL, DEL). Instances are simulated with separate memory, sharing only the fake database.
import { mkdtempSync, rmSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEvent, IntakeSession, Turn } from '@medx/shared';
import { backendFromEnv, postgresBackend, redisBackend, REDIS_CAS, REDIS_READ, REDIS_RELEASE, selectedStoreMode, storeKey, upstashClient, type RedisClient, type RemoteBackend, type SqlTag } from '../kvStore';
import { createSession } from '../pipeline';
import { checkRateLimit, clientIp, resetRateLimit, setRateLimitRedis } from '../rateLimit';
import { seedDemo } from '../seed';
import {
  appendAudit, applyReassignedCodes, flushStore, getAudit, getConsultRecord, getSession, getSessions, MAX_SNAPSHOT_BYTES, newStoreInstance,
  resetDemoStore, saveConsultRecord, saveSession, setStoreBackend, StoreBusyError, storeFilePath, storeTuning, syncStore, withSessionLock,
} from '../store';
import { handle } from '../../../app/api/_http';
import { GET as health } from '../../../app/api/health/route';
import { GET as listSessions, POST as postSession } from '../../../app/api/sessions/route';
import { GET as getSessionRoute } from '../../../app/api/sessions/[id]/route';
import { POST as postTurn } from '../../../app/api/sessions/[id]/turns/route';

type Snapshot = { sessions: IntakeSession[]; audit: AuditEvent[]; consults: unknown[]; clientTurnIds: unknown[]; rev?: Record<string, number> };
interface FakeDb {
  backend: RemoteBackend;
  /** The shared snapshot as stored, or null when nothing was written. */
  snapshot(): Snapshot | null;
  /** Compare-and-set attempts on the snapshot row. */
  writes: number;
  /** Another writer always lands first: every compare-and-set fails. */
  hostile: boolean;
  /** The database is unreachable. */
  down: boolean;
  /** Reads work, writes fail (connection lost mid-request). */
  writesDown: boolean;
  /** Network latency on compare-and-set, so concurrent instances both read before either write lands. */
  writeDelayMs: number;
  corrupt(): void;
}
const SNAP = 'medx:test:snapshot';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** Fake @neondatabase/serverless tagged query function over an in-memory medx_store table. */
function fakeNeon(): FakeDb {
  const rows = new Map<string, { version: number; data: string; updatedAt: number }>();
  const db: FakeDb = {
    writes: 0, hostile: false, down: false, writesDown: false, writeDelayMs: 0,
    snapshot: () => (rows.has(SNAP) ? JSON.parse(rows.get(SNAP)!.data) : null),
    corrupt: () => { const r = rows.get(SNAP)!; r.version++; r.data = JSON.stringify({ unexpected: true }); },
    backend: undefined as unknown as RemoteBackend,
  };
  const sql: SqlTag = async (strings, ...values) => {
    await tick();
    if (db.down) throw new Error('fetch failed: getaddrinfo ENOTFOUND ep-test.neon.tech');
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    const write = text.startsWith('UPDATE') || text.startsWith('INSERT INTO medx_store (id, version, data) VALUES');
    if (write && db.writesDown) throw new Error('fetch failed: socket hang up');
    if (write && db.writeDelayMs) await new Promise(r => setTimeout(r, db.writeDelayMs));
    if (text.startsWith('CREATE TABLE IF NOT EXISTS medx_store (id text PRIMARY KEY, version bigint NOT NULL, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())')) return [];
    if (text === 'SELECT version FROM medx_store WHERE id = ?') { const r = rows.get(String(values[0])); return r ? [{ version: String(r.version) }] : []; }
    if (text === 'SELECT version, data FROM medx_store WHERE id = ?') { const r = rows.get(String(values[0])); return r ? [{ version: String(r.version), data: JSON.parse(r.data) }] : []; }
    if (text === 'INSERT INTO medx_store (id, version, data) VALUES (?, 1, ?::jsonb) ON CONFLICT (id) DO NOTHING RETURNING version') {
      db.writes++;
      const [id, json] = values as [string, string];
      if (db.hostile && !rows.has(id)) rows.set(id, { version: 1, data: JSON.stringify({ sessions: [], audit: [] }), updatedAt: Date.now() });
      if (rows.has(id)) return [];
      rows.set(id, { version: 1, data: json, updatedAt: Date.now() }); return [{ version: '1' }];
    }
    if (text === 'UPDATE medx_store SET version = version + 1, data = ?::jsonb, updated_at = now() WHERE id = ? AND version = ? RETURNING version') {
      db.writes++;
      const [json, id, expected] = values as [string, string, number];
      const r = rows.get(id); if (!r) return [];
      if (db.hostile) r.version++;
      if (r.version !== Number(expected)) return [];
      r.version++; r.data = json; r.updatedAt = Date.now(); return [{ version: String(r.version) }];
    }
    if (text.startsWith('INSERT INTO medx_store (id, version, data, updated_at) VALUES (?, 1, ?::jsonb, now()) ON CONFLICT (id) DO UPDATE SET version = medx_store.version + 1, data = EXCLUDED.data, updated_at = now() WHERE medx_store.updated_at < now() - (?::int * interval \'1 second\') RETURNING version')) {
      const [id, owner, ttl] = values as [string, string, number]; const r = rows.get(id);
      if (r && Date.now() - r.updatedAt < Number(ttl) * 1000) return [];
      rows.set(id, { version: (r?.version ?? 0) + 1, data: owner, updatedAt: Date.now() }); return [{ version: String(rows.get(id)!.version) }];
    }
    if (text === "DELETE FROM medx_store WHERE id = ? AND data->>'owner' = ?") {
      const [id, owner] = values as [string, string]; const r = rows.get(id);
      if (r && JSON.parse(r.data).owner === owner) rows.delete(id);
      return [];
    }
    throw new Error(`fake neon: unexpected SQL: ${text}`);
  };
  db.backend = postgresBackend(sql);
  return db;
}

/** Fake Upstash REST endpoint: implements GET, SET (NX, PX), INCR, EXPIRE, EVAL (our three scripts) and DEL. */
function fakeUpstash(): FakeDb & { client: RedisClient; calls: string[][]; kv: Map<string, { value: string; expiresAt?: number }> } {
  const kv = new Map<string, { value: string; expiresAt?: number }>();
  const calls: string[][] = [];
  const get = (k: string) => { const e = kv.get(k); if (!e) return null; if (e.expiresAt !== undefined && e.expiresAt <= Date.now()) { kv.delete(k); return null; } return e.value; };
  const db = {
    writes: 0, hostile: false, down: false, writesDown: false, writeDelayMs: 0, calls, kv,
    snapshot: () => { const d = get(`${SNAP}:data`); return d ? JSON.parse(d) as Snapshot : null; },
    corrupt: () => { kv.set(`${SNAP}:data`, { value: JSON.stringify({ unexpected: true }) }); kv.set(`${SNAP}:v`, { value: String(Number(get(`${SNAP}:v`) || 0) + 1) }); },
  } as FakeDb & { client: RedisClient; calls: string[][]; kv: typeof kv };
  const fetchFn = async (url: string, init: RequestInit) => {
    await tick();
    if (db.down) throw new TypeError('fetch failed');
    expect(url).toBe('https://fake.upstash.io');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    const args = JSON.parse(String(init.body)) as string[]; calls.push(args);
    const [cmd, ...rest] = args; let result: unknown = null;
    switch (cmd) {
      case 'GET': result = get(rest[0]); break;
      case 'SET': {
        const [k, v, ...opts] = rest; const px = opts.includes('PX') ? Number(opts[opts.indexOf('PX') + 1]) : undefined;
        if (opts.includes('NX') && get(k) !== null) result = null;
        else { kv.set(k, { value: v, expiresAt: px === undefined ? undefined : Date.now() + px }); result = 'OK'; }
        break;
      }
      case 'INCR': { const n = Number(get(rest[0]) ?? '0') + 1; kv.set(rest[0], { value: String(n), expiresAt: kv.get(rest[0])?.expiresAt }); result = n; break; }
      case 'EXPIRE': { const e = kv.get(rest[0]); if (e) e.expiresAt = Date.now() + Number(rest[1]) * 1000; result = e ? 1 : 0; break; }
      case 'DEL': result = kv.delete(rest[0]) ? 1 : 0; break;
      case 'EVAL': {
        const [script, n, ...more] = rest; const keys = more.slice(0, Number(n)), argv = more.slice(Number(n));
        if (script === REDIS_READ) result = [get(keys[0]) ?? '0', get(keys[1]) ?? ''];
        else if (script === REDIS_CAS) {
          db.writes++;
          if (db.writesDown) throw new TypeError('fetch failed');
          if (db.writeDelayMs) {
            // Latency before the script runs; the script itself stays atomic.
            await new Promise(r => setTimeout(r, db.writeDelayMs));
            if (db.down) throw new TypeError('fetch failed');
          }
          if (db.hostile) kv.set(keys[0], { value: String(Number(get(keys[0]) ?? '0') + 1) });
          if ((get(keys[0]) ?? '0') !== argv[0]) result = 0;
          else { kv.set(keys[1], { value: argv[1] }); kv.set(keys[0], { value: String(Number(argv[0]) + 1) }); result = 1; }
        } else if (script === REDIS_RELEASE) result = get(keys[0]) === argv[0] ? (kv.delete(keys[0]) ? 1 : 0) : 0;
        else return new Response(JSON.stringify({ error: 'NOSCRIPT' }), { status: 400 });
        break;
      }
      default: return new Response(JSON.stringify({ error: `ERR unknown command '${cmd}'` }), { status: 400 });
    }
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  db.client = upstashClient('https://fake.upstash.io/', 'test-token', fetchFn);
  db.backend = redisBackend(db.client);
  return db;
}

const g = globalThis as typeof globalThis & { medxStore?: unknown };
const defaults = { ...storeTuning };
let dir: string;
const post = (body: unknown = { patientLang: 'en' }, url = 'http://localhost/api/sessions', ip = '203.0.113.7') =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const turn = (text: string): Turn => ({ id: crypto.randomUUID(), role: 'patient', lang: 'en', text, at: new Date().toISOString() });
async function until(cond: () => boolean) { for (let i = 0; i < 400 && !cond(); i++) await new Promise(r => setTimeout(r, 5)); if (!cond()) throw new Error('timed out'); }

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'medx-remote-'));
  vi.stubEnv('MEDX_STORE_PATH', path.join(dir, 'store.json')); vi.stubEnv('MODEL_PROVIDER', 'mock'); vi.stubEnv('MEDX_STORE_NS', 'test');
  Object.assign(storeTuning, { backoffMs: 1, leasePollMs: 5 });
  delete g.medxStore;
});
afterEach(() => {
  setStoreBackend(null); delete g.medxStore; Object.assign(storeTuning, defaults);
  setRateLimitRedis(undefined); resetRateLimit();
  vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true });
});

describe.each([['postgres (fake Neon driver)', fakeNeon], ['redis (fake Upstash fetch)', fakeUpstash]] as const)('shared store: %s', (_name, make) => {
  let db: FakeDb;
  beforeEach(() => { db = make(); setStoreBackend(db.backend); });

  it('(a) two instances (globalThis.medxStore reset between them) create sessions at the same time; both exist after syncStore()', async () => {
    delete g.medxStore; await syncStore(); const A = g.medxStore;
    delete g.medxStore; await syncStore(); const B = g.medxStore;
    g.medxStore = A; const a = createSession('en');
    g.medxStore = B; const b = createSession('th');
    expect([a.code, b.code]).toEqual(['B-001', 'B-001']);
    g.medxStore = A; await flushStore();
    g.medxStore = B; await flushStore();
    for (const instance of [A, B]) {
      g.medxStore = instance; await syncStore();
      expect(getSessions().map(s => s.id).sort()).toEqual([a.id, b.id].sort());
    }
    // (d) The merge reassigned the code of the session that landed second.
    expect(getSessions().map(s => s.code).sort()).toEqual(['B-001', 'B-002']);
    expect(getSession(a.id)!.code).toBe('B-001');
    expect(getSession(b.id)!.code).toBe('B-002');
    expect(db.snapshot()!.sessions).toHaveLength(2);
  });

  it('(a)+(d) concurrent POST /api/sessions on two instances: both stored, codes unique, responses carry the final code', async () => {
    const A = newStoreInstance(), B = newStoreInstance(), C = newStoreInstance();
    const [ra, rb] = await Promise.all([A.run(() => postSession(post())), B.run(() => postSession(post({ patientLang: 'th' })))]);
    expect([ra.status, rb.status]).toEqual([201, 201]);
    const [sa, sb] = await Promise.all([ra.json(), rb.json()]) as IntakeSession[];
    expect([sa.code, sb.code].sort()).toEqual(['B-001', 'B-002']);
    await C.run(async () => {
      await syncStore();
      expect(getSessions()).toHaveLength(2);
      expect(getSession(sa.id)!.code).toBe(sa.code);
      expect(getSession(sb.id)!.code).toBe(sb.code);
    });
  });

  it('(b) concurrent patient turns on one session from two instances are serialised; no turn is lost', async () => {
    const A = newStoreInstance(), B = newStoreInstance(), C = newStoreInstance();
    const s = await A.run(async () => (await (await postSession(post())).json()) as IntakeSession);
    const texts = ['My head has hurt since this morning', 'I have no allergies and take no medicines'];
    db.writeDelayMs = 25;
    const [r1, r2] = await Promise.all([
      A.run(() => postTurn(post({ text: texts[0] }, `http://localhost/api/sessions/${s.id}/turns`), ctx(s.id))),
      B.run(() => postTurn(post({ text: texts[1] }, `http://localhost/api/sessions/${s.id}/turns`), ctx(s.id))),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    const final = await C.run(async () => { await syncStore(); return getSession(s.id)!; });
    expect(final.turns.filter(t => t.role === 'patient').map(t => t.text).sort()).toEqual([...texts].sort());
  });

  it('(b) withSessionLock replays a write when another instance changed the session first', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    const s = await A.run(async () => { const s = createSession('en'); await flushStore(); return s; });
    let runsA = 0, reachedA = false; let release!: () => void; const gate = new Promise<void>(r => (release = r));
    const pa = A.run(() => withSessionLock(s.id, async () => {
      runsA++; const cur = getSession(s.id)!; reachedA = true; await gate;
      cur.turns.push(turn('from A')); saveSession(cur); return cur.turns.map(t => t.text);
    }));
    await until(() => reachedA);
    await B.run(() => withSessionLock(s.id, () => { const cur = getSession(s.id)!; cur.turns.push(turn('from B')); saveSession(cur); }));
    release();
    expect(await pa).toEqual(['from B', 'from A']);
    expect(runsA).toBe(2);
    expect(db.snapshot()!.sessions[0].turns.map(t => t.text)).toEqual(['from B', 'from A']);
  });

  it('(b) within one instance, locked writes on a session never overlap', async () => {
    const A = newStoreInstance();
    await A.run(async () => {
      const s = createSession('en'); await flushStore();
      const log: string[] = [];
      const write = (name: string, ms: number) => withSessionLock(s.id, async () => {
        log.push(`${name}:in`); const cur = getSession(s.id)!; await new Promise(r => setTimeout(r, ms));
        cur.turns.push(turn(name)); saveSession(cur); log.push(`${name}:out`);
      });
      await Promise.all([write('one', 15), write('two', 1)]);
      expect(log).toEqual(['one:in', 'one:out', 'two:in', 'two:out']);
      expect(getSession(s.id)!.turns.map(t => t.text)).toEqual(['one', 'two']);
    });
  });

  it('(c) audit events written by both instances are all kept, as a union by event id', async () => {
    const A = newStoreInstance(), B = newStoreInstance(), C = newStoreInstance();
    const s = await A.run(async () => { const s = createSession('en'); await flushStore(); return s; });
    const write = (who: string) => async () => {
      await syncStore();
      const events = [appendAudit(s.id, 'review', 'clinician', { who, n: 1 }, who), appendAudit(s.id, 'red_flag_review', 'clinician', { who, n: 2 }, who)];
      await flushStore(); return events;
    };
    const [ea, eb] = await Promise.all([A.run(write('Dr. A')), B.run(write('Dr. B'))]);
    const ids = db.snapshot()!.audit.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of [...ea, ...eb]) expect(ids).toContain(e.id);
    expect(ids).toHaveLength(5); // session_created + 2 + 2
    await C.run(async () => { await syncStore(); expect(getAudit(s.id)).toHaveLength(5); });
  });

  it('(d) a lock key that is not a session (demo-start cap) still serialises across instances', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    const claim = () => withSessionLock('cap-test', () => {
      if (getAudit().some(e => e.payload.capClaim)) return false;
      const s = createSession('en'); appendAudit(s.id, 'review', 'system', { capClaim: true }); return true;
    });
    const results = await Promise.all([A.run(claim), B.run(claim)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(db.snapshot()!.sessions).toHaveLength(1);
    expect(db.snapshot()!.audit.filter(e => e.payload.capClaim)).toHaveLength(1);
  });

  it('(e) resetDemoStore clears the remote snapshot', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    await A.run(async () => { createSession('en'); createSession('it'); await flushStore(); });
    expect(db.snapshot()!.sessions).toHaveLength(2);
    await A.run(async () => { resetDemoStore(); await flushStore(); });
    expect(db.snapshot()).toMatchObject({ sessions: [], audit: [], consults: [], clientTurnIds: [] });
    await B.run(async () => { await syncStore(); expect(getSessions()).toEqual([]); expect(getAudit()).toEqual([]); });
  });

  it('(e) a demo reset replaces every shared session with the synthetic seed', async () => {
    vi.stubEnv('DEMO_SEED', '1');
    const A = newStoreInstance(), B = newStoreInstance();
    const visitor = await A.run(async () => { const s = createSession('en'); await flushStore(); return s; });
    const result = await B.run(() => seedDemo({ reset: true }));
    const shared = db.snapshot()!;
    expect(shared.sessions.map(s => s.id)).not.toContain(visitor.id);
    expect(shared.sessions).toHaveLength(result.sessions.length);
    expect(shared.audit.some(e => e.sessionId === visitor.id)).toBe(false);
  });

  it('(f) when the CAS conflict cannot be resolved after 5 retries, the request returns 503 "Store busy, retry"', async () => {
    db.hostile = true;
    const res = await newStoreInstance().run(() => postSession(post()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Store busy, retry', code: 'internal' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(db.writes).toBe(6); // the first attempt plus 5 retries
    db.hostile = false;
    await newStoreInstance().run(async () => { await syncStore(); expect(getSessions()).toEqual([]); });
  });

  it('(f) a session that keeps changing on another instance gives up after 5 replays (StoreBusyError, never a blind overwrite)', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    const s = await A.run(async () => { const s = createSession('en'); await flushStore(); return s; });
    let runs = 0;
    const attempt = A.run(() => withSessionLock(s.id, async () => {
      runs++; const cur = getSession(s.id)!;
      await B.run(() => withSessionLock(s.id, () => { const other = getSession(s.id)!; other.turns.push(turn(`B${runs}`)); saveSession(other); }));
      cur.turns.push(turn('A')); saveSession(cur);
    }));
    await expect(attempt).rejects.toBeInstanceOf(StoreBusyError);
    expect(runs).toBe(6);
    expect(db.snapshot()!.sessions[0].turns.map(t => t.text)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
  });

  it('handle() syncs before the route function and flushes after it', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    await A.run(() => syncStore());
    const s = await B.run(async () => { const s = createSession('en'); await flushStore(); return s; });
    // A synced before B wrote; handle() must read the newer snapshot first.
    const got = await A.run(() => getSessionRoute(new Request(`http://localhost/api/sessions/${s.id}`), ctx(s.id)));
    expect(got.status).toBe(200);
    // A POST is in the shared row by the time its response exists.
    const res = await A.run(() => postSession(post()));
    const created = await res.json() as IntakeSession;
    expect(db.snapshot()!.sessions.map(x => x.id)).toContain(created.id);
  });

  it('a request that writes a session after a nested lock committed it is not a false conflict', async () => {
    const res = await newStoreInstance().run(() => handle(async () => {
      const s = await withSessionLock('demo-start-test', () => createSession('en'));
      saveSession({ ...getSession(s.id)!, status: 'needs_human' });
      return s;
    }, 201, post()));
    expect(res.status).toBe(201);
    const { id } = await res.json() as IntakeSession;
    expect(db.snapshot()!.sessions.find(x => x.id === id)!.status).toBe('needs_human');
  });

  it('a write made after its request already answered (work scheduled with after()) still lands', async () => {
    let late!: Promise<IntakeSession>;
    const res = await newStoreInstance().run(() => handle(async () => {
      late = (async () => { await new Promise(r => setTimeout(r, 30)); return createSession('en'); })();
      return { ok: true };
    }, 200, post()));
    expect(res.status).toBe(200);
    const s = await late;
    await until(() => Boolean(db.snapshot()?.sessions.some(x => x.id === s.id)));
  });

  it('fails safe when the database errors: 503 for reads and writes, nothing reported as saved', async () => {
    db.down = true;
    const A = newStoreInstance();
    const write = await A.run(() => postSession(post()));
    expect(write.status).toBe(503);
    expect((await write.json()).error).toMatch(/Shared store unavailable; this change may not have been saved/);
    const read = await A.run(() => listSessions(new Request('http://localhost/api/sessions')));
    expect(read.status).toBe(503);
    db.down = false;
    expect(db.snapshot()).toBeNull();
    expect((await A.run(() => postSession(post()))).status).toBe(201);
  });

  it('a write that cannot land answers 503 and is not kept in memory either', async () => {
    const A = newStoreInstance(), B = newStoreInstance();
    const s = await A.run(async () => (await (await postSession(post())).json()) as IntakeSession);
    db.writesDown = true;
    const res = await A.run(() => postTurn(post({ text: 'My chest hurts' }, `http://localhost/api/sessions/${s.id}/turns`), ctx(s.id)));
    expect(res.status).toBe(503);
    db.writesDown = false;
    for (const instance of [A, B]) await instance.run(async () => { await syncStore(); expect(getSession(s.id)!.turns).toEqual([]); });
  });

  it('a corrupt shared snapshot fails closed (503), never overwritten', async () => {
    await newStoreInstance().run(async () => { createSession('en'); await flushStore(); });
    db.corrupt();
    const res = await newStoreInstance().run(() => listSessions(new Request('http://localhost/api/sessions')));
    expect(res.status).toBe(503);
    expect(db.snapshot()).toEqual({ unexpected: true });
  });

  it('seeded-once guard: two cold instances auto-seeding at once create the demo cases once', async () => {
    vi.stubEnv('DEMO_SEED', '1'); vi.stubEnv('DEMO_AUTOSEED', '1');
    const A = newStoreInstance(), B = newStoreInstance();
    const [la, lb] = await Promise.all([
      A.run(() => listSessions(new Request('http://localhost/api/sessions'))),
      B.run(() => listSessions(new Request('http://localhost/api/sessions'))),
    ]);
    expect([la.status, lb.status]).toEqual([200, 200]);
    const [qa, qb] = await Promise.all([la.json(), lb.json()]) as IntakeSession[][];
    expect(qa.length).toBeGreaterThan(0);
    expect(qb.map(s => s.id).sort()).toEqual(qa.map(s => s.id).sort());
    const shared = db.snapshot()!;
    const created = shared.audit.filter(e => e.type === 'session_created');
    expect(new Set(created.map(e => e.payload.demoCaseId)).size).toBe(created.length);
    expect(new Set(shared.sessions.map(s => s.id)).size).toBe(shared.sessions.length);
    expect(new Set(shared.sessions.map(s => s.code)).size).toBe(shared.sessions.length);
  });

  it('seed lease: one owner at a time, stale leases expire, and a seed waits for the holder', async () => {
    vi.stubEnv('DEMO_SEED', '1');
    const key = storeKey('seed-lease');
    expect(await db.backend.acquireLease(key, 'other-instance', 60_000)).toBe(true);
    expect(await db.backend.acquireLease(key, 'me', 60_000)).toBe(false);
    await db.backend.releaseLease(key, 'me'); // not the owner: no effect
    expect(await db.backend.acquireLease(key, 'me', 60_000)).toBe(false);
    let done = false;
    const seeding = newStoreInstance().run(() => seedDemo()).then(r => { done = true; return r; });
    await new Promise(r => setTimeout(r, 80));
    expect(done).toBe(false);
    expect(db.snapshot()).toBeNull(); // nothing is seeded while another instance holds the lease
    await db.backend.releaseLease(key, 'other-instance');
    const first = await seeding;
    expect(first.created).toBe(first.sessions.length);
    const again = await newStoreInstance().run(() => seedDemo());
    expect(again.created).toBe(0);
    expect(db.snapshot()!.sessions).toHaveLength(first.sessions.length);
    // A lease left by a crashed instance expires after its TTL.
    expect(await db.backend.acquireLease(`${key}-crash`, 'crashed', 1)).toBe(true);
    await new Promise(r => setTimeout(r, 1100));
    expect(await db.backend.acquireLease(`${key}-crash`, 'me', 1)).toBe(true);
  });

  it('rewriting identical content does not touch the shared row (polling reads stay reads)', async () => {
    await newStoreInstance().run(async () => {
      const s = createSession('en'); saveConsultRecord(s.id, getConsultRecord(s.id)); await flushStore();
      const before = db.writes;
      await withSessionLock(s.id, () => { saveSession(getSession(s.id)!); saveConsultRecord(s.id, getConsultRecord(s.id)); });
      await flushStore();
      expect(db.writes).toBe(before);
    });
  });

  it('(C-01) above 2 MB the flush prunes non-demo sessions older than 24 h and keeps every audit event', async () => {
    const old = new Date(Date.now() - 3 * 24 * 3600e3).toISOString();
    await newStoreInstance().run(async () => {
      const big = (s: IntakeSession) => ({ ...s, createdAt: old, updatedAt: old, turns: [{ ...turn('x'.repeat(90_000)), at: old }] });
      const stale = Array.from({ length: 25 }, () => { const s = big(createSession('en')); saveSession(s); return s; });
      const demo = big(createSession('en', { demoCaseId: 'EN-01' })); saveSession(demo);
      await flushStore();
      // Everything written in a commit is kept, even when the commit crosses the cap.
      expect(JSON.stringify(db.snapshot()).length).toBeGreaterThan(MAX_SNAPSHOT_BYTES);
      const auditBefore = db.snapshot()!.audit.length;
      const recent = createSession('it');
      await flushStore();
      const shared = db.snapshot()!;
      const ids = shared.sessions.map(s => s.id);
      expect(ids).toContain(demo.id);
      expect(ids).toContain(recent.id);
      for (const s of stale) expect(ids).not.toContain(s.id);
      expect(shared.audit.length).toBeGreaterThanOrEqual(auditBefore + 1);
      for (const s of stale) expect(shared.audit.some(e => e.sessionId === s.id && e.type === 'session_created')).toBe(true);
      expect(JSON.stringify(shared).length).toBeLessThan(MAX_SNAPSHOT_BYTES);
    });
  });

  it('(w20) still over 2 MB: idle per-visitor demo cases are pruned oldest first; seeded and recent ones stay', async () => {
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60e3).toISOString();
    await newStoreInstance().run(async () => {
      const big = (s: IntakeSession, when: string) => ({ ...s, createdAt: when, updatedAt: when, turns: [{ ...turn('x'.repeat(90_000)), at: when }] });
      // 30 visitor cases idle 2 to 3 hours (oldest first in creation order is not assumed), all within the daily reset.
      const idle = Array.from({ length: 30 }, (_, i) => { const s = big(createSession('en', { demoStart: 'intake' }), at(120 + ((i * 7) % 30))); saveSession(s); return s; });
      const fresh = big(createSession('en', { demoStart: 'pharmacy_verify' }), at(10)); saveSession(fresh);
      const seeded = big(createSession('en', { demoCaseId: 'EN-01' }), at(600)); saveSession(seeded);
      await flushStore();
      expect(JSON.stringify(db.snapshot()).length).toBeGreaterThan(MAX_SNAPSHOT_BYTES); // a commit keeps what it wrote
      const auditBefore = db.snapshot()!.audit.length;
      createSession('it'); await flushStore();
      const shared = db.snapshot()!;
      const ids = new Set(shared.sessions.map(s => s.id));
      expect(ids.has(fresh.id)).toBe(true);
      expect(ids.has(seeded.id)).toBe(true);
      const kept = idle.filter(s => ids.has(s.id)), dropped = idle.filter(s => !ids.has(s.id));
      expect(dropped.length).toBeGreaterThan(0); expect(kept.length).toBeGreaterThan(0); // only as many as needed
      const oldestKept = Math.min(...kept.map(s => Date.parse(s.updatedAt)));
      for (const s of dropped) expect(Date.parse(s.updatedAt)).toBeLessThanOrEqual(oldestKept);
      expect(new Blob([JSON.stringify(shared)]).size).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
      expect(shared.audit.length).toBeGreaterThanOrEqual(auditBefore + 1);
      for (const s of dropped) expect(shared.audit.some(e => e.sessionId === s.id && e.type === 'session_created')).toBe(true);
    });
  });

  it('(w20) a per-visitor demo case active in the last 90 minutes is never pruned for size', async () => {
    await newStoreInstance().run(async () => {
      const when = new Date(Date.now() - 30 * 60e3).toISOString();
      const recent = Array.from({ length: 25 }, () => { const s = { ...createSession('en', { demoStart: 'intake' }), createdAt: when, updatedAt: when, turns: [{ ...turn('x'.repeat(90_000)), at: when }] }; saveSession(s); return s; });
      await flushStore(); createSession('it'); await flushStore();
      const ids = new Set(db.snapshot()!.sessions.map(s => s.id));
      for (const s of recent) expect(ids.has(s.id)).toBe(true);
    });
  });

  it('GET /api/health reports the store kind, version and a session count, with no patient data', async () => {
    vi.stubEnv('MEDX_COMMIT', '38e3382aa1b2c3'); vi.stubEnv('VERCEL_REGION', 'sin1');
    const A = newStoreInstance();
    await A.run(async () => { createSession('en'); await flushStore(); });
    const body = await (await A.run(() => health(new Request('http://localhost/api/health')))).json();
    expect(body).toMatchObject({ status: 'ok', provider: 'mock', store: db.backend.kind, storeOk: true, sessions: 1, commit: '38e3382', region: 'sin1' });
    expect(body.storeVersion).toBeGreaterThan(0);
    expect(Object.keys(body).sort()).toEqual(['commit', 'hardware', 'model', 'provider', 'providerConfigured', 'region', 'sessions', 'status', 'store', 'storeOk', 'storeVersion']);
    db.down = true;
    const degraded = await (await newStoreInstance().run(() => health(new Request('http://localhost/api/health')))).json();
    expect(degraded).toMatchObject({ status: 'degraded', store: db.backend.kind, storeOk: false, storeVersion: null, sessions: null });
  });

  it('keys are namespaced by MEDX_STORE_NS', async () => {
    await newStoreInstance().run(async () => { createSession('en'); await flushStore(); });
    expect(db.snapshot()).not.toBeNull();
    vi.stubEnv('MEDX_STORE_NS', 'other');
    await newStoreInstance().run(async () => { await syncStore(); expect(getSessions()).toEqual([]); });
  });
});

describe('store selection and file fallback', () => {
  it('uses the file store under vitest even when shared-store variables are set', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@ep-test.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
    vi.stubEnv('KV_REST_API_URL', 'https://fake.upstash.io'); vi.stubEnv('KV_REST_API_TOKEN', 't');
    expect(selectedStoreMode()).toBe('file');
    expect(backendFromEnv()).toBeNull();
  });

  it('auto-detects Neon, then Upstash, else the file store; MEDX_STORE overrides', () => {
    vi.stubEnv('VITEST', '');
    for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'MEDX_STORE']) vi.stubEnv(k, '');
    expect(selectedStoreMode()).toBe('file');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io'); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 't');
    expect(selectedStoreMode()).toBe('redis');
    vi.stubEnv('POSTGRES_URL', 'postgresql://u:p@ep-test.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
    expect(selectedStoreMode()).toBe('postgres');
    expect(backendFromEnv()?.backend.kind).toBe('postgres');
    vi.stubEnv('MEDX_STORE', 'file');
    expect(selectedStoreMode()).toBe('file');
    expect(backendFromEnv()).toBeNull();
    vi.stubEnv('MEDX_STORE', 'postgress');
    expect(selectedStoreMode()).toBe('invalid');
  });

  it('an explicit shared store without its URL fails safe instead of silently using /tmp', async () => {
    vi.stubEnv('VITEST', '');
    for (const k of ['DATABASE_URL', 'POSTGRES_URL']) vi.stubEnv(k, '');
    vi.stubEnv('MEDX_STORE', 'postgres');
    const configured = backendFromEnv();
    expect(configured?.backend.kind).toBe('postgres');
    await expect(configured!.backend.head('k')).rejects.toThrow(/DATABASE_URL/);
  });

  it('on Vercel without MEDX_STORE_PATH the file store lives in os.tmpdir()/medx/store.json, not /var/task', () => {
    vi.stubEnv('MEDX_STORE_PATH', ''); vi.stubEnv('VERCEL', '1');
    expect(storeFilePath()).toBe(path.join(os.tmpdir(), 'medx', 'store.json'));
    vi.stubEnv('MEDX_STORE_PATH', '/data/medx.json');
    expect(storeFilePath()).toBe('/data/medx.json');
  });

  it('namespace falls back from MEDX_STORE_NS to VERCEL_ENV, then "local"', () => {
    vi.stubEnv('MEDX_STORE_NS', 'demo-a'); vi.stubEnv('VERCEL_ENV', 'production');
    expect(storeKey('snapshot')).toBe('medx:demo-a:snapshot');
    vi.stubEnv('MEDX_STORE_NS', '');
    expect(storeKey('snapshot')).toBe('medx:production:snapshot');
    vi.stubEnv('VERCEL_ENV', '');
    expect(storeKey('snapshot')).toBe('medx:local:snapshot');
  });

  it('file mode: handle() keeps working without any shared store, and health says where data lives', async () => {
    const res = await handle(() => createSession('en'), 201, post());
    expect(res.status).toBe(201);
    const body = await (await health(new Request('http://localhost/api/health'))).json();
    expect(body).toMatchObject({ store: 'tmp-ephemeral', storeOk: true, sessions: 1 });
    vi.stubEnv('MEDX_STORE_PATH', path.join(process.cwd(), '.data', `w20-absent-${Date.now()}.json`));
    expect((await (await health(new Request('http://localhost/api/health'))).json()).store).toBe('file');
  });

  it('patches reassigned B-0xx codes into nested route results', () => {
    const value = { sessions: [{ id: 'x', code: 'B-001', turns: [] }, { id: 'y', code: 'B-002' }], session: { id: 'x', code: 'B-001' } };
    expect(applyReassignedCodes(value, new Map([['x', 'B-003']]))).toEqual({ sessions: [{ id: 'x', code: 'B-003', turns: [] }, { id: 'y', code: 'B-002' }], session: { id: 'x', code: 'B-003' } });
    expect(applyReassignedCodes(value, new Map())).toBe(value);
  });
});

describe('per-IP rate limit on POST (C-01)', () => {
  const minute = 29_000_000;
  beforeEach(() => { vi.stubEnv('MEDX_RATE_LIMIT_PER_MIN', '30'); vi.spyOn(Date, 'now').mockReturnValue(minute * 60_000 + 1_000); });
  const ok = () => handle(() => ({ ok: true }), 200, post({}, 'http://localhost/api/x', '198.51.100.1'));

  it('with Redis: INCR medx:{ns}:rl:{ip}:{minute} with EXPIRE 60; the 31st POST is 429 and other IPs are unaffected', async () => {
    const redis = fakeUpstash(); setRateLimitRedis(redis.client);
    for (let i = 0; i < 30; i++) expect((await ok()).status).toBe(200);
    const limited = await ok();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'Too many requests from this network; retry in a minute', code: 'bad_request' });
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await handle(() => ({ ok: true }), 200, post({}, 'http://localhost/api/x', '198.51.100.2'))).status).toBe(200);
    const key = `medx:test:rl:198.51.100.1:${minute}`;
    expect(redis.calls.filter(c => c[0] === 'INCR' && c[1] === key)).toHaveLength(31);
    expect(redis.calls.filter(c => c[0] === 'EXPIRE')).toEqual([['EXPIRE', key, '60'], ['EXPIRE', `medx:test:rl:198.51.100.2:${minute}`, '60']]);
    // GETs are never limited.
    expect((await handle(() => ({ ok: true }), 200, new Request('http://localhost/api/x', { headers: { 'x-forwarded-for': '198.51.100.1' } }))).status).toBe(200);
  });

  it('without Redis it counts in memory per instance, and a Redis outage falls back to memory', async () => {
    setRateLimitRedis(null);
    for (let i = 0; i < 30; i++) expect((await ok()).status).toBe(200);
    expect((await ok()).status).toBe(429);
    resetRateLimit();
    const broken = fakeUpstash(); broken.down = true; setRateLimitRedis(broken.client);
    for (let i = 0; i < 30; i++) expect((await ok()).status).toBe(200);
    expect((await ok()).status).toBe(429);
  });

  it('is off under vitest unless configured, and reads the first x-forwarded-for hop', async () => {
    vi.stubEnv('MEDX_RATE_LIMIT_PER_MIN', '');
    expect((await checkRateLimit(post())).limited).toBe(false);
    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }))).toBe('203.0.113.9');
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '2001:db8::1' } }))).toBe('2001:db8::1');
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
