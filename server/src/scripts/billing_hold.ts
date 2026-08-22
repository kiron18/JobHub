/**
 * Place or lift a billing hold on a client by email.
 *
 * A hold pauses the client's access to generation, analysis, match scoring and
 * the job feed. It does NOT touch their Stripe subscription, their data, or
 * their login — they can still sign in and read what is already there. It is a
 * pause, not a cancellation.
 *
 * Placing a hold fetches that customer's open Stripe invoice and stores its
 * hosted payment link, so the app can send them straight to the exact invoice
 * they owe. Paying it lifts the hold automatically via the
 * invoice.payment_succeeded webhook — you should not normally need `lift`.
 *
 * Usage (run from server/):
 *   npx tsx src/scripts/billing_hold.ts status
 *   npx tsx src/scripts/billing_hold.ts place <email> [email2 ...]
 *   npx tsx src/scripts/billing_hold.ts lift  <email> [email2 ...]
 *
 * Add --dry-run to any command to print what would change and write nothing.
 */
import { PrismaClient } from '@prisma/client';
import StripeLib from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();
const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia' as any,
});

const DRY = process.argv.includes('--dry-run');

/** The hosted link for the customer's oldest unpaid invoice, if they have one. */
async function openInvoiceUrl(stripeCustomerId: string | null): Promise<string | null> {
  if (!stripeCustomerId) return null;
  try {
    const open = await stripe.invoices.list({ customer: stripeCustomerId, status: 'open', limit: 10 });
    const oldest = open.data.sort((a, b) => a.created - b.created)[0];
    return oldest?.hosted_invoice_url ?? null;
  } catch (err: any) {
    console.warn(`  ! could not read Stripe invoices: ${err.message ?? err}`);
    return null;
  }
}

async function status() {
  const held = await prisma.candidateProfile.findMany({
    where: { billingHoldAt: { not: null } },
    select: { email: true, name: true, planStatus: true, billingHoldAt: true, billingHoldInvoiceUrl: true },
    orderBy: { billingHoldAt: 'asc' },
  });
  if (held.length === 0) {
    console.log('No accounts are on billing hold.');
    return;
  }
  console.log(`${held.length} account(s) on billing hold:\n`);
  for (const h of held) {
    console.log(`  ${h.name ?? '(no name)'} <${h.email}>`);
    console.log(`    held since : ${h.billingHoldAt?.toISOString().slice(0, 10)}`);
    console.log(`    planStatus : ${h.planStatus}`);
    console.log(`    pay link   : ${h.billingHoldInvoiceUrl ?? '(none stored)'}`);
  }
}

async function apply(action: 'place' | 'lift', emails: string[]) {
  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    const profile = await prisma.candidateProfile.findFirst({
      where: { email },
      select: { id: true, email: true, name: true, planStatus: true, stripeCustomerId: true, billingHoldAt: true },
    });
    if (!profile) {
      console.error(`  ✗ ${email} — no profile found, skipped`);
      continue;
    }

    if (action === 'place') {
      if (profile.billingHoldAt) {
        console.log(`  = ${email} — already on hold since ${profile.billingHoldAt.toISOString().slice(0, 10)}, left alone`);
        continue;
      }
      const payUrl = await openInvoiceUrl(profile.stripeCustomerId);
      if (!payUrl) {
        console.warn(`  ! ${email} — no open Stripe invoice found. Holding anyway, but with no pay link to show them.`);
      }
      if (DRY) {
        console.log(`  ~ ${email} — WOULD hold (payUrl=${payUrl ?? 'none'})`);
        continue;
      }
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { billingHoldAt: new Date(), billingHoldInvoiceUrl: payUrl },
      });
      console.log(`  ✓ ${email} — held${payUrl ? ' with pay link' : ' (no pay link)'}`);
    } else {
      if (!profile.billingHoldAt) {
        console.log(`  = ${email} — not on hold, nothing to do`);
        continue;
      }
      if (DRY) {
        console.log(`  ~ ${email} — WOULD lift`);
        continue;
      }
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { billingHoldAt: null, billingHoldInvoiceUrl: null },
      });
      console.log(`  ✓ ${email} — hold lifted`);
    }
  }
}

async function main() {
  const cmd = process.argv[2];
  const emails = process.argv.slice(3).filter((a) => !a.startsWith('--'));

  if (cmd === 'status') {
    await status();
  } else if (cmd === 'place' || cmd === 'lift') {
    if (emails.length === 0) {
      console.error(`Usage: npx tsx src/scripts/billing_hold.ts ${cmd} <email> [email2 ...] [--dry-run]`);
      process.exit(1);
    }
    console.log(`${DRY ? '[DRY RUN] ' : ''}${cmd === 'place' ? 'Placing' : 'Lifting'} hold on ${emails.length} account(s):\n`);
    await apply(cmd, emails);
    console.log('');
    await status();
  } else {
    console.error('Usage: npx tsx src/scripts/billing_hold.ts <status|place|lift> [emails...] [--dry-run]');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
