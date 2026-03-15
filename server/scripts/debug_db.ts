
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const profile = await prisma.candidateProfile.findFirst();
  console.log('Profile skills type:', typeof profile?.skills);
  console.log('Profile skills value:', JSON.stringify(profile?.skills, null, 2));
  process.exit(0);
}

check();
