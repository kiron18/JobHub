/**
 * /api/analyze — core job analysis routes
 *
 * POST /job                    Full match analysis against profile + Pinecone
 * POST /gap                    Skills gap between JD and profile
 * POST /achievement-suggestions  What achievements to add for a given JD
 * POST /jd-summary             Structured metadata extracted from a JD
 */
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { callLLM } from '../services/llm';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { searchAchievements } from '../services/vector';
import { JOB_ANALYSIS_PROMPT } from '../services/prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { addGrades, computeComposite } from '../services/compositeScoring';
import { EXEMPT_EMAILS } from './stripe';
import type { DimensionScores } from '../services/compositeScoring';

const router = Router();

// Apply rate limit AFTER authenticate has populated req.user
router.use(authenticate, analyzeRateLimit);

router.post('/job', async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        console.log('--- Job Analysis Started ---');
        const { jobDescription } = req.body;

        if (!jobDescription || jobDescription.trim().length < 50) {
            return res.status(400).json({ error: 'Job description is too short (min 50 chars).' });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId } as any,
            include: { achievements: true }
        }) as any;

        if (!profile) {
            return res.status(404).json({ error: 'Please set up your profile first.' });
        }

        // ── Access control ────────────────────────────────────────────────────────
        const userEmail = ((req as any).user?.email ?? '').toLowerCase();
        const { checkAccess } = await import('../middleware/accessControl');
        const access = await checkAccess(userId, 'analysis', userEmail);
        if (!access.allowed) {
          return res.status(402).json({
            error: 'Analysis limit reached',
            upgradeRequired: true,
            remaining: 0,
          });
        }
        // ─────────────────────────────────────────────────────────────────────────

        let parsedSkills = { technical: [], industryKnowledge: [], softSkills: [] };
        try {
            parsedSkills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : (profile.skills || parsedSkills);
        } catch {
            console.warn('Failed to parse profile skills, using defaults');
        }

        let matches: any[] = [];
        try {
            matches = await searchAchievements(userId, jobDescription, 12);
        } catch (err: any) {
            console.error('Pinecone Search Failed:', err.message);
        }

        const achievementsText = (matches && matches.length > 0)
            ? matches.map((match: any) => {
                const meta = match.metadata || {};
                return `ID: ${match.id} | Title: ${meta.title || 'Unknown'} | Text: ${meta.text || ''} | Metric: ${meta.metric || 'N/A'}`;
            }).join('\n---\n')
            : 'No achievements found in the bank.';

        const identityCards: Array<{ label: string; summary: string }> =
            Array.isArray(profile.identityCards) ? profile.identityCards : [];

        const analysisPrompt = JOB_ANALYSIS_PROMPT(
            jobDescription,
            { ...profile, skills: parsedSkills },
            achievementsText,
            identityCards
        );

        let analysisRaw;
        try {
            analysisRaw = await callLLMWithRetry(analysisPrompt, true);
        } catch (err: any) {
            console.error('LLM Call Failed:', err.message);
            return res.status(503).json({ error: 'Career Coach AI is currently unavailable. Please try again in 30 seconds.' });
        }

        let analysis;
        try {
            analysis = parseLLMJson(analysisRaw);
        } catch {
            return res.status(500).json({ error: 'Failed to process AI analysis results. Please retry.' });
        }

        // --- Dimensional scoring (server-side composite) ---
        let dimensions: DimensionScores | undefined;
        let overallGrade: string | undefined;
        let computedMatchScore: number = analysis.matchScore ?? 50;

        if (analysis.dimensions && typeof analysis.dimensions === 'object') {
            try {
                dimensions = addGrades(analysis.dimensions);
                const composite = computeComposite(dimensions);
                overallGrade = composite.overallGrade;
                computedMatchScore = composite.matchScore;
            } catch (err: any) {
                console.error('[Analyze] Composite scoring failed:', err.message);
            }
        }

        const australianFlags = analysis.australianFlags ?? {
            apsLevel: null,
            requiresCitizenship: false,
            securityClearanceRequired: 'none',
            salaryType: 'unknown',
        };

        const citizenshipWarning: boolean =
            australianFlags.requiresCitizenship === true &&
            profile.visaStatus !== null &&
            profile.visaStatus !== 'Australian Citizen';

        const matchedIdentityCard: string | null = analysis.matchedIdentityCard ?? null;

        let finalRanked = [];
        try {
            const { rankAchievements } = require('../services/generation');
            const detailedAchievements = await rankAchievements(userId, jobDescription, analysis.keywords || []);
            finalRanked = detailedAchievements.map((ach: any) => {
                const llmMatch = (analysis.rankedAchievements || []).find((la: any) => la.id === ach.id);
                return { ...ach, reason: llmMatch?.reason || 'Relevant to your professional background.' };
            });
        } catch (err: any) {
            console.error('Ranking service failed, falling back:', err.message);
            finalRanked = (analysis.rankedAchievements || []).map((a: any) => ({ ...a, tier: a.tier || 'MODERATE' }));
        }

        const hasSufficientEvidence = finalRanked.filter((a: any) => a.tier === 'STRONG').length >= 3;

        const company = analysis.extractedMetadata?.company || analysis.company || 'Unknown Company';
        const role = analysis.extractedMetadata?.role || analysis.role || 'Unknown Position';

        let jobApplication;
        try {
            jobApplication = await prisma.jobApplication.create({
                data: {
                    userId,
                    candidateProfileId: profile.id,
                    title: role,
                    company,
                    description: jobDescription,
                    dimensions: dimensions as any ?? undefined,
                    overallGrade: overallGrade ?? undefined,
                    matchedIdentityCard: matchedIdentityCard ?? undefined,
                    australianFlags: australianFlags as any,
                }
            });
        } catch (err: any) {
            console.error('Database Save Failed (JobApplication):', err.message);
        }

        res.json({
            jobApplicationId: jobApplication?.id ?? null,
            matchScore: computedMatchScore,
            overallGrade: overallGrade ?? null,
            dimensions: dimensions ?? null,
            matchedIdentityCard,
            australianFlags,
            citizenshipWarning,
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
        res.status(500).json({ error: 'Analysis failed due to a server error.' });
    }
});

router.post('/gap', async (req: any, res: any) => {
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
- skillGaps: 2-4 genuine gaps, not nitpicks
- strengthAreas: 2-4 areas where the candidate genuinely fits
- quickWins: 2-3 specific, actionable additions
- profileReadiness: 0-100`;

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

router.post('/achievement-suggestions', async (req: any, res: any) => {
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

Generate 4 specific achievement suggestions — types of evidence the candidate should add to their bank for this role. Each suggestion should directly address a JD requirement, not already be covered, and be documentable with a measurable outcome.

Return JSON:
{
  "suggestions": [
    {
      "title": "Short label for the achievement type",
      "prompt": "One-sentence question to help them recall an example",
      "example": "Example of a strong achievement of this type (1 sentence with a metric)",
      "why": "Why this achievement is relevant to this specific role (1 sentence)"
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

router.post('/jd-summary', async (req: any, res: any) => {
    try {
        const { jobDescription } = req.body as { jobDescription?: string };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

        const prompt = `Parse this job description and extract structured metadata. Only extract information explicitly stated.

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Return JSON:
{
  "roleType": "Individual Contributor | Manager | Senior Manager | Executive | Team Lead | Specialist | Graduate/Entry Level",
  "experienceYears": "e.g. '3-5 years' or null if not stated",
  "keySkills": ["up to 8 most critical skills/tools explicitly required"],
  "arrangement": "On-site | Hybrid | Remote | Flexible | null",
  "employmentType": "Full-time | Part-time | Contract | Casual | Fixed-term | null",
  "salaryMentioned": "exact salary/range text from JD or null",
  "closingDate": "application closing date if mentioned, or null",
  "securityClearance": "clearance level required or null"
}

Return ONLY valid JSON. Use null for anything not explicitly in the JD.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json(result);

    } catch (err: any) {
        console.error('[JD Summary] Error:', err.message);
        res.status(500).json({ error: 'Failed to parse job description.' });
    }
});

export default router;
