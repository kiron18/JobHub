import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { SENT_APPLICATION_FILTER } from '../tracker/metricHelpers';
import { appliedToken, tokenToInstant, promoteAndGetSettings } from '../tracker/goals';
import { computeDailyStreakBatch } from '../tracker/closeout';
import type { CheckinContext } from './messages';

export const CHALLENGE_LENGTH = 90;
const DAY_MS = 86400000;

/** 1-based challenge day for a start instant, or null when unset or past day 90. */
/** First name, written normally: "KIRON KURIAN" and "kiron" both become "Kiron". */
export function firstName(full: string | null | undefined): string {
  const first = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function challengeDay(startedAt: Date | null | undefined, today: Date = todayAEST()): number | null {
  if (!startedAt) return null;
  const day = Math.floor((today.getTime() - appliedToken(startedAt).getTime()) / DAY_MS) + 1;
  return day >= 1 && day <= CHALLENGE_LENGTH ? day : null;
}

/** Applications sent today, de-duplicated by source URL like everywhere else. */
async function countFiledToday(userId: string): Promise<number> {
  const rows = await prisma.jobApplication.findMany({
    where: { userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: tokenToInstant(todayAEST()) } },
    select: { sourceUrl: true, id: true },
  });
  return new Set(rows.map(r => r.sourceUrl ?? `__id:${r.id}`)).size;
}

/**
 * Everything a check-in message needs: the member's program goal (the same
 * one goals.ts and the tracker use, so a message can never disagree with
 * what the member sees on screen), today's real count, and the daily streak.
 */
export async function getCheckinContext(userId: string): Promise<CheckinContext> {
  const [profile, settings, filedToday, streaks] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { userId },
      select: { name: true, challengeStartedAt: true },
    }),
    promoteAndGetSettings(userId),
    countFiledToday(userId),
    computeDailyStreakBatch([userId]),
  ]);

  return {
    name: firstName(profile?.name),
    target: settings.appGoal,
    filedToday,
    streak: streaks.get(userId) ?? 0,
    day: challengeDay(profile?.challengeStartedAt),
    challengeLength: CHALLENGE_LENGTH,
  };
}
