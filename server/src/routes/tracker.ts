import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
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

/** Monday of the current week in AEST, as midnight-UTC (same convention as todayAEST). */
export function mondayAEST(): Date {
  const today = todayAEST();
  const day = today.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  return new Date(today.getTime() - daysSinceMonday * 86400000);
}

export async function getGoalProgress(userId: string): Promise<{
  goalType: 'daily' | 'weekly'; goal: number; applied: number;
}> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { dailyApplicationGoal: true, applicationGoalType: true },
  });
  const goalType = profile?.applicationGoalType === 'weekly' ? 'weekly' : 'daily';
  const goal = profile?.dailyApplicationGoal ?? 5;
  const since = goalType === 'weekly' ? mondayAEST() : todayAEST();
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: since } },
    select: { sourceUrl: true, id: true },
  });
  return { goalType, goal, applied: countDistinctJobs(rows) };
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
// Populate req.user on every tracker route — without this, req.user is undefined
// and req.user.id throws (500 on /progress and /activity).
router.use(authenticate);
router.get('/progress', async (req: any, res: any) => {
  try { res.json(await getDailyProgress(req.user.id)); }
  catch (e) { console.error('[tracker/progress]', e); res.status(500).json({ error: 'failed' }); }
});
router.get('/activity', async (req: any, res: any) => {
  try { res.json(await getActivity(req.user.id)); }
  catch (e) { console.error('[tracker/activity]', e); res.status(500).json({ error: 'failed' }); }
});
router.get('/goal', async (req: any, res: any) => {
  try { res.json(await getGoalProgress(req.user.id)); }
  catch (e) { console.error('[tracker/goal]', e); res.status(500).json({ error: 'failed' }); }
});
router.post('/goal', async (req: any, res: any) => {
  try {
    const { goalType, goal } = req.body as { goalType?: string; goal?: number };
    if (goalType !== 'daily' && goalType !== 'weekly') {
      return res.status(400).json({ error: 'goalType must be daily or weekly' });
    }
    const count = Math.round(Number(goal));
    if (!Number.isFinite(count) || count < 1 || count > 100) {
      return res.status(400).json({ error: 'goal must be between 1 and 100' });
    }
    await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { applicationGoalType: goalType, dailyApplicationGoal: count },
    });
    res.json(await getGoalProgress(req.user.id));
  } catch (e) { console.error('[tracker/goal:set]', e); res.status(500).json({ error: 'failed' }); }
});
export default router;
