/**
 * Manually grant a paid plan to a user by email.
 *
 * Use this to reconcile a payment Stripe collected but the webhook could not
 * attach to an account — e.g. a payment link created by hand in the Stripe
 * dashboard (no userId metadata). This sets the profile to exactly what the
 * webhook would have set for that plan.
 *
 * Usage (run from server/):
 *   npx tsx src/scripts/grant_access.ts <email> [plan]
 *     plan = three_month (default) | monthly | annual
 *
 * Examples:
 *   npx tsx src/scripts/grant_access.ts pawanheg7@gmail.com three_month
 *   npx tsx src/scripts/grant_access.ts someone@example.com monthly
 *
 * three_month grants 90 days of access (matches the one-time bundle).
 * monthly/annual mark the plan active (no Stripe subscription is created —
 * this is a manual grant for already-collected payments only).
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];
  const planArg = (process.argv[3] ?? 'three_month').toLowerCase();

  if (!emailArg) {
    console.error('Usage: npx tsx src/scripts/grant_access.ts <email> [three_month|monthly|annual]');
    process.exit(1);
  }
  if (!['three_month', 'monthly', 'annual'].includes(planArg)) {
    console.error(`Invalid plan "${planArg}". Use: three_month | monthly | annual`);
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();

  const profile = await prisma.candidateProfile.findFirst({
    where: { email },
    select: { id: true, userId: true, email: true, name: true, plan: true, planStatus: true },
  });

  if (!profile) {
    console.error(`No profile found for email "${email}".`);
    console.error('The user must have signed up to JobHub with this exact email first.');
    process.exit(1);
  }

  const data: Record<string, unknown> = {
    plan: planArg,
    planStatus: 'active',
    dashboardAccess: true,
  };
  if (planArg === 'three_month') {
    data.accessExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }

  console.log(`Found profile: ${profile.name ?? '(no name)'} <${profile.email}>`);
  console.log(`  before: plan=${profile.plan} planStatus=${profile.planStatus}`);

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data,
    select: { plan: true, planStatus: true, accessExpiresAt: true, dashboardAccess: true },
  });

  console.log(`  after:  plan=${updated.plan} planStatus=${updated.planStatus} ` +
    `dashboardAccess=${updated.dashboardAccess}` +
    (updated.accessExpiresAt ? ` expires=${updated.accessExpiresAt.toISOString()}` : ''));
  console.log('Access granted. The user should refresh the app.');
}

main()
  .catch((err) => {
    console.error('grant_access failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
