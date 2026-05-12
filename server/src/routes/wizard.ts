/**
 * /api/wizard — Wizard step utilities
 *
 * POST /step-feedback   Return 1-2 sentences of personalized coaching feedback for a wizard step
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { callLLM } from '../services/llm';

const router = Router();
router.use(authenticate);

const STEP_CONTEXT: Record<string, string> = {
  summary: 'professional summary section',
  experience: 'work experience section',
  achievements: 'achievements section',
  education: 'education section',
  certifications: 'certifications section',
  volunteering: 'volunteering section',
  skills: 'skills section',
};

/**
 * POST /wizard/step-feedback
 * Returns 1-2 sentences of personalized coaching feedback for a wizard step.
 */
router.post('/step-feedback', async (req: any, res: any) => {
  try {
    const { stepType, content } = req.body as { stepType?: string; content?: any };

    if (!stepType || !content) {
      return res.status(400).json({ error: 'stepType and content are required.' });
    }

    const sectionLabel = STEP_CONTEXT[stepType] || 'profile section';
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    const prompt = `You are a concise job application coach reviewing one section of a job seeker's profile.

Section: ${sectionLabel}
Content submitted:
${contentStr.slice(0, 1200)}

Write exactly 1-2 sentences of specific, honest coaching feedback about what they just submitted. Reference something they actually wrote. If there is a strong metric or specific outcome, acknowledge it. If something is vague, note what would strengthen it. Be direct and encouraging. Do not start with "Great!" or hollow praise. Output only the feedback text, no labels or preamble.`;

    const feedback = await callLLM(prompt, false);
    const trimmed = (feedback as string).trim().slice(0, 300);

    return res.json({ feedback: trimmed });
  } catch (err: any) {
    console.error('[wizard/step-feedback] error:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to generate feedback.' });
  }
});

export default router;
