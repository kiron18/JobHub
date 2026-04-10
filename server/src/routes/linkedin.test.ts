import { describe, it, expect } from 'vitest';
import { checkHeadshotRateLimit } from './linkedin';

describe('checkHeadshotRateLimit', () => {
  it('allows generation when no prior usage', () => {
    expect(checkHeadshotRateLimit(0, null, 3)).toEqual({ allowed: true, usedToday: 0 });
  });

  it('allows generation when under limit today', () => {
    expect(checkHeadshotRateLimit(2, new Date(), 3)).toEqual({ allowed: true, usedToday: 2 });
  });

  it('blocks when limit reached today', () => {
    expect(checkHeadshotRateLimit(3, new Date(), 3)).toEqual({ allowed: false, usedToday: 3 });
  });

  it('resets counter when last generation was on a different day', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(checkHeadshotRateLimit(3, yesterday, 3)).toEqual({ allowed: true, usedToday: 0 });
  });
});
