import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.candidateProfile.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      userId: true,
      hasCompletedOnboarding: true,
      resumeRawText: true,
      targetRole: true,
      targetCity: true,
      createdAt: true,
    },
  });

  console.log('Recent profiles:');
  profiles.forEach(p => {
    console.log({
      userId: p.userId.slice(0, 8) + '...',
      hasCompletedOnboarding: p.hasCompletedOnboarding,
      hasResume: p.resumeRawText != null,
      resumeLength: p.resumeRawText?.length || 0,
      targetRole: p.targetRole,
      targetCity: p.targetCity,
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
