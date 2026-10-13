/**
 * Turns a list of Stripe charges into the numbers a revenue view needs.
 *
 * Pure on purpose: no Stripe client and no database in here, so the sums can
 * be tested without either. routes/admin-revenue.ts does the fetching.
 *
 * Stripe is the money truth. JobHub stores who is paying (plan, status, the
 * Stripe ids) but never how much, so every amount on this page comes from the
 * charge itself and the profile only puts a name to it.
 *
 * ⚠️ Our own test payments are listed but NOT counted. A $1 card check from
 * an owner inbox is not revenue, and hiding it entirely would make the list
 * disagree with the Stripe dashboard.
 */

/** Our own inboxes, +tag variants included. Same rule /admin/people uses. */
const INTERNAL_EMAIL = /kiron|norik|kamiproject/i;

/** The slice of a Stripe charge this needs. */
export interface ChargeLike {
  id: string;
  /** Smallest currency unit, as Stripe sends it. */
  amount: number;
  amount_refunded: number;
  currency: string;
  /** Unix seconds. */
  created: number;
  status: string;
  customer?: string | { id: string } | null;
  billing_details?: { email?: string | null; name?: string | null } | null;
  receipt_email?: string | null;
  description?: string | null;
}

export interface PayerProfile {
  userId: string;
  name: string | null;
  email: string | null;
  stripeCustomerId: string | null;
}

export interface RevenuePayment {
  id: string;
  paidAt: string;
  amount: number;
  refunded: number;
  net: number;
  currency: string;
  email: string | null;
  name: string | null;
  /** The JobHub account this payment belongs to, when one could be found. */
  userId: string | null;
  description: string | null;
  /** One of ours: shown, never summed. */
  internal: boolean;
}

export interface RevenueTotals {
  gross: number;
  refunded: number;
  net: number;
  payments: number;
}

export interface RevenueSummary {
  currency: string;
  totals: RevenueTotals;
  /** Oldest first, every month in the range present even at zero. */
  byMonth: ({ month: string } & RevenueTotals)[];
  /** Newest first. */
  payments: RevenuePayment[];
  /** Real payments with no JobHub account behind them. */
  unmatched: number;
}

const sydneyMonth = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit' }).format(d);

const cents = (n: number) => Math.round(n) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const [fy, fm] = sydneyMonth(from).split('-').map(Number);
  const [ty, tm] = sydneyMonth(to).split('-').map(Number);
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, m = 1) : m++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

export function summariseRevenue(
  charges: ChargeLike[],
  profiles: PayerProfile[],
  range: { from: Date; to: Date },
  currency = 'aud',
): RevenueSummary {
  const byCustomer = new Map<string, PayerProfile>();
  const byEmail = new Map<string, PayerProfile>();
  for (const p of profiles) {
    if (p.stripeCustomerId) byCustomer.set(p.stripeCustomerId, p);
    if (p.email) byEmail.set(p.email.toLowerCase().trim(), p);
  }

  const zero = (): RevenueTotals => ({ gross: 0, refunded: 0, net: 0, payments: 0 });
  const totals = zero();
  const months = new Map(monthsBetween(range.from, range.to).map((m) => [m, zero()]));
  const payments: RevenuePayment[] = [];
  let unmatched = 0;

  for (const ch of charges) {
    // A failed or pending charge is not money. Another currency would need
    // converting before it could be added to these, so it is left out rather
    // than summed as if a dollar were a dollar.
    if (ch.status !== 'succeeded' || ch.currency.toLowerCase() !== currency) continue;

    const customerId = typeof ch.customer === 'string' ? ch.customer : ch.customer?.id ?? null;
    const email = (ch.billing_details?.email ?? ch.receipt_email ?? '').toLowerCase().trim() || null;
    // Customer id first: it survives the payer using a different email at
    // checkout from the one on their account, which is the usual mismatch.
    const profile = (customerId && byCustomer.get(customerId)) || (email && byEmail.get(email)) || null;
    const paidAt = new Date(ch.created * 1000);
    const amount = cents(ch.amount);
    const refunded = cents(ch.amount_refunded);
    const net = round2(amount - refunded);
    const internal = INTERNAL_EMAIL.test(email ?? '') || INTERNAL_EMAIL.test(profile?.email ?? '');

    payments.push({
      id: ch.id,
      paidAt: paidAt.toISOString(),
      amount, refunded, net,
      currency: ch.currency.toLowerCase(),
      email: email ?? profile?.email ?? null,
      name: profile?.name ?? ch.billing_details?.name ?? null,
      userId: profile?.userId ?? null,
      description: ch.description ?? null,
      internal,
    });

    if (internal) continue;
    if (!profile) unmatched++;
    for (const t of [totals, months.get(sydneyMonth(paidAt))]) {
      if (!t) continue;
      t.gross = round2(t.gross + amount);
      t.refunded = round2(t.refunded + refunded);
      t.net = round2(t.net + net);
      t.payments++;
    }
  }

  payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return {
    currency,
    totals,
    byMonth: [...months].map(([month, t]) => ({ month, ...t })),
    payments,
    unmatched,
  };
}
