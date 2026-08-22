import { describe, it, expect, vi, beforeAll } from 'vitest';

// stripe.ts constructs a Stripe client and pulls in prisma at import time.
// Neither is needed to test the pure invoice-shape helper, so both are stubbed.
vi.mock('stripe', () => ({ default: class { webhooks = {}; subscriptions = {}; } }));
vi.mock('../index', () => ({ prisma: {} }));
vi.mock('../middleware/auth', () => ({ authenticate: () => {}, }));
vi.mock('../services/email', () => ({ sendAdminPaymentAlert: vi.fn() }));
vi.mock('../services/onboarding', () => ({ onboardPaidCustomer: vi.fn() }));
vi.mock('../services/skoolUpgrade', () => ({ raiseSkoolUpgrade: vi.fn() }));
vi.mock('../services/salesLead', () => ({ recordLeadSignal: vi.fn() }));

let subscriptionIdFromInvoice: (i: any) => string | null;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
  ({ subscriptionIdFromInvoice } = await import('./stripe'));
});

describe('subscriptionIdFromInvoice', () => {
  // The shape Stripe actually sends on API 2026-03-25.dahlia. Reading
  // invoice.subscription here returns undefined, which is what silently broke
  // both the past_due marking and the access restore.
  it('reads the id from invoice.parent on the current API version', () => {
    expect(subscriptionIdFromInvoice({
      parent: {
        type: 'subscription_details',
        subscription_details: { metadata: {}, subscription: 'sub_live_123' },
      },
    })).toBe('sub_live_123');
  });

  it('still reads the legacy top-level field, for replayed old events', () => {
    expect(subscriptionIdFromInvoice({ subscription: 'sub_legacy_456' })).toBe('sub_legacy_456');
  });

  it('prefers the current shape when an event somehow carries both', () => {
    expect(subscriptionIdFromInvoice({
      subscription: 'sub_legacy_456',
      parent: { subscription_details: { subscription: 'sub_live_123' } },
    })).toBe('sub_live_123');
  });

  it('unwraps an expanded subscription object', () => {
    expect(subscriptionIdFromInvoice({
      parent: { subscription_details: { subscription: { id: 'sub_expanded_789', object: 'subscription' } } },
    })).toBe('sub_expanded_789');
  });

  it('returns null for a one-off invoice with no subscription', () => {
    expect(subscriptionIdFromInvoice({ parent: null })).toBeNull();
    expect(subscriptionIdFromInvoice({})).toBeNull();
  });
});
