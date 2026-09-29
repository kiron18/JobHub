import { prisma } from '../../index';
import { getRealUserIds } from '../../routes/admin';
import { todayAEST } from '../jobFeed';
import { mondayAEST } from '../tracker/goals';
import { claimNudge } from '../accountability/nudges';
import { sendCoachWhatsApp } from '../whatsappBaileys';
import { getCheckinContext } from './context';
import { morningCheckinText, eveningCheckinText } from './messages';
import { logPrompt } from './replies';

export type CheckinSlot = 'morning' | 'evening';

export interface CheckinRunResult {
  slot: CheckinSlot;
  sent: Array<{ email: string; text: string }>;
  skipped: Array<{ email: string; reason: string }>;
}

export { coachCheckinsEnabled } from './flags';

/**
 * Optional allowlist for testing: COACH_CHECKINS_ONLY_EMAILS=a@x.com,b@y.com
 * limits the scheduled run to those members. Empty or unset means everyone
 * eligible. Set it before switching the feature on for the first time.
 */
function allowlist(): string[] {
  return (process.env.COACH_CHECKINS_ONLY_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

interface Member { userId: string; email: string; whatsappNumber: string }

/**
 * Paying members who have texted the bot's START code and been verified.
 * Never anyone who has not: same rule as everywhere else in whatsappBaileys.ts.
 */
async function getEligibleMembers(onlyEmails: string[]): Promise<Member[]> {
  const userIds = await getRealUserIds();
  if (userIds.length === 0) return [];

  const profiles = await prisma.candidateProfile.findMany({
    where: {
      userId: { in: userIds },
      plan: { not: 'free' },
      whatsappVerifiedAt: { not: null },
      whatsappNumber: { not: null },
      email: { not: null },
    },
    select: { userId: true, email: true, whatsappNumber: true },
  });

  return profiles
    .filter(p => p.email && p.whatsappNumber && !p.email.endsWith('@jobhub-test.local'))
    .filter(p => onlyEmails.length === 0 || onlyEmails.includes(p.email!.toLowerCase()))
    .map(p => ({ userId: p.userId, email: p.email!, whatsappNumber: p.whatsappNumber! }));
}

/**
 * Send one slot's check-in to every eligible member.
 *
 * `force` is for testing from the admin route: it skips the once-per-day
 * guard and the paused-week skip, so the same person can be messaged again.
 * The scheduled run never uses it.
 */
export async function runCoachCheckin(
  slot: CheckinSlot,
  opts: { force?: boolean; onlyEmails?: string[] } = {},
): Promise<CheckinRunResult> {
  const result: CheckinRunResult = { slot, sent: [], skipped: [] };
  const members = await getEligibleMembers(opts.onlyEmails ?? allowlist());
  const dayToken = todayAEST().toISOString().slice(0, 10);
  const kind = slot === 'morning' ? 'coach_checkin_am' : 'coach_checkin_pm';

  for (const m of members) {
    try {
      if (!opts.force) {
        const paused = await prisma.pauseWeek.findFirst({ where: { userId: m.userId, weekStart: mondayAEST() } });
        if (paused) { result.skipped.push({ email: m.email, reason: 'paused week' }); continue; }
        if (!(await claimNudge(m.userId, kind, dayToken))) {
          result.skipped.push({ email: m.email, reason: 'already sent today' });
          continue;
        }
      }

      const ctx = await getCheckinContext(m.userId);
      const text = slot === 'morning' ? morningCheckinText(ctx) : eveningCheckinText(ctx);
      const sent = await sendCoachWhatsApp(m.whatsappNumber, text);

      if (!sent) {
        // Bot offline or daily cap hit. Give the claim back so the next
        // hourly tick can try again instead of losing today's message.
        if (!opts.force) await prisma.nudgeLog.deleteMany({ where: { userId: m.userId, kind, periodKey: dayToken } });
        result.skipped.push({ email: m.email, reason: 'not sent (bot offline or daily cap reached)' });
        continue;
      }

      await logPrompt(m.userId, slot, text);
      result.sent.push({ email: m.email, text });
    } catch (err: any) {
      console.error(`[coachCheckin] ${slot} failed for ${m.email}:`, err?.message ?? err);
      result.skipped.push({ email: m.email, reason: `error: ${err?.message ?? 'unknown'}` });
    }
  }
  return result;
}
