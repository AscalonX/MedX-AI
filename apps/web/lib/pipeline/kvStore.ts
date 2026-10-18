/**
 * Remote snapshot backends for the shared store (owner decision 6, Sat 17 Oct 2026).
 *
 * - postgres (primary): Neon serverless Postgres over HTTP through the official @neondatabase/serverless
 *   driver, DATABASE_URL (or POSTGRES_URL). One table, created on first use, one whole-snapshot row per
 *   namespace with a version column for optimistic concurrency.
 * - redis (optional): Upstash REST (KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/TOKEN),
 *   same contract with a Lua compare-and-set. Also used for the shared per-IP rate limit when configured.
 *
 * Backends only ever receive the store snapshot, which holds redacted text (invariant 5 is enforced
 * upstream, before storage). They never see raw patient text, API keys or the connection string.
 */
import { neon } from '@neondatabase/serverless';

export interface RemoteRow { version: number; data: unknown }
export interface RemoteBackend {
  readonly kind: 'postgres' | 'redis';
  /** Version of a record, 0 when it does not exist. */
  head(key: string): Promise<number>;
  read(key: string): Promise<RemoteRow | null>;
  /** Compare-and-set: writes only when the stored version equals `expected` (0 = the record must not exist yet). */
  write(key: string, expected: number, json: string): Promise<boolean>;
  /** Row-level lease (the seeded-once guard). True when `owner` now holds it. Stale leases expire after ttlMs. */
  acquireLease(key: string, owner: string, ttlMs: number): Promise<boolean>;
  releaseLease(key: string, owner: string): Promise<void>;
}

export const STORE_TABLE = 'medx_store';
/** Tagged-template query function, the shape of neon() from @neondatabase/serverless. */
export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

export function postgresBackend(sql: SqlTag): RemoteBackend {
  let ready: Promise<void> | undefined;
  const ensure = () => (ready ||= (async () => {
    try {
      await sql`CREATE TABLE IF NOT EXISTS medx_store (id text PRIMARY KEY, version bigint NOT NULL, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
    } catch (error) {
      // Two cold instances racing CREATE TABLE IF NOT EXISTS can collide in the catalog; the table then exists.
      const rows = await sql`SELECT to_regclass('medx_store') AS t`;
      if (!rows[0]?.t) throw error;
    }
  })().catch(error => { ready = undefined; throw error; }));
  return {
    kind: 'postgres',
    async head(key) {
      await ensure();
      const rows = await sql`SELECT version FROM medx_store WHERE id = ${key}`;
      return rows.length ? Number(rows[0].version) : 0;
    },
    async read(key) {
      await ensure();
      const rows = await sql`SELECT version, data FROM medx_store WHERE id = ${key}`;
      if (!rows.length) return null;
      const data = rows[0].data;
      return { version: Number(rows[0].version), data: typeof data === 'string' ? JSON.parse(data) : data };
    },
    async write(key, expected, json) {
      await ensure();
      const rows = expected === 0
        ? await sql`INSERT INTO medx_store (id, version, data) VALUES (${key}, 1, ${json}::jsonb) ON CONFLICT (id) DO NOTHING RETURNING version`
        : await sql`UPDATE medx_store SET version = version + 1, data = ${json}::jsonb, updated_at = now() WHERE id = ${key} AND version = ${expected} RETURNING version`;
      return rows.length === 1;
    },
    async acquireLease(key, owner, ttlMs) {
      await ensure();
      const rows = await sql`INSERT INTO medx_store (id, version, data, updated_at) VALUES (${key}, 1, ${JSON.stringify({ owner })}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET version = medx_store.version + 1, data = EXCLUDED.data, updated_at = now()
        WHERE medx_store.updated_at < now() - (${Math.max(1, Math.ceil(ttlMs / 1000))}::int * interval '1 second')
        RETURNING version`;
      return rows.length === 1;
    },
    async releaseLease(key, owner) {
      await ensure();
      await sql`DELETE FROM medx_store WHERE id = ${key} AND data->>'owner' = ${owner}`;
    },
  };
}

export interface RedisClient { command(args: (string | number)[]): Promise<unknown> }
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
/** Minimal Upstash REST client: POST the command as a JSON array, read { result } or { error }. */
export function upstashClient(url: string, token: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): RedisClient {
  const base = url.replace(/\/+$/, '');
  return {
    async command(args) {
      const response = await fetchFn(base, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args.map(String)), cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
      // Never echo the token or the payload; the command name is enough to debug.
      if (!response.ok || body.error !== undefined) throw new Error(`Upstash ${String(args[0])} failed (${response.status})`);
      return body.result ?? null;
    },
  };
}

/** KEYS[1] = version key, KEYS[2] = data key. Returns { version, data } read atomically. */
export const REDIS_READ = "local v = redis.call('GET', KEYS[1]) local d = redis.call('GET', KEYS[2]) return {v or '0', d or ''}";
/** KEYS[1] = version key, KEYS[2] = data key, ARGV[1] = expected version, ARGV[2] = JSON. 1 = written. */
export const REDIS_CAS = "local v = redis.call('GET', KEYS[1]) or '0' if v ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2]) redis.call('SET', KEYS[1], tostring(tonumber(ARGV[1]) + 1)) return 1";
/** KEYS[1] = lease key, ARGV[1] = owner. Deletes only the caller's own lease. */
export const REDIS_RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

export function redisBackend(client: RedisClient): RemoteBackend {
  return {
    kind: 'redis',
    async head(key) { return Number(await client.command(['GET', `${key}:v`]) ?? 0) || 0; },
    async read(key) {
      const [v, d] = await client.command(['EVAL', REDIS_READ, 2, `${key}:v`, `${key}:data`]) as [string, string];
      const version = Number(v) || 0;
      return version || d ? { version, data: d ? JSON.parse(d) : null } : null;
    },
    async write(key, expected, json) { return Number(await client.command(['EVAL', REDIS_CAS, 2, `${key}:v`, `${key}:data`, expected, json])) === 1; },
    async acquireLease(key, owner, ttlMs) { return (await client.command(['SET', key, owner, 'NX', 'PX', Math.max(1, Math.ceil(ttlMs))])) === 'OK'; },
    async releaseLease(key, owner) { await client.command(['EVAL', REDIS_RELEASE, 1, key, owner]); },
  };
}

// ---- Configuration from the environment -------------------------------------------------------------

export type StoreMode = 'postgres' | 'redis' | 'file';
/** Keys are namespaced by MEDX_STORE_NS, falling back to VERCEL_ENV, so preview and production never share rows. */
export function storeNamespace() {
  return (process.env.MEDX_STORE_NS || process.env.VERCEL_ENV || 'local').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'local';
}
export function storeKey(suffix: string) { return `medx:${storeNamespace()}:${suffix}`; }
export function databaseUrl() { return process.env.DATABASE_URL || process.env.POSTGRES_URL || ''; }
export function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}
/**
 * MEDX_STORE=postgres|redis|file wins; unset means auto-detect (DATABASE_URL/POSTGRES_URL, then Upstash, else file).
 * Under vitest the file store is always used unless a test injects a backend (store.ts setStoreBackend).
 */
export function selectedStoreMode(): StoreMode | 'invalid' {
  if (process.env.VITEST) return 'file';
  const mode = (process.env.MEDX_STORE || '').trim().toLowerCase();
  if (mode === 'file' || mode === 'postgres' || mode === 'redis') return mode;
  if (mode) return 'invalid';
  if (databaseUrl()) return 'postgres';
  if (redisEnv()) return 'redis';
  return 'file';
}

/** A backend that refuses every call: an explicit-but-broken configuration fails safe (503), never falls back to /tmp. */
function misconfigured(kind: 'postgres' | 'redis', reason: string): RemoteBackend {
  const fail = async (): Promise<never> => { throw new Error(reason); };
  return { kind, head: fail, read: fail, write: fail, acquireLease: fail, releaseLease: fail };
}

type BackendCache = { config: string; value: { id: string; backend: RemoteBackend } | null };
const cache = globalThis as typeof globalThis & { medxBackendCache?: BackendCache; medxRedisCache?: { config: string; client: RedisClient | null } };

export function backendFromEnv(): { id: string; backend: RemoteBackend } | null {
  const mode = selectedStoreMode();
  const url = databaseUrl(); const redis = redisEnv();
  const config = `${mode}|${url}|${redis?.url || ''}|${redis?.token || ''}|${process.env.MEDX_STORE || ''}`;
  if (cache.medxBackendCache?.config === config) return cache.medxBackendCache.value;
  let value: BackendCache['value'] = null;
  if (mode === 'invalid') value = { id: 'invalid', backend: misconfigured('postgres', 'MEDX_STORE must be postgres, redis or file') };
  else if (mode === 'postgres') value = url ? { id: 'neon', backend: postgresBackend(neon(url) as unknown as SqlTag) } : { id: 'neon-missing', backend: misconfigured('postgres', 'MEDX_STORE=postgres but DATABASE_URL/POSTGRES_URL is not set') };
  else if (mode === 'redis') value = redis ? { id: 'upstash', backend: redisBackend(upstashClient(redis.url, redis.token)) } : { id: 'upstash-missing', backend: misconfigured('redis', 'MEDX_STORE=redis but the Upstash REST URL/token is not set') };
  cache.medxBackendCache = { config, value };
  return value;
}

/** Upstash client for the shared rate limit, whatever the snapshot store is. Null under vitest. */
export function redisClientFromEnv(): RedisClient | null {
  if (process.env.VITEST) return null;
  const redis = redisEnv(); const config = `${redis?.url || ''}|${redis?.token || ''}`;
  if (cache.medxRedisCache?.config !== config) cache.medxRedisCache = { config, client: redis ? upstashClient(redis.url, redis.token) : null };
  return cache.medxRedisCache.client;
}
