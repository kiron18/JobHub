import cron from 'node-cron';
import { prisma } from '../index';
import { sendTrialReminderEmail } from '../services/email';

let cronStarted = false;

export function startTrialReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 10:00 UTC daily = 20:00 AEST
  cron.schedule('0 10 * * *', async () => {
    console.log('[trialReminder] Checking for trials ending tomorrow');

    const now = new Date();
    const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20h from now
    const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);   // 36h from now

    try {
      const profiles = await prisma.candidateProfile.findMany({
        where: {
          planStatus: 'trialing',
          trialEndDate: { gte: windowStart, lte: windowEnd },
          email: { not: null },
        },
        select: { email: true, name: true, userId: true },
      });

      console.log(`[trialReminder] Found ${profiles.length} trial(s) ending tomorrow`);

      for (const profile of profiles) {
        if (!profile.email) continue;
        try {
          await sendTrialReminderEmail(profile.email, profile.name ?? '');
          console.log(`[trialReminder] Sent reminder to ${profile.email}`);
        } catch (err: any) {
          console.error(`[trialReminder] Failed to send to ${profile.email}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[trialReminder] Cron error:', err);
    }
  });
}
