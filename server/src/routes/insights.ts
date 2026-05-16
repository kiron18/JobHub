import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/insights/application-pattern
 *
 * Returns where the user is applying (clusters of role titles) and where
 * their resume is actually competitive (top job-feed matches by score).
 * Used by the Strategic Intelligence card after they've sent ≥ 1 application.
 *
 * No industry data exists in the schema, so the "applied to" panel surfaces
 * title clusters rather than industry/seniority buckets. Honest given the data.
 */
router.get('/application-pattern', async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const applications = await prisma.jobApplication.findMany({
      where: {
        candidateProfile: { userId },
        status: { not: 'SAVED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Cluster by normalised title.
    const buckets = new Map<string, { title: string; count: number }>();
    for (const app of applications) {
      const title = (app.title ?? '').trim();
      if (!title) continue;
      const key = title.toLowerCase();
      const existing = buckets.get(key);
      if (existing) existing.count++;
      else buckets.set(key, { title, count: 1 });
    }

    const competitiveJobs = await prisma.jobFeedItem.findMany({
      where: { userId, matchScore: { not: null } },
      orderBy: { matchScore: 'desc' },
      take: 5,
    });

    res.json({
      appliedTo: Array.from(buckets.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      competitiveFor: competitiveJobs.map(j => ({
        jobTitle: j.title ?? '',
        company: j.company ?? '',
        matchScore: j.matchScore ?? 0,
      })),
      applicationsTotal: applications.length,
    });
  } catch (err: any) {
    console.error('[insights/application-pattern] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to compute application pattern.' });
  }
});

export default router;
