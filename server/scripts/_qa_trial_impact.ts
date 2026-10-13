import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const endStatuses = ['day_failed', 'forfeited', 'completed'];
  const ended = await prisma.trialChallenge.findMany({
    where: { status: { in: endStatuses } },
    select: { userId: true, status: true, currentDay: true, updatedAt: true },
  });
  console.log(`Trials that reached an end screen: ${ended.length}`);
  for (const s of endStatuses) console.log(`  ${s}: ${ended.filter(e => e.status === s).length}`);

  const userIds = ended.map(e => e.userId);
  const profiles = await prisma.candidateProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, email: true, stripeSubscriptionId: true, plan: true, subscriptionStatus: true },
  });
  const byId = new Map(profiles.map(p => [p.userId, p]));

  const converted = ended.filter(e => byId.get(e.userId)?.stripeSubscriptionId);
  const notConverted = ended.filter(e => !byId.get(e.userId)?.stripeSubscriptionId);
  console.log(`\nOf those, ever subscribed (stripeSubscriptionId set): ${converted.length}`);
  console.log(`Never subscribed: ${notConverted.length}`);

  console.log('\n--- never-converted sample (most recent 15) ---');
  const sample = notConverted
    .map(e => ({ ...e, email: byId.get(e.userId)?.email }))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 15);
  for (const s of sample) console.log(s.updatedAt.toISOString().slice(0,10), s.status, s.email);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
