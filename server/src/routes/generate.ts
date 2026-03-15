import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { DOCUMENT_GENERATION_PROMPT } from '../services/prompts';
import fs from 'fs';
import path from 'path';

const router = Router();

async function getRuleBase(type: string) {
    try {
        let fileName = 'resume_rules.md';
        if (type === 'cover-letter') fileName = 'cover_letter_rules.md';
        if (type === 'selection-criteria') fileName = 'selection_criteria_rules.md';
        
        const filePath = path.join(__dirname, '..', '..', 'rules', fileName);
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.error(`Failed to read rule base for ${type}:`, e);
        return '';
    }
}

router.post('/:type', authenticate, async (req, res) => {
    const type = req.params.type as string;
    const userId = (req as any).user.id as string;
    const { jobDescription, selectedAchievementIds, regenerate, analysisContext, jobApplicationId } = req.body;

    if (!jobDescription) {
        return res.status(400).json({ error: 'Job description is required' });
    }

    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
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
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Use the centralized helper to build achievement context
        const { buildAchievementContext } = await import('../services/generation');
        const selectedAchievements = await buildAchievementContext(
            userId,
            jobDescription,
            selectedAchievementIds
        );

        const ruleBase = await getRuleBase(type);
        
        console.log('[Generation Debug]', {
            type,
            achievementCount: selectedAchievements.length,
            achievementSample: selectedAchievements[0]?.description?.substring(0, 100),
            jdLength: jobDescription.length,
            jdSample: jobDescription.substring(0, 200),
            hasAnalysisContext: !!analysisContext,
            jobApplicationId
        });

        const docType = type === 'selection-criteria' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');
        const prompt = DOCUMENT_GENERATION_PROMPT(
            docType,
            jobDescription,
            profile,
            selectedAchievements,
            ruleBase,
            analysisContext
        );

        console.log(`[Generation] Prompt built, calling LLM for ${type}...`);
        const content = await callLLM(prompt, false); // Not JSON, returns Markdown
        console.log(`[Generation] LLM responded with ${content.length} characters.`);

        // Create initial draft record to support auto-save
        console.log(`[Generation] Creating document record for ${type}...`);
        
        // Sanitize jobApplicationId for persistent storage
        const sanitizedJobAppId = jobApplicationId === 'temp-id' ? null : jobApplicationId;

        const doc = await prisma.document.create({
            data: {
                title: `${type.toUpperCase()} - ${profile.name || 'Draft'}`,
                content,
                type: docType,
                userId,
                jobApplicationId: sanitizedJobAppId || null
            }
        });
        console.log(`[Generation] Document created with ID: ${doc.id}`);

        res.json({ content, id: doc.id });

    } catch (error) {
        console.error(`Generation Error (${type}):`, error);
        res.status(500).json({ error: `Failed to generate ${type}` });
    }
});

export default router;
