/**
 * Read-only check: show a user's plan state and whether the access gate
 * (middleware/accessControl.ts) would currently ALLOW a paid feature.
 *
 * Usage (from server/):  npx tsx src/scripts/verify_access.ts <email>
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? '').toLowerCase().trim();
  if (!email) {
    console.error('Usage: npx tsx src/scripts/verify_access.ts <email>');
    process.exit(1);
  }

  const p = await prisma.candidateProfile.findFirst({
    where: { email },
    select: {
      email: true, name: true, plan: true, planStatus: true,
      accessExpiresAt: true, dashboardAccess: true,
      freeAnalysesUsed: true, freeGenerationsUsed: true,
    },
  });

  if (!p) {
    console.error(`No profile found for "${email}".`);
    process.exit(1);
  }

  // Mirror of middleware/accessControl.ts checkAccess (paid-plan branches)
  const plan = p.plan ?? 'free';
  const planStatus = p.planStatus ?? 'active';
  let allowed = false;
  let why = '';
  if (plan === 'three_month') {
    if (p.accessExpiresAt && p.accessExpiresAt < new Date()) {
      allowed = false; why = 'three_month bundle EXPIRED → would downgrade to free';
    } else {
      allowed = true; why = 'three_month bundle active';
    }
  } else if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) {
    allowed = true; why = `paid plan "${plan}" with status "${planStatus}"`;
  } else {
    allowed = false; why = `plan "${plan}" / status "${planStatus}" → free path (capped)`;
  }

  console.log(`Profile:        ${p.name ?? '(no name)'} <${p.email}>`);
  console.log(`plan:           ${p.plan}`);
  console.log(`planStatus:     ${p.planStatus}`);
  console.log(`accessExpiresAt:${p.accessExpiresAt ? ' ' + p.accessExpiresAt.toISOString() : ' (none)'}`);
  console.log(`dashboardAccess:${' '}${p.dashboardAccess}`);
  console.log(`freeAnalysesUsed/freeGenerationsUsed: ${p.freeAnalysesUsed}/${p.freeGenerationsUsed}`);
  console.log('');
  console.log(`GATE → ${allowed ? 'ALLOWED (uncapped) ✅' : 'BLOCKED (capped) ❌'}  — ${why}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
