import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { countDistinctJobs, SENT_APPLICATION_FILTER } from './metricHelpers';
import { GOAL_RULES, promoteAndGetSettings, tokenToInstant, appliedToken } from './goals';
import { OUTREACH_PER_MISSING_APPLICATION } from './dailyTarget';

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
 * Streak freezes, Duolingo rules:
 *   - a missed working day spends a freeze automatically, and the streak
 *     survives it without growing;
 *   - no freeze left, the streak resets to zero;
 *   - a freeze is only spent protecting a live streak, never on a day when
 *     there was nothing to protect;
 *   - everyone starts with one, earns one for every FREEZE_EARN_EVERY days
 *     cleared in a row, and holds at most FREEZE_MAX;
 *   - today is never a miss while it is still today. It counts the moment
 *     the floor is cleared, and until then the streak is "at risk", not gone.
 * Weekends neither count nor break, as before.
 *
 * Derived from application history alone, replayed from the start of the
 * window, so there is no freeze inventory to store or drift out of step.
 */
export const FREEZE_START = 1;
export const FREEZE_EARN_EVERY = 5;
export const FREEZE_MAX = 2;

/** How far back the replay starts. Covers the whole 90-day program. */
const STREAK_WINDOW_DAYS = 120;

export interface StreakState {
  streak: number;
  /** Freezes in hand right now. */
  freezes: number;
  /** ISO day tokens that a freeze covered. */
  frozenDays: string[];
  /** Today already cleared the floor. False means the streak is at risk. */
  todayDone: boolean;
}

/**
 * On a day switched to outreach ("No more good roles today", dailyTarget.ts)
 * every two outreach messages count as one application toward the floor.
 * Keyed by the same ISO day token as byDay.
 */
type SwapCredit = Map<string, number>;

function streakStateFromByDay(byDay: Map<string, Set<string>>, today: Date, days: number, credit: SwapCredit = new Map()): StreakState {
  let streak = 0;
  let freezes = FREEZE_START;
  let run = 0;
  const frozenDays: string[] = [];
  let todayDone = false;

  const cleared = () => {
    streak++;
    run++;
    if (run % FREEZE_EARN_EVERY === 0) freezes = Math.min(FREEZE_MAX, freezes + 1);
  };

  for (let i = days - 1; i >= 0; i--) {
    const dayToken = new Date(today.getTime() - i * DAY_MS);
    const key = dayToken.toISOString();
    const met = (byDay.get(key)?.size ?? 0) + (credit.get(key) ?? 0) >= DAILY_STREAK_FLOOR;

    if (i === 0) {
      if (met) { cleared(); todayDone = true; }
      break;
    }
    if (isWeekendToken(dayToken)) continue;

    if (met) cleared();
    else if (streak > 0 && freezes > 0) { freezes--; frozenDays.push(key); }
    else { streak = 0; run = 0; }
  }

  return { streak, freezes, frozenDays, todayDone };
}

function byDayFromRows(rows: Array<{ sourceUrl: string | null; id: string; dateApplied: Date | null }>): Map<string, Set<string>> {
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.dateApplied) continue;
    const key = appliedToken(r.dateApplied).toISOString();
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(jobKey(r));
  }
  return byDay;
}

/**
 * Swap credit per user per day. Read defensively: if the swap columns are
 * ever missing (a migration that did not land), the streak falls back to
 * applications only instead of taking the dashboard and leaderboard down.
 */
async function loadSwapCredit(userIds: string[], firstDay: Date): Promise<Map<string, SwapCredit>> {
  const out = new Map<string, SwapCredit>();
  try {
    const swaps = await prisma.dailyTarget.findMany({
      where: { userId: { in: userIds }, date: { gte: firstDay }, swappedAt: { not: null } },
      select: { userId: true, date: true },
    });
    if (swaps.length === 0) return out;
    const logs = await prisma.outreachLog.findMany({
      where: { userId: { in: [...new Set(swaps.map(s => s.userId))] }, createdAt: { gte: tokenToInstant(firstDay) } },
      select: { userId: true, createdAt: true },
    });
    const perDay = new Map<string, number>();
    for (const l of logs) {
      const k = `${l.userId}|${appliedToken(l.createdAt).toISOString()}`;
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    for (const s of swaps) {
      const day = s.date.toISOString();
      const credit = Math.floor((perDay.get(`${s.userId}|${day}`) ?? 0) / OUTREACH_PER_MISSING_APPLICATION);
      if (!out.has(s.userId)) out.set(s.userId, new Map());
      out.get(s.userId)!.set(day, credit);
    }
  } catch (err) {
    console.warn('[streak] swap credit unavailable, counting applications only:', (err as Error)?.message);
  }
  return out;
}

/** The streak with its freezes, for the engagement strip. */
export async function computeStreakState(userId: string, days = STREAK_WINDOW_DAYS): Promise<StreakState> {
  const today = todayAEST();
  const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);

  const [rows, credit] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(firstDay) } },
      select: { sourceUrl: true, id: true, dateApplied: true },
    }),
    loadSwapCredit([userId], firstDay),
  ]);

  return streakStateFromByDay(byDayFromRows(rows), today, days, credit.get(userId));
}

/**
 * Consecutive working days that cleared the daily floor, with freezes
 * applied (see streakStateFromByDay). Weekends are skipped rather than
 * breaking the streak, matching the program's 5-day working week.
 */
export async function computeDailyStreak(userId: string, days = STREAK_WINDOW_DAYS): Promise<number> {
  return (await computeStreakState(userId, days)).streak;
}

/**
 * Same as computeDailyStreak, for every user in one query set — for the
 * leaderboard, which needs everyone's streak at once rather than one
 * round trip per row (same batching approach as getWeeklyCountsBatch).
 */
export async function computeDailyStreakBatch(userIds: string[], days = STREAK_WINDOW_DAYS): Promise<Map<string, number>> {
  const today = todayAEST();
  const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);

  const [rows, credit] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId: { in: userIds }, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(firstDay) } },
      select: { userId: true, sourceUrl: true, id: true, dateApplied: true },
    }),
    loadSwapCredit(userIds, firstDay),
  ]);

  const byUserByDay = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    if (!r.dateApplied) continue;
    if (!byUserByDay.has(r.userId)) byUserByDay.set(r.userId, new Map());
    const byDay = byUserByDay.get(r.userId)!;
    const key = appliedToken(r.dateApplied).toISOString();
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(jobKey(r));
  }

  const out = new Map<string, number>();
  for (const userId of userIds) {
    out.set(userId, streakStateFromByDay(byUserByDay.get(userId) ?? new Map(), today, days, credit.get(userId)).streak);
  }
  return out;
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
