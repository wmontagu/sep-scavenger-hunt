/**
 * In-memory fixed-window limiter (per server instance). Only meant to blunt
 * brute-forcing short codes, so limits are generous: pledges share campus NAT IPs.
 */
const buckets = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now - v.start >= windowMs) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function resetRateLimits(): void {
  buckets.clear();
}
