
import { PrismaClient } from '@prisma/client';
import { DOCUMENT_GENERATION_PROMPT } from '../src/services/prompts';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function getRuleBase(type: string) {
    try {
        let fileName = 'resume_rules.md';
        if (type === 'cover-letter') fileName = 'cover_letter_rules.md';
        if (type === 'selection-criteria') fileName = 'selection_criteria_rules.md';
        
        const filePath = path.join(__dirname, '..', '..', 'rules', fileName);
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return '';
    }
}

async function run() {
    const profile = await prisma.candidateProfile.findFirst({
        include: { 
            achievements: true,
            experience: true,
            education: true,
            volunteering: true,
            certifications: true,
            languages: true
        }
    });

    if (!profile) {
        console.log('No profile found');
        return;
    }

    const jobDescription = "Software Engineer role at TechCorp. Requirements: React, TypeScript, Node.js, and AWS experience. Must have 5 years experience and strong communication skills.";
    const selectedAchievements: any[] = (profile.achievements as any[]).slice(0, 3);
    const type = 'resume';
    const docType = 'RESUME';
    const ruleBase = await getRuleBase(type);
    const analysisContext = { tone: "professional", competencies: ["React", "TypeScript"] };

    const prompt = DOCUMENT_GENERATION_PROMPT(
        docType,
        jobDescription,
        profile,
        selectedAchievements,
        ruleBase,
        analysisContext
    );

    console.log('--- GENERATION DEBUG START ---');
    console.log('achievementCount:', selectedAchievements.length);
    console.log('profileDataFields:', Object.keys(profile).filter(k => !!(profile as any)[k]));
    console.log('jdLength:', jobDescription.length);
    console.log('promptSample:', prompt.substring(0, 200));
    console.log('--- GENERATION DEBUG END ---');
    
    process.exit(0);
}

run();
