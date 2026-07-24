import cron from 'node-cron';
import { prisma } from '../index';
import { sendFollowUpReminderEmail } from '../services/email';

let cronStarted = false;

const DAY_MS = 24 * 60 * 60 * 1000;
// Applications become "worth a follow-up" at 7 days and drop out of the window
// at 30 — past a month a follow-up reads as desperate, so we stop nudging.
const FOLLOWUP_MIN_DAYS = 7;
const FOLLOWUP_MAX_DAYS = 30;
// Once a person has been nudged, don't nudge them again for 4 days — this is
// what keeps the reminder to one email per person per cycle instead of one per
// application (someone who applied to 8 jobs in a day gets ONE email, not 8).
const NUDGE_COOLDOWN_DAYS = 4;
// Jobs listed by name in the email before we collapse the rest into "+N more".
const MAX_JOBS_LISTED = 3;

export function startFollowUpReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 09:00 UTC daily = 19:00 AEST
  cron.schedule('0 9 * * *', async () => {
    console.log('[followUpReminder] Checking for follow-up candidates');

    const now = new Date();
    const windowStart = new Date(now.getTime() - FOLLOWUP_MAX_DAYS * DAY_MS); // oldest we still nudge for
    const windowEnd = new Date(now.getTime() - FOLLOWUP_MIN_DAYS * DAY_MS);   // youngest that's due
    const cooldownCutoff = new Date(now.getTime() - NUDGE_COOLDOWN_DAYS * DAY_MS);

    try {
      // Every application currently sitting in the follow-up window. We group
      // these by candidate below so each person gets a single batched email.
      const applications = await prisma.jobApplication.findMany({
        where: {
          status: 'APPLIED',
          dateApplied: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        select: {
          id: true,
          title: true,
          company: true,
          dateApplied: true,
          candidateProfileId: true,
          candidateProfile: {
            select: { id: true, email: true, name: true, lastFollowUpNudgeAt: true },
          },
        },
        orderBy: { dateApplied: 'asc' }, // oldest application first within each person's list
      });

      // Group by candidate.
      const byCandidate = new Map<string, typeof applications>();
      for (const app of applications) {
        const key = app.candidateProfileId;
        const bucket = byCandidate.get(key);
        if (bucket) bucket.push(app);
        else byCandidate.set(key, [app]);
      }

      console.log(
        `[followUpReminder] ${applications.length} application(s) in window across ${byCandidate.size} candidate(s)`,
      );

      let sent = 0;

      for (const [, apps] of byCandidate) {
        const profile = apps[0].candidateProfile;
        const email = profile?.email;
        if (!email) continue;

        // Throttle: skip anyone nudged within the cooldown. First-ever nudge
        // (lastFollowUpNudgeAt === null) always passes.
        const last = profile?.lastFollowUpNudgeAt;
        if (last && last > cooldownCutoff) continue;

        const firstName = profile?.name?.trim().split(/\s+/)[0] || undefined;
        const jobs = apps.slice(0, MAX_JOBS_LISTED).map(a => ({ title: a.title, company: a.company }));

        try {
          await sendFollowUpReminderEmail({
            to: email,
            firstName,
            jobs,
            totalCount: apps.length,
          });

          // Stamp the person, not the applications — this is what enforces the
          // per-person cadence.
          await prisma.candidateProfile.update({
            where: { id: profile!.id },
            data: { lastFollowUpNudgeAt: now },
          });

          sent++;
          console.log(
            `[followUpReminder] Nudged ${email} about ${apps.length} application(s)`,
          );
        } catch (err: any) {
          console.error(`[followUpReminder] Failed for ${email}:`, err?.message ?? err);
        }
      }

      console.log(`[followUpReminder] Sent ${sent} reminder email(s)`);
    } catch (err) {
      console.error('[followUpReminder] Cron error:', err);
    }
  });
}
