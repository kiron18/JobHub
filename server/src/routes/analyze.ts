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

/**
 * POST /api/analyze/polish-achievement
 * Takes a rough achievement and returns a polished STAR-format version.
 *
 * Body: { title, description, metric?, skills? }
 * Returns: { polishedTitle, polishedDescription, suggestedMetric?, reasoning }
 */
router.post('/polish-achievement', authenticate, async (req: any, res: any) => {
    try {
        const { title, description, metric, skills } = req.body as {
            title?: string;
            description?: string;
            metric?: string;
            skills?: string;
        };

        if (!description || description.length < 10) {
            return res.status(400).json({ error: 'Description required.' });
        }

        const prompt = `You are a professional resume writer helping an Australian job seeker polish a career achievement into a compelling, metrics-rich STAR-format bullet for their achievement bank.

CURRENT ACHIEVEMENT:
Title: ${title || '(none)'}
Description: ${description}
Metric: ${metric || '(none provided)'}
Skills: ${skills || '(none tagged)'}

Your task: rewrite this achievement to be strong, specific, and quantified. Follow these rules:
1. Situation → Action → Result structure in the description
2. Start the title with a strong verb and include the impact (e.g. "Reduced customer onboarding time by 40%")
3. If a metric is mentioned in the description, extract and standardise it (%, $, count, time saved)
4. If NO metric is mentioned, suggest a realistic metric placeholder the user should fill in (e.g. "[X]% improvement")
5. Australian English spelling
6. Keep description under 150 words — tight and punchy
7. Do NOT fabricate specifics that aren't hinted at in the original

Return JSON:
{
  "polishedTitle": "Strong verb + quantified impact title",
  "polishedDescription": "Concise STAR-format description under 150 words",
  "suggestedMetric": "Extracted or suggested metric string, or null if can't determine",
  "reasoning": "One sentence explaining what you changed and why"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        if (!result.polishedTitle || !result.polishedDescription) {
            return res.status(500).json({ error: 'Polish failed — unexpected LLM response.' });
        }

        return res.json({
            polishedTitle: result.polishedTitle,
            polishedDescription: result.polishedDescription,
            suggestedMetric: result.suggestedMetric || null,
            reasoning: result.reasoning || '',
        });

    } catch (err: any) {
        console.error('[Polish Achievement] Error:', err.message);
        res.status(500).json({ error: 'Failed to polish achievement.' });
    }
});

/**
 * POST /api/analyze/interview-questions
 * Extracts the top 8 likely interview questions for a role, with STAR talking points.
 *
 * Body: { jobDescription: string }
 * Returns: { questions: Array<{ question, type, talkingPoints, why }> }
 */
router.post('/interview-questions', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { jobDescription } = req.body as { jobDescription?: string };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

        // Get profile achievements for context
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: { achievements: { select: { title: true, metric: true } } }
        });
        const achievementTitles = profile?.achievements.slice(0, 12).map((a: any) => a.title).join('; ') || 'none';

        const prompt = `You are an expert career coach preparing an Australian job seeker for an interview.

JOB DESCRIPTION (first 2000 chars):
${jobDescription.slice(0, 2000)}

CANDIDATE'S ACHIEVEMENT BANK (titles):
${achievementTitles}

Generate exactly 8 interview questions the hiring manager is most likely to ask for this specific role. Mix the question types:
- behavioral (past experience: "Tell me about a time when...")
- situational (hypothetical: "What would you do if...")
- role-specific (technical/domain knowledge)
- motivation (why this role/company)

For each question, provide 2-3 STAR-structured talking points the candidate should hit in their answer, drawing on the role requirements.

Return JSON:
{
  "questions": [
    {
      "question": "Exact question the interviewer might ask",
      "type": "behavioral" | "situational" | "role-specific" | "motivation",
      "talkingPoints": ["Point 1 — what to cover", "Point 2 — what to cover", "Point 3 — what to cover"],
      "why": "One sentence explaining why interviewers ask this for this role"
    }
  ]
}

Return ONLY valid JSON. Generate exactly 8 questions. Order: 2 behavioral, 2 situational, 2 role-specific, 1 motivation, 1 wildcard.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            questions: Array.isArray(result.questions) ? result.questions.slice(0, 8) : [],
        });

    } catch (err: any) {
        console.error('[Interview Questions] Error:', err.message);
        res.status(500).json({ error: 'Failed to extract interview questions.' });
    }
});

/**
 * POST /api/analyze/jd-summary
 * Parses a job description and returns structured metadata.
 *
 * Body: { jobDescription: string }
 * Returns: { roleType, experienceYears, keySkills, arrangement, employmentType, salaryMentioned, closingDate? }
 */
router.post('/jd-summary', authenticate, async (req: any, res: any) => {
    try {
        const { jobDescription } = req.body as { jobDescription?: string };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

        const prompt = `Parse this job description and extract structured metadata. Be precise — only extract information that is explicitly stated.

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Return JSON:
{
  "roleType": "Individual Contributor | Manager | Senior Manager | Executive | Team Lead | Specialist | Graduate/Entry Level",
  "experienceYears": "e.g. '3-5 years' or '5+ years' or null if not stated",
  "keySkills": ["up to 8 most critical skills/tools explicitly required"],
  "arrangement": "On-site | Hybrid | Remote | Flexible | null",
  "employmentType": "Full-time | Part-time | Contract | Casual | Fixed-term | null",
  "salaryMentioned": "exact salary/range text from JD or null",
  "closingDate": "application closing date if mentioned, or null",
  "securityClearance": "clearance level required or null"
}

Return ONLY valid JSON. Use null for anything not explicitly in the JD — do not infer.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json(result);

    } catch (err: any) {
        console.error('[JD Summary] Error:', err.message);
        res.status(500).json({ error: 'Failed to parse job description.' });
    }
});

/**
 * POST /api/analyze/email-cover-letter
 * Condenses a full cover letter into an email-appropriate body + subject line.
 *
 * Body: { coverLetterContent: string, role?: string, company?: string, candidateName?: string }
 * Returns: { emailSubject, emailBody }
 */
router.post('/email-cover-letter', authenticate, async (req: any, res: any) => {
    try {
        const { coverLetterContent, role, company, candidateName } = req.body as {
            coverLetterContent?: string;
            role?: string;
            company?: string;
            candidateName?: string;
        };

        if (!coverLetterContent || coverLetterContent.length < 100) {
            return res.status(400).json({ error: 'Cover letter content required.' });
        }

        const prompt = `You are helping an Australian job seeker convert a formal cover letter into a concise email application.

COVER LETTER:
${coverLetterContent.slice(0, 3000)}

ROLE: ${role || 'the advertised position'}
COMPANY: ${company || 'the organisation'}
CANDIDATE NAME: ${candidateName || 'the candidate'}

Generate:
1. A professional email subject line (format: "Application — [Role] | [Name]" or "Expression of Interest — [Role]" for unadvertised)
2. A condensed email body (maximum 150 words) that:
   - Opens with a direct statement of purpose (no "I am writing to...")
   - Hits the 2-3 strongest points from the original cover letter
   - References the attachment ("Please find my resume and cover letter attached")
   - Closes with a clear call to action
   - Australian English, no waffling

Return JSON:
{
  "emailSubject": "Subject line text",
  "emailBody": "Full email body text (plain text, no markdown formatting — this goes in an email client)"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        if (!result.emailSubject || !result.emailBody) {
            return res.status(500).json({ error: 'Email generation failed.' });
        }

        return res.json({
            emailSubject: result.emailSubject,
            emailBody: result.emailBody,
        });

    } catch (err: any) {
        console.error('[Email Cover Letter] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate email version.' });
    }
});

/**
 * POST /api/analyze/profile-advisor
 * Analyses the user's profile and returns specific, prioritised improvements.
 *
 * Body: { targetRole?: string }
 * Returns: { overallGrade, improvements: Array<{ area, issue, fix, impact, priority }> }
 */
router.post('/profile-advisor', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { targetRole } = req.body as { targetRole?: string };

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                achievements: { select: { id: true, title: true, metric: true, description: true } },
                experience: { select: { role: true, company: true, startDate: true, endDate: true, isCurrent: true, description: true } },
                education: { select: { institution: true, degree: true } },
                certifications: { select: { name: true } },
            }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        const achievementSummary = profile.achievements.slice(0, 10).map((a: any) => {
            const hasMetric = !!a.metric;
            const descLen = a.description?.length ?? 0;
            return `- "${a.title}" (metric: ${hasMetric ? a.metric : 'MISSING'}, desc: ${descLen} chars)`;
        }).join('\n') || 'No achievements.';

        const experienceSummary = profile.experience.slice(0, 5).map((e: any) =>
            `- ${e.role} at ${e.company} (${e.startDate}–${e.isCurrent ? 'Present' : e.endDate ?? '?'}): ${e.description ? e.description.length + ' chars' : 'NO DESCRIPTION'}`
        ).join('\n') || 'No experience.';

        const prompt = `You are a career coach reviewing an Australian job seeker's profile database for generation quality.

TARGET ROLE: ${targetRole || profile.targetRole || 'Not specified'}

PROFILE SUMMARY:
Name: ${profile.name || 'MISSING'}
Email: ${profile.email || 'MISSING'}
Location: ${profile.location || 'MISSING'}
Professional Summary: ${profile.professionalSummary ? profile.professionalSummary.length + ' chars' : 'MISSING'}
Skills: ${profile.skills ? 'Present' : 'MISSING'}

EXPERIENCE ENTRIES (${profile.experience.length}):
${experienceSummary}

EDUCATION ENTRIES: ${profile.education.length}
CERTIFICATIONS: ${profile.certifications.length}

ACHIEVEMENTS (${profile.achievements.length}):
${achievementSummary}

Identify the top 5 most impactful improvements this person should make to their profile to get better AI-generated documents. Be specific — "add metrics to your achievements" is too generic; "achievement 'Led the product redesign' has no metric — add the impact (e.g. conversion rate improvement, user adoption %, revenue impact)" is good.

Return JSON:
{
  "overallGrade": "A" | "B" | "C" | "D",
  "summary": "One sentence assessment of the profile's current generation quality",
  "improvements": [
    {
      "area": "Category (e.g. Achievements, Experience, Summary, Skills)",
      "issue": "What's specifically wrong or missing",
      "fix": "Exactly what they should add or change (be specific)",
      "impact": "Which document types this will improve (e.g. 'Resume + Cover Letter')",
      "priority": 1 to 5 (1 = most urgent)
    }
  ]
}

Return ONLY valid JSON. Generate exactly 5 improvements, ordered by priority (1 first).`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            overallGrade: result.overallGrade || 'C',
            summary: result.summary || '',
            improvements: Array.isArray(result.improvements) ? result.improvements.slice(0, 5) : [],
        });

    } catch (err: any) {
        console.error('[Profile Advisor] Error:', err.message);
        res.status(500).json({ error: 'Failed to analyse profile.' });
    }
});

// ── ATS Coverage ──────────────────────────────────────────────────────────────
// Analyse a generated document against the JD to surface keyword gaps.
router.post('/ats-coverage', authenticate, async (req: any, res: any) => {
    try {
        const { document, jobDescription, docType } = req.body;
        if (!document || !jobDescription) {
            return res.status(400).json({ error: 'document and jobDescription are required.' });
        }

        const prompt = `You are an ATS (Applicant Tracking System) keyword expert for Australian employers.

DOCUMENT TYPE: ${docType || 'resume'}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

SUBMITTED DOCUMENT:
${document.slice(0, 4000)}

Task: Identify the most important ATS keywords from the job description and check whether they appear (verbatim or semantically equivalent) in the submitted document.

Focus on:
- Job title variants and role keywords
- Required technical skills, tools, frameworks, platforms
- Certifications, qualifications, degrees mentioned
- Key action verbs that appear in the JD
- Industry-specific terminology
- Soft skills that are explicitly called out (not generic ones)

Exclude: company name, salary details, location, generic filler words.

Return JSON exactly:
{
  "score": <integer 0-100 representing % of key terms covered>,
  "matched": [<terms found in document — max 12>],
  "missing": [<important terms NOT found — max 10, prioritised by importance>],
  "quickFixes": [<2-3 specific sentence-level suggestions to add missing terms naturally>]
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            score: typeof result.score === 'number' ? Math.min(100, Math.max(0, result.score)) : 50,
            matched: Array.isArray(result.matched) ? result.matched.slice(0, 12) : [],
            missing: Array.isArray(result.missing) ? result.missing.slice(0, 10) : [],
            quickFixes: Array.isArray(result.quickFixes) ? result.quickFixes.slice(0, 3) : [],
        });

    } catch (err: any) {
        console.error('[ATS Coverage] Error:', err.message);
        res.status(500).json({ error: 'Failed to analyse ATS coverage.' });
    }
});

// ── Tone Rewrite ───────────────────────────────────────────────────────────────
// Rewrite a paragraph in a target tone without changing substance.
router.post('/tone-rewrite', authenticate, async (req: any, res: any) => {
    try {
        const { text, tone, context } = req.body;
        if (!text || !tone) {
            return res.status(400).json({ error: 'text and tone are required.' });
        }

        const toneDescriptions: Record<string, string> = {
            confident: 'authoritative and self-assured, using strong active verbs, avoiding hedging language like "helped" or "assisted"',
            concise: 'tight and direct — cut every unnecessary word, no filler phrases, max impact per word',
            formal: 'professional Australian business register, suitable for government or corporate roles',
            warm: 'approachable and personable while remaining professional, slight conversational tone',
            technical: 'precise technical language appropriate for a specialist or engineering audience',
        };

        const toneDesc = toneDescriptions[tone] || tone;

        const prompt = `You are an expert Australian professional copywriter.

CONTEXT: ${context || 'Professional job application document'}

REQUESTED TONE: ${toneDesc}

ORIGINAL TEXT:
${text}

Rewrite this text in the requested tone. Keep all factual content, achievements, and claims intact — only change the voice, word choice, and sentence structure.

Return JSON exactly:
{
  "rewritten": "<rewritten text>",
  "changes": "<one sentence describing the key changes made>"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            rewritten: result.rewritten || text,
            changes: result.changes || '',
        });

    } catch (err: any) {
        console.error('[Tone Rewrite] Error:', err.message);
        res.status(500).json({ error: 'Failed to rewrite tone.' });
    }
});

export default router;

