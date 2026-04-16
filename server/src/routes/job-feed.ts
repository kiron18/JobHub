import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import {
  buildDailyFeed,
  generateBullets,
  findAddressee,
  todayAEST,
  type RawJob,
} from '../services/jobFeed';
import { scoreJobForFeed } from '../services/jobAnalysis';

const router = Router();

// All routes require auth
router.use(authenticate);

// Helper: check dashboardAccess
async function requirePremium(userId: string, res: Response): Promise<boolean> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { dashboardAccess: true },
  });
  if (!profile?.dashboardAccess) {
    res.status(403).json({ error: 'Premium access required' });
    return false;
  }
  return true;
}

// GET /api/job-feed/feed?offset=0
router.get('/feed', async (req: any, res: any) => {
  const userId = req.user.id;
  const offset = parseInt((req.query.offset as string) || '0', 10);
  const today = todayAEST();

  try {
    if (!(await requirePremium(userId, res))) return;
    // Lazy fetch if no jobs for today
    const count = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });
    if (count === 0) {
      try {
        await buildDailyFeed(userId);
      } catch (err: any) {
        // Profile incomplete — surface message but don't 500
        if (err.message?.includes('Profile incomplete')) {
          return res.json({ jobs: [], total: 0, hasMore: false, feedDate: today.toISOString().slice(0, 10), profileIncomplete: true });
        }
        throw err;
      }
    }

    const total = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });
    const items = await prisma.jobFeedItem.findMany({
      where: { userId, feedDate: today },
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: 10,
    });

    // Generate bullets for any items that don't have them
    const nullBulletItems = items.filter(i => i.bullets === null);
    if (nullBulletItems.length > 0) {
      const rawJobs = nullBulletItems.map(i => ({
        title: i.title,
        company: i.company,
        location: i.location ?? '',
        salary: i.salary,
        description: i.description,
        sourceUrl: i.sourceUrl,
        sourcePlatform: i.sourcePlatform,
        postedAt: i.postedAt,
      })) as RawJob[];

      const bulletArrays = await generateBullets(rawJobs);

      await Promise.all(
        nullBulletItems.map((item, idx) =>
          bulletArrays[idx]
            ? prisma.jobFeedItem.update({
                where: { id: item.id },
                data: { bullets: bulletArrays[idx] },
              })
            : Promise.resolve()
        )
      );

      // Merge generated bullets into response
      for (const item of items) {
        const idx = nullBulletItems.findIndex(n => n.id === item.id);
        if (idx !== -1 && bulletArrays[idx]) {
          (item as any).bullets = bulletArrays[idx];
        }
      }
    }

    // Mark as read (fire and forget)
    prisma.jobFeedItem
      .updateMany({
        where: { id: { in: items.map(i => i.id) } },
        data: { isRead: true },
      })
      .catch(() => {/* silent */});

    return res.json({
      jobs: items,
      total,
      hasMore: offset + items.length < total,
      feedDate: today.toISOString().slice(0, 10),
    });
  } catch (err: any) {
    console.error('[job-feed/feed]', err);
    return res.status(500).json({ error: 'Failed to load job feed' });
  }
});

// POST /api/job-feed/refresh
router.post('/refresh', async (req: any, res: any) => {
  const userId = req.user.id;
  const today = todayAEST();

  try {
    if (!(await requirePremium(userId, res))) return;
    const newest = await prisma.jobFeedItem.findFirst({
      where: { userId, feedDate: today },
      orderBy: { createdAt: 'desc' },
    });

    if (newest) {
      const ageSeconds = Math.floor((Date.now() - newest.createdAt.getTime()) / 1000);
      if (ageSeconds < 3600) {
        return res.status(400).json({
          error: 'Feed refreshed recently. Try again later.',
          retryAfter: 3600 - ageSeconds,
        });
      }
    }

    await buildDailyFeed(userId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[job-feed/refresh]', err);
    return res.status(500).json({ error: 'Failed to refresh feed' });
  }
});

// POST /api/job-feed/:id/score
router.post('/:id/score', analyzeRateLimit, async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    if (item.matchScore !== null) {
      return res.json({ matchScore: item.matchScore, matchDetails: item.matchDetails });
    }

    const result = await scoreJobForFeed(userId, item.description);

    await prisma.jobFeedItem.update({
      where: { id },
      data: { matchScore: result.matchScore, matchDetails: result.matchDetails as any },
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[job-feed/score]', err);
    return res.status(500).json({ error: 'Scoring failed — try again shortly.' });
  }
});

// POST /api/job-feed/:id/find-addressee
router.post('/:id/find-addressee', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    // Return cached if already searched (addresseeSource is set even when no name found)
    if (item.addresseeSource !== null) {
      return res.json({
        suggestedAddressee: item.suggestedAddressee,
        addresseeTitle: item.addresseeTitle,
        addresseeConfidence: item.addresseeConfidence,
        addresseeSource: item.addresseeSource,
      });
    }

    const suggestion = await findAddressee(item.company, item.title, item.description);

    const update = suggestion
      ? {
          suggestedAddressee: suggestion.name,
          addresseeTitle: suggestion.title,
          addresseeConfidence: suggestion.confidence,
          addresseeSource: suggestion.source,
        }
      : {
          // Store empty string as sentinel so we don't re-search next time
          suggestedAddressee: '',
          addresseeTitle: '',
          addresseeConfidence: 'low' as const,
          addresseeSource: 'web-search' as const,
        };

    await prisma.jobFeedItem.update({ where: { id }, data: update });

    return res.json({
      suggestedAddressee: suggestion?.name ?? null,
      addresseeTitle: suggestion?.title ?? null,
      addresseeConfidence: suggestion?.confidence ?? null,
      addresseeSource: suggestion?.source ?? null,
    });
  } catch (err: any) {
    console.error('[job-feed/find-addressee]', err);
    return res.json({
      suggestedAddressee: null,
      addresseeTitle: null,
      addresseeConfidence: null,
      addresseeSource: null,
    });
  }
});

// POST /api/job-feed/:id/save
router.post('/:id/save', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const jobApp = await prisma.jobApplication.create({
      data: {
        userId,
        candidateProfileId: profile.id,
        title: item.title,
        company: item.company,
        description: item.description,
        notes: `Source: ${item.sourceUrl}`,
        status: 'SAVED',
      },
    });

    await prisma.jobFeedItem.update({ where: { id }, data: { isSaved: true } });

    return res.json({ jobApplicationId: jobApp.id });
  } catch (err: any) {
    console.error('[job-feed/save]', err);
    return res.status(500).json({ error: 'Failed to save job' });
  }
});

export default router;
