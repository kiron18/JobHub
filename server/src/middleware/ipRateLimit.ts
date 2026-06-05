/**
 * Per-IP sliding-window rate limiter for the public /api/cv-scan endpoint.
 *
 * Limits: 8 requests per IP per 15 minutes.
 * Stored in-memory — resets on server restart, which is acceptable since
 * these are soft cost-protection limits, not security-critical ones.
 */
import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 8;

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

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || 'unknown';
}

export function ipRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);

  const now = Date.now();
  const entry = buckets.get(ip);

  if (!entry || now >= entry.resetAt) {
    // First request in this window
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: `Too many scan requests. You can make ${MAX_REQUESTS} requests per 15 minutes. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
    });
    return;
  }

  entry.count += 1;
  next();
}
