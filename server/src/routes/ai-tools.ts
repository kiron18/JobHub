/**
 * /api/analyze — AI-powered writing tools
 *
 * POST /polish-achievement      Rewrite a rough achievement into polished STAR format
 * POST /email-cover-letter      Condense cover letter into email body + subject
 * POST /profile-advisor         Grade profile A-D with 5 prioritised improvements
 * POST /notes-actions           Extract follow-up action items from job notes
 */
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { callLLM, callClaude } from '../services/llm';
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

/**
 * POST /job-facts — the role title and employer, read out of a pasted job ad.
 *
 * These two strings name the tracker row, get stamped on exported filenames,
 * and are written into the follow-up and outreach emails that go to the
 * employer. They were previously guessed with a regex, which produced a real
 * email reading "I applied for the [role] role at venues": the pattern matched
 * "experience working at venues" and took the noun as the company.
 *
 * A model reads an ad the way a person does, which is what this needs. It is a
 * small, cheap, temperature-zero call and the client keeps its own instant
 * fallback, so a failure here costs accuracy and never blocks the application.
 */
router.post('/job-facts', async (req: any, res: any) => {
    try {
        const { jobDescription } = req.body as { jobDescription?: string };
        if (!jobDescription || jobDescription.trim().length < 50) {
            return res.status(400).json({ error: 'Job description required.' });
        }

        const prompt = `Read this job advertisement and return the role title and the employer.

Rules:
- Use ONLY what the advertisement actually says. Never infer, complete or guess a name.
- "title" is the advertised role, exactly as written, with no seniority or department invented.
- "company" is the ORGANISATION HIRING. It is not the recruitment agency posting on their behalf, not a location, not a venue, not a client the role serves, and not a generic noun that happened to follow the word "at".
- Many ads genuinely do not name the employer, for example when a recruiter lists it confidentially. That is normal and expected. Return null for company in that case.
- "agency" is the recruitment agency or consultancy that posted the ad, when the ad names one. Most ads have none, and an ad posted by the employer directly has none. If the ad names the agency but hides the employer, that is exactly the case this field exists for. Return null when no agency is named.
- Return null for anything the ad does not state. A null is correct and useful; a plausible guess is worse than nothing because it will be sent to that employer in an email.

Return JSON only:
{ "title": "<the role, or null>", "company": "<the hiring organisation, or null>", "agency": "<the recruitment agency that posted it, or null>" }

JOB ADVERTISEMENT:
"""
${jobDescription.slice(0, 12000)}
"""`;

        const raw = await callLLM(prompt, true);
        const result = parseLLMJson(raw);

        const clean = (value: unknown): string | null => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            if (!trimmed || trimmed.length > 120) return null;
            // Models reach for these when asked to return null in prose form.
            if (/^(null|none|n\/a|not (stated|specified|provided|listed)|unknown|confidential)$/i.test(trimmed)) return null;
            return trimmed;
        };

        return res.json({
            title: clean(result.title),
            company: clean(result.company),
            agency: clean(result.agency),
        });
    } catch (err: any) {
        console.error('[Job Facts] Error:', err.message);
        res.status(500).json({ error: 'Failed to read the job ad.' });
    }
});

/**
 * POST /follow-up-email — the 7-day follow-up, written against this application.
 *
 * The template version filled in the role, employer, date and sign-off and said
 * nothing whatsoever about the candidate, which made every follow-up every
 * client sent identical. The material to fix that is already sitting on the
 * row: the advert, and the cover letter generated against it.
 *
 * Note what this must NOT do. The employer already has the cover letter, so
 * lifting a paragraph out of it verbatim reads as copy-paste and is worse than
 * the generic version. It has to make the point again in fresh, shorter words.
 *
 * The doctrine from module 05 holds and is enforced in the prompt: a follow-up
 * confirms the application arrived and does not ask for the job. Every extra
 * line is a line that can be held against the candidate.
 */
router.post('/follow-up-email', async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const { jobApplicationId } = req.body as { jobApplicationId?: string };
        if (!jobApplicationId) return res.status(400).json({ error: 'jobApplicationId required.' });

        const job = await prisma.jobApplication.findFirst({
            where: { id: jobApplicationId, userId },
            select: {
                title: true, company: true, description: true, dateApplied: true,
                documents: {
                    where: { type: 'COVER_LETTER' },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: { content: true },
                },
            },
        });
        if (!job) return res.status(404).json({ error: 'Application not found.' });

        const coverLetter = job.documents[0]?.content;
        if (!coverLetter) {
            // Nothing to personalise from. The caller keeps the filled template,
            // which is a worse email but an honest one.
            return res.json({ body: null, reason: 'no_cover_letter' });
        }

        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            select: { name: true, phone: true, email: true },
        });

        const applied = job.dateApplied
            ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
                .format(job.dateApplied)
            : null;

        const prompt = `Write a short follow-up email for an Australian job seeker checking on an application they already submitted.

WHAT THIS EMAIL IS
It confirms the application arrived and reminds the reader, in one specific line, why this candidate is worth a look. It is NOT a second application and it does NOT ask for the job, for an interview, or for a decision. Every extra line is a line that can be held against the candidate.

HARD RULES
- 3 short paragraphs maximum. Under 120 words in the body. Shorter is better.
- The reader ALREADY HAS the cover letter. Never reuse a sentence or phrase from it. Make the point again in different, shorter words.
- Every fact about the candidate must come from the cover letter below. Never invent an employer, a number, a title or an outcome. If the cover letter has no number, do not produce one.
- Name the specific thing that connects this candidate to this role. One line. Concrete, not "I am a strong fit" or "my skills align".
- No flattery, no "I am passionate", no "I believe I would be a great fit", no "I look forward to hearing from you", no "thank you for your time and consideration".
- Australian English. No em dashes or en dashes anywhere, use commas or rewrite.
- Do not write the greeting line and do not write the sign-off. Return the body paragraphs only. Those are added around your text.

THE ROLE: ${job.title}
THE EMPLOYER: ${job.company}
${applied ? `APPLIED ON: ${applied}` : ''}

THE JOB ADVERTISEMENT:
"""
${(job.description || '').slice(0, 6000)}
"""

THE COVER LETTER THEY ALREADY SENT (source of every fact, and text to avoid repeating):
"""
${coverLetter.slice(0, 6000)}
"""

Return JSON only:
{ "body": "<the paragraphs, separated by \\n\\n>" }`;

        const raw = await callLLM(prompt, true, 0.3);
        const result = parseLLMJson(raw);
        const body = typeof result.body === 'string' ? result.body.trim() : null;
        if (!body) return res.json({ body: null, reason: 'empty' });

        return res.json({
            body,
            signature: [profile?.name, [profile?.phone, profile?.email].filter(Boolean).join(' | ')]
                .filter(Boolean),
        });
    } catch (err: any) {
        console.error('[Follow-up Email] Error:', err.message);
        res.status(500).json({ error: 'Failed to write the follow-up.' });
    }
});

export default router;
