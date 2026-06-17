import { Router } from 'express';
import { prisma } from '../index';
import { todayAEST } from '../services/jobFeed';
import { countDistinctJobs, bucketByDay } from '../services/tracker/metricHelpers';

export async function getDailyProgress(userId: string): Promise<{ appliedToday: number; goal: number }> {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { dailyApplicationGoal: true } });
  const goal = profile?.dailyApplicationGoal ?? 5;
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: todayAEST() } },
    select: { sourceUrl: true, id: true },
  });
  return { appliedToday: countDistinctJobs(rows), goal };
}

export async function getActivity(userId: string, days = 365): Promise<Array<{ date: string; count: number }>> {
  const since = new Date(todayAEST().getTime() - (days - 1) * 86400000);
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: since } },
    select: { sourceUrl: true, id: true, dateApplied: true },
  });
  return bucketByDay(rows as any, days, todayAEST());
}

const router = Router();
// Apply the SAME auth middleware job-feed.ts uses (req.user.id must be populated):
router.get('/progress', async (req: any, res: any) => {
  try { res.json(await getDailyProgress(req.user.id)); }
  catch (e) { console.error('[tracker/progress]', e); res.status(500).json({ error: 'failed' }); }
});
router.get('/activity', async (req: any, res: any) => {
  try { res.json(await getActivity(req.user.id)); }
  catch (e) { console.error('[tracker/activity]', e); res.status(500).json({ error: 'failed' }); }
});
export default router;
