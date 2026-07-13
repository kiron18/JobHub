import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { countDistinctJobs } from './metricHelpers';

/**
 * Accountability rules for the AGC program.
 * Floors are the bare minimum a member can set for themselves (5-day week):
 * applications 5/day or 20/week, outreach 4/day or 20/week.
 * Goal changes are locked: 14-day cooldown between changes and at most
 * 3 changes in any rolling 90-day window. Non-coach changes take effect
 * the following Monday (AEST) so nobody can lower a goal mid-week to dodge a miss.
 */
export const GOAL_RULES = {
  application: { dailyMin: 5, weeklyMin: 20 },
  outreach: { dailyMin: 4, weeklyMin: 20 },
  maxGoal: 100,
  cooldownDays: 14,
  windowDays: 90,
  maxChangesPerWindow: 3,
} as const;

/** Weekly minimums used for streak / miss evaluation regardless of goal type. */
export const WEEKLY_MINIMUM = { applications: 20, outreach: 20 } as const;

export type GoalType = 'daily' | 'weekly';

export interface GoalSettings {
  appGoal: number;
  appGoalType: GoalType;
  outreachGoal: number;
  outreachGoalType: GoalType;
}

const DAY_MS = 86400000;
// todayAEST() returns the Sydney calendar date as a midnight-UTC token.
// Subtracting 10h converts a token to the real UTC instant of AEST midnight
// (fixed UTC+10, no DST — same convention as metricHelpers.aestDateStr).
const AEST_OFFSET_MS = 10 * 3600 * 1000;

export function tokenToInstant(token: Date): Date {
  return new Date(token.getTime() - AEST_OFFSET_MS);
}

/** Monday of the current week in AEST, as a midnight-UTC token. */
export function mondayAEST(): Date {
  const today = todayAEST();
  const day = today.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  return new Date(today.getTime() - daysSinceMonday * DAY_MS);
}

export function nextMondayAEST(): Date {
  return new Date(mondayAEST().getTime() + 7 * DAY_MS);
}

export function weeklyEquivalent(goal: number, goalType: GoalType): number {
  return goalType === 'daily' ? goal * 5 : goal;
}

/**
 * Applies any pending goal change whose effective time has arrived, then
 * returns the active settings. Lazy promotion — no cron needed.
 */
export async function promoteAndGetSettings(userId: string): Promise<GoalSettings> {
  const now = new Date();
  const due = await prisma.goalChange.findFirst({
    where: { userId, appliedAt: null, effectiveAt: { lte: now } },
    orderBy: { effectiveAt: 'desc' },
  });
  if (due) {
    await prisma.$transaction([
      prisma.candidateProfile.update({
        where: { userId },
        data: {
          dailyApplicationGoal: due.appGoal,
          applicationGoalType: due.appGoalType,
          dailyOutreachGoal: due.outreachGoal,
          outreachGoalType: due.outreachGoalType,
        },
      }),
      prisma.goalChange.updateMany({
        where: { userId, appliedAt: null, effectiveAt: { lte: now } },
        data: { appliedAt: now },
      }),
    ]);
  }
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      dailyApplicationGoal: true, applicationGoalType: true,
      dailyOutreachGoal: true, outreachGoalType: true,
    },
  });
  return {
    appGoal: profile?.dailyApplicationGoal ?? 5,
    appGoalType: profile?.applicationGoalType === 'weekly' ? 'weekly' : 'daily',
    outreachGoal: profile?.dailyOutreachGoal ?? 4,
    outreachGoalType: profile?.outreachGoalType === 'weekly' ? 'weekly' : 'daily',
  };
}

export interface WeekCounts {
  weekStart: string; // yyyy-mm-dd (Monday, AEST)
  applications: number;
  outreach: number;
  paused: boolean;
}

/**
 * Weekly application/outreach counts for the last `weeks` weeks, oldest first,
 * ending with the current (possibly incomplete) week. Pause weeks are marked.
 */
export async function getWeeklyCounts(userId: string, weeks = 26): Promise<WeekCounts[]> {
  const currentMonday = mondayAEST();
  const firstMonday = new Date(currentMonday.getTime() - (weeks - 1) * 7 * DAY_MS);

  const [appRows, outreachRows, pauses] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId, dateApplied: { gte: firstMonday } },
      select: { sourceUrl: true, id: true, dateApplied: true },
    }),
    prisma.outreachLog.findMany({
      where: { userId, createdAt: { gte: tokenToInstant(firstMonday) } },
      select: { createdAt: true },
    }),
    prisma.pauseWeek.findMany({
      where: { userId, weekStart: { gte: firstMonday } },
      select: { weekStart: true },
    }),
  ]);

  const weekIndexFromToken = (token: Date) =>
    Math.floor((token.getTime() - firstMonday.getTime()) / (7 * DAY_MS));

  const appsByWeek: Array<Set<string>> = Array.from({ length: weeks }, () => new Set());
  for (const r of appRows) {
    if (!r.dateApplied) continue;
    const idx = weekIndexFromToken(r.dateApplied);
    if (idx >= 0 && idx < weeks) appsByWeek[idx].add(r.sourceUrl ?? `__id:${r.id}`);
  }

  const outreachByWeek = new Array(weeks).fill(0);
  for (const r of outreachRows) {
    // Convert the real timestamp to its AEST date token, then to a week index.
    const token = new Date(Math.floor((r.createdAt.getTime() + AEST_OFFSET_MS) / DAY_MS) * DAY_MS);
    const idx = weekIndexFromToken(token);
    if (idx >= 0 && idx < weeks) outreachByWeek[idx]++;
  }

  const pausedSet = new Set(pauses.map(p => p.weekStart.toISOString().slice(0, 10)));

  return Array.from({ length: weeks }, (_, i) => {
    const monday = new Date(firstMonday.getTime() + i * 7 * DAY_MS);
    const key = monday.toISOString().slice(0, 10);
    return {
      weekStart: key,
      applications: appsByWeek[i].size,
      outreach: outreachByWeek[i],
      paused: pausedSet.has(key),
    };
  });
}

/**
 * Consecutive weeks (ending with the last completed week) hitting the weekly
 * minimums for both applications and outreach. Pause weeks are skipped, not
 * broken. If the current week is already hit, it extends the streak.
 */
export function computeStreak(weeklyCounts: WeekCounts[]): number {
  if (weeklyCounts.length === 0) return 0;
  const hit = (w: WeekCounts) =>
    w.applications >= WEEKLY_MINIMUM.applications && w.outreach >= WEEKLY_MINIMUM.outreach;

  let streak = 0;
  const current = weeklyCounts[weeklyCounts.length - 1];
  if (hit(current)) streak++;

  for (let i = weeklyCounts.length - 2; i >= 0; i--) {
    const w = weeklyCounts[i];
    if (w.paused) continue;
    if (hit(w)) streak++;
    else break;
  }
  return streak;
}

/**
 * Batched weekly application/outreach counts for many users at once
 * (same bucketing conventions as getWeeklyCounts, one query set total).
 */
export async function getWeeklyCountsBatch(userIds: string[], weeks: number): Promise<Map<string, WeekCounts[]>> {
  const currentMonday = mondayAEST();
  const firstMonday = new Date(currentMonday.getTime() - (weeks - 1) * 7 * DAY_MS);

  const [appRows, outreachRows, pauses] = await Promise.all([
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
      select: { userId: true, weekStart: true },
    }),
  ]);

  const weekIndexFromToken = (token: Date) =>
    Math.floor((token.getTime() - firstMonday.getTime()) / (7 * DAY_MS));

  const apps = new Map<string, Array<Set<string>>>();
  const outreach = new Map<string, number[]>();
  const paused = new Map<string, Set<string>>();
  const ensure = (userId: string) => {
    if (!apps.has(userId)) {
      apps.set(userId, Array.from({ length: weeks }, () => new Set()));
      outreach.set(userId, new Array(weeks).fill(0));
      paused.set(userId, new Set());
    }
  };

  for (const r of appRows) {
    if (!r.dateApplied) continue;
    ensure(r.userId);
    const idx = weekIndexFromToken(r.dateApplied);
    if (idx >= 0 && idx < weeks) apps.get(r.userId)![idx].add(r.sourceUrl ?? `__id:${r.id}`);
  }
  for (const r of outreachRows) {
    ensure(r.userId);
    const token = new Date(Math.floor((r.createdAt.getTime() + AEST_OFFSET_MS) / DAY_MS) * DAY_MS);
    const idx = weekIndexFromToken(token);
    if (idx >= 0 && idx < weeks) outreach.get(r.userId)![idx]++;
  }
  for (const p of pauses) {
    ensure(p.userId);
    paused.get(p.userId)!.add(p.weekStart.toISOString().slice(0, 10));
  }

  const out = new Map<string, WeekCounts[]>();
  for (const userId of userIds) {
    ensure(userId);
    out.set(userId, Array.from({ length: weeks }, (_, i) => {
      const monday = new Date(firstMonday.getTime() + i * 7 * DAY_MS);
      const key = monday.toISOString().slice(0, 10);
      return {
        weekStart: key,
        applications: apps.get(userId)![i].size,
        outreach: outreach.get(userId)![i],
        paused: paused.get(userId)!.has(key),
      };
    }));
  }
  return out;
}

/** Day of week in AEST: Monday = 1 … Sunday = 7. */
export function aestDayOfWeek(): number {
  const day = todayAEST().getUTCDay();
  return day === 0 ? 7 : day;
}

/** Prorated share of a weekly target for a 5-day (Mon–Fri) working week. */
export function proratedPace(weeklyTarget: number, dayOfWeek = aestDayOfWeek()): number {
  return Math.ceil(weeklyTarget * Math.min(dayOfWeek, 5) / 5);
}

export interface ChangeEligibility {
  remaining: number;
  nextAllowedAt: string | null; // ISO; null = can change now
  isFirstChange: boolean;
}

export async function getChangeEligibility(userId: string): Promise<ChangeEligibility> {
  const now = Date.now();
  const [everCount, recent] = await Promise.all([
    prisma.goalChange.count({ where: { userId, byCoach: false } }),
    prisma.goalChange.findMany({
      where: { userId, byCoach: false, createdAt: { gte: new Date(now - GOAL_RULES.windowDays * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const candidates: number[] = [];
  if (recent[0]) candidates.push(recent[0].createdAt.getTime() + GOAL_RULES.cooldownDays * DAY_MS);
  if (recent.length >= GOAL_RULES.maxChangesPerWindow) {
    // A slot frees when the oldest of the last N changes leaves the 90-day window.
    const oldestOfWindow = recent[GOAL_RULES.maxChangesPerWindow - 1];
    candidates.push(oldestOfWindow.createdAt.getTime() + GOAL_RULES.windowDays * DAY_MS);
  }
  const nextAllowed = candidates.length ? Math.max(...candidates) : 0;

  return {
    remaining: Math.max(0, GOAL_RULES.maxChangesPerWindow - recent.length),
    nextAllowedAt: nextAllowed > now ? new Date(nextAllowed).toISOString() : null,
    isFirstChange: everCount === 0,
  };
}

export class GoalChangeError extends Error {
  status: number;
  payload: Record<string, unknown>;
  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.error ?? 'goal change rejected'));
    this.status = status;
    this.payload = payload;
  }
}

function validateSettings(input: GoalSettings): void {
  for (const t of [input.appGoalType, input.outreachGoalType]) {
    if (t !== 'daily' && t !== 'weekly') {
      throw new GoalChangeError(400, { error: 'goalType must be daily or weekly' });
    }
  }
  for (const g of [input.appGoal, input.outreachGoal]) {
    if (!Number.isInteger(g) || g > GOAL_RULES.maxGoal) {
      throw new GoalChangeError(400, { error: `goals must be whole numbers up to ${GOAL_RULES.maxGoal}` });
    }
  }
  const appMin = input.appGoalType === 'daily' ? GOAL_RULES.application.dailyMin : GOAL_RULES.application.weeklyMin;
  if (input.appGoal < appMin) {
    throw new GoalChangeError(400, {
      error: `Application goal can't go below the program minimum of ${appMin} per ${input.appGoalType === 'daily' ? 'day' : 'week'}`,
      floor: appMin,
    });
  }
  const outMin = input.outreachGoalType === 'daily' ? GOAL_RULES.outreach.dailyMin : GOAL_RULES.outreach.weeklyMin;
  if (input.outreachGoal < outMin) {
    throw new GoalChangeError(400, {
      error: `Outreach goal can't go below the program minimum of ${outMin} per ${input.outreachGoalType === 'daily' ? 'day' : 'week'}`,
      floor: outMin,
    });
  }
}

/**
 * Validates and records a goal change.
 * - First-ever change applies immediately (initial setup grace).
 * - Later member changes take effect next Monday AEST and are rate-limited.
 * - Coach changes apply immediately and bypass the lock.
 */
export async function requestGoalChange(
  userId: string,
  input: GoalSettings,
  opts: { byCoach?: boolean; note?: string } = {},
): Promise<void> {
  validateSettings(input);
  const current = await promoteAndGetSettings(userId);

  const pending = await prisma.goalChange.findFirst({
    where: { userId, appliedAt: null, effectiveAt: { gt: new Date() } },
    orderBy: { effectiveAt: 'desc' },
  });
  const target = pending ?? current;
  const same =
    target.appGoal === input.appGoal &&
    target.appGoalType === input.appGoalType &&
    target.outreachGoal === input.outreachGoal &&
    target.outreachGoalType === input.outreachGoalType;
  if (same) throw new GoalChangeError(400, { error: 'No change — these are already your goals.' });

  let effectiveAt = new Date();
  if (!opts.byCoach) {
    const eligibility = await getChangeEligibility(userId);
    if (eligibility.nextAllowedAt) {
      throw new GoalChangeError(403, {
        error: 'Goal changes are locked for now.',
        reason: eligibility.remaining <= 0 ? 'limit' : 'cooldown',
        nextAllowedAt: eligibility.nextAllowedAt,
        remaining: eligibility.remaining,
      });
    }
    if (!eligibility.isFirstChange) effectiveAt = tokenToInstant(nextMondayAEST());
  }

  await prisma.goalChange.create({
    data: {
      userId,
      appGoal: input.appGoal,
      appGoalType: input.appGoalType,
      outreachGoal: input.outreachGoal,
      outreachGoalType: input.outreachGoalType,
      effectiveAt,
      byCoach: opts.byCoach ?? false,
      note: opts.note ?? null,
    },
  });

  if (effectiveAt.getTime() <= Date.now()) await promoteAndGetSettings(userId);
}

export interface GoalStatePeriodProgress {
  goal: number;
  goalType: GoalType;
  done: number;
}

export interface GoalState {
  application: GoalStatePeriodProgress;
  outreach: GoalStatePeriodProgress;
  week: {
    weekStart: string;
    applications: number;
    outreach: number;
    applicationsTarget: number;
    outreachTarget: number;
    applicationsPace: number;
    outreachPace: number;
  };
  pending: (GoalSettings & { effectiveAt: string }) | null;
  changes: ChangeEligibility & {
    cooldownDays: number;
    windowDays: number;
    maxPerWindow: number;
    history: Array<GoalSettings & { createdAt: string; effectiveAt: string; byCoach: boolean }>;
  };
  streak: number;
  floors: typeof GOAL_RULES;
}

export async function getGoalState(userId: string): Promise<GoalState> {
  const settings = await promoteAndGetSettings(userId);
  const today = todayAEST();
  const monday = mondayAEST();

  const [todayApps, weekly, pendingRow, eligibility, history, todayOutreach] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId, dateApplied: { gte: today } },
      select: { sourceUrl: true, id: true },
    }),
    getWeeklyCounts(userId, 26),
    prisma.goalChange.findFirst({
      where: { userId, appliedAt: null, effectiveAt: { gt: new Date() } },
      orderBy: { effectiveAt: 'desc' },
    }),
    getChangeEligibility(userId),
    prisma.goalChange.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.outreachLog.count({
      where: { userId, createdAt: { gte: tokenToInstant(today) } },
    }),
  ]);

  const currentWeek = weekly[weekly.length - 1];
  const asType = (t: string): GoalType => (t === 'weekly' ? 'weekly' : 'daily');

  return {
    application: {
      goal: settings.appGoal,
      goalType: settings.appGoalType,
      done: settings.appGoalType === 'weekly' ? currentWeek.applications : countDistinctJobs(todayApps),
    },
    outreach: {
      goal: settings.outreachGoal,
      goalType: settings.outreachGoalType,
      done: settings.outreachGoalType === 'weekly' ? currentWeek.outreach : todayOutreach,
    },
    week: {
      weekStart: currentWeek.weekStart,
      applications: currentWeek.applications,
      outreach: currentWeek.outreach,
      applicationsTarget: weeklyEquivalent(settings.appGoal, settings.appGoalType),
      outreachTarget: weeklyEquivalent(settings.outreachGoal, settings.outreachGoalType),
      applicationsPace: proratedPace(weeklyEquivalent(settings.appGoal, settings.appGoalType)),
      outreachPace: proratedPace(weeklyEquivalent(settings.outreachGoal, settings.outreachGoalType)),
    },
    pending: pendingRow
      ? {
          appGoal: pendingRow.appGoal,
          appGoalType: asType(pendingRow.appGoalType),
          outreachGoal: pendingRow.outreachGoal,
          outreachGoalType: asType(pendingRow.outreachGoalType),
          effectiveAt: pendingRow.effectiveAt.toISOString(),
        }
      : null,
    changes: {
      ...eligibility,
      cooldownDays: GOAL_RULES.cooldownDays,
      windowDays: GOAL_RULES.windowDays,
      maxPerWindow: GOAL_RULES.maxChangesPerWindow,
      history: history.map(h => ({
        appGoal: h.appGoal,
        appGoalType: asType(h.appGoalType),
        outreachGoal: h.outreachGoal,
        outreachGoalType: asType(h.outreachGoalType),
        createdAt: h.createdAt.toISOString(),
        effectiveAt: h.effectiveAt.toISOString(),
        byCoach: h.byCoach,
      })),
    },
    streak: computeStreak(weekly),
    floors: GOAL_RULES,
  };
}
