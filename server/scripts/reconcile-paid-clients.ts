/**
 * Reconcile CandidateProfile billing state against Stripe.
 *
 * Why this exists: the Stripe webhook can only stamp a profile when it can
 * resolve the payment to a userId. Two routes defeat it —
 *
 *   1. The client pays BEFORE creating their JobHub account (Mayank paid
 *      11 Jul, signed up 13 Jul), so there is no profile to update and the
 *      webhook falls through to the "unmatched payment" alert.
 *   2. The client pays through a bare Stripe payment link, which produces a
 *      charge with no customer object and no metadata (Kangeshvar, $500).
 *
 * Either way the profile stays plan='free', and every surface that reads
 * `plan` — the admin client roster, access control — treats a paying client
 * as a free trial user.
 *
 * Run with:  npx tsx -r dotenv/config scripts/reconcile-paid-clients.ts        (dry run)
 *            npx tsx -r dotenv/config scripts/reconcile-paid-clients.ts --write
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WRITE = process.argv.includes('--write');

interface Repair {
  email: string;
  why: string;
  data: Record<string, unknown>;
}

const REPAIRS: Repair[] = [
  {
    email: 'mayank0312parekh@gmail.com',
    why: 'Active $250/mo Stripe subscription since 2026-07-11 (sub_1TrpXQRRHBMzeTPTWA9tHEqu). Paid two days before signing up, so the webhook had no userId to match.',
    data: {
      plan: 'monthly',
      planStatus: 'active',
      stripeCustomerId: 'cus_UrYeHrXodH8hxI',
      stripeSubscriptionId: 'sub_1TrpXQRRHBMzeTPTWA9tHEqu',
      dashboardAccess: true,
    },
  },
  {
    email: 'kangesh18@gmail.com',
    why: 'Paid $500 AUD on 2026-06-26 (py_3TmONKRRHBMzeTPT0asYATgy) via a payment link — no Stripe customer object, so nothing to reconcile against. Kiron confirmed 2026-08-01: three months from the date of payment, so 90 days from 26 Jun = 24 Sep 2026, matching how the webhook grants every other three_month bundle.',
    data: {
      plan: 'three_month',
      planStatus: 'active',
      dashboardAccess: true,
      accessExpiresAt: new Date('2026-09-24T00:00:00.000Z'),
    },
  },
];

async function main() {
  console.log(WRITE ? '=== WRITING ===\n' : '=== DRY RUN (pass --write to apply) ===\n');

  for (const r of REPAIRS) {
    const before = await prisma.candidateProfile.findFirst({
      where: { email: r.email },
      select: {
        userId: true, name: true, email: true, plan: true, planStatus: true,
        subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true,
        accessExpiresAt: true, dashboardAccess: true,
      },
    });

    if (!before) {
      console.log(`SKIP ${r.email} — no CandidateProfile with that email\n`);
      continue;
    }

    console.log(`${before.name ?? '(no name)'} <${r.email}>`);
    console.log(`  why:    ${r.why}`);
    console.log(`  before: plan=${before.plan}/${before.planStatus} cus=${before.stripeCustomerId ?? '-'} sub=${before.stripeSubscriptionId ?? '-'} dash=${before.dashboardAccess} expires=${before.accessExpiresAt?.toISOString().slice(0, 10) ?? '-'}`);
    console.log(`  after:  ${JSON.stringify(r.data)}`);

    if (WRITE) {
      const after = await prisma.candidateProfile.update({
        where: { userId: before.userId },
        data: r.data,
        select: { plan: true, planStatus: true, stripeCustomerId: true, stripeSubscriptionId: true, dashboardAccess: true, accessExpiresAt: true },
      });
      console.log(`  wrote:  plan=${after.plan}/${after.planStatus} cus=${after.stripeCustomerId ?? '-'} sub=${after.stripeSubscriptionId ?? '-'} dash=${after.dashboardAccess} expires=${after.accessExpiresAt?.toISOString().slice(0, 10) ?? '-'}`);
    }
    console.log('');
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
