import { describe, it, expect, vi, beforeAll } from 'vitest';

// Same stubs as stripe.invoice.test.ts: only the pure helper is under test.
vi.mock('stripe', () => ({ default: class { webhooks = {}; subscriptions = {}; } }));
vi.mock('../index', () => ({ prisma: {} }));
vi.mock('../middleware/auth', () => ({ authenticate: () => {}, }));
vi.mock('../services/email', () => ({ sendAdminPaymentAlert: vi.fn() }));
vi.mock('../services/onboarding', () => ({ onboardPaidCustomer: vi.fn() }));
vi.mock('../services/skoolUpgrade', () => ({ raiseSkoolUpgrade: vi.fn() }));
vi.mock('../services/salesLead', () => ({ recordLeadSignal: vi.fn() }));
vi.mock('../services/lifecycle/send', () => ({ onTrialStarted: vi.fn(), onInvoicePaid: vi.fn() }));

let cardTrialEnd: (signedUpAt: Date | null | undefined, now?: Date) => number;
const DAY = 86_400_000;
const signup = new Date('2026-11-01T00:00:00Z');
const days = (unix: number) => (unix * 1000 - signup.getTime()) / DAY;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
  ({ cardTrialEnd } = await import('./stripe'));
});

describe('cardTrialEnd', () => {
  it('ends on day seven when the card goes on during the free three days', () => {
    expect(days(cardTrialEnd(signup, new Date(signup.getTime() + 2.5 * DAY)))).toBe(7);
  });

  it('does not cost an early card any days', () => {
    expect(days(cardTrialEnd(signup, new Date(signup.getTime() + 0.1 * DAY)))).toBe(7);
  });

  it('gives four days from now to someone who comes back after the free days', () => {
    expect(days(cardTrialEnd(signup, new Date(signup.getTime() + 10 * DAY)))).toBe(14);
  });

  it('treats a missing signup date as signing up now', () => {
    const now = new Date('2026-11-05T00:00:00Z');
    expect((cardTrialEnd(null, now) * 1000 - now.getTime()) / DAY).toBe(7);
  });
});
