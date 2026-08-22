/**
 * The nightly sweep used to email an admin alert for every unmatched payer on
 * every run, so one unresolved customer produced one email a day forever.
 * Then it was once-then-weekly, which still piled up for payers who will never
 * have an account. These tests pin what is left: recording is unconditional,
 * mailing is UNMATCHED_PAYMENT_ALERTS' call and off unless asked for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above the file body, so anything they close
// over has to come from vi.hoisted().
const { subscriptionsList, chargesList, prismaMock } = vi.hoisted(() => ({
  subscriptionsList: vi.fn(),
  chargesList: vi.fn(),
  prismaMock: {
    candidateProfile: { findFirst: vi.fn(), update: vi.fn() },
    unmatchedPayment: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('stripe', () => ({
  default: class {
    subscriptions = { list: subscriptionsList };
    charges = { list: chargesList };
  },
}));

vi.mock('../index', () => ({ prisma: prismaMock }));
vi.mock('./onboarding', () => ({ onboardPaidCustomer: vi.fn() }));

import { reconcileStripePayments } from './paymentReconcile';

const DAY = 86400000;

/** One succeeded $500 one-off charge from a payer with no account. */
function stripeHasOneOffPayer(email = 'payer@example.com') {
  subscriptionsList.mockResolvedValue({ data: [] });
  chargesList.mockResolvedValue({
    data: [{
      id: 'ch_test', status: 'succeeded', refunded: false, amount: 50000,
      created: Math.floor((Date.now() - 10 * DAY) / 1000),
      customer: 'cus_test', billing_details: { email }, receipt_email: null,
    }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  // Most cases here are about the re-nag rule, so they opt into the loud mode.
  process.env.UNMATCHED_PAYMENT_ALERTS = 'weekly';
  // Default: nobody has a profile, and no prior unmatched record.
  prismaMock.candidateProfile.findFirst.mockResolvedValue(null);
  prismaMock.unmatchedPayment.findUnique.mockResolvedValue(null);
  prismaMock.unmatchedPayment.findFirst.mockResolvedValue(null);
  prismaMock.unmatchedPayment.upsert.mockImplementation(async ({ create }: any) => ({
    firstSeenAt: new Date(), alertCount: 1, ...create,
  }));
});

describe('unmatched payer alerting', () => {
  it('sends nothing by default, but still records the payer', async () => {
    delete process.env.UNMATCHED_PAYMENT_ALERTS;
    stripeHasOneOffPayer();

    const r = await reconcileStripePayments({ write: true });

    expect(r.unmatched).toEqual(['payer@example.com']); // still reported + logged
    expect(r.toAlert).toHaveLength(0);                  // but no mail
    expect(prismaMock.unmatchedPayment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ alertedAt: null, alertCount: 0 }) }),
    );
  });

  it('in once mode, alerts on first sight and never again', async () => {
    process.env.UNMATCHED_PAYMENT_ALERTS = 'once';
    stripeHasOneOffPayer();

    const first = await reconcileStripePayments({ write: true });
    expect(first.toAlert).toHaveLength(1);

    // Same payer, alerted long ago and still unresolved: weekly would re-nag.
    prismaMock.unmatchedPayment.findUnique.mockResolvedValue({
      email: 'payer@example.com',
      firstSeenAt: new Date(Date.now() - 90 * DAY),
      alertedAt: new Date(Date.now() - 90 * DAY),
      alertCount: 1,
      resolvedAt: null,
    });

    const later = await reconcileStripePayments({ write: true });
    expect(later.toAlert).toHaveLength(0);
  });

  it('alerts the first time a payer is seen', async () => {
    stripeHasOneOffPayer();
    const r = await reconcileStripePayments({ write: true });

    expect(r.unmatched).toEqual(['payer@example.com']);
    expect(r.toAlert).toHaveLength(1);
    expect(r.toAlert[0].amount).toBe(500);
    expect(r.toAlert[0].plan).toBe('three_month');
  });

  it('stays silent on the next nightly run', async () => {
    stripeHasOneOffPayer();
    prismaMock.unmatchedPayment.findUnique.mockResolvedValue({
      email: 'payer@example.com',
      firstSeenAt: new Date(Date.now() - DAY),
      alertedAt: new Date(Date.now() - DAY), // alerted yesterday
      alertCount: 1,
      resolvedAt: null,
    });

    const r = await reconcileStripePayments({ write: true });

    expect(r.unmatched).toEqual(['payer@example.com']); // still a problem
    expect(r.toAlert).toHaveLength(0);                  // but no new email
  });

  it('re-nags once a week while unresolved', async () => {
    stripeHasOneOffPayer();
    prismaMock.unmatchedPayment.findUnique.mockResolvedValue({
      email: 'payer@example.com',
      firstSeenAt: new Date(Date.now() - 8 * DAY),
      alertedAt: new Date(Date.now() - 8 * DAY),
      alertCount: 1,
      resolvedAt: null,
    });
    prismaMock.unmatchedPayment.upsert.mockResolvedValue({
      firstSeenAt: new Date(Date.now() - 8 * DAY), alertCount: 2,
    });

    const r = await reconcileStripePayments({ write: true });

    expect(r.toAlert).toHaveLength(1);
    expect(r.toAlert[0].alertCount).toBe(2);
  });

  it('treats a previously-resolved payer going unmatched again as new', async () => {
    stripeHasOneOffPayer();
    prismaMock.unmatchedPayment.findUnique.mockResolvedValue({
      email: 'payer@example.com',
      firstSeenAt: new Date(Date.now() - 60 * DAY),
      alertedAt: new Date(Date.now() - 60 * DAY),
      alertCount: 3,
      resolvedAt: new Date(Date.now() - 50 * DAY),
    });

    const r = await reconcileStripePayments({ write: true });

    expect(r.toAlert).toHaveLength(1);
    // The reopened row must clear resolvedAt, or it would never alert again.
    expect(prismaMock.unmatchedPayment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ resolvedAt: null }) }),
    );
  });

  it('closes the record once the payer has an account', async () => {
    stripeHasOneOffPayer();
    prismaMock.candidateProfile.findFirst.mockResolvedValue({
      userId: 'u1', plan: 'three_month', planStatus: 'active', accessExpiresAt: new Date(),
    });
    prismaMock.unmatchedPayment.findFirst.mockResolvedValue({ id: 'rec1' });

    const r = await reconcileStripePayments({ write: true });

    expect(r.unmatched).toHaveLength(0);
    expect(r.resolved).toEqual(['payer@example.com']);
    expect(prismaMock.unmatchedPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rec1' }, data: { resolvedAt: expect.any(Date) } }),
    );
  });

  it('writes nothing on a dry run', async () => {
    stripeHasOneOffPayer();
    const r = await reconcileStripePayments({ write: false });

    expect(r.unmatched).toEqual(['payer@example.com']);
    expect(prismaMock.unmatchedPayment.upsert).not.toHaveBeenCalled();
    expect(prismaMock.candidateProfile.update).not.toHaveBeenCalled();
  });

  it('matches a profile whose email differs only by case', async () => {
    stripeHasOneOffPayer('Payer@Example.com');
    prismaMock.candidateProfile.findFirst.mockResolvedValue({
      userId: 'u1', plan: 'free', planStatus: 'active', accessExpiresAt: null,
    });

    await reconcileStripePayments({ write: true });

    expect(prismaMock.candidateProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'payer@example.com', mode: 'insensitive' } },
      }),
    );
  });
});
