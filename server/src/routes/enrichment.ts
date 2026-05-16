import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../index';
import { callLLM } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { buildQuestionPrompt, buildParseAnswerPrompt } from '../services/prompts/enrichmentPrompts';

const router = Router();
router.use(authenticate);

/**
 * POST /api/enrichment/questions
 * Body: { jobDescription: string, achievementIds: string[] }
 * Returns: { questions: Array<{ achievementId, question, title, text }> }
 */
router.post('/questions', async (req: any, res: any) => {
  try {
    const { jobDescription, achievementIds } = req.body as {
      jobDescription?: string;
      achievementIds?: string[];
    };

    if (!jobDescription || !Array.isArray(achievementIds) || achievementIds.length === 0) {
      return res.status(400).json({ error: 'jobDescription and achievementIds are required.' });
    }

    const userId = req.user.id;
    const achievements = await prisma.achievement.findMany({
      where: { id: { in: achievementIds }, candidateProfile: { userId } } as any,
    });

    const questions = await Promise.all(
      achievements.map(async (a: any) => {
        const prompt = buildQuestionPrompt({
          achievementTitle: a.title ?? '',
          achievementText: a.description ?? '',
          jobDescription,
        });
        const q = (await callLLM(prompt, false)) as string;
        return {
          achievementId: a.id,
          question: (q ?? '').trim().slice(0, 300),
          title: a.title ?? '',
          text: a.description ?? '',
        };
      })
    );

    res.json({ questions });
  } catch (err: any) {
    console.error('[enrichment/questions] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to generate questions.' });
  }
});

/**
 * POST /api/enrichment/parse-answer
 * Body: { achievementId, question, userAnswer }
 * Returns: { metric: string | null, rewrittenText: string }
 *
 * Does NOT persist. Frontend shows the parsed result for confirmation; on
 * confirm, frontend PATCHes /achievements/:id with the metric directly.
 */
router.post('/parse-answer', async (req: any, res: any) => {
  try {
    const { achievementId, question, userAnswer } = req.body as {
      achievementId?: string;
      question?: string;
      userAnswer?: string;
    };

    if (!achievementId || !question || !userAnswer) {
      return res.status(400).json({ error: 'achievementId, question, and userAnswer are required.' });
    }

    const userId = req.user.id;
    const achievement = await prisma.achievement.findFirst({
      where: { id: achievementId, candidateProfile: { userId } } as any,
    }) as any;
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });

    const prompt = buildParseAnswerPrompt({
      question,
      originalText: achievement.description ?? '',
      userAnswer,
    });

    const raw = await callLLM(prompt, true);
    let parsed: { metric?: string | null; rewrittenText?: string } = {};
    try {
      parsed = parseLLMJson(raw as string) ?? {};
    } catch {
      parsed = {};
    }

    res.json({
      metric: parsed?.metric ?? null,
      rewrittenText: parsed?.rewrittenText ?? userAnswer.trim(),
    });
  } catch (err: any) {
    console.error('[enrichment/parse-answer] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to parse answer.' });
  }
});

export default router;
