import { cacheConnection } from "@/lib/cacheConnection";

type RateLimitEntry = {
  count: number;
  timestamp: number;
};

// In-memory fallback store
const memoryStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export function checkRateLimit(
  ip: string,
  limit = MAX_REQUESTS
): { ok: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry || now - entry.timestamp > WINDOW_MS) {
    memoryStore.set(ip, { count: 1, timestamp: now });
    return { ok: true, headers: { "X-RateLimit-Remaining": String(limit - 1) } };
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      headers: { "Retry-After": String(Math.ceil((entry.timestamp + WINDOW_MS - now) / 1000)) },
    };
  }

  entry.count += 1;
  memoryStore.set(ip, entry);

  return { ok: true, headers: { "X-RateLimit-Remaining": String(limit - entry.count) } };
}

/**
 * Distributed Rate Limiter with Redis support.
 * Uses Redis INCR + EXPIRE when available; falls back to in-memory store if Redis is offline.
 */
export async function checkRateLimitDistributed(
  key: string,
  limit = MAX_REQUESTS
): Promise<{ ok: boolean; headers: Record<string, string> }> {
  try {
    if (cacheConnection.status === "wait" || cacheConnection.status === "connecting") {
      await cacheConnection.connect().catch(() => {});
    }

    if (cacheConnection.status === "ready") {
      const redisKey = `ratelimit:${key}`;
      const count = await cacheConnection.incr(redisKey);
      if (count === 1) {
        await cacheConnection.expire(redisKey, 60);
      }

      const remaining = Math.max(0, limit - count);
      if (count > limit) {
        const ttl = await cacheConnection.ttl(redisKey);
        return {
          ok: false,
          headers: {
            "Retry-After": String(ttl > 0 ? ttl : 60),
            "X-RateLimit-Remaining": "0",
          },
        };
      }

      return {
        ok: true,
        headers: { "X-RateLimit-Remaining": String(remaining) },
      };
    }
  } catch {
    // Graceful fallback to memoryStore if Redis connection fails
  }

  return checkRateLimit(key, limit);
}

export function extractIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown-ip";
}
