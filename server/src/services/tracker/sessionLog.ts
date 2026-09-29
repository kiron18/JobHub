import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';

/**
 * The evening check-out (Kiron, 2026-09-29): a multiple-choice log of how the
 * day went, and a nudge about tomorrow. Always available from the sidebar,
 * not only once the day's number is done.
 *
 * Answers are stored as ids from these two lists, never free text, so they
 * can be counted in the coach view later. The client holds the wording; the
 * ids here are the contract. Add ids freely; never rename one in use.
 */
export const OUTCOME_IDS = [
  'hit_number',        // I hit my number
  'followed_up',       // I followed up on older applications
  'reached_out',       // I messaged someone at a company I like
  'heard_back',        // I heard back from an employer
  'ran_out_of_roles',  // I ran out of good roles
  'tailoring_slow',    // Tailoring took longer than I expected
  'life_got_in_way',   // Life got in the way today
] as const;

export const TOMORROW_IDS = [
  'same_time',         // Start at the same time
  'follow_up_last_week', // Follow up on last week's applications
  'new_source',        // Try a new job board or careers page
  'message_two',       // Message 2 people at companies I applied to
  'beat_today',        // Beat today's number
] as const;

export interface SessionLogEntry { outcomes: string[]; tomorrow: string[]; savedAt: string | null }

export class SessionLogError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function clean(input: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))];
}

export async function getTodaySessionLog(userId: string): Promise<SessionLogEntry> {
  const row = await prisma.sessionLog.findUnique({ where: { userId_date: { userId, date: todayAEST() } } });
  return { outcomes: row?.outcomes ?? [], tomorrow: row?.tomorrow ?? [], savedAt: row?.updatedAt.toISOString() ?? null };
}

/** Save today's check-out. Submitting again the same day replaces it. */
export async function saveSessionLog(userId: string, body: { outcomes?: unknown; tomorrow?: unknown }): Promise<SessionLogEntry> {
  const outcomes = clean(body?.outcomes, OUTCOME_IDS);
  const tomorrow = clean(body?.tomorrow, TOMORROW_IDS);
  if (outcomes.length === 0 && tomorrow.length === 0) {
    throw new SessionLogError(400, 'Tick at least one box.');
  }
  const date = todayAEST();
  const row = await prisma.sessionLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, outcomes, tomorrow },
    update: { outcomes, tomorrow },
  });
  return { outcomes: row.outcomes, tomorrow: row.tomorrow, savedAt: row.updatedAt.toISOString() };
}
