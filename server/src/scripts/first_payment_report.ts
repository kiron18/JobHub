/**
 * When each paying client's money first arrived, straight from Stripe.
 *
 * READ ONLY. Stripe is the money truth: the CRM ledger and the JobHub profile
 * both hold a copy of this date and both have been wrong before, so neither is
 * used here except to say which customer to ask about.
 *
 * "First payment" means the earliest charge that actually succeeded and was not
 * refunded. Khushal's first attempt failed 45 seconds before it cleared and
 * Ananya's declined three times before it went through, so an attempt date and
 * a payment date are genuinely different things for this customer list.
 *
 *   npx tsx src/scripts/first_payment_report.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import StripeLib from 'stripe';

const prisma = new PrismaClient();
const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

/** How long access should run from the first payment. */
export const ACCESS_YEARS = 1;

export function plusYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

const mask = (email: string | null | undefined): string => {
  const s = (email ?? '').trim();
  const at = s.lastIndexOf('@');
  return at <= 0 ? '(no email)' : `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
};

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

export interface Payment { at: Date; amount: number; currency: string }

/**
 * Every client's first payment, keyed by the address they paid with.
 *
 * Built by walking the whole charge list rather than by asking per customer,
 * because the three legacy one-off clients — Pawan, Ananya and Kangesh — have
 * NO Stripe customer attached to their charge at all. That money came in
 * through a payment link before our checkout existed, so `charges.list({
 * customer })` finds nothing for them and `customers.list({ email })` finds no
 * customer to search. The billing email on the charge is the only thread that
 * connects those payments to a person, and it is the thread the CRM ledger was
 * built from too.
 *
 * The account has had well under a hundred charges in its life. If that stops
 * being true this needs to paginate; `has_more` is asserted for that reason.
 */
export async function firstPayments(): Promise<{ byEmail: Map<string, Payment>; byCustomer: Map<string, Payment> }> {
  const page = await stripe.charges.list({ limit: 100 });
  if (page.has_more) {
    throw new Error('More than 100 charges: this needs to paginate before it can be trusted.');
  }

  const byEmail = new Map<string, Payment>();
  const byCustomer = new Map<string, Payment>();
  const paid = page.data
    .filter(c => c.status === 'succeeded' && !c.refunded && c.amount_captured > 0)
    .sort((a, b) => a.created - b.created); // earliest first, so the first write wins

  for (const c of paid) {
    const payment: Payment = {
      at: new Date(c.created * 1000),
      amount: c.amount_captured / 100,
      currency: c.currency.toUpperCase(),
    };
    const email = (c.billing_details?.email ?? c.receipt_email ?? '').trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, payment);
    const customer = typeof c.customer === 'string' ? c.customer : null;
    if (customer && !byCustomer.has(customer)) byCustomer.set(customer, payment);
  }
  return { byEmail, byCustomer };
}

export interface Plan {
  userId: string;
  email: string | null;
  plan: string | null;
  current: Date | null;
  first: Payment;
  target: Date;
}

/**
 * What each paying profile's accessExpiresAt should be, and which profiles
 * cannot be answered from Stripe at all.
 *
 * A profile is only ever EXTENDED. If somebody's existing expiry is already
 * later than a year from their first payment, they keep the later one — this
 * is here to guarantee a floor, not to claw anything back.
 */
export async function planYearOfAccess(prismaClient: PrismaClient = prisma) {
  const { byEmail, byCustomer } = await firstPayments();
  const rows = await prismaClient.candidateProfile.findMany({
    where: { OR: [{ plan: { not: 'free' } }, { dashboardAccess: true }] },
    select: {
      userId: true, email: true, plan: true, planStatus: true, accessExpiresAt: true,
      dashboardAccess: true, stripeCustomerId: true,
    },
  });

  const matched: Plan[] = [];
  const unmatched: typeof rows = [];
  const usedEmails = new Set<string>();

  for (const r of rows) {
    /*
      Customer id first, email second, because they disagree and the id is the
      stronger claim. Mayank's profile carries a different address to the one
      his card is billed under — a signup email and a payment email are simply
      two different things, and the whole CRM/JobHub/Stripe join is on email,
      which is the pending cleanup the root CLAUDE.md mentions. Matching on the
      id as well means this does not wait for that.
    */
    const first =
      (r.stripeCustomerId ? byCustomer.get(r.stripeCustomerId) : undefined)
      ?? byEmail.get((r.email ?? '').trim().toLowerCase());

    if (!first) { unmatched.push(r); continue; }
    usedEmails.add((r.email ?? '').trim().toLowerCase());
    matched.push({
      userId: r.userId, email: r.email, plan: r.plan,
      current: r.accessExpiresAt, first, target: plusYears(first.at, ACCESS_YEARS),
    });
  }

  /*
    Money that arrived from an address no profile matched: somebody paid and
    either never signed up, or signed up under a different address. That is a
    paying person with no access, and it is worth knowing about. Payments
    already claimed via a customer id are not orphans, hence `matchedPayments`.
  */
  const matchedPayments = new Set(matched.map(m => m.first.at.getTime()));
  const orphanPayments = [...byEmail.entries()].filter(
    ([email, p]) => !usedEmails.has(email) && !matchedPayments.has(p.at.getTime()),
  );

  return { matched, unmatched, orphanPayments };
}

async function main() {
  const { matched, unmatched, orphanPayments } = await planYearOfAccess();

  console.log(`PAID CLIENTS MATCHED TO A STRIPE PAYMENT (${matched.length})`);
  console.log(`  ${'client'.padEnd(32)} ${'plan'.padEnd(12)} first payment   amount     expires now -> after\n`);
  for (const m of matched.sort((a, b) => a.first.at.getTime() - b.first.at.getTime())) {
    const extends_ = !m.current || m.target > m.current;
    console.log(
      `  ${mask(m.email).padEnd(32)} ${(m.plan ?? '').padEnd(12)} ${day(m.first.at)}`
      + `  ${m.first.currency} ${String(m.first.amount).padStart(4)}`
      + `   ${day(m.current).padEnd(11)} -> ${day(m.target)}${extends_ ? '' : '   (already later, left alone)'}`,
    );
  }

  console.log(`\nPROFILES WITH A GRANT BUT NO PAYMENT IN STRIPE (${unmatched.length}) — left alone`);
  for (const u of unmatched) {
    console.log(`  ${mask(u.email).padEnd(32)} ${(u.plan ?? '').padEnd(12)} grant=${u.dashboardAccess} expires=${day(u.accessExpiresAt)}`);
  }

  console.log(`\nPAYMENTS WITH NO MATCHING PROFILE (${orphanPayments.length})`);
  for (const [email, p] of orphanPayments) {
    console.log(`  ${mask(email).padEnd(32)} paid ${day(p.at)}  ${p.currency} ${p.amount}`);
  }
  if (orphanPayments.length === 0) console.log('  none — every payment maps to an account');
}

if (process.argv[1]?.includes('first_payment_report')) {
  main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
}
