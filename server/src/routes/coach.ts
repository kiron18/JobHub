import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { getRealUserIds } from './admin';
import {
    mondayAEST,
    tokenToInstant,
    computeStreak,
    weeklyEquivalent,
    requestGoalChange,
    GoalChangeError,
    WEEKLY_MINIMUM,
    type GoalType,
} from '../services/tracker/goals';

const router = Router();
const DAY_MS = 86400000;

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    const email = (req.user?.email ?? '').toLowerCase();
    if (!email || !EXEMPT_EMAILS.includes(email)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/coach/overview
 * One row per member: this week's numbers vs their goals, streak, the last
 * 4 completed weeks, backdating flags, and goal-change history.
 */
router.get('/overview', async (_req, res) => {
    try {
        const monday = mondayAEST();
        const weeks = 12;
        const firstMonday = new Date(monday.getTime() - (weeks - 1) * 7 * DAY_MS);

        const userIds = await getRealUserIds();
        if (userIds.length === 0) return res.json({ weekStart: monday.toISOString().slice(0, 10), members: [] });

        const [profiles, appRows, outreachRows, pauses, goalChanges, recentCreated, outreachWithStatus, localExpEntries] = await Promise.all([
            prisma.candidateProfile.findMany({
                where: { userId: { in: userIds } },
                select: {
                    userId: true, name: true, email: true,
                    dailyApplicationGoal: true, applicationGoalType: true,
                    dailyOutreachGoal: true, outreachGoalType: true,
                },
            }),
            prisma.jobApplication.findMany({
                where: { userId: { in: userIds }, dateApplied: { gte: firstMonday } },
                select: { userId: true, sourceUrl: true, id: true, dateApplied: true },
            }),
            prisma.outreachLog.findMany({
                where: { userId: { in: userIds }, createdAt: { gte: tokenToInstant(firstMonday) } },
                select: { userId: true, createdAt: true },
            }),
            prisma.pauseWeek.findMany({
                where: { userId: { in: userIds }, weekStart: { gte: firstMonday } },
            }),
            prisma.goalChange.findMany({
                where: { userId: { in: userIds } },
                orderBy: { createdAt: 'desc' },
            }),
            // Backdating check: entries logged in the last 14 days whose applied
            // date is well before the day they were entered.
            prisma.jobApplication.findMany({
                where: {
                    userId: { in: userIds },
                    createdAt: { gte: new Date(Date.now() - 14 * DAY_MS) },
                    dateApplied: { not: null },
                },
                select: { userId: true, createdAt: true, dateApplied: true },
            }),
            // Outreach with status for funnel
            prisma.outreachLog.findMany({
                where: { userId: { in: userIds }, createdAt: { gte: firstMonday } },
                select: { userId: true, status: true, createdAt: true },
            }),
            // Local experience entries
            prisma.localExperienceEntry.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, type: true, organisation: true, role: true, startedAt: true, endedAt: true },
            }),
        ]);

        const weekIndexFromToken = (token: Date) =>
            Math.floor((token.getTime() - firstMonday.getTime()) / (7 * DAY_MS));
        const AEST_OFFSET_MS = 10 * 3600 * 1000;

        const appsByUser = new Map<string, Array<Set<string>>>();
        const outreachByUser = new Map<string, number[]>();
        const ensure = (id: string) => {
            if (!appsByUser.has(id)) {
                appsByUser.set(id, Array.from({ length: weeks }, () => new Set()));
                outreachByUser.set(id, new Array(weeks).fill(0));
            }
        };
        for (const r of appRows) {
            if (!r.dateApplied) continue;
            ensure(r.userId);
            const idx = weekIndexFromToken(r.dateApplied);
            if (idx >= 0 && idx < weeks) appsByUser.get(r.userId)![idx].add(r.sourceUrl ?? `__id:${r.id}`);
        }
        for (const r of outreachRows) {
            ensure(r.userId);
            const token = new Date(Math.floor((r.createdAt.getTime() + AEST_OFFSET_MS) / DAY_MS) * DAY_MS);
            const idx = weekIndexFromToken(token);
            if (idx >= 0 && idx < weeks) outreachByUser.get(r.userId)![idx]++;
        }

        const pausesByUser = new Map<string, Set<string>>();
        for (const p of pauses) {
            if (!pausesByUser.has(p.userId)) pausesByUser.set(p.userId, new Set());
            pausesByUser.get(p.userId)!.add(p.weekStart.toISOString().slice(0, 10));
        }

        const changesByUser = new Map<string, typeof goalChanges>();
        for (const c of goalChanges) {
            if (!changesByUser.has(c.userId)) changesByUser.set(c.userId, []);
            changesByUser.get(c.userId)!.push(c);
        }

        const backdatedByUser = new Map<string, number>();
        for (const r of recentCreated) {
            const appliedInstant = r.dateApplied!.getTime() - AEST_OFFSET_MS;
            if (r.createdAt.getTime() - appliedInstant > 2.5 * DAY_MS) {
                backdatedByUser.set(r.userId, (backdatedByUser.get(r.userId) ?? 0) + 1);
            }
        }

        // Aggregate outreach funnel by user (last 4 weeks + current)
        const outreachFunnelByUser = new Map<string, { sent: number; replied: number; callsBooked: number; referrals: number; closedNoReply: number }>();
        for (const o of outreachWithStatus) {
            const counts = outreachFunnelByUser.get(o.userId) ?? { sent: 0, replied: 0, callsBooked: 0, referrals: 0, closedNoReply: 0 };
            counts.sent++;
            if (o.status === 'REPLIED' || o.status === 'CALL_BOOKED' || o.status === 'REFERRAL') counts.replied++;
            if (o.status === 'CALL_BOOKED') counts.callsBooked++;
            if (o.status === 'REFERRAL') counts.referrals++;
            if (o.status === 'CLOSED_NO_REPLY') counts.closedNoReply++;
            outreachFunnelByUser.set(o.userId, counts);
        }

        // Aggregate local experience by user
        const localExpByUser = new Map<string, Array<{ type: string; organisation: string; role: string; startedAt: Date; endedAt: Date | null }>>();
        const activeLocalExpCountByUser = new Map<string, number>();
        for (const e of localExpEntries) {
            const entries = localExpByUser.get(e.userId) ?? [];
            entries.push({
                type: e.type,
                organisation: e.organisation,
                role: e.role,
                startedAt: e.startedAt,
                endedAt: e.endedAt,
            });
            localExpByUser.set(e.userId, entries);
            if (!e.endedAt) {
                activeLocalExpCountByUser.set(e.userId, (activeLocalExpCountByUser.get(e.userId) ?? 0) + 1);
            }
        }

        const members = profiles.filter(p => !(p.email ?? '').endsWith('@jobhub-test.local')).map(p => {
            ensure(p.userId);
            const weeklyCounts = Array.from({ length: weeks }, (_, i) => {
                const mondayI = new Date(firstMonday.getTime() + i * 7 * DAY_MS);
                const key = mondayI.toISOString().slice(0, 10);
                return {
                    weekStart: key,
                    applications: appsByUser.get(p.userId)![i].size,
                    outreach: outreachByUser.get(p.userId)![i],
                    paused: pausesByUser.get(p.userId)?.has(key) ?? false,
                };
            });
            const currentWeek = weeklyCounts[weeklyCounts.length - 1];
            const lastFour = weeklyCounts.slice(-5, -1).map(w => ({
                ...w,
                hit: w.applications >= WEEKLY_MINIMUM.applications && w.outreach >= WEEKLY_MINIMUM.outreach,
            }));

            const changes = changesByUser.get(p.userId) ?? [];
            const memberChanges90d = changes.filter(c => !c.byCoach && c.createdAt.getTime() > Date.now() - 90 * DAY_MS);
            const pending = changes.find(c => !c.appliedAt && c.effectiveAt.getTime() > Date.now());

            const appTarget = weeklyEquivalent(p.dailyApplicationGoal, (p.applicationGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const outreachTarget = weeklyEquivalent(p.dailyOutreachGoal, (p.outreachGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const missedWeeks = lastFour.filter(w => !w.paused && !w.hit).length;

            return {
                userId: p.userId,
                name: p.name ?? (p.email ?? 'Member').split('@')[0],
                email: p.email,
                goals: {
                    appGoal: p.dailyApplicationGoal,
                    appGoalType: p.applicationGoalType,
                    outreachGoal: p.dailyOutreachGoal,
                    outreachGoalType: p.outreachGoalType,
                    weeklyAppTarget: appTarget,
                    weeklyOutreachTarget: outreachTarget,
                },
                week: {
                    applications: currentWeek.applications,
                    outreach: currentWeek.outreach,
                    paused: currentWeek.paused,
                    onTrackApps: currentWeek.applications >= appTarget,
                    onTrackOutreach: currentWeek.outreach >= outreachTarget,
                },
                streak: computeStreak(weeklyCounts),
                lastFourWeeks: lastFour,
                flags: {
                    missedWeeks,
                    backdatedEntries14d: backdatedByUser.get(p.userId) ?? 0,
                    needsConversation: missedWeeks >= 2,
                },
                goalChanges: {
                    countLast90d: memberChanges90d.length,
                    lastChangeAt: changes[0]?.createdAt.toISOString() ?? null,
                    pending: pending
                        ? {
                            appGoal: pending.appGoal, appGoalType: pending.appGoalType,
                            outreachGoal: pending.outreachGoal, outreachGoalType: pending.outreachGoalType,
                            effectiveAt: pending.effectiveAt.toISOString(),
                        }
                        : null,
                    recent: changes.slice(0, 5).map(c => ({
                        appGoal: c.appGoal, appGoalType: c.appGoalType,
                        outreachGoal: c.outreachGoal, outreachGoalType: c.outreachGoalType,
                        byCoach: c.byCoach, createdAt: c.createdAt.toISOString(),
                        effectiveAt: c.effectiveAt.toISOString(),
                    })),
                },
                pauseWeeks: [...(pausesByUser.get(p.userId) ?? [])].sort(),
                outreachFunnel: outreachFunnelByUser.get(p.userId) ?? { sent: 0, replied: 0, callsBooked: 0, referrals: 0, closedNoReply: 0 },
                localExperience: {
                    activeCount: activeLocalExpCountByUser.get(p.userId) ?? 0,
                    entries: localExpByUser.get(p.userId) ?? [],
                },
            };
        });

        // Members needing attention first, then by weakest current week.
        members.sort((a, b) =>
            Number(b.flags.needsConversation) - Number(a.flags.needsConversation) ||
            (a.week.applications + a.week.outreach) - (b.week.applications + b.week.outreach));

        res.json({ weekStart: monday.toISOString().slice(0, 10), members });
    } catch (e) {
        console.error('[coach/overview]', e);
        res.status(500).json({ error: 'failed' });
    }
});

/**
 * POST /api/admin/coach/pause { userId, weekStart: 'yyyy-mm-dd', reason?, remove? }
 * Grants (or removes) a pause week — that week is skipped by miss/streak logic.
 */
router.post('/pause', async (req, res) => {
    try {
        const { userId, weekStart, reason, remove } = req.body ?? {};
        if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? '')) {
            return res.status(400).json({ error: 'userId and weekStart (yyyy-mm-dd) required' });
        }
        const start = new Date(`${weekStart}T00:00:00.000Z`);
        if (start.getUTCDay() !== 1) return res.status(400).json({ error: 'weekStart must be a Monday' });

        if (remove) {
            await prisma.pauseWeek.deleteMany({ where: { userId, weekStart: start } });
            return res.json({ ok: true, removed: true });
        }
        await prisma.pauseWeek.upsert({
            where: { userId_weekStart: { userId, weekStart: start } },
            create: { userId, weekStart: start, reason: reason ?? null },
            update: { reason: reason ?? null },
        });
        res.json({ ok: true });
    } catch (e) {
        console.error('[coach/pause]', e);
        res.status(500).json({ error: 'failed' });
    }
});

/**
 * POST /api/admin/coach/goals { userId, appGoal, appGoalType, outreachGoal, outreachGoalType, note? }
 * Coach override: applies immediately, bypasses cooldown/lock, audited as byCoach.
 */
router.post('/goals', async (req, res) => {
    try {
        const { userId, appGoal, appGoalType, outreachGoal, outreachGoalType, note } = req.body ?? {};
        if (!userId) return res.status(400).json({ error: 'userId required' });
        await requestGoalChange(
            userId,
            {
                appGoal: Math.round(Number(appGoal)),
                appGoalType,
                outreachGoal: Math.round(Number(outreachGoal)),
                outreachGoalType,
            },
            { byCoach: true, note: note ?? 'coach override' },
        );
        res.json({ ok: true });
    } catch (e) {
        if (e instanceof GoalChangeError) return res.status(e.status).json(e.payload);
        console.error('[coach/goals]', e);
        res.status(500).json({ error: 'failed' });
    }
});

/**
 * POST /api/admin/coach/nudges/run { kind: 'daily_pace'|'weekly_wrap'|'coach_digest', dryRun?: boolean }
 * Manually trigger a nudge run. dryRun defaults to TRUE — it reports who would
 * get what without sending anything. Real sends also require ACCOUNTABILITY_EMAILS=true.
 */
router.post('/nudges/run', async (req, res) => {
    try {
        const { kind, dryRun } = req.body ?? {};
        const opts = { dryRun: dryRun !== false }; // only explicit false sends
        const { runPaceNudges, runWeeklyWraps, runCoachDigest } = await import('../services/accountability/nudges');
        let result;
        if (kind === 'daily_pace') result = await runPaceNudges({ ...opts, force: true });
        else if (kind === 'weekly_wrap') result = await runWeeklyWraps(opts);
        else if (kind === 'coach_digest') result = await runCoachDigest(opts);
        else return res.status(400).json({ error: 'kind must be daily_pace, weekly_wrap or coach_digest' });
        res.json(result);
    } catch (e) {
        console.error('[coach/nudges]', e);
        res.status(500).json({ error: 'failed' });
    }
});

export default router;
