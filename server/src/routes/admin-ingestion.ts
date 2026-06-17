import { Router } from 'express';
import { prisma } from '../db';
import { EXEMPT_EMAILS } from './stripe';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth';

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

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

const router = Router();
router.get('/summary', requireAdmin, async (_req, res) => {
  res.json(await buildIngestionSummary());
});

export default router;
