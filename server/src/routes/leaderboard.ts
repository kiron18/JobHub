import { Router, type Response, type NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { getRealUserIds } from './admin';
import { countDistinctJobs, SENT_APPLICATION_FILTER } from '../services/tracker/metricHelpers';
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

/*
 * Open to everyone again.
 *
 * It was closed because every row reported streak 0 and nobody had ever earned
 * the weekly bonus: a streak needed 20 applications AND 20 outreach in one
 * week, and across all users and all time there were 44 outreach rows. A board
 * with a permanently dead column reads as broken software, which is the last
 * thing you want in front of a paying cohort.
 *
 * Both of the things that were broken are gone rather than fixed. The streak
 * column no longer exists, and the weekly bonus no longer scores. What is left
 * is two numbers everybody actually generates.
 */

router.use(authenticate);

/**
 * Leaderboard scoring: one point per application, one per outreach.
 *
 * Interviews used to be worth 15 and offers 40, which meant the board ranked
 * people by outcomes they do not control. Two members can do identical work all
 * week and finish 40 points apart because one employer happened to reply. That
 * is demoralising for the person who did everything right, and it rewards luck.
 *
 * So points are effort, and effort only. Interviews and offers still show on
 * the board, in their own columns, because seeing somebody land one is the best
 * motivation on the page. They just do not move the ranking.
 */
const POINTS = { application: 1, outreach: 1 } as const;
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
    goalHit: boolean;
    /**
     * A pace marker rather than a member. Rendered in the board but never
     * ranked against, and always labelled. See PACE_ROWS.
     */
    isExample?: boolean;
}

/**
 * Pace rows.
 *
 * The board is thin while the cohort is small, and a leaderboard with three
 * names on it reads as a room with nobody in it. These fill it out.
 *
 * They are targets, not people, and that is deliberate. Inventing members
 * would work right up until somebody asks on a call who Priya M is and why
 * she has never been on one, and in a cohort this size that is a matter of
 * weeks. A target does the same motivating job without anything to find out:
 * "you: 7, program minimum: 20" tells you where you stand AND what to do,
 * which a fake rival never does.
 *
 * Both numbers are real. 20 and 20 is the program minimum enforced in
 * services/tracker/goals.ts. The strong week is what the top of the board
 * has actually looked like.
 */
const PACE_ROWS: Array<{ name: string; applications: number; outreach: number }> = [
    { name: 'A strong week', applications: 35, outreach: 30 },
    { name: 'Program minimum', applications: 20, outreach: 20 },
];

function paceEntries(): LeaderboardEntry[] {
    return PACE_ROWS.map(p => ({
        rank: 0,
        name: p.name,
        isYou: false,
        applications: p.applications,
        outreach: p.outreach,
        interviews: 0,
        offers: 0,
        points: p.applications * POINTS.application + p.outreach * POINTS.outreach,
        goalHit: true,
        isExample: true,
    }));
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
                    where: { userId: { in: userIds }, ...SENT_APPLICATION_FILTER },
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

            const appTarget = weeklyEquivalent(profile.dailyApplicationGoal, (profile.applicationGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const outreachTarget = weeklyEquivalent(profile.dailyOutreachGoal, (profile.outreachGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType);
            const goalHit = currentWeek.applications >= appTarget && currentWeek.outreach >= outreachTarget;

            const applications = period === 'week'
                ? currentWeek.applications
                : countDistinctJobs(allAppsByUser.get(userId) ?? []);
            const outreach = period === 'week'
                ? currentWeek.outreach
                : (allOutreachByUser.get(userId) ?? 0);

            const points =
                applications * POINTS.application +
                outreach * POINTS.outreach;

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
                goalHit,
            });
        }

        // Pace rows sit in the ordering so you can see where you fall against
        // them, but they never take a rank number: a target is not in the race.
        const withPace = period === 'week' ? [...entries, ...paceEntries()] : entries;
        withPace.sort((a, b) =>
            b.points - a.points || b.interviews - a.interviews || b.applications - a.applications || a.name.localeCompare(b.name));

        let rank = 0;
        for (const e of withPace) {
            if (e.isExample) continue;
            e.rank = ++rank;
        }
        entries.length = 0;
        entries.push(...withPace);

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
