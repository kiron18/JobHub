/**
 * Give a paying customer who has NO JobHub account at all a working login.
 *
 * This is the fix for a "PAID BUT UNMATCHED" alert. Use grant_access.ts only
 * when the person already has a profile and it is merely marked free —
 * grant_access refuses to run when no profile exists, which is exactly the
 * case the unmatched alert is about.
 *
 * What this does, via onboardPaidCustomer():
 *   1. creates a Supabase login (or reuses one if the address already has it)
 *   2. creates/updates the CandidateProfile with 90 days of full access
 *   3. emails them a set-password link and the getting-started instructions
 *
 * Step 3 sends the customer real mail, so this is a deliberate manual action
 * rather than something the nightly sweep does on its own.
 *
 * Usage (run from server/):
 *   npx tsx src/scripts/onboard_paid.ts <email> [stripeCustomerId]
 *   npx tsx src/scripts/onboard_paid.ts <email> --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { onboardPaidCustomer } from '../services/onboarding';

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];
  const rest = process.argv.slice(3);
  const dryRun = rest.includes('--dry-run');
  const stripeCustomerId = rest.find((a) => a.startsWith('cus_')) ?? null;

  if (!emailArg) {
    console.error('Usage: npx tsx src/scripts/onboard_paid.ts <email> [cus_xxx] [--dry-run]');
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();

  const existing = await prisma.candidateProfile.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { email: true, name: true, plan: true, planStatus: true },
  });

  if (existing) {
    console.log(`A profile already exists for ${existing.email} (${existing.name ?? 'no name'}):`);
    console.log(`  plan=${existing.plan} planStatus=${existing.planStatus}`);
    console.log('This is not an "unmatched" case. To just mark them paid, use:');
    console.log(`  npx tsx src/scripts/grant_access.ts ${email} three_month`);
    console.log('Continuing anyway would re-send them a set-password email. Stopping.');
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[dry run] would create a login for ${email}, grant 90 days,`);
    console.log('[dry run] and email them a set-password link. Nothing was written.');
    return;
  }

  console.log(`Onboarding ${email}${stripeCustomerId ? ` (${stripeCustomerId})` : ''}...`);
  const res = await onboardPaidCustomer({ email, stripeCustomerId });

  console.log(`  userId:          ${res.userId}`);
  console.log(`  created login:   ${res.createdAuthUser ? 'yes' : 'no (already existed)'}`);
  console.log(`  set-password email sent: ${res.emailSent ? 'yes' : 'NO — send it by hand'}`);

  // Close the open alert record so the nightly sweep stops flagging them.
  const open = await prisma.unmatchedPayment.findFirst({ where: { email, resolvedAt: null } });
  if (open) {
    await prisma.unmatchedPayment.update({ where: { id: open.id }, data: { resolvedAt: new Date() } });
    console.log('  cleared the open unmatched-payment alert for this address');
  }

  if (!res.emailSent) {
    console.log('\nThe account and access are live regardless. Only the email failed.');
    console.log('Re-send with: npx tsx src/scripts/gen_recovery_link.ts ' + email);
  }
}

main()
  .catch((err) => {
    console.error('onboard_paid failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
