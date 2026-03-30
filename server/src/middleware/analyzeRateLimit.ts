/**
 * Per-user sliding-window rate limiter for /analyze endpoints.
 *
 * Limits: 30 requests per user per 15 minutes.
 * Stored in-memory — resets on server restart, which is acceptable since
 * these are soft cost-protection limits, not security-critical ones.
 * If we ever need persistence, swap the Map for a Redis INCR + TTL.
 */
import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 30;

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

// Clean up expired buckets every 30 minutes to avoid unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}, 30 * 60 * 1000).unref(); // .unref() so it doesn't keep the process alive

export function analyzeRateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId: string | undefined = (req as any).user?.id;

  // If auth middleware hasn't run yet (shouldn't happen on /analyze routes),
  // fall through — the authenticate middleware will reject the request.
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const entry = buckets.get(userId);

  if (!entry || now >= entry.resetAt) {
    // First request in this window
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: `Too many analysis requests. You can make ${MAX_REQUESTS} requests per 15 minutes. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
    });
    return;
  }

  entry.count += 1;
  next();
}
