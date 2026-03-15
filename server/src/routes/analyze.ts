import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { searchAchievements } from '../services/vector';
import { JOB_ANALYSIS_PROMPT } from '../services/prompts';

const router = Router();

router.post('/job', authenticate, async (req: any, res: any) => {
    try {
        const userId = (req as any).user.id;
        console.log('--- Job Analysis Started ---');
        const { jobDescription } = req.body;

        if (!jobDescription || jobDescription.trim().length < 50) {
            console.error('Job Analysis Error: Job description too short or missing');
            return res.status(400).json({ error: 'Job description is too short (min 50 chars).' });
        }

        // 1. Fetch user profile
        console.log('Step 1: Fetching profile...');
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId } as any,
            include: { achievements: true }
        });

        if (!profile) {
            console.error('Job Analysis Error: No profile found');
            return res.status(404).json({ error: 'Please set up your profile first.' });
        }
        console.log(`Found profile: ${profile.name} (${profile.id})`);

        // 2. Parse profile skills for the prompt
        let parsedSkills = { technical: [], industryKnowledge: [], softSkills: [] };
        try {
            parsedSkills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : (profile.skills || parsedSkills);
        } catch (e) {
            console.warn('Failed to parse profile skills, using defaults');
        }

        // 3. Semantic Search for top 12 relevant achievements in Pinecone
        console.log('Step 2: Semantic Search in Pinecone...');
        let matches: any[] = [];
        try {
            matches = await searchAchievements(userId, jobDescription, 12);
            console.log(`Pinecone Search successful. Matches found: ${matches?.length || 0}`);
        } catch (err: any) {
            console.error('Pinecone Search Failed:', err.message);
            // We continue, just with less context
        }
        
        const achievementsText = (matches && matches.length > 0)
            ? matches.map((match: any) => {
                const meta = match.metadata || {};
                return `ID: ${match.id} | Title: ${meta.title || 'Unknown'} | Text: ${meta.text || ''} | Metric: ${meta.metric || 'N/A'}`;
            }).join('\n---\n')
            : "No achievements found in the bank.";

        // 4. Call LLM to analyze the match
        console.log('Step 3: Calling LLM for Analysis...');
        const analysisPrompt = JOB_ANALYSIS_PROMPT(
            jobDescription, 
            { ...profile, skills: parsedSkills }, 
            achievementsText
        );

        let analysisRaw;
        try {
            analysisRaw = await callLLM(analysisPrompt, true);
            console.log('LLM Response received');
        } catch (err: any) {
            console.error('LLM Call Failed:', err.message);
            return res.status(503).json({ error: 'Career Coach AI is currently unavailable. Please try again in 30 seconds.' });
        }

        let analysis;
        try {
            const cleaned = analysisRaw.trim().replace(/^```json|```$/g, '').trim();
            analysis = JSON.parse(cleaned);
            console.log('LLM Response parsed successfully');
        } catch (e) {
            console.error('[Parse Failure] Raw LLM response:', analysisRaw);
            return res.status(500).json({ 
                error: 'Failed to process AI analysis results. Please retry.',
                rawResponse: analysisRaw 
            });
        }

        // 5. Detailed Ranking & Metadata Enrichment
        console.log('Step 4: Ranking achievements...');
        let finalRanked = [];
        try {
            const { rankAchievements } = require('../services/generation');
            const detailedAchievements = await rankAchievements(
                userId,
                jobDescription,
                analysis.keywords || []
            );

            finalRanked = detailedAchievements.map((ach: any) => {
                const llmMatch = (analysis.rankedAchievements || []).find((la: any) => la.id === ach.id);
                return {
                    ...ach,
                    reason: llmMatch?.reason || 'Relevant to your professional background.'
                };
            });
            console.log(`Ranked ${finalRanked.length} achievements`);
        } catch (err: any) {
            console.error('Ranking service failed, falling back to basic list:', err.message);
            finalRanked = (analysis.rankedAchievements || []).map((a: any) => ({ ...a, tier: a.tier || 'MODERATE' }));
        }

        const hasSufficientEvidence = finalRanked.filter((a: any) => a.tier === 'STRONG').length >= 3;

        // 6. Persist JobApplication
        console.log('Step 5: Persisting Job Application...');
        const company = analysis.extractedMetadata?.company || analysis.company || 'Unknown Company';
        const role = analysis.extractedMetadata?.role || analysis.role || 'Unknown Position';

        let jobApplication;
        try {
           jobApplication = await prisma.jobApplication.create({
            data: {
                userId,
                title: role,
                company: company,
                description: jobDescription,
                analysisContext: JSON.stringify(analysis)
            } as any
        });
            console.log(`Job Application created: ${jobApplication.id}`);
        } catch (err: any) {
            console.error('Database Save Failed (JobApplication):', err.message);
            // We can still return the analysis even if DB save fails
        }

        console.log('--- Job Analysis Completed Successfully ---');
        res.json({
            jobApplicationId: jobApplication?.id || 'temp-id',
            matchScore: analysis.matchScore || 50,
            keywords: analysis.keywords || [],
            analysisTone: analysis.analysisTone || 'Professional',
            requiresSelectionCriteria: !!analysis.requiresSelectionCriteria,
            coreCompetencies: analysis.coreCompetencies || [],
            extractedMetadata: { company, role },
            rankedAchievements: finalRanked,
            hasSufficientEvidence,
            evidenceWarning: hasSufficientEvidence 
                ? null 
                : "You have fewer than 3 'Strong' matched achievements. Consider adding more specific metrics to your profile for a better match."
        });

    } catch (error: any) {
        console.error('CRITICAL: Unexpected Job Analysis Error:', error);
        res.status(500).json({ error: 'Analysis failed due to a server error. We have logged this issue.' });
    }
});

export default router;
