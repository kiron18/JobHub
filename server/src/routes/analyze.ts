import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { searchAchievements } from '../services/vector';
import { JOB_ANALYSIS_PROMPT } from '../services/prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';

const router = Router();

async function callLLMWithRetry(
  prompt: string, isJson: boolean, maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(prompt, isJson);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[LLM Retry] Attempt ${attempt} failed. Retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('All LLM retries exhausted');
}

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
            analysisRaw = await callLLMWithRetry(analysisPrompt, true);
            console.log('LLM Response received');
        } catch (err: any) {
            console.error('LLM Call Failed:', err.message);
            return res.status(503).json({ error: 'Career Coach AI is currently unavailable. Please try again in 30 seconds.' });
        }

        let analysis;
        try {
            analysis = parseLLMJson(analysisRaw);
            console.log('LLM Response parsed successfully');
        } catch (e) {
            return res.status(500).json({ error: 'Failed to process AI analysis results. Please retry.' });
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
                candidateProfileId: profile.id,
                title: role,
                company: company,
                description: jobDescription
            }
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

/**
 * POST /api/analyze/gap
 * Compares a job description against the user's profile + achievements.
 * Returns missing skills, strength areas, and quick-win suggestions.
 *
 * Body: { jobDescription: string, keywords?: string[] }
 * Returns: { overallFit, missingKeywords, skillGaps, strengthAreas, quickWins }
 */
router.post('/gap', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { jobDescription, keywords } = req.body as { jobDescription?: string; keywords?: string[] };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required (min 50 chars).' });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: { achievements: true }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        let parsedSkills = { technical: [], industryKnowledge: [], softSkills: [] };
        try {
            parsedSkills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : (profile.skills || parsedSkills);
        } catch {}

        const profileAchievements = profile.achievements
            .map((a: any) => `- ${a.title}: ${a.description}${a.metric ? ` (${a.metric})` : ''}`)
            .join('\n') || 'No achievements recorded.';

        const allProfileSkills = [
            ...(parsedSkills.technical || []),
            ...(parsedSkills.industryKnowledge || []),
            ...(parsedSkills.softSkills || []),
        ].join(', ') || 'Not specified';

        const keywordHint = keywords?.length ? `\nKnown JD keywords: ${keywords.join(', ')}` : '';

        const prompt = `You are a career coach analysing a candidate's readiness for a specific job. Return ONLY valid JSON.

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}${keywordHint}

CANDIDATE PROFILE:
Skills: ${allProfileSkills}
Experience summary: ${profile.professionalSummary || 'Not provided'}

ACHIEVEMENTS:
${profileAchievements}

Analyse the gap between what the JD needs and what the candidate has. Be specific and actionable.

Return this exact JSON:
{
  "overallFit": "STRONG" | "MODERATE" | "WEAK",
  "missingKeywords": ["keyword1", "keyword2"],
  "skillGaps": [
    { "gap": "specific missing skill or experience", "suggestion": "concrete action to address it" }
  ],
  "strengthAreas": ["area1", "area2"],
  "quickWins": ["specific achievement or profile addition that would boost this application"],
  "profileReadiness": number
}

Rules:
- missingKeywords: exact terms from JD not present in achievements or skills (max 8)
- skillGaps: 2-4 genuine gaps, not nitpicks (focus on requirements, not nice-to-haves)
- strengthAreas: 2-4 areas where the candidate genuinely fits
- quickWins: 2-3 specific, actionable additions (e.g. "Add the $2M budget you managed in your PM role")
- profileReadiness: 0-100 score of how complete the profile is relative to this JD`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        res.json({
            overallFit: result.overallFit || 'MODERATE',
            missingKeywords: result.missingKeywords || [],
            skillGaps: result.skillGaps || [],
            strengthAreas: result.strengthAreas || [],
            quickWins: result.quickWins || [],
            profileReadiness: result.profileReadiness ?? 50,
        });

    } catch (err: any) {
        console.error('[Gap Analysis] Error:', err.message);
        res.status(500).json({ error: 'Gap analysis failed.' });
    }
});

/**
 * POST /api/analyze/achievement-suggestions
 * Given a job description and existing achievements, returns 3-5 specific
 * achievement types the candidate should add to boost their profile for this role.
 *
 * Body: { jobDescription: string }
 * Returns: { suggestions: Array<{ title, prompt, example, why }> }
 */
router.post('/achievement-suggestions', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { jobDescription } = req.body as { jobDescription?: string };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: { achievements: { select: { title: true, metric: true, metricType: true } } }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        const existingTitles = profile.achievements.map((a: any) => a.title).join(', ') || 'none';

        const prompt = `You are a career coach helping an Australian job seeker strengthen their achievement bank for a specific role.

JOB DESCRIPTION (first 1500 chars):
${jobDescription.slice(0, 1500)}

EXISTING ACHIEVEMENTS (titles only):
${existingTitles}

Generate 4 specific achievement suggestions — types of evidence the candidate should add to their bank for this role. Each suggestion should be a concrete achievement type that:
1. Directly addresses a requirement in the JD
2. Is NOT already covered by existing achievements
3. Can be documented with a measurable outcome

Return JSON:
{
  "suggestions": [
    {
      "title": "Short label for the achievement type (e.g. 'Cost Reduction Project')",
      "prompt": "One-sentence question to help them recall an example (e.g. 'When did you reduce costs or improve efficiency in a process?')",
      "example": "Example of what a strong achievement of this type looks like (1 sentence with a metric)",
      "why": "Why this type of achievement is relevant to this specific role (1 sentence)"
    }
  ]
}

Return ONLY valid JSON. Generate exactly 4 suggestions.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 5) : [],
        });

    } catch (err: any) {
        console.error('[Achievement Suggestions] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate suggestions.' });
    }
});

export default router;
