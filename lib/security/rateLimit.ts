type RateLimitEntry = {
  count: number;
  timestamp: number;
};

// In-memory store (warning: will reset on app restart and doesn't share state between workers)
const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // Allow up to 100 requests per minute by default

export function checkRateLimit(ip: string, limit = MAX_REQUESTS): { ok: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || (now - entry.timestamp > WINDOW_MS)) {
    store.set(ip, { count: 1, timestamp: now });
    return { ok: true, headers: { 'X-RateLimit-Remaining': String(limit - 1) } };
  }

  if (entry.count >= limit) {
    return { ok: false, headers: { 'Retry-After': String(Math.ceil((entry.timestamp + WINDOW_MS - now) / 1000)) } };
  }

  entry.count += 1;
  store.set(ip, entry);
  
  return { ok: true, headers: { 'X-RateLimit-Remaining': String(limit - entry.count) } };
}

export function extractIp(req: Request): string {
  // Try to get IP from x-forwarded-for or fallback
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0] : 'unknown-ip';
}
