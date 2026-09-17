// Throwaway local-dev helper. Not shipped as a route, not meant to be pretty.
// Seeds (or resets) the dev-bypass user's CandidateProfile on whatever DB
// .env.local points at, and wipes any existing trial-challenge state, so a
// tester can click through the 3-day arc from a clean slate as many times as
// needed. Run with: npx tsx scripts/devTrialReset.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const DEV_BYPASS_USER_ID = 'dev-test-00000000-0000-0000-0000-000000000001';
const DEV_BYPASS_EMAIL = 'dev-test@jobhub.local';

async function main() {
  const prisma = new PrismaClient();

  // hasCompletedOnboarding: true skips the onboarding intake form entirely
  // (App.tsx's stage logic and OnboardingGate both gate on this one field),
  // so the dev-bypass user lands straight on the dashboard instead of the
  // "complete your profile" screen.
  const seed = { name: 'Dev Test', email: DEV_BYPASS_EMAIL, targetRole: 'Business Analyst', hasCompletedOnboarding: true };
  await prisma.candidateProfile.upsert({
    where: { userId: DEV_BYPASS_USER_ID },
    create: { userId: DEV_BYPASS_USER_ID, ...seed },
    update: seed,
  });

  const trial = await prisma.trialChallenge.findUnique({ where: { userId: DEV_BYPASS_USER_ID } });
  if (trial) {
    await prisma.trialChallengeDay.deleteMany({ where: { trialChallengeId: trial.id } });
    await prisma.trialChallenge.delete({ where: { id: trial.id } });
  }

  console.log('[dev-trial-reset] dev-bypass profile ready, trial-challenge state cleared.');
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
