const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
    const profileCount = await prisma.candidateProfile.count();
    const jobAppCount = await prisma.jobApplication.count();
    const documentCount = await prisma.document.count();
    const achievementCount = await prisma.achievement.count();

    console.log({
        profileCount,
        jobAppCount,
        documentCount,
        achievementCount
    });

    const profiles = await prisma.candidateProfile.findMany({
        select: { id: true, email: true, name: true }
    });
    console.log('Profiles:', profiles);

    const jobs = await prisma.jobApplication.findMany({
        select: { id: true, title: true, company: true, candidateProfileId: true }
    });
    console.log('Jobs:', jobs);

    await prisma.$disconnect();
}

checkDb();
