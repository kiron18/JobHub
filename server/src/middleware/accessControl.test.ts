import { describe, it, expect, vi } from 'vitest';

// Mock the stripe import before importing the module under test.
// EXEMPT_EMAILS is a const array, so we provide the real value.
vi.mock('../routes/stripe', () => ({
  EXEMPT_EMAILS: ['kiron@example.com'],
}));

import { hasActiveAccess } from './accessControl';

describe('hasActiveAccess', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('true for an active trial (free plan, trialEndDate in the future)', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: future, dashboardAccess: false, accessExpiresAt: null })).toBe(true);
  });
  it('false for an expired trial (free plan, trialEndDate in the past)', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: past, dashboardAccess: false, accessExpiresAt: null })).toBe(false);
  });
  it('true for a paid active plan', () => {
    expect(hasActiveAccess({ plan: 'monthly', planStatus: 'active', trialEndDate: null, dashboardAccess: false, accessExpiresAt: null })).toBe(true);
  });
  it('true when dashboardAccess granted', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: null, dashboardAccess: true, accessExpiresAt: null })).toBe(true);
  });
  it('false for a plain free user with no trial', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: null, dashboardAccess: false, accessExpiresAt: null })).toBe(false);
  });
});
