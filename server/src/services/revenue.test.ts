import { describe, it, expect } from 'vitest';
import { summariseRevenue, type ChargeLike, type PayerProfile } from './revenue';

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const charge = (over: Partial<ChargeLike>): ChargeLike => ({
  id: 'ch_x', amount: 75000, amount_refunded: 0, currency: 'aud',
  created: at('2026-09-10T02:00:00Z'), status: 'succeeded',
  customer: null, billing_details: { email: null, name: null }, receipt_email: null, description: null,
  ...over,
});

const profiles: PayerProfile[] = [
  { userId: 'u1', name: 'Priya Sharma', email: 'priya@example.com', stripeCustomerId: 'cus_1' },
  { userId: 'u2', name: 'Rohan Mehta', email: 'Rohan@Example.com', stripeCustomerId: null },
];

const range = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-10-14T00:00:00Z') };

describe('summariseRevenue', () => {
  it('sums succeeded charges net of refunds and buckets them by Sydney month', () => {
    const s = summariseRevenue([
      charge({ id: 'ch_1', customer: 'cus_1' }),
      charge({ id: 'ch_2', amount: 50000, amount_refunded: 20000, billing_details: { email: 'rohan@example.com' }, created: at('2026-10-02T00:00:00Z') }),
    ], profiles, range);

    expect(s.totals).toEqual({ gross: 1250, refunded: 200, net: 1050, payments: 2 });
    expect(s.byMonth).toEqual([
      { month: '2026-08', gross: 0, refunded: 0, net: 0, payments: 0 },
      { month: '2026-09', gross: 750, refunded: 0, net: 750, payments: 1 },
      { month: '2026-10', gross: 500, refunded: 200, net: 300, payments: 1 },
    ]);
    expect(s.payments.map((p) => p.id)).toEqual(['ch_2', 'ch_1']);
  });

  it('matches on the Stripe customer before the email, and on email whatever its case', () => {
    const s = summariseRevenue([
      charge({ id: 'ch_1', customer: 'cus_1', billing_details: { email: 'someone-else@example.com' } }),
      charge({ id: 'ch_2', billing_details: { email: 'ROHAN@example.com' } }),
    ], profiles, range);

    expect(s.payments.find((p) => p.id === 'ch_1')?.userId).toBe('u1');
    expect(s.payments.find((p) => p.id === 'ch_2')?.name).toBe('Rohan Mehta');
    expect(s.unmatched).toBe(0);
  });

  it('counts a payer with no account as unmatched but still as revenue', () => {
    const s = summariseRevenue([charge({ billing_details: { email: 'stranger@example.com' } })], profiles, range);
    expect(s.unmatched).toBe(1);
    expect(s.totals.net).toBe(750);
    expect(s.payments[0].userId).toBeNull();
  });

  it('lists our own test payments without counting them', () => {
    const s = summariseRevenue([charge({ amount: 100, billing_details: { email: 'kiron182+test@gmail.com' } })], profiles, range);
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0].internal).toBe(true);
    expect(s.totals).toEqual({ gross: 0, refunded: 0, net: 0, payments: 0 });
    expect(s.unmatched).toBe(0);
  });

  it('leaves out failed charges and other currencies', () => {
    const s = summariseRevenue([
      charge({ id: 'ch_failed', status: 'failed' }),
      charge({ id: 'ch_usd', currency: 'usd' }),
    ], profiles, range);
    expect(s.payments).toHaveLength(0);
    expect(s.totals.payments).toBe(0);
  });

  it('puts a late-evening UTC payment in the Sydney month it landed in', () => {
    // 30 Sep 15:00 UTC is 1 Oct in Sydney.
    const s = summariseRevenue([charge({ customer: 'cus_1', created: at('2026-09-30T15:00:00Z') })], profiles, range);
    expect(s.byMonth.find((m) => m.month === '2026-10')?.payments).toBe(1);
    expect(s.byMonth.find((m) => m.month === '2026-09')?.payments).toBe(0);
  });
});
