import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const profile = await prisma.candidateProfile.upsert({
        where: { email: 'candidate@example.com' },
        update: {},
        create: {
            name: 'John Doe',
            email: 'candidate@example.com',
            professionalSummary: 'Product-focused Software Engineer with 5+ years of experience.',
            skills: 'React, TypeScript, Node.js, PostgreSQL',
            experience: {
                create: [
                    {
                        company: 'Tech Corp',
                        role: 'Senior Engineer',
                        startDate: '2021-01-01',
                        isCurrent: true,
                        description: 'Leading the growth team.',
                    }
                ]
            }
        }
    });

    console.log('✅ Seeding complete:', profile.name);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
