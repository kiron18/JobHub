
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDB() {
  const profile = await prisma.candidateProfile.findFirst({
    include: { achievements: true, experience: true }
  });
  console.log('--- Profile Found ---');
  console.log('Name:', profile?.name);
  console.log('Achievements Count:', profile?.achievements.length);
  console.log('Experience Count:', profile?.experience.length);
  
  if (profile?.achievements.length) {
    console.log('First Achievement Sample:', profile.achievements[0].title);
  }
}

checkDB().finally(() => prisma.$disconnect());
