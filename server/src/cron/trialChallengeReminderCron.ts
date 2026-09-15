import cron from 'node-cron';
import { prisma } from '../index';
import { sendTrialChallengeReminderEmail } from '../services/email';
import { sendTrialChallengeReminderWhatsApp } from '../services/whatsapp';
import { todayAEST } from '../services/jobFeed';
import { claimNudge } from '../services/accountability/nudges';
import { forfeitureDeadline } from '../services/trialChallenge/engine';

let cronStarted = false;

/** Fallback when a candidate never set a reminder-hour preference. */
const DEFAULT_REMINDER_HOUR = 9;

function currentAESTHour(): number {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', hour: '2-digit', hour12: false,
  }).format(new Date());
  return parseInt(s, 10) % 24; // Intl can return "24" for midnight
}

/**
 * Hourly, not once-daily like the paid-trial reminder: each candidate's
 * reminder should land near their own chosen hour, and the forfeiture
 * deadline is a hard per-user cutoff rather than a fixed broadcast slot.
 * Idempotent per (user, day) via the same NudgeLog table the accountability
 * nudges use, so a restart or an overlapping tick can never double-send.
 */
export function startTrialChallengeReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule('0 * * * *', async () => {
    const hour = currentAESTHour();
    const dayToken = todayAEST().toISOString().slice(0, 10);

    try {
      const waiting = await prisma.trialChallenge.findMany({
        where: { status: 'day_passed_waiting' },
        select: { userId: true, currentDay: true, passedDayAt: true },
      });

      for (const t of waiting) {
        if (!t.passedDayAt) continue;
        const deadline = forfeitureDeadline(t.passedDayAt);
        if (new Date() >= deadline) continue; // next resolveTrialState read will mark this forfeited

        const profile = await prisma.candidateProfile.findUnique({
          where: { userId: t.userId },
          select: { email: true, name: true, whatsappNumber: true, reminderTimePreferenceHour: true },
        });
        if (!profile?.email) continue;

        const preferredHour = profile.reminderTimePreferenceHour ?? DEFAULT_REMINDER_HOUR;
        if (hour !== preferredHour) continue;

        const nextDay = t.currentDay + 1;
        const claimed = await claimNudge(t.userId, 'trial_challenge_reminder', `${dayToken}:${nextDay}`);
        if (!claimed) continue; // already sent today for this day

        try {
          await sendTrialChallengeReminderEmail(profile.email, profile.name ?? '', nextDay, deadline);
        } catch (err: any) {
          console.error(`[trialChallengeReminder] email failed for ${profile.email}:`, err.message);
        }
        if (profile.whatsappNumber) {
          try {
            await sendTrialChallengeReminderWhatsApp(profile.whatsappNumber, {
              '1': profile.name || 'there',
              '2': String(nextDay),
            });
          } catch (err: any) {
            console.error(`[trialChallengeReminder] whatsapp failed for ${profile.whatsappNumber}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[trialChallengeReminder] Cron error:', err);
    }
  });
}
