import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { getRealUserIds } from './admin';
import { countDistinctJobs } from '../services/tracker/metricHelpers';
import {
    mondayAEST,
    tokenToInstant,
    computeStreak,
    weeklyEquivalent,
    getWeeklyCountsBatch,
    WEEKLY_MINIMUM,
    type GoalType,
} from '../services/tracker/goals';

const router = Router();
router.use(authenticate);

/**
 * Leaderboard scoring. Applications and outreach are volume; interviews and
 * offers are outcomes and dominate the board. A weekly bonus rewards hitting
 * both program minimums in a week.
 */
const POINTS = { application: 1, outreach: 1, interview: 15, offer: 40, weeklyGoalBonus: 10 } as const;
const DAY_MS = 86400000;
const STREAK_WEEKS = 26;

function displayName(name: string | null, email: string | null): string {
    const n = (name ?? '').trim();
    if (n) {
        const parts = n.split(/\s+/);
        if (parts.length === 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
    }
    return (email ?? 'Member').split('@')[0];
}

export interface LeaderboardEntry {
    rank: number;
    name: string;
    isYou: boolean;
    applications: number;
    outreach: number;
    interviews: number;
    offers: number;
    points: number;
    streak: number;
    goalHit: boolean;
}

// GET /api/leaderboard?period=week|all
router.get('/', async (req: any, res: any) => {
    try {
        const period: 'week' | 'all' = req.query.period === 'all' ? 'all' : 'week';
        const monday = mondayAEST();
        const mondayInstant = tokenToInstant(monday);

        const userIds = await getRealUserIds();
        if (userIds.length === 0) return res.json({ period, weekStart: monday.toISOString().slice(0, 10), entries: [], highlights: [] });

        const [profiles, weeklyMap, appRows, outreachCounts, milestoneRows, recentInterviews] = await Promise.all([
            prisma.candidateProfile.findMany({
                where: { userId: { in: userIds } },
                select: {
                    userId: true, name: true, email: true,
                    dailyApplicationGoal: true, applicationGoalType: true,
                    dailyOutreachGoal: true, outreachGoalType: true,
                },
            }),
            getWeeklyCountsBatch(userIds, STREAK_WEEKS),
            period === 'all'
                ? prisma.jobApplication.findMany({
                    where: { userId: { in: userIds }, dateApplied: { not: null } },
                    select: { userId: true, sourceUrl: true, id: true },
                })
                : Promise.resolve(null),
            period === 'all'
                ? prisma.outreachLog.groupBy({
                    by: ['userId'],
                    where: { userId: { in: userIds } },
                    _count: { _all: true },
                })
                : Promise.resolve(null),
            prisma.jobApplication.findMany({
                where: {
                    userId: { in: userIds },
                    ...(period === 'week'
                        ? { OR: [{ interviewReachedAt: { gte: mondayInstant } }, { offerReachedAt: { gte: mondayInstant } }] }
                        : { interviewReachedAt: { not: null } }),
                },
                select: { userId: true, interviewReachedAt: true, offerReachedAt: true },
            }),
            // Interview callouts: interviews reached in the last 7 days.
            prisma.jobApplication.findMany({
                where: { userId: { in: userIds }, interviewReachedAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
                select: { userId: true, title: true, company: true, interviewReachedAt: true },
                orderBy: { interviewReachedAt: 'desc' },
                take: 10,
            }),
        ]);

        // Automated flow-test accounts live in the DB as real auth users — keep them off the board.
        const realProfiles = profiles.filter(p => !(p.email ?? '').endsWith('@jobhub-test.local'));
        const profileByUser = new Map(realProfiles.map(p => [p.userId, p]));

        // All-time totals (only fetched for period=all)
        const allAppsByUser = new Map<string, Array<{ sourceUrl: string | null; id: string }>>();
        if (appRows) {
            for (const r of appRows) {
                if (!allAppsByUser.has(r.userId)) allAppsByUser.set(r.userId, []);
                allAppsByUser.get(r.userId)!.push(r);
            }
        }
        const allOutreachByUser = new Map<string, number>(
            (outreachCounts ?? []).map((g: any) => [g.userId, g._count._all]),
        );

        const milestonesByUser = new Map<string, { interviews: number; offers: number }>();
        for (const m of milestoneRows) {
            if (!milestonesByUser.has(m.userId)) milestonesByUser.set(m.userId, { interviews: 0, offers: 0 });
            const entry = milestonesByUser.get(m.userId)!;
            if (period === 'week') {
                if (m.interviewReachedAt && m.interviewReachedAt >= mondayInstant) entry.interviews++;
                if (m.offerReachedAt && m.offerReachedAt >= mondayInstant) entry.offers++;
            } else {
                if (m.interviewReachedAt) entry.interviews++;
                if (m.offerReachedAt) entry.offers++;
            }
        }

        const entries: LeaderboardEntry[] = [];
        for (const userId of userIds) {
            const profile = profileByUser.get(userId);
            if (!profile) continue; // never onboarded — nothing to rank

            const weekly = weeklyMap.get(userId)!;
            const currentWeek = weekly[weekly.length - 1];
            const milestones = milestonesByUser.get(userId) ?? { interviews: 0, offers: 0 };
            const streak = computeStreak(weekly);

            const appTarget = weeklyEquivalent(profile.dailyApplicationGoal, (profile.applicationGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const outreachTarget = weeklyEquivalent(profile.dailyOutreachGoal, (profile.outreachGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const goalHit = currentWeek.applications >= appTarget && currentWeek.outreach >= outreachTarget;

            const applications = period === 'week'
                ? currentWeek.applications
                : countDistinctJobs(allAppsByUser.get(userId) ?? []);
            const outreach = period === 'week'
                ? currentWeek.outreach
                : (allOutreachByUser.get(userId) ?? 0);

            const minimumsHitWeeks = period === 'week'
                ? (currentWeek.applications >= WEEKLY_MINIMUM.applications && currentWeek.outreach >= WEEKLY_MINIMUM.outreach ? 1 : 0)
                : weekly.filter(w => !w.paused && w.applications >= WEEKLY_MINIMUM.applications && w.outreach >= WEEKLY_MINIMUM.outreach).length;

            const points =
                applications * POINTS.application +
                outreach * POINTS.outreach +
                milestones.interviews * POINTS.interview +
                milestones.offers * POINTS.offer +
                minimumsHitWeeks * POINTS.weeklyGoalBonus;

            if (period === 'all' && points === 0) continue; // hide totally inactive accounts

            entries.push({
                rank: 0,
                name: displayName(profile.name, profile.email),
                isYou: userId === req.user.id,
                applications,
                outreach,
                interviews: milestones.interviews,
                offers: milestones.offers,
                points,
                streak,
                goalHit,
            });
        }

        entries.sort((a, b) =>
            b.points - a.points || b.interviews - a.interviews || b.applications - a.applications || a.name.localeCompare(b.name));
        entries.forEach((e, i) => { e.rank = i + 1; });

        const highlights = recentInterviews.map(r => {
            const p = profileByUser.get(r.userId);
            return {
                name: p ? displayName(p.name, p.email) : 'Member',
                title: r.title,
                company: r.company,
                when: r.interviewReachedAt?.toISOString() ?? null,
            };
        });

        res.json({ period, weekStart: monday.toISOString().slice(0, 10), entries, highlights });
    } catch (e) {
        console.error('[leaderboard]', e);
        res.status(500).json({ error: 'failed' });
    }
});

export default router;
