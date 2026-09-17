import { prisma } from '../../index';
import { SENT_APPLICATION_FILTER } from '../tracker/metricHelpers';
import { isPaidOrExempt } from '../../middleware/accessControl';
import { isTrialChallengeTestMode } from '../../config/trialChallengeGate';
import { DAY_RULES, LAST_DAY, ruleForDay, DayRule, TrialChallengeStatus } from './rules';

/**
 * Real minutes normally; compressed 6x under TRIAL_CHALLENGE_TEST_MODE (30
 * real minutes -> 5 test minutes), not shrunk to raw seconds. A single real
 * resume + cover letter generation in this environment takes 40-45 seconds on
 * its own (LLM round trips) — a 30-SECOND window, tried first, made even one
 * application structurally impossible to finish in time, let alone the two
 * required, and looked like a broken app rather than a fast test. 6x still
 * turns 30/45/60 real minutes into 5/7.5/10 test minutes — the whole 3-day arc
 * in under 25 minutes — while leaving real room to actually generate.
 */
function windowDurationMs(rule: DayRule): number {
  const speedup = isTrialChallengeTestMode() ? 6 : 1;
  return (rule.windowMinutes * 60_000) / speedup;
}

export interface TrialState {
  eligible: boolean;
  status: TrialChallengeStatus | 'not_started';
  currentDay: number;
  windowEndsAt: Date | null;
  minimumRequired: number;
  appliedThisWindow: number;
  linkedinUnlocked: boolean;
  forfeitureDeadline: Date | null;
  /** True once the one free restart-from-Day-1 has been spent. */
  resetUsed: boolean;
}

export class TrialChallengeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/** True for a free/unpaid account — the only kind this challenge applies to. */
export async function isEligibleForTrial(userId: string, email?: string | null): Promise<boolean> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { plan: true, planStatus: true, accessExpiresAt: true, dashboardAccess: true },
  });
  if (!profile) return false;
  return !isPaidOrExempt(profile, email);
}

/**
 * NOTE: deliberately NOT the "midnight UTC as a day token" trick todayAEST()
 * uses elsewhere in this codebase. That trick is fine for same-day equality
 * checks (is this row from today?) but is off by the AEST/AEDT offset
 * (10-11 hours) as a real instant — fine for a comparison, wrong for a
 * deadline we enforce and show the user a wall-clock time for. This computes
 * the actual UTC instant of Sydney midnight, DST included.
 */
function sydneyDateParts(date: Date): { year: number; month: number; day: number } {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const [day, month, year] = s.split('/').map(Number);
  return { year, month, day };
}

/** How far ahead of UTC `timeZone` is at this instant, in ms (handles DST). */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUTC - instant.getTime();
}

/** The real UTC instant of midnight at the start of the given Sydney calendar date. `day` may overflow (e.g. 32) — Date.UTC normalises it into the next month. */
function sydneyMidnightUTC(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(guess.getTime() - tzOffsetMs(guess, 'Australia/Sydney'));
}

/**
 * The hard cutoff: end of the AEST/AEDT day immediately after the day a pass
 * was recorded — i.e. the start of the day after that. Anchored to
 * `passedDayAt` (= that day's windowEndsAt), never to whenever the user
 * happens to next open the app — otherwise someone who doesn't reopen the app
 * for hours would see their forfeiture window quietly shrink.
 */
export function forfeitureDeadline(passedDayAt: Date): Date {
  const { year, month, day } = sydneyDateParts(passedDayAt);
  return sydneyMidnightUTC(year, month, day + 2);
}

/** Applications sent (status left SAVED) since a window started. Same shape as applicationCap.ts's query, filtered to sent-not-saved and anchored on dateApplied (stamped when status leaves SAVED), not createdAt. */
export async function countApplicationsInWindow(userId: string, windowStartedAt: Date): Promise<number> {
  return prisma.jobApplication.count({
    where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: windowStartedAt } },
  });
}

/**
 * The single place trial state gets decided — called from every route below on
 * every read, not by a sweeping cron. A cron that marks profiles forfeited
 * once an hour (or once a day) leaves a window where a stale status is shown
 * to the very user it's about; computing it fresh on read closes that gap
 * completely and needs no extra job just to stay correct.
 *
 * Returns null when the user has never pressed Begin — callers report
 * `not_started` themselves rather than creating a row on a bare read.
 */
export async function resolveTrialState(userId: string): Promise<TrialState | null> {
  const trial = await prisma.trialChallenge.findUnique({ where: { userId } });
  if (!trial) return null;

  const now = new Date();
  let status = trial.status as TrialChallengeStatus;
  let linkedinUnlocked = trial.linkedinUnlocked;
  let passedDayAt = trial.passedDayAt;
  let appliedThisWindow = 0;
  const rule = ruleForDay(trial.currentDay);

  if (status === 'day_in_progress' && trial.windowStartedAt) {
    appliedThisWindow = await countApplicationsInWindow(userId, trial.windowStartedAt);

    const dayRow = await prisma.trialChallengeDay.findUnique({
      where: { trialChallengeId_day: { trialChallengeId: trial.id, day: trial.currentDay } },
    });
    // Per-DAY crossing, not the global one-way linkedinUnlocked flag — day 2's
    // own minimum still has to be met even though day 1 already unlocked
    // LinkedIn for good.
    let crossedThisDay = (rule?.minimum ?? 0) === 0 || dayRow?.crossedMinimumAt != null;

    if (!crossedThisDay && rule && appliedThisWindow >= rule.minimum) {
      crossedThisDay = true;
      if (dayRow) {
        await prisma.trialChallengeDay.update({ where: { id: dayRow.id }, data: { crossedMinimumAt: now } });
      }
    }
    if (crossedThisDay && !linkedinUnlocked) {
      linkedinUnlocked = true;
      await prisma.trialChallenge.updateMany({
        where: { id: trial.id, linkedinUnlocked: false },
        data: { linkedinUnlocked: true },
      });
    }

    if (trial.windowEndsAt && now >= trial.windowEndsAt) {
      status = crossedThisDay
        ? (trial.currentDay === LAST_DAY ? 'completed' : 'day_passed_waiting')
        : 'day_failed';
      passedDayAt = status === 'day_passed_waiting' ? trial.windowEndsAt : passedDayAt;

      await prisma.trialChallenge.update({ where: { id: trial.id }, data: { status, passedDayAt } });
      if (dayRow && dayRow.outcome == null) {
        await prisma.trialChallengeDay.update({
          where: { id: dayRow.id },
          data: { outcome: crossedThisDay ? 'pass' : 'fail', decidedAt: now },
        });
      }
    }
  }

  if (
    status === 'day_passed_waiting' && passedDayAt &&
    !isTrialChallengeTestMode() && now >= forfeitureDeadline(passedDayAt)
  ) {
    status = 'forfeited';
    await prisma.trialChallenge.update({ where: { id: trial.id }, data: { status } });
  }

  return {
    eligible: true,
    status,
    currentDay: trial.currentDay,
    windowEndsAt: trial.windowEndsAt,
    minimumRequired: rule?.minimum ?? 0,
    appliedThisWindow,
    linkedinUnlocked,
    // Still computed (and shown) in test mode — only the forfeitureDeadline
    // ENFORCEMENT above is skipped, so the pass screen keeps rendering
    // normally instead of vanishing for lack of a deadline to show.
    forfeitureDeadline: status === 'day_passed_waiting' && passedDayAt ? forfeitureDeadline(passedDayAt) : null,
    resetUsed: trial.resetUsed,
  };
}

/**
 * The one free restart-from-Day-1, spent here. Only callable from a terminal
 * "missed it" state (day_failed or forfeited, never day_failed's sibling
 * `completed`, since finishing the trial is not a miss to recover from) and
 * only once per trial. Wipes the day history clean rather than layering a
 * second attempt on top of it, so `resolveTrialState` reads the restarted
 * day-1 row the same way it reads a first attempt.
 */
export async function resetTrial(userId: string): Promise<TrialState> {
  const trial = await prisma.trialChallenge.findUnique({ where: { userId } });
  if (!trial) throw new TrialChallengeError('No trial to reset', 'not_started');
  if (trial.resetUsed) throw new TrialChallengeError('The free restart has already been used', 'reset_used');
  if (trial.status !== 'day_failed' && trial.status !== 'forfeited') {
    throw new TrialChallengeError('Nothing to reset', trial.status);
  }

  const rule = ruleForDay(1)!;
  const windowStartedAt = new Date();
  const windowEndsAt = new Date(windowStartedAt.getTime() + windowDurationMs(rule));

  await prisma.$transaction([
    prisma.trialChallengeDay.deleteMany({ where: { trialChallengeId: trial.id } }),
    prisma.trialChallenge.update({
      where: { id: trial.id },
      data: {
        currentDay: 1,
        status: 'day_in_progress',
        windowStartedAt,
        windowEndsAt,
        passedDayAt: null,
        resetUsed: true,
      },
    }),
    prisma.trialChallengeDay.create({
      data: { trialChallengeId: trial.id, day: 1, windowStartedAt, windowEndsAt, minimumRequired: rule.minimum },
    }),
  ]);

  return (await resolveTrialState(userId))!;
}

/** Starts a window. The only place the clock is ever set running. */
export async function beginDay(userId: string): Promise<TrialState> {
  const existing = await prisma.trialChallenge.findUnique({ where: { userId } });

  if (!existing) {
    const rule = ruleForDay(1)!;
    const windowStartedAt = new Date();
    const windowEndsAt = new Date(windowStartedAt.getTime() + windowDurationMs(rule));
    const trial = await prisma.trialChallenge.create({
      data: { userId, currentDay: 1, status: 'day_in_progress', windowStartedAt, windowEndsAt },
    });
    await prisma.trialChallengeDay.create({
      data: { trialChallengeId: trial.id, day: 1, windowStartedAt, windowEndsAt, minimumRequired: rule.minimum },
    });
    return (await resolveTrialState(userId))!;
  }

  const state = await resolveTrialState(userId);
  if (!state || state.status !== 'day_passed_waiting') {
    throw new TrialChallengeError('No day available to begin', state?.status ?? 'not_started');
  }
  if (!isTrialChallengeTestMode() && state.forfeitureDeadline && new Date() >= state.forfeitureDeadline) {
    throw new TrialChallengeError('This trial was forfeited', 'forfeited');
  }

  const nextDay = existing.currentDay + 1;
  const rule = ruleForDay(nextDay);
  if (!rule) {
    throw new TrialChallengeError('The trial is already complete', 'completed');
  }

  const windowStartedAt = new Date();
  const windowEndsAt = new Date(windowStartedAt.getTime() + windowDurationMs(rule));

  await prisma.trialChallenge.update({
    where: { id: existing.id },
    data: { currentDay: nextDay, status: 'day_in_progress', windowStartedAt, windowEndsAt },
  });
  await prisma.trialChallengeDay.create({
    data: { trialChallengeId: existing.id, day: nextDay, windowStartedAt, windowEndsAt, minimumRequired: rule.minimum },
  });

  return (await resolveTrialState(userId))!;
}

export async function hasLinkedinTrialAccess(userId: string): Promise<boolean> {
  const trial = await prisma.trialChallenge.findUnique({ where: { userId }, select: { linkedinUnlocked: true } });
  return trial?.linkedinUnlocked ?? false;
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since a candidate might
// occasionally need to read this off a screen rather than tap the link/QR.
const OPT_IN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateOptInCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += OPT_IN_CODE_CHARS[Math.floor(Math.random() * OPT_IN_CODE_CHARS.length)];
  return out;
}

/**
 * The code embedded in the wa.me link/QR shown on the pass screen
 * ("START AB3F9K") — this, not a phone number typed into a form, is how an
 * inbound WhatsApp message gets matched back to the right profile. One tap
 * opens WhatsApp pre-filled and sends; the candidate never types or copies
 * anything. Generated once and reused on every later read.
 */
export async function getOrCreateWhatsappOptInCode(userId: string): Promise<string> {
  const existing = await prisma.candidateProfile.findUnique({ where: { userId }, select: { whatsappOptInCode: true } });
  if (existing?.whatsappOptInCode) return existing.whatsappOptInCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateOptInCode();
    try {
      await prisma.candidateProfile.update({ where: { userId }, data: { whatsappOptInCode: code } });
      return code;
    } catch {
      // Unique collision — vanishingly unlikely at 6 chars from a 32-char alphabet. Retry with a fresh code.
    }
  }
  throw new Error('Could not generate a unique WhatsApp opt-in code');
}

export { DAY_RULES };
