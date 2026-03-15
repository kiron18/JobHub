import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { STAGE_1_PROMPT, STAGE_2_PROMPT } from '../services/prompts';

const router = Router();

router.post('/resume', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Resume text is required' });
    }

    try {
        console.log('--- Stage 1: Structure Extraction ---');
        let stage1Raw = await callLLM(STAGE_1_PROMPT(text));
        console.log('Raw Stage 1 Output:', stage1Raw);
        
        let cleanedStage1 = stage1Raw;
        // Clean JSON if LLM returned markdown backticks
        if (cleanedStage1.includes('```json')) {
            cleanedStage1 = cleanedStage1.split('```json')[1].split('```')[0].trim();
        } else if (cleanedStage1.includes('```')) {
            cleanedStage1 = cleanedStage1.split('```')[1].split('```')[0].trim();
        }

        let stage1Data: any;
        try {
            stage1Data = JSON.parse(cleanedStage1);
        } catch (e: any) {
            console.error('Failed to parse Stage 1 JSON. Cleaned output:', cleanedStage1);
            throw new Error(`Invalid Stage 1 JSON: ${e.message}`);
        }

        console.log('--- Stage 2: Achievement Detection (Per-Role) ---');
        let achievements: any[] = [];
        
        if (stage1Data.experience && Array.isArray(stage1Data.experience)) {
            for (let i = 0; i < stage1Data.experience.length; i++) {
                const exp = stage1Data.experience[i];
                if (exp.bullets && exp.bullets.length > 0) {
                    console.log(`Analyzing role: ${exp.role} at ${exp.company}`);
                    let stage2Raw = await callLLM(STAGE_2_PROMPT(exp.role, exp.company, exp.bullets));
                    let cleanedStage2 = stage2Raw;

                    if (cleanedStage2.includes('```json')) {
                        cleanedStage2 = cleanedStage2.split('```json')[1].split('```')[0].trim();
                    } else if (cleanedStage2.includes('```')) {
                        cleanedStage2 = cleanedStage2.split('```')[1].split('```')[0].trim();
                    }

                    let stage2Data;
                    try {
                        stage2Data = JSON.parse(cleanedStage2);
                    } catch (e: any) {
                        console.error('Failed to parse Stage 2 JSON. Cleaned output:', cleanedStage2);
                        // Don't fail the whole extraction if one role fails, just log and continue
                        continue;
                    }
                    const roleAchievements = (stage2Data.achievements || []).map((ach: any) => ({
                        ...ach,
                        experienceIndex: i // Store index to link later in profile save
                    }));
                    achievements = [...achievements, ...roleAchievements];
                }
            }
        }


        res.json({
            profile: stage1Data.profile,
            skills: stage1Data.skills,
            experience: stage1Data.experience,
            education: stage1Data.education,
            volunteering: stage1Data.volunteering || [],
            certifications: stage1Data.certifications || [],
            languages: stage1Data.languages || [],
            coachingAlerts: stage1Data.coachingAlerts || [],
            discoveredAchievements: achievements
        });
    } catch (error: any) {
        console.error('Extraction Workflow Error:', error);
        res.status(500).json({ 
            error: 'Failed to extract data from resume',
            details: error.message,
            stack: error.stack
        });
    }
});

export default router;
