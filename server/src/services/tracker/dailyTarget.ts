import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { countDistinctJobs, SENT_APPLICATION_FILTER } from './metricHelpers';
import { promoteAndGetSettings, tokenToInstant } from './goals';

/**
 * Today's target — how many applications the member has committed to for
 * this AEST day.
 *
 * This sits ON TOP of the program goal in goals.ts and deliberately does
 * not touch it. The program goal has a 14-day cooldown, a 3-per-90-days
 * limit and next-Monday effectiveness, all of which exist so nobody can
 * lower a goal mid-week to dodge a miss. Today's target can only ever be
 * set at or above the program goal, so it cannot be used to dodge either:
 * the floor here IS the program goal.
 *
 * The rules, in one place:
 *   - floor    the member's program goal (never below it)
 *   - ceiling  10, or the program goal if that is somehow higher
 *   - raises   automatic. Do more than you committed to and the target
 *              rises to match, capped at the ceiling. Nobody is told they
 *              have overshot for doing more than they promised.
 *   - lowering never. Committing is the point.
 *   - undo     exactly one per day, which unlocks the number for one more
 *              set. After that the day's number stands.
 *
 * Nothing here feeds streaks, the leaderboard or miss evaluation — those
 * keep measuring the program goal. If the streak measured a self-set
 * number, setting the floor every day would be the optimal way to keep a
 * streak and ambition would be punished.
 */

/** The ceiling, and the reason for it is a product position, not a limit:
 *  past ten in a sitting the tailoring thins out and tomorrow gets
 *  skipped. See the client's PostApplicationPopup for the full argument. */
export const DAILY_TARGET_CEILING = 10;

export interface DailyTargetState {
  /** Today's effective target, after auto-raising. */
  target: number;
  /** What they actually committed to, or null if they have not yet. */
  committed: number | null;
  /** True once set, until the day's undo is spent. */
  locked: boolean;
  /** False once today's single undo has been used. */
  undoAvailable: boolean;
  /** Applications sent today — the auto-raise input. */
  filedToday: number;
  /** Lowest number they may set: their program goal. */
  min: number;
  /** Highest number they may set. */
  max: number;
  /** Whether the one-time commit explainer has been shown to them. */
  explainerSeen: boolean;
  /** They pressed "No more good roles today" (option B). */
  swapped: boolean;
  /** Outreach logged today (OutreachLog rows created today). */
  outreachToday: number;
  /** After a swap: outreach messages that make up the rest of the target. */
  outreachNeeded: number;
  /** Today's commitment is met, by applications or by the swap. */
  done: boolean;
}

/** Two outreach messages stand in for each application still missing. */
export const OUTREACH_PER_MISSING_APPLICATION = 2;

export class DailyTargetError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>) {
    super(String(payload.error ?? 'daily target error'));
  }
}

/** Outreach logged today. Each OutreachLog row is one person messaged. */
async function countOutreachToday(userId: string): Promise<number> {
  return prisma.outreachLog.count({ where: { userId, createdAt: { gte: tokenToInstant(todayAEST()) } } });
}

/** Applications sent today, de-duplicated by source URL like everywhere else. */
async function countFiledToday(userId: string): Promise<number> {
  const rows = await prisma.jobApplication.findMany({
    where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(todayAEST()) } },
    select: { sourceUrl: true, id: true },
  });
  return countDistinctJobs(rows);
}

async function loadBounds(userId: string): Promise<{ min: number; max: number }> {
  const settings = await promoteAndGetSettings(userId);
  const min = settings.appGoal;
  // A coach could in principle set a program goal above the ceiling. The
  // floor wins in that case — never hand someone a max below their own
  // committed program goal.
  return { min, max: Math.max(DAILY_TARGET_CEILING, min) };
}

export function effectiveTarget(committed: number, filedToday: number, max: number): number {
  return Math.min(max, Math.max(committed, filedToday));
}

export async function getDailyTargetState(userId: string): Promise<DailyTargetState> {
  const today = todayAEST();
  /* "Have they seen the explainer?" is the same question as "have they
     ever committed a target?", so it is derived rather than stored.
     It used to be a column on CandidateProfile, and that was a bad call:
     CandidateProfile is read by /profile with a bare `include`, so Prisma
     selects every scalar on it. When the migration adding the column did
     not land on staging, every profile read threw and the whole app went
     down with "We could not reach your account" — a feature that had not
     even been switched on yet. A new column on a hot table couples the
     entire app to one migration; keeping this inside DailyTarget means a
     missing migration can only ever break this feature. */
  const [row, filedToday, bounds, everCommitted, outreachToday] = await Promise.all([
    prisma.dailyTarget.findUnique({ where: { userId_date: { userId, date: today } } }),
    countFiledToday(userId),
    loadBounds(userId),
    prisma.dailyTarget.count({ where: { userId } }),
    countOutreachToday(userId),
  ]);

  const committed = row?.target ?? null;
  const target = effectiveTarget(committed ?? bounds.min, filedToday, bounds.max);
  const swapped = !!row?.swappedAt;
  const outreachNeeded = swapped
    ? Math.max(0, target - (row?.swapFiled ?? filedToday)) * OUTREACH_PER_MISSING_APPLICATION
    : 0;
  // After a swap, applications still count one for one and outreach covers
  // the rest two for one, so sending one more application late is never
  // punished.
  const done = filedToday >= target
    || (swapped && filedToday + Math.floor(outreachToday / OUTREACH_PER_MISSING_APPLICATION) >= target);
  return {
    target,
    committed,
    locked: row?.locked ?? false,
    undoAvailable: row ? !row.undoUsed : true,
    filedToday,
    min: bounds.min,
    max: bounds.max,
    explainerSeen: everCommitted > 0,
    swapped,
    outreachToday,
    outreachNeeded,
    done,
  };
}

/**
 * "No more good roles today" (option B, Kiron 2026-09-29).
 *
 * Some days there are not enough roles worth a tailored application, and a
 * commitment that can only fail on those days teaches people to commit low.
 * So once the number is set, they can switch the rest of it to outreach: two
 * messages for each application still missing. The target itself does not
 * move, and the day still counts for the streak (see closeout.ts).
 *
 * Once per day, only while the number is locked and not yet met.
 */
export async function swapToOutreach(userId: string): Promise<DailyTargetState> {
  const today = todayAEST();
  const [row, filedToday, bounds] = await Promise.all([
    prisma.dailyTarget.findUnique({ where: { userId_date: { userId, date: today } } }),
    countFiledToday(userId),
    loadBounds(userId),
  ]);
  if (!row || !row.locked) {
    throw new DailyTargetError(409, { error: 'Set today\'s number first.' });
  }
  if (row.swappedAt) {
    throw new DailyTargetError(409, { error: 'Today is already switched to outreach.' });
  }
  if (filedToday >= effectiveTarget(row.target, filedToday, bounds.max)) {
    throw new DailyTargetError(409, { error: 'Today\'s number is already met.' });
  }
  await prisma.dailyTarget.update({
    where: { userId_date: { userId, date: today } },
    data: { swappedAt: new Date(), swapFiled: filedToday },
  });
  return getDailyTargetState(userId);
}

/** Commit today's number. Rejected while the day's number is locked. */
export async function setDailyTarget(userId: string, requested: number): Promise<DailyTargetState> {
  const today = todayAEST();
  const [row, filedToday, bounds] = await Promise.all([
    prisma.dailyTarget.findUnique({ where: { userId_date: { userId, date: today } } }),
    countFiledToday(userId),
    loadBounds(userId),
  ]);

  if (row?.locked) {
    throw new DailyTargetError(409, {
      error: 'Today\'s number is already set.',
      undoAvailable: !row.undoUsed,
    });
  }

  const target = Math.round(Number(requested));
  if (!Number.isFinite(target)) {
    throw new DailyTargetError(400, { error: 'Target must be a number.' });
  }
  if (target < bounds.min || target > bounds.max) {
    throw new DailyTargetError(400, {
      error: `Today's target must be between ${bounds.min} and ${bounds.max}.`,
      min: bounds.min, max: bounds.max,
    });
  }
  // You cannot un-send an application, so the day's work so far is a floor
  // of its own. Without this, someone eight applications in could "commit"
  // to five and be instantly, permanently finished.
  if (target < filedToday && filedToday <= bounds.max) {
    throw new DailyTargetError(400, {
      error: `You have already sent ${filedToday} today.`,
      min: filedToday, max: bounds.max,
    });
  }

  await prisma.dailyTarget.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, target, locked: true, undoUsed: row?.undoUsed ?? false },
    update: { target, locked: true },
  });
  return getDailyTargetState(userId);
}

/** Spend the day's single undo, unlocking the number for one more set. */
export async function useDailyUndo(userId: string): Promise<DailyTargetState> {
  const today = todayAEST();
  const row = await prisma.dailyTarget.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!row || !row.locked) {
    throw new DailyTargetError(409, { error: 'Today\'s number is not set yet.' });
  }
  if (row.undoUsed) {
    throw new DailyTargetError(409, { error: 'You have already used today\'s undo.' });
  }

  await prisma.dailyTarget.update({
    where: { userId_date: { userId, date: today } },
    data: { locked: false, undoUsed: true },
  });
  return getDailyTargetState(userId);
}
