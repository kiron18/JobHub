import cron from 'node-cron';
import { prisma } from '../index';
import { sendFollowUpReminderEmail } from '../services/email';

let cronStarted = false;

export function startFollowUpReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 09:00 UTC daily = 19:00 AEST
  cron.schedule('0 9 * * *', async () => {
    console.log('[followUpReminder] Checking for 7-day follow-up candidates');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    try {
      const applications = await prisma.jobApplication.findMany({
        where: {
          status: 'APPLIED',
          followUpSentAt: null,
          dateApplied: {
            gte: eightDaysAgo,
            lte: sevenDaysAgo,
          },
        },
        select: {
          id: true,
          title: true,
          company: true,
          // Email lives on CandidateProfile, not a separate User model — same pattern as trialReminderCron
          candidateProfile: {
            select: { email: true },
          },
        },
      });

      console.log(`[followUpReminder] Found ${applications.length} application(s) due for follow-up`);

      for (const app of applications) {
        const email = app.candidateProfile?.email;
        if (!email) continue;

        try {
          await sendFollowUpReminderEmail({
            to: email,
            jobTitle: app.title,
            company: app.company,
          });

          // Mark as sent so the cron never double-fires for the same application
          await prisma.jobApplication.update({
            where: { id: app.id },
            data: { followUpSentAt: now },
          });

          console.log(`[followUpReminder] Sent follow-up reminder to ${email} for ${app.title} at ${app.company}`);
        } catch (err: any) {
          console.error(`[followUpReminder] Failed for application ${app.id}:`, err?.message ?? err);
        }
      }
    } catch (err) {
      console.error('[followUpReminder] Cron error:', err);
    }
  });
}
