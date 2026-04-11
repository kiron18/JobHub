/**
 * /api/analyze — AI-powered writing tools
 *
 * POST /polish-achievement      Rewrite a rough achievement into polished STAR format
 * POST /interview-questions     Generate 8 likely interview Qs with talking points
 * POST /email-cover-letter      Condense cover letter into email body + subject
 * POST /profile-advisor         Grade profile A-D with 5 prioritised improvements
 * POST /notes-actions           Extract follow-up action items from job notes
 */
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { callLLM } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

const router = Router();
router.use(authenticate, analyzeRateLimit);

router.post('/polish-achievement', async (req: any, res: any) => {
    try {
        const { title, description, metric, skills } = req.body as {
            title?: string; description?: string; metric?: string; skills?: string;
        };

        if (!description || description.length < 10) {
            return res.status(400).json({ error: 'Description required.' });
        }

        const prompt = `You are a professional resume writer helping an Australian job seeker polish a career achievement into a compelling, metrics-rich STAR-format bullet.

CURRENT ACHIEVEMENT:
Title: ${title || '(none)'}
Description: ${description}
Metric: ${metric || '(none provided)'}
Skills: ${skills || '(none tagged)'}

Rules:
1. Situation → Action → Result structure in the description
2. Title: strong verb + quantified impact (e.g. "Reduced customer onboarding time by 40%")
3. If a metric is in the description, extract and standardise it (%, $, count, time saved)
4. If NO metric exists, suggest a realistic placeholder (e.g. "[X]% improvement")
5. Australian English spelling
6. Description under 150 words
7. Do NOT fabricate specifics not hinted at in the original

Return JSON:
{
  "polishedTitle": "Strong verb + quantified impact title",
  "polishedDescription": "Concise STAR-format description under 150 words",
  "suggestedMetric": "Extracted or suggested metric string, or null",
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

router.post('/interview-questions', async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { jobDescription } = req.body as { jobDescription?: string };

        if (!jobDescription || jobDescription.length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

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

Generate exactly 8 interview questions the hiring manager is most likely to ask. Mix types: behavioral, situational, role-specific, motivation. For each question, provide 2-3 STAR-structured talking points.

Return JSON:
{
  "questions": [
    {
      "question": "Exact question the interviewer might ask",
      "type": "behavioral" | "situational" | "role-specific" | "motivation",
      "talkingPoints": ["Point 1", "Point 2", "Point 3"],
      "why": "One sentence explaining why interviewers ask this for this role"
    }
  ]
}

Return ONLY valid JSON. Exactly 8 questions. Order: 2 behavioral, 2 situational, 2 role-specific, 1 motivation, 1 wildcard.`;

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

router.post('/email-cover-letter', async (req: any, res: any) => {
    try {
        const { coverLetterContent, role, company, candidateName } = req.body as {
            coverLetterContent?: string; role?: string; company?: string; candidateName?: string;
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
1. A professional email subject line (format: "Application — [Role] | [Name]")
2. A condensed email body (maximum 150 words) that:
   - Opens with a direct statement of purpose (no "I am writing to...")
   - Hits the 2-3 strongest points from the cover letter
   - References the attachment ("Please find my resume and cover letter attached")
   - Closes with a clear call to action
   - Australian English, no waffling

Return JSON:
{
  "emailSubject": "Subject line text",
  "emailBody": "Full email body text (plain text, no markdown)"
}

Return ONLY valid JSON.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        if (!result.emailSubject || !result.emailBody) {
            return res.status(500).json({ error: 'Email generation failed.' });
        }

        return res.json({ emailSubject: result.emailSubject, emailBody: result.emailBody });

    } catch (err: any) {
        console.error('[Email Cover Letter] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate email version.' });
    }
});

router.post('/profile-advisor', async (req: any, res: any) => {
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

        // ── Daily rate limit ─────────────────────────────────────────────
        const maxCalls = parseInt(process.env.MAX_DAILY_PROFILE_ANALYSES ?? '3', 10);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const lastDate = (profile as any).profileAdvisorCallsDate;
        const isToday = lastDate && new Date(lastDate) >= today;
        const callsToday = isToday ? (profile as any).profileAdvisorCallsToday : 0;

        if (callsToday >= maxCalls) {
            return res.status(429).json({ error: 'DAILY_LIMIT_REACHED', callsToday, limit: maxCalls });
        }
        // ── End rate limit ───────────────────────────────────────────────

        const achievementSummary = profile.achievements.slice(0, 10).map((a: any) =>
            `- "${a.title}" (metric: ${a.metric || 'MISSING'}, desc: ${a.description?.length ?? 0} chars)`
        ).join('\n') || 'No achievements.';

        const experienceSummary = profile.experience.slice(0, 5).map((e: any) =>
            `- ${e.role} at ${e.company} (${e.startDate}–${e.isCurrent ? 'Present' : e.endDate ?? '?'}): ${e.description ? e.description.length + ' chars' : 'NO DESCRIPTION'}`
        ).join('\n') || 'No experience.';

        const prompt = `You are a career coach reviewing an Australian job seeker's profile for AI document generation quality.

TARGET ROLE: ${targetRole || (profile as any).targetRole || 'Not specified'}

PROFILE SUMMARY:
Name: ${profile.name || 'MISSING'}
Email: ${profile.email || 'MISSING'}
Location: ${(profile as any).location || 'MISSING'}
Professional Summary: ${profile.professionalSummary ? profile.professionalSummary.length + ' chars' : 'MISSING'}
Skills: ${profile.skills ? 'Present' : 'MISSING'}

EXPERIENCE ENTRIES (${profile.experience.length}):
${experienceSummary}

EDUCATION ENTRIES: ${profile.education.length}
CERTIFICATIONS: ${profile.certifications.length}

ACHIEVEMENTS (${profile.achievements.length}):
${achievementSummary}

Identify the top 5 most impactful improvements. Be specific — not "add metrics" but "achievement 'Led the product redesign' has no metric — add the impact (conversion rate, adoption %, revenue)".

Return JSON:
{
  "overallGrade": "A" | "B" | "C" | "D",
  "summary": "One sentence assessment of current generation quality",
  "improvements": [
    {
      "area": "Category (Achievements | Experience | Summary | Skills)",
      "issue": "What's specifically wrong or missing",
      "fix": "Exactly what they should add or change",
      "impact": "Which document types this will improve",
      "priority": 1 to 5
    }
  ]
}

Return ONLY valid JSON. Exactly 5 improvements, ordered by priority (1 = most urgent).`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        // Increment counter
        await prisma.candidateProfile.update({
            where: { userId },
            data: {
                profileAdvisorCallsToday: callsToday + 1,
                profileAdvisorCallsDate: new Date(),
            },
        });

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

router.post('/notes-actions', async (req: any, res: any) => {
    try {
        const { notes, jobTitle, company, status } = req.body;

        if (!notes || notes.trim().length < 20) {
            return res.status(400).json({ error: 'notes must be at least 20 characters.' });
        }

        const prompt = `You are a job search coach. Extract actionable follow-up items from these job application notes.

JOB: ${jobTitle || 'Unknown'} at ${company || 'Unknown'}
STATUS: ${status || 'Unknown'}

NOTES:
${notes}

Extract 2-4 specific action items — things the candidate needs to DO before or during their next step.

Return JSON:
{
  "actions": [
    {
      "text": "<clear, specific action to take>",
      "type": "follow-up" | "prepare" | "research" | "deadline",
      "urgency": "high" | "medium" | "low"
    }
  ]
}

Return ONLY valid JSON with 2-4 actions. If no actionable items exist, return { "actions": [] }.`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        return res.json({
            actions: Array.isArray(result.actions) ? result.actions.slice(0, 4) : [],
        });

    } catch (err: any) {
        console.error('[Notes Actions] Error:', err.message);
        res.status(500).json({ error: 'Failed to extract actions.' });
    }
});

export default router;
