import { Router, type Response, type NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { getRealUserIds } from './admin';
import { countDistinctJobs, SENT_APPLICATION_FILTER } from '../services/tracker/metricHelpers';
import { computeDailyStreakBatch } from '../services/tracker/closeout';
import {
    mondayAEST,
    tokenToInstant,
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
 * The old streak is gone, but a new one replaced it: the daily application
 * streak from services/tracker/closeout.ts (5/day, weekends skipped), which
 * members actually earn in practice. That is now what ranks the board — see
 * the ranking note below.
 */

router.use(authenticate);

/**
 * Leaderboard ranking: current daily streak, first.
 *
 * Volume alone used to be the sort key (one point per application, one per
 * outreach), which rewarded exactly the thing this program doesn't want:
 * someone who blasts 50 applications in one manic day outranked someone doing
 * 5 a day, every day, for two weeks straight. Ranking by streak instead means
 * consistency wins by construction — the 50-in-a-day person gets one day of
 * streak credit, same as the 5-in-a-day person got that day.
 *
 * Points (still one per application, one per outreach) are kept as the
 * tie-break and still shown in their own column, because total effort is
 * real information — it just shouldn't be the thing that decides #1.
 *
 * Interviews and offers still show on the board and still do not rank it:
 * two members can do identical work and land 40 points apart in outcomes
 * because one employer happened to reply. That's demoralising for whoever did
 * everything right, and it rewards luck rather than effort.
 */
const POINTS = { application: 1, outreach: 1 } as const;
const DAY_MS = 86400000;
const STREAK_WEEKS = 26;
const DAILY_STREAK_DAYS = 60;

/**
 * The board is capped at ten ranked names, and a name only takes one of those
 * ten spots by actually clearing a volume floor for the board it's on. The
 * point is competitiveness without deception: someone doing little should
 * never see themselves (or a real client) sitting in the top ten, because
 * that tells them they're already doing fine when they aren't. Below-floor
 * members still get their true rank in "Your rank" — they just don't
 * decorate the shared board.
 *
 * Week's floor is the existing program minimum. All-time's is a first pass —
 * eight weeks of that same minimum, i.e. sustained rather than one hot week.
 * Tune freely; it's just this constant.
 */
const TOP_TEN_SIZE = 10;
const ALL_TIME_MINIMUM = {
    applications: WEEKLY_MINIMUM.applications * 8,
    outreach: WEEKLY_MINIMUM.outreach * 8,
} as const;

function meetsVolumeFloor(e: Pick<LeaderboardEntry, 'applications' | 'outreach'>, period: 'week' | 'all'): boolean {
    const floor = period === 'week' ? WEEKLY_MINIMUM : ALL_TIME_MINIMUM;
    return e.applications >= floor.applications && e.outreach >= floor.outreach;
}

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
    /** Current daily application streak — see services/tracker/closeout.ts. This ranks the board. */
    currentStreak: number;
    goalHit: boolean;
    /**
     * A pace marker rather than a member. Rendered in the board but never
     * ranked against, and always labelled. See PACE_ROWS_WEEK / PACE_ROWS_ALL.
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
 * has actually looked like. The all-time pair scales the same two figures
 * to ALL_TIME_MINIMUM's eight-week window rather than reusing the weekly
 * ones out of context.
 */
const PACE_ROWS_WEEK: Array<{ name: string; applications: number; outreach: number }> = [
    { name: 'A strong week', applications: 35, outreach: 30 },
    { name: 'Program minimum', applications: WEEKLY_MINIMUM.applications, outreach: WEEKLY_MINIMUM.outreach },
];
const PACE_ROWS_ALL: Array<{ name: string; applications: number; outreach: number }> = [
    { name: 'A strong stretch', applications: 280, outreach: 240 },
    { name: 'Program minimum', applications: ALL_TIME_MINIMUM.applications, outreach: ALL_TIME_MINIMUM.outreach },
];

function paceEntries(period: 'week' | 'all'): LeaderboardEntry[] {
    const rows = period === 'week' ? PACE_ROWS_WEEK : PACE_ROWS_ALL;
    return rows.map(p => ({
        rank: 0,
        name: p.name,
        isYou: false,
        applications: p.applications,
        outreach: p.outreach,
        interviews: 0,
        offers: 0,
        points: p.applications * POINTS.application + p.outreach * POINTS.outreach,
        currentStreak: 0,
        goalHit: true,
        isExample: true,
    }));
}

/**
 * Real clients the coach tracks outside the app, entered and kept up to date
 * through /admin/coach/leaderboard (see routes/coach.ts). These rank fully
 * alongside computed rows on both boards — they are real people, just not
 * measured from JobHub's own activity tables.
 */
async function manualEntries(): Promise<LeaderboardEntry[]> {
    const rows = await prisma.manualLeaderboardEntry.findMany({ where: { active: true } });
    return rows.map(r => ({
        rank: 0,
        name: r.displayName,
        isYou: false,
        applications: r.applications,
        outreach: r.outreach,
        interviews: r.interviews,
        offers: r.offers,
        points: r.applications * POINTS.application + r.outreach * POINTS.outreach,
        currentStreak: r.currentStreak,
        goalHit: false,
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

        const [profiles, weeklyMap, dailyStreakMap, manualRows, appRows, outreachCounts, milestoneRows, recentInterviews] = await Promise.all([
            prisma.candidateProfile.findMany({
                where: { userId: { in: userIds } },
                select: {
                    userId: true, name: true, email: true,
                    dailyApplicationGoal: true, applicationGoalType: true,
                    dailyOutreachGoal: true, outreachGoalType: true,
                },
            }),
            getWeeklyCountsBatch(userIds, STREAK_WEEKS),
            computeDailyStreakBatch(userIds, DAILY_STREAK_DAYS),
            manualEntries(),
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
                currentStreak: dailyStreakMap.get(userId) ?? 0,
                goalHit,
            });
        }

        // Manual rows (real clients tracked outside the app) rank fully
        // alongside computed ones, on both boards. Pace rows sit in the
        // ordering too, so you can see where you fall against them, but never
        // take a rank number — a target is not in the race.
        const withPace = [...entries, ...manualRows, ...paceEntries(period)];
        withPace.sort((a, b) =>
            b.currentStreak - a.currentStreak || b.points - a.points || b.interviews - a.interviews || b.applications - a.applications || a.name.localeCompare(b.name));

        let rank = 0;
        for (const e of withPace) {
            if (e.isExample) continue;
            e.rank = ++rank;
        }

        // The visible board: top ten ranked names that actually clear the
        // volume floor, plus the pace rows for reference (they don't count
        // against the cap — see meetsVolumeFloor above). Someone below the
        // floor, or ranked past ten, keeps their real rank (used by "Your
        // rank" below) but doesn't get a row here — unless it's the viewer's
        // own row, which is always pinned in so they can see where they
        // stand, not just that they didn't make it.
        const board: LeaderboardEntry[] = [];
        let shown = 0;
        for (const e of withPace) {
            if (e.isExample) { board.push(e); continue; }
            if (shown >= TOP_TEN_SIZE || !meetsVolumeFloor(e, period)) continue;
            board.push(e);
            shown++;
        }
        if (!board.some(e => e.isYou)) {
            const mine = withPace.find(e => e.isYou);
            if (mine) board.push(mine);
        }

        entries.length = 0;
        entries.push(...board);

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
