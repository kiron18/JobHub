import { Router } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/requireAdmin';
import { authenticate } from '../middleware/auth';

export async function buildIngestionSummary() {
  const grouped = await prisma.sourceResult.groupBy({
    by: ['source'],
    _sum: { rawCount: true, newCount: true, uniqueCount: true, creditsUsed: true },
  } as any);
  const totalRuns = await prisma.ingestionRun.count();
  return {
    totalRuns,
    sources: (grouped as any[]).map(g => ({
      source: g.source,
      rawCount: g._sum.rawCount ?? 0,
      newCount: g._sum.newCount ?? 0,
      uniqueCount: g._sum.uniqueCount ?? 0,
      creditsUsed: g._sum.creditsUsed ?? 0,
    })),
  };
}

const router = Router();
router.get('/summary', authenticate, requireAdmin, async (_req, res) => {
  res.json(await buildIngestionSummary());
});

export default router;
