/**
 * Sends the pre-workshop nudge to everyone registered for the current session.
 *
 * Why a cron and not a setTimeout at boot: Railway redeploys and restarts, and
 * a timer would be silently lost with no way to tell it had been. A cron that
 * re-derives the window from the clock on every tick survives a restart at any
 * point before the workshop.
 *
 * `reminderSentAt` is what makes it safe to tick often. Rows are claimed with a
 * conditional update before the send, so two overlapping ticks, or two server
 * instances, cannot both mail the same person.
 */
import cron from 'node-cron';
import { prisma } from '../index';
import { sendWorkshopReminderEmail } from '../services/email';
import {
  CURRENT_SESSION_KEY,
  MEET_LINK,
  WORKSHOP_TITLE,
  REMINDER_MINUTES_BEFORE,
  workshopStart,
} from '../config/workshop';

let cronStarted = false;

export function startWorkshopReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // Every two minutes. The query is tiny and only does anything inside a short
  // window once per workshop, so the cost of ticking often is negligible and it
  // buys tight control over when the nudge actually lands.
  cron.schedule('*/2 * * * *', async () => {
    const start = workshopStart();
    if (!start) return;

    const now = new Date();
    // Opens slightly before the target so a two-minute tick cannot skip past it,
    // and closes before the start so nobody gets a "starts in 20 minutes" email
    // after it has already begun.
    const windowOpens = new Date(start.getTime() - (REMINDER_MINUTES_BEFORE + 2) * 60_000);
    const windowCloses = new Date(start.getTime() - 60_000);
    if (now < windowOpens || now > windowCloses) return;

    try {
      const due = await prisma.sessionRegistration.findMany({
        where: { sessionKey: CURRENT_SESSION_KEY, reminderSentAt: null },
        select: { id: true, email: true, name: true },
      });
      if (!due.length) return;

      console.log(`[workshopReminder] ${due.length} reminder(s) to send`);

      for (const person of due) {
        // Claim first. If another tick got there, updateMany reports 0 rows and
        // we skip rather than sending a duplicate.
        const claimed = await prisma.sessionRegistration.updateMany({
          where: { id: person.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        if (claimed.count === 0) continue;

        try {
          await sendWorkshopReminderEmail({
            to: person.email,
            name: person.name,
            meetLink: MEET_LINK,
            workshopTitle: WORKSHOP_TITLE,
            minutesBefore: REMINDER_MINUTES_BEFORE,
          });
        } catch (err) {
          // Hand the row back so the next tick retries it, as long as the
          // window is still open.
          await prisma.sessionRegistration.updateMany({
            where: { id: person.id },
            data: { reminderSentAt: null },
          });
          console.error('[workshopReminder] send failed for', person.email, err);
        }
      }
    } catch (err) {
      console.error('[workshopReminder] tick failed', err);
    }
  });

  console.log('[workshopReminder] cron started');
}
