interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Purge expired entries every 5 minutes to avoid memory leaks
const interval = setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) store.delete(key);
  });
}, 5 * 60 * 1000);

// Allow Node.js to exit even if the interval is still running
if (interval.unref) interval.unref();

/**
 * Token-bucket rate limiter backed by an in-memory Map.
 * Suitable for single-instance deployments (single Node.js process).
 *
 * @param key      Unique key for the counter (e.g. "ip:192.168.1.1:tickets")
 * @param limit    Maximum number of requests allowed within the window
 * @param windowMs Duration of the window in milliseconds
 * @returns true if the request is allowed, false if it should be blocked (429)
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}
