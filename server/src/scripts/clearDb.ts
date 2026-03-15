import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Clearing database...');

  try {
    // Order matters due to foreign key constraints if using SQLite/Postgres with FKs
    // In Prisma, we can use $transaction and deleteMany
    await prisma.$transaction([
      prisma.document.deleteMany(),
      prisma.jobApplication.deleteMany(),
      prisma.achievement.deleteMany(),
      prisma.experience.deleteMany(),
      prisma.education.deleteMany(),
      prisma.volunteering.deleteMany(),
      prisma.certification.deleteMany(),
      prisma.language.deleteMany(),
      prisma.candidateProfile.deleteMany(),
    ]);

    console.log('✅ Database cleared successfully.');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
