import { describe, it, expect, vi } from 'vitest';

// Mock the stripe import before importing the module under test.
// EXEMPT_EMAILS is a const array, so we provide the real value.
vi.mock('../routes/stripe', () => ({
  EXEMPT_EMAILS: ['kiron@example.com'],
}));

import { hasActiveAccess, isOnBillingHold, denyPayload } from './accessControl';

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

describe('isOnBillingHold', () => {
  const held = new Date('2026-08-22T00:00:00Z');

  it('false when no hold is set', () => {
    expect(isOnBillingHold({ billingHoldAt: null })).toBe(false);
  });
  it('true when a hold is set', () => {
    expect(isOnBillingHold({ billingHoldAt: held })).toBe(true);
  });
  it('never holds an exempt account', () => {
    expect(isOnBillingHold({ billingHoldAt: held }, 'kiron@example.com')).toBe(false);
    expect(isOnBillingHold({ billingHoldAt: held }, 'KIRON@example.com')).toBe(false);
  });
});

describe('hasActiveAccess with a billing hold', () => {
  const held = new Date('2026-08-22T00:00:00Z');

  // The whole point of the hold: it overrules the grant these clients already
  // have. If dashboardAccess still won, the hold would be decorative.
  it('a hold beats an explicit dashboardAccess grant', () => {
    expect(hasActiveAccess({ plan: 'three_month', planStatus: 'active', dashboardAccess: true, billingHoldAt: held })).toBe(false);
  });
  it('a hold beats a live paid plan', () => {
    expect(hasActiveAccess({ plan: 'monthly', planStatus: 'active', dashboardAccess: false, billingHoldAt: held })).toBe(false);
  });
  it('access returns the moment the hold is cleared', () => {
    expect(hasActiveAccess({ plan: 'three_month', planStatus: 'active', dashboardAccess: true, billingHoldAt: null })).toBe(true);
  });
});

describe('denyPayload', () => {
  it('tells a held client to pay, not to upgrade', () => {
    const body = denyPayload(
      { allowed: false, reason: 'BILLING_HOLD', payUrl: 'https://invoice.stripe.com/i/abc' },
      'Generation',
    ) as Record<string, unknown>;
    expect(body.error).toBe('BILLING_HOLD');
    expect(body.billingHold).toBe(true);
    expect(body.payUrl).toBe('https://invoice.stripe.com/i/abc');
    expect(body.upgradeRequired).toBeUndefined();
  });
  it('keeps the old upgrade wording for an ordinary cap', () => {
    const body = denyPayload({ allowed: false, upgradeRequired: true, remaining: 0 }, 'Generation') as Record<string, unknown>;
    expect(body.error).toBe('Generation limit reached');
    expect(body.upgradeRequired).toBe(true);
  });
});
