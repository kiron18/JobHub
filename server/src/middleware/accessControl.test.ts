import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
  checkAccess reads the profile, so the client has to be stubbed. The mock is
  per-test: each case sets ONE profile and asserts what the gate does with it.
  `updates` records every write, because the three-month downgrade is the one
  path here that changes a customer's row and it must not fire by accident.
*/
const updates: unknown[] = [];
let profileRow: Record<string, unknown> | null = null;

vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      findUnique: async () => profileRow,
      update: async (args: unknown) => { updates.push(args); return {}; },
    },
  },
}));

// Mock the stripe import before importing the module under test. Importing it
// for real would construct the Stripe client at module load and need a key.
// The plus-tag rule is reproduced here rather than stubbed away, because it is
// the behaviour these tests are asserting on.
vi.mock('../routes/stripe', () => ({
  EXEMPT_EMAILS: ['kiron@example.com'],
  COMP_EMAILS: ['tester@example.com'],
  hasComplimentaryAccess: (email?: string | null) => {
    const trimmed = (email ?? '').trim().toLowerCase();
    const at = trimmed.lastIndexOf('@');
    if (at <= 0) return false;
    const local = trimmed.slice(0, at);
    const plus = local.indexOf('+');
    const normalised = (plus === -1 ? local : local.slice(0, plus)) + trimmed.slice(at);
    return ['kiron@example.com', 'tester@example.com'].includes(normalised);
  },
}));

import { hasActiveAccess, isOnBillingHold, isPaidOrExempt, denyPayload, checkAccess } from './accessControl';
import { isGateEnforced } from '../config/accessGate';

/* ── The gate ────────────────────────────────────────────────────────────────
   These are the tests that stand between a paying client and being locked out
   of something they have paid for. On 9 Sep 2026 every one of the eight paying
   accounts was carrying dashboardAccess=true, so that is the case that matters
   most, and it is asserted in both modes.                                    */
describe('the free-tier gate', () => {
  const FUTURE = new Date(Date.now() + 30 * 86_400_000);
  const PAST = new Date(Date.now() - 86_400_000);

  const profile = (over: Record<string, unknown> = {}) => ({
    plan: 'free', planStatus: 'active', accessExpiresAt: null, trialEndDate: null,
    dashboardAccess: false, billingHoldAt: null, billingHoldInvoiceUrl: null,
    freeGenerationsUsed: 0, freeAnalysesUsed: 0, freeJobSearchesUsed: 0, freeMatchScoresUsed: 0,
    ...over,
  });

  beforeEach(() => { updates.length = 0; profileRow = null; delete process.env.FREE_TIER_GATE; });
  afterEach(() => { delete process.env.FREE_TIER_GATE; });

  const enforce = () => { process.env.FREE_TIER_GATE = 'on'; };

  describe('the switch itself', () => {
    it('is paused when the variable is unset, which is what deploying it does', () => {
      expect(isGateEnforced()).toBe(false);
    });
    it('is paused for anything that is not "on"', () => {
      for (const v of ['', 'off', 'false', 'true', 'ON!', 'yes']) {
        process.env.FREE_TIER_GATE = v;
        expect(isGateEnforced()).toBe(false);
      }
    });
    it('is enforced for "on", however it is cased or spaced', () => {
      for (const v of ['on', 'ON', ' On ']) {
        process.env.FREE_TIER_GATE = v;
        expect(isGateEnforced()).toBe(true);
      }
    });
  });

  describe('nobody who is paying is interrupted', () => {
    it('an explicit grant keeps unlimited access with the gate on', async () => {
      enforce();
      profileRow = profile({ dashboardAccess: true });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
      expect(updates).toEqual([]);
    });
    it('a live monthly plan keeps unlimited access with the gate on', async () => {
      enforce();
      profileRow = profile({ plan: 'monthly', planStatus: 'active' });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
    });
    it('a trialing plan keeps unlimited access', async () => {
      enforce();
      profileRow = profile({ plan: 'premium', planStatus: 'trialing' });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
    });
    it('an unexpired three-month bundle keeps access and is never downgraded', async () => {
      enforce();
      profileRow = profile({ plan: 'three_month', accessExpiresAt: FUTURE, dashboardAccess: true });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
      expect(updates).toEqual([]);
    });
    it('a three-month bundle with no end date is not treated as expired', async () => {
      enforce();
      profileRow = profile({ plan: 'three_month', accessExpiresAt: null, dashboardAccess: true });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
      expect(updates).toEqual([]);
    });
    it('the owner never touches the database at all', async () => {
      enforce();
      profileRow = null; // a read would throw on `.plan` of null if one happened
      expect(await checkAccess('u', 'generation', 'kiron@example.com')).toEqual({ allowed: true });
    });
  });

  describe('with the gate paused, which is how it ships', () => {
    it('a plain free account is unlimited', async () => {
      profileRow = profile({ freeGenerationsUsed: 99 });
      expect(await checkAccess('u', 'generation', 'free@example.com')).toEqual({ allowed: true });
      expect(updates).toEqual([]);
    });
    it('an expired three-month bundle is NOT downgraded while paused', async () => {
      profileRow = profile({ plan: 'three_month', accessExpiresAt: PAST, dashboardAccess: true });
      expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
      expect(updates).toEqual([]);
    });
    // The one denial that has to survive the pause: it exists to withhold
    // access from a paying client whose payment failed.
    it('a billing hold still bites', async () => {
      profileRow = profile({ dashboardAccess: true, billingHoldAt: new Date(), billingHoldInvoiceUrl: 'https://inv' });
      expect(await checkAccess('u', 'generation', 'client@example.com'))
        .toEqual({ allowed: false, reason: 'BILLING_HOLD', payUrl: 'https://inv' });
    });
  });

  describe('with the gate enforced', () => {
    it('a free account under the cap is allowed, and the counter moves', async () => {
      enforce();
      profileRow = profile({ freeGenerationsUsed: 2 });
      expect(await checkAccess('u', 'generation', 'free@example.com')).toEqual({ allowed: true, remaining: 2 });
      expect(updates).toEqual([{ where: { userId: 'u' }, data: { freeGenerationsUsed: { increment: 1 } } }]);
    });
    it('a free account at the cap is denied, and the counter does not move', async () => {
      enforce();
      profileRow = profile({ freeGenerationsUsed: 5 });
      expect(await checkAccess('u', 'generation', 'free@example.com'))
        .toEqual({ allowed: false, upgradeRequired: true, remaining: 0 });
      expect(updates).toEqual([]);
    });
    it('counts each feature separately', async () => {
      enforce();
      profileRow = profile({ freeGenerationsUsed: 5, freeAnalysesUsed: 0 });
      expect((await checkAccess('u', 'analysis', 'free@example.com')).allowed).toBe(true);
    });
    it('an expired trial falls back to the free limits', async () => {
      enforce();
      profileRow = profile({ trialEndDate: PAST, freeGenerationsUsed: 5 });
      expect((await checkAccess('u', 'generation', 'free@example.com')).allowed).toBe(false);
    });
    it('an expired three-month bundle is downgraded once, then metered', async () => {
      enforce();
      profileRow = profile({ plan: 'three_month', planStatus: 'active', accessExpiresAt: PAST, dashboardAccess: true });
      const r = await checkAccess('u', 'generation', 'client@example.com');
      expect(r.allowed).toBe(true);
      expect(updates[0]).toEqual({
        where: { userId: 'u' },
        data: { plan: 'free', planStatus: 'expired', dashboardAccess: false },
      });
    });
    it('a missing profile is denied rather than waved through', async () => {
      enforce();
      profileRow = null;
      expect((await checkAccess('u', 'generation', 'nobody@example.com')).allowed).toBe(false);
    });
  });
});

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

/* ── The paid-for window ─────────────────────────────────────────────────────
   accessExpiresAt is a promise about a date, made to eight clients on 9 Sep
   2026: a year of access from the day their first payment cleared. What these
   assert is that the promise survives everything that might otherwise revoke
   it — a finished three-month bundle, a cancelled subscription, a grant being
   withdrawn — because every one of those happens NORMALLY at the end of a
   program and none of them means the year is over.                           */
describe('a window somebody has paid for', () => {
  const future = new Date(Date.now() + 200 * 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('grants access on its own, with no plan and no grant', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', dashboardAccess: false, accessExpiresAt: future })).toBe(true);
  });

  // The exact shape customer.subscription.deleted leaves behind: it writes
  // plan=free, planStatus=cancelled, dashboardAccess=false, and does NOT touch
  // accessExpiresAt. A client who paid for a year in month one must not lose it
  // in month four because the recurring charge stopped.
  it('survives a cancelled subscription', () => {
    expect(hasActiveAccess({
      plan: 'free', planStatus: 'cancelled', dashboardAccess: false, accessExpiresAt: future,
    })).toBe(true);
  });

  it('survives an expired plan with the grant withdrawn', () => {
    expect(hasActiveAccess({
      plan: 'free', planStatus: 'expired', dashboardAccess: false, trialEndDate: past, accessExpiresAt: future,
    })).toBe(true);
  });

  it('stops the day it runs out', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'cancelled', dashboardAccess: false, accessExpiresAt: past })).toBe(false);
  });

  // A hold is money owed right now. It has to outrank a window that was paid
  // for earlier, or it stops being a lever at all.
  it('does not survive a billing hold', () => {
    expect(hasActiveAccess({ plan: 'monthly', accessExpiresAt: future, billingHoldAt: new Date() })).toBe(false);
  });

  // The daily cap is a cost guard aimed at free trials. Somebody inside a year
  // they bought is not a free trial.
  it('exempts them from the trial daily cap', () => {
    expect(isPaidOrExempt({ plan: 'free', planStatus: 'cancelled', dashboardAccess: false, accessExpiresAt: future })).toBe(true);
    expect(isPaidOrExempt({ plan: 'free', planStatus: 'cancelled', dashboardAccess: false, accessExpiresAt: past })).toBe(false);
  });

  it('and the gate lets them through', async () => {
    process.env.FREE_TIER_GATE = 'on';
    profileRow = {
      plan: 'free', planStatus: 'cancelled', accessExpiresAt: future, trialEndDate: null,
      dashboardAccess: false, billingHoldAt: null, billingHoldInvoiceUrl: null,
      freeGenerationsUsed: 99, freeAnalysesUsed: 99, freeJobSearchesUsed: 99, freeMatchScoresUsed: 99,
    };
    updates.length = 0;
    expect(await checkAccess('u', 'generation', 'client@example.com')).toEqual({ allowed: true });
    expect(updates).toEqual([]);
    delete process.env.FREE_TIER_GATE;
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
  // Every staging run of the funnel signs up under a fresh plus tag, so a
  // comp'd address only stays comp'd if the tag is ignored.
  it('never holds a comp account signed up under a plus tag', () => {
    expect(isOnBillingHold({ billingHoldAt: held }, 'tester+t27329@example.com')).toBe(false);
    expect(isOnBillingHold({ billingHoldAt: held }, 'TESTER+T99@example.com')).toBe(false);
  });
  it('still holds a stranger who merely shares the tag', () => {
    expect(isOnBillingHold({ billingHoldAt: held }, 'someoneelse+tester@example.com')).toBe(true);
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
