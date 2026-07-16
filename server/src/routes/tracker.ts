import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { todayAEST } from '../services/jobFeed';
import { countDistinctJobs, bucketByDay } from '../services/tracker/metricHelpers';
import {
    getGoalState,
    requestGoalChange,
    promoteAndGetSettings,
    GoalChangeError,
    mondayAEST as mondayAESTShared,
} from '../services/tracker/goals';

export async function getDailyProgress(userId: string): Promise<{ appliedToday: number; goal: number }> {
  // promoteAndGetSettings applies any goal change that has become effective.
  const goal = (await promoteAndGetSettings(userId)).appGoal;
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: todayAEST() } },
    select: { sourceUrl: true, id: true },
  });
  return { appliedToday: countDistinctJobs(rows), goal };
}

/** Monday of the current week in AEST, as midnight-UTC (same convention as todayAEST). */
export const mondayAEST = mondayAESTShared;

export async function getGoalProgress(userId: string): Promise<{
  goalType: 'daily' | 'weekly'; goal: number; applied: number;
}> {
  const settings = await promoteAndGetSettings(userId);
  const goalType = settings.appGoalType;
  const goal = settings.appGoal;
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
// Legacy single-goal setter — kept for old clients, but now routed through the
// same floors/cooldown/lock rules as /goals (outreach settings carry over unchanged).
router.post('/goal', async (req: any, res: any) => {
  try {
    const { goalType, goal } = req.body as { goalType?: string; goal?: number };
    const current = await promoteAndGetSettings(req.user.id);
    await requestGoalChange(req.user.id, {
      appGoal: Math.round(Number(goal)),
      appGoalType: goalType as any,
      outreachGoal: current.outreachGoal,
      outreachGoalType: current.outreachGoalType,
    });
    res.json(await getGoalProgress(req.user.id));
  } catch (e) {
    if (e instanceof GoalChangeError) return res.status(e.status).json(e.payload);
    console.error('[tracker/goal:set]', e); res.status(500).json({ error: 'failed' });
  }
});

// Full goal state: both goals, weekly pacing, pending change, lock status, streak.
router.get('/goals', async (req: any, res: any) => {
  try { res.json(await getGoalState(req.user.id)); }
  catch (e) { console.error('[tracker/goals]', e); res.status(500).json({ error: 'failed' }); }
});

// Change both goals. Enforces floors, 14-day cooldown, 3-per-90-days lock,
// and next-Monday effectiveness (first-ever change applies immediately).
router.post('/goals', async (req: any, res: any) => {
  try {
    const { appGoal, appGoalType, outreachGoal, outreachGoalType } = req.body ?? {};
    await requestGoalChange(req.user.id, {
      appGoal: Math.round(Number(appGoal)),
      appGoalType,
      outreachGoal: Math.round(Number(outreachGoal)),
      outreachGoalType,
    });
    res.json(await getGoalState(req.user.id));
  } catch (e) {
    if (e instanceof GoalChangeError) return res.status(e.status).json(e.payload);
    console.error('[tracker/goals:set]', e); res.status(500).json({ error: 'failed' });
  }
});
export default router;

// ── Local Experience Log ─────────────────────────────────────────────────────

import { Prisma } from '@prisma/client';

const localExperienceRouter = Router();
localExperienceRouter.use(authenticate);

// GET /tracker/local-experience - List own entries
localExperienceRouter.get('/local-experience', async (req: any, res: any) => {
  try {
    const entries = await prisma.localExperienceEntry.findMany({
      where: { userId: req.user.id },
      orderBy: { startedAt: 'desc' },
    });
    res.json({ entries });
  } catch (e) {
    console.error('[tracker/local-experience:list]', e);
    res.status(500).json({ error: 'failed' });
  }
});

// POST /tracker/local-experience - Create entry
localExperienceRouter.post('/local-experience', async (req: any, res: any) => {
  try {
    const { type, organisation, role, description, hoursPerWeek, startedAt, endedAt } = req.body ?? {};

    const validTypes = ['VOLUNTEERING', 'TEMP_WORK', 'INTERNSHIP', 'PART_TIME', 'PROJECT', 'COMMUNITY', 'OTHER'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }
    if (!organisation?.trim()) {
      return res.status(400).json({ error: 'organisation is required' });
    }
    if (!role?.trim()) {
      return res.status(400).json({ error: 'role is required' });
    }
    if (!startedAt) {
      return res.status(400).json({ error: 'startedAt is required' });
    }

    const entry = await prisma.localExperienceEntry.create({
      data: {
        userId: req.user.id,
        type: type as Prisma.LocalExperienceEntryCreateInput['type'],
        organisation: organisation.trim(),
        role: role.trim(),
        description: (description ?? '').trim(),
        hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : null,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
      },
    });
    res.json({ ok: true, entry });
  } catch (e) {
    console.error('[tracker/local-experience:create]', e);
    res.status(500).json({ error: 'failed' });
  }
});

// PATCH /tracker/local-experience/:id - Update entry (mainly to set endedAt)
localExperienceRouter.patch('/local-experience/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { organisation, role, description, hoursPerWeek, startedAt, endedAt } = req.body ?? {};

    const existing = await prisma.localExperienceEntry.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const updateData: Prisma.LocalExperienceEntryUpdateInput = {};
    if (organisation !== undefined) updateData.organisation = organisation.trim();
    if (role !== undefined) updateData.role = role.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (hoursPerWeek !== undefined) updateData.hoursPerWeek = hoursPerWeek ? parseInt(hoursPerWeek) : null;
    if (startedAt !== undefined) updateData.startedAt = new Date(startedAt);
    if (endedAt !== undefined) updateData.endedAt = endedAt ? new Date(endedAt) : null;

    const entry = await prisma.localExperienceEntry.update({
      where: { id },
      data: updateData,
    });
    res.json({ ok: true, entry });
  } catch (e) {
    console.error('[tracker/local-experience:update]', e);
    res.status(500).json({ error: 'failed' });
  }
});

// DELETE /tracker/local-experience/:id - Delete entry
localExperienceRouter.delete('/local-experience/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const existing = await prisma.localExperienceEntry.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    await prisma.localExperienceEntry.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[tracker/local-experience:delete]', e);
    res.status(500).json({ error: 'failed' });
  }
});

export { localExperienceRouter };
