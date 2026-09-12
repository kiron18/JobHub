import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { countDistinctJobs, SENT_APPLICATION_FILTER } from './metricHelpers';
import { GOAL_RULES, promoteAndGetSettings, tokenToInstant, appliedToken } from './goals';

/**
 * The daily close-out: once the day's applications are actually done, say so
 * plainly instead of letting the session fizzle out after the last quiet
 * applause.ts toast. Fires once per AEST day, gated server-side so a refresh
 * or a second device never replays it.
 */

const DAY_MS = 86400000;

/**
 * The bar a day has to clear to count toward the streak. Fixed at the
 * program floor rather than the candidate's own goal — same rule as
 * computeStreak in goals.ts, so raising your goal never retroactively
 * breaks a streak you already built at a lower one.
 */
export const DAILY_STREAK_FLOOR = GOAL_RULES.application.dailyMin;

function jobKey(r: { sourceUrl: string | null; id: string }): string {
  return r.sourceUrl ?? `__id:${r.id}`;
}

/** Saturday or Sunday for an AEST calendar-day token. */
function isWeekendToken(token: Date): boolean {
  const day = token.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Consecutive AEST calendar days, ending today, that cleared the daily
 * floor. Weekends are skipped rather than breaking the streak, matching the
 * 5-day working week the program's weekly minimums are built on.
 */
export async function computeDailyStreak(userId: string, days = 60): Promise<number> {
  const today = todayAEST();
  const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);

  const rows = await prisma.jobApplication.findMany({
    where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(firstDay) } },
    select: { sourceUrl: true, id: true, dateApplied: true },
  });

  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.dateApplied) continue;
    const key = appliedToken(r.dateApplied).toISOString();
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(jobKey(r));
  }

  let streak = 0;
  for (let i = 0; i < days; i++) {
    const dayToken = new Date(today.getTime() - i * DAY_MS);
    if (isWeekendToken(dayToken)) continue;
    const count = byDay.get(dayToken.toISOString())?.size ?? 0;
    if (count >= DAILY_STREAK_FLOOR) streak++;
    else break;
  }
  return streak;
}

export interface CloseoutState {
  /** True only on the first check after today's goal is met — never again today. */
  eligible: boolean;
  appliedToday: number;
  goal: number;
  dailyStreak: number;
}

export async function getCloseoutState(userId: string): Promise<CloseoutState> {
  const today = todayAEST();
  const [settings, profile, rows, dailyStreak] = await Promise.all([
    promoteAndGetSettings(userId),
    prisma.candidateProfile.findUnique({ where: { userId }, select: { closeoutSeenDate: true } }),
    prisma.jobApplication.findMany({
      where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(today) } },
      select: { sourceUrl: true, id: true },
    }),
    computeDailyStreak(userId),
  ]);

  const appliedToday = countDistinctJobs(rows);
  // Weekly goals are retired (see goals.ts) — promoteAndGetSettings always
  // returns a daily goal, so it's always the day's real target.
  const goal = settings.appGoal;
  const seenToday = profile?.closeoutSeenDate?.getTime() === today.getTime();

  return { eligible: !seenToday && appliedToday >= goal, appliedToday, goal, dailyStreak };
}

/** Marks today's close-out as shown. Never rolls the marker backwards. */
export async function ackCloseout(userId: string): Promise<void> {
  const today = todayAEST();
  await prisma.candidateProfile.updateMany({
    where: { userId, OR: [{ closeoutSeenDate: null }, { closeoutSeenDate: { lt: today } }] },
    data: { closeoutSeenDate: today },
  });
}
