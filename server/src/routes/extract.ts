import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';
import { STAGE_1_PROMPT, STAGE_2_PROMPT } from '../services/prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { fetchSeekJobFromUrl, SeekUrlError } from '../services/seekJobUrl';

const router = Router();

router.post('/resume', authenticate, async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Resume text is required' });
    }

    // Scanned / image-only PDF detection
    if (text.trim().length < 100) {
        return res.status(400).json({
            error: "We weren't able to read the text in your PDF \u2014 it looks like it may be a scanned image rather than a text-based document. This is easy to fix: run it through a free OCR tool like smallpdf.com or ilovepdf.com, then re-upload the result. Alternatively, copy and paste your resume text directly into the text box below."
        });
    }

    try {
        console.log('--- Stage 1: Structure Extraction ---');
        let stage1Raw = await callLLM(STAGE_1_PROMPT(text));
        console.log('Raw Stage 1 Output:', stage1Raw);

        let stage1Data: any;
        try {
            stage1Data = parseLLMJson(stage1Raw);
        } catch (e: any) {
            console.error('Failed to parse Stage 1 JSON. Raw output:', stage1Raw);
            throw new Error(`Invalid Stage 1 JSON: ${e.message}`);
        }

        console.log('[extract] education items found:', stage1Data.education?.length ?? 0, JSON.stringify(stage1Data.education ?? []));
        console.log('[extract] experience roles found:', stage1Data.experience?.length ?? 0);
        console.log('[extract] certifications found:', stage1Data.certifications?.length ?? 0);

        console.log('--- Stage 2: Achievement Detection (Per-Role) ---');
        let achievements: any[] = [];

        if (stage1Data.experience && Array.isArray(stage1Data.experience)) {
            for (let i = 0; i < stage1Data.experience.length; i++) {
                const exp = stage1Data.experience[i];
                if (exp.bullets && exp.bullets.length > 0) {
                    console.log(`Analyzing role: ${exp.role} at ${exp.company}`);
                    let stage2Raw = await callLLM(STAGE_2_PROMPT(exp.role, exp.company, exp.bullets));

                    let stage2Data;
                    try {
                        stage2Data = parseLLMJson(stage2Raw);
                    } catch (e: any) {
                        console.error('Failed to parse Stage 2 JSON. Raw output:', stage2Raw);
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
            ...(process.env.NODE_ENV === 'development' && {
                details: error.message,
                stack: error.stack,
            }),
        });
    }
});

/**
 * POST /api/extract/from-url — resolve a pasted Seek link into a job.
 *
 * Deliberately does NOT generate anything. It returns the resolved job so the
 * UI can show the title and company back and let the user confirm before we
 * tailor a resume to it. The silent-wrong-job failure (a search-page URL whose
 * slug names a different role than the job it carries) is the one that costs
 * the user real time, so confirmation is a required step, not a nicety.
 */
router.post('/from-url', authenticate, async (req, res) => {
    const { url } = req.body ?? {};

    if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'Paste a Seek job link to continue.', code: 'not_a_url' });
    }

    try {
        const job = await fetchSeekJobFromUrl(url);
        return res.json({ job });
    } catch (err: any) {
        if (err instanceof SeekUrlError) {
            // 422: we understood the request, the link just isn't usable. The
            // message is written for the user — pass it straight through.
            return res.status(422).json({ error: err.message, code: err.code });
        }
        console.error('[extract/from-url]', err);
        return res.status(500).json({
            error: 'Something went wrong reading that link. Try again, or paste the description instead.',
            code: 'fetch_failed',
        });
    }
});

export default router;
