import { PrismaClient } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

async function resetSystem() {
    console.log('--- System Reset Started ---');

    try {
        // 1. Clear Database
        console.log('Clearing Database...');
        // Order matters for foreign keys if not using CASCADE, 
        // but we'll use a transaction for safety.
        await prisma.$transaction([
            prisma.document.deleteMany({}),
            prisma.jobApplication.deleteMany({}),
            prisma.achievement.deleteMany({}),
            prisma.language.deleteMany({}),
            prisma.certification.deleteMany({}),
            prisma.volunteering.deleteMany({}),
            prisma.education.deleteMany({}),
            prisma.experience.deleteMany({}),
            prisma.candidateProfile.deleteMany({})
        ]);
        console.log('Database cleared.');

        // 2. Clear Pinecone
        console.log('Clearing Pinecone Index...');
        if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME) {
            try {
                const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
                const index = pc.index(process.env.PINECONE_INDEX_NAME);
                await index.deleteAll();
                console.log('Pinecone index cleared.');
            } catch (pcError) {
                console.warn('Pinecone reset failed:', pcError);
            }
        } else {
            console.warn('Pinecone skip: Config missing (PINECONE_API_KEY or PINECONE_INDEX_NAME).');
        }

        console.log('--- System Reset Completed Successfully ---');
        console.log('Note: Please clear your browser localStorage to finish the reset.');
    } catch (error) {
        console.error('Reset Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetSystem();
