/**
 * Per-IP rate limit for public POST routes (backlog C-01).
 *
 * Fixed one-minute windows keyed medx:{ns}:rl:{ip}:{minute}. With Upstash configured the count is shared
 * across instances (INCR, then EXPIRE 60 on the first hit); otherwise, or if Redis errors, it is counted in
 * memory per instance. In-memory per instance is an accepted limitation on Vercel (owner decision 6): several
 * warm instances each allow the full budget.
 *
 * MEDX_RATE_LIMIT_PER_MIN sets the budget (default 30; 0 disables). Under vitest it is off unless set.
 */
import { redisClientFromEnv, storeNamespace, type RedisClient } from './kvStore';

const WINDOW_MS = 60_000;
type Memory = { minute: number; hits: Map<string, number> };
const g = globalThis as typeof globalThis & { medxRateLimit?: Memory; medxRateLimitRedis?: RedisClient | null };

export function rateLimitPerMinute(): number {
  const raw = process.env.MEDX_RATE_LIMIT_PER_MIN;
  if (raw === undefined || raw.trim() === '') return process.env.VITEST ? 0 : 30;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** First x-forwarded-for hop (Vercel overwrites this header with the real client), then x-real-ip. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || '';
  return ip.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64) || 'unknown';
}

/** Test hook: inject a Redis client (or null for memory only); undefined returns to the environment. */
export function setRateLimitRedis(client: RedisClient | null | undefined) {
  if (client === undefined) delete g.medxRateLimitRedis; else g.medxRateLimitRedis = client;
}
export function resetRateLimit() { delete g.medxRateLimit; }

function memoryHit(key: string, minute: number) {
  if (!g.medxRateLimit || g.medxRateLimit.minute !== minute) g.medxRateLimit = { minute, hits: new Map() };
  const count = (g.medxRateLimit.hits.get(key) || 0) + 1;
  g.medxRateLimit.hits.set(key, count);
  return count;
}

export interface RateLimitResult { limited: boolean; count: number; limit: number; retryAfter: number; key?: string }

export async function checkRateLimit(request: Request, now = Date.now()): Promise<RateLimitResult> {
  const limit = rateLimitPerMinute();
  if (request.method !== 'POST' || limit <= 0) return { limited: false, count: 0, limit, retryAfter: 0 };
  const minute = Math.floor(now / WINDOW_MS);
  const key = `medx:${storeNamespace()}:rl:${clientIp(request)}:${minute}`;
  const retryAfter = Math.max(1, Math.ceil(((minute + 1) * WINDOW_MS - now) / 1000));
  const redis = 'medxRateLimitRedis' in g ? g.medxRateLimitRedis : redisClientFromEnv();
  let count: number | undefined;
  if (redis) {
    try {
      count = Number(await redis.command(['INCR', key]));
      if (count === 1) await redis.command(['EXPIRE', key, 60]);
      if (!Number.isFinite(count)) count = undefined;
    } catch { count = undefined; /* a limiter outage must not block clinical writes; fall back to this instance */ }
  }
  if (count === undefined) count = memoryHit(key, minute);
  return { limited: count > limit, count, limit, retryAfter, key };
}
