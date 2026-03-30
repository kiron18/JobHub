import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextFunction } from 'express';

// Re-import fresh module for each test to reset the rate limit map
describe('analyzeRateLimit middleware', () => {
  let analyzeRateLimit: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/analyzeRateLimit');
    analyzeRateLimit = mod.analyzeRateLimit;
  });

  const makeReq = (userId: string) => ({ user: { id: userId } } as any);
  const makeRes = () => {
    const res: any = {};
    res.set = vi.fn().mockReturnValue(res);
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };
  const next: NextFunction = vi.fn();

  it('allows the first request through', () => {
    const req = makeReq('user-1');
    const res = makeRes();
    analyzeRateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes requests without a user id', () => {
    const req = {} as any;
    const res = makeRes();
    analyzeRateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 429 after exceeding the limit', () => {
    const userId = 'rate-limit-test-user';
    const MAX = 30;
    // Exhaust the bucket
    for (let i = 0; i < MAX; i++) {
      const req = makeReq(userId);
      const res = makeRes();
      analyzeRateLimit(req, res, next);
    }
    // Next one should be rejected
    const req = makeReq(userId);
    const res = makeRes();
    analyzeRateLimit(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('uses separate buckets per user', () => {
    const res1 = makeRes();
    const res2 = makeRes();
    analyzeRateLimit(makeReq('user-a'), res1, next);
    analyzeRateLimit(makeReq('user-b'), res2, next);
    expect(res1.status).not.toHaveBeenCalled();
    expect(res2.status).not.toHaveBeenCalled();
  });
});
