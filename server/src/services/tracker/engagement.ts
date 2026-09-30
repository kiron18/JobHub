import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { countDistinctJobs, SENT_APPLICATION_FILTER, isSentStatus } from './metricHelpers';
import { computeStreakState, DAILY_STREAK_FLOOR } from './closeout';
import { appliedToken } from './goals';

/**
 * Everything the dashboard's engagement strip needs, in one round trip.
 *
 * Deliberately one endpoint rather than four client queries: the heading,
 * the ritual line, the squares, the day counter and the tree all describe
 * the same day, and four independently-resolving queries means the strip
 * assembles itself on screen a piece at a time and can briefly show
 * numbers that disagree with each other.
 *
 * Every figure is derived from rows that already exist. Nothing here
 * writes, and nothing here needed a schema change.
 */

const DAY_MS = 86400000;
const PROGRAM_DAYS = 90;
/** Sunday-first, matching WeekStrip and the client's DayCounter. */
export type DayState = 'none' | 'partial' | 'goal' | 'over' | 'future' | 'frozen';

export interface EngagementSummary {
  /** Consecutive days clearing the floor. The program goal decides this,
   *  never the member's own daily target — see dailyTarget.ts. */
  streak: number;
  /** Streak freezes in hand (Duolingo rules, see closeout.ts). */
  streakFreezes: number;
  /** Today already cleared the floor. False = the streak is at risk today. */
  streakTodayDone: boolean;
  /** Applications in a day that count it toward the streak. */
  streakFloor: number;
  /** False until the one-time 90-day intro has been accepted. */
  challengeStarted: boolean;
  /** 1-based day of the 90-day program. */
  programDay: number;
  programLength: number;
  /** Applications actually sent, all time, de-duplicated by source URL. */
  applications: number;
  /** Reached interview at any point, whatever happened after. An interview
   *  is a tag on an application, never a separate pile: ten applications
   *  with three interviews is 10 and 3, not 7 and 3. */
  interviews: number;
  outreach: number;
  /** Distinct days with at least one application sent. */
  daysActive: number;
  /** Seven states, Sunday first. */
  week: DayState[];
  /** Index of today within `week`. */
  todayIndex: number;
  /** Stable per-member seed so the tree is always the same tree. */
  treeSeed: number;
}

/** A stable small integer from the user id — same person, same tree. */
function seedFrom(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 999999;
}

function dayState(count: number, goal: number, future: boolean): DayState {
  if (future) return 'future';
  if (count <= 0) return 'none';
  if (count < goal) return 'partial';
  if (count === goal) return 'goal';
  return 'over';
}

export async function getEngagementSummary(userId: string): Promise<EngagementSummary> {
  const today = todayAEST();
  const sunday = new Date(today.getTime() - today.getUTCDay() * DAY_MS);

  const [streakState, profile, jobs, outreach] = await Promise.all([
    computeStreakState(userId),
    prisma.candidateProfile.findUnique({
      where: { userId },
      // Explicit select, always. A bare include on this table is what took
      // /api/profile down when a column went missing — see dailyTarget.ts.
      select: { createdAt: true, dailyApplicationGoal: true, challengeStartedAt: true },
    }),
    prisma.jobApplication.findMany({
      where: { userId, ...SENT_APPLICATION_FILTER },
      select: { sourceUrl: true, id: true, status: true, dateApplied: true, interviewReachedAt: true },
    }),
    prisma.outreachLog.count({ where: { userId } }),
  ]);

  const goal = profile?.dailyApplicationGoal ?? 5;

  // Day 1 is the day they pressed "Start my 90 days" (the one-time intro,
  // POST /tracker/challenge/start), not the day the account was made: an
  // account opened in June and first used in September is on day 1, not 90.
  // Until they start, the counter shows day 1 and challengeStarted is false,
  // which is what puts the intro in front of them.
  const startedAt = profile?.challengeStartedAt ?? null;
  const elapsed = startedAt ? Math.floor((today.getTime() - appliedToken(startedAt).getTime()) / DAY_MS) : 0;
  const programDay = Math.min(PROGRAM_DAYS, Math.max(1, elapsed + 1));

  const applications = countDistinctJobs(jobs);
  const interviews = jobs.filter(j =>
    j.interviewReachedAt !== null || j.status === 'INTERVIEW' || j.status === 'OFFER',
  ).length;

  // Bucket by AEST day for both the week strip and the active-day count.
  const perDay = new Map<number, number>();
  for (const j of jobs) {
    if (!j.dateApplied || !isSentStatus(j.status)) continue;
    const token = Math.floor((j.dateApplied.getTime() + 10 * 3600 * 1000) / DAY_MS) * DAY_MS;
    perDay.set(token, (perDay.get(token) ?? 0) + 1);
  }
  const daysActive = perDay.size;

  const frozen = new Set(streakState.frozenDays.map(k => new Date(k).getTime()));
  const week: DayState[] = Array.from({ length: 7 }, (_, i) => {
    const d = sunday.getTime() + i * DAY_MS;
    if (frozen.has(d)) return 'frozen';
    return dayState(perDay.get(d) ?? 0, goal, d > today.getTime());
  });

  return {
    streak: streakState.streak,
    streakFreezes: streakState.freezes,
    streakTodayDone: streakState.todayDone,
    streakFloor: DAILY_STREAK_FLOOR,
    challengeStarted: !!startedAt,
    programDay,
    programLength: PROGRAM_DAYS,
    applications,
    interviews,
    outreach,
    daysActive,
    week,
    todayIndex: today.getUTCDay(),
    treeSeed: seedFrom(userId),
  };
}
