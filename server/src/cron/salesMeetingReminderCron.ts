/**
 * Emails people before a booked sales call: once the day before, once an hour
 * out.
 *
 * Same shape as workshopReminderCron and for the same reasons: a cron that
 * re-derives what is due from the clock survives a Railway restart, and each
 * row is claimed with a conditional update before the send so two overlapping
 * ticks cannot both mail the same person.
 *
 * A reminder that is already pointless when the meeting is booked (a call set
 * for this afternoon needs no "see you tomorrow") is stamped as sent at
 * booking, in salesMeeting.reminderStamps. This file only ever looks for nulls.
 */
import cron from 'node-cron';
import { prisma } from '../index';
import { sendSalesMeetingReminderEmail } from '../services/email';
import { DAY_REMINDER_MS, HOUR_REMINDER_MS } from '../services/salesMeeting';

let cronStarted = false;

type Kind = 'day' | 'hour';
const FIELD = { day: 'reminderDaySentAt', hour: 'reminderHourSentAt' } as const;

/**
 * Meetings due a reminder of this kind right now.
 *
 * Each window closes well before the next thing happens, so a server that was
 * down through the window skips the reminder rather than sending "tomorrow"
 * three hours before the call, or "in an hour" as it starts.
 */
export function reminderWindow(kind: Kind, now: Date): { gt: Date; lte: Date } {
  return kind === 'day'
    ? { gt: new Date(now.getTime() + 12 * 60 * 60_000), lte: new Date(now.getTime() + DAY_REMINDER_MS) }
    : { gt: new Date(now.getTime() + 20 * 60_000), lte: new Date(now.getTime() + HOUR_REMINDER_MS) };
}

export async function sendDueReminders(kind: Kind, now: Date = new Date()): Promise<number> {
  const field = FIELD[kind];
  const due = await prisma.salesMeeting.findMany({
    // Only people who can actually be mailed. A meeting booked before the
    // email was known is left unclaimed, so the reminder still goes if the
    // address is added while the window is open.
    where: {
      cancelledAt: null, notify: true, [field]: null, startsAt: reminderWindow(kind, now),
      lead: { email: { not: null } },
    },
    select: { id: true, startsAt: true, meetLink: true, lead: { select: { name: true, email: true } } },
  });

  let sent = 0;
  for (const m of due) {
    // Claim first. If another tick got there, updateMany reports 0 rows and
    // we skip rather than sending a duplicate.
    const claimed = await prisma.salesMeeting.updateMany({
      where: { id: m.id, [field]: null },
      data: { [field]: new Date() },
    });
    if (claimed.count === 0 || !m.lead.email) continue;

    try {
      await sendSalesMeetingReminderEmail({
        to: m.lead.email,
        name: m.lead.name,
        startsAt: m.startsAt,
        meetLink: m.meetLink,
        kind,
      });
      sent++;
    } catch (err) {
      // Hand the row back so the next tick retries, while the window is open.
      await prisma.salesMeeting.updateMany({ where: { id: m.id }, data: { [field]: null } });
      console.error(`[salesMeetingReminder] ${kind} reminder failed for`, m.lead.email, err);
    }
  }
  return sent;
}

export function startSalesMeetingReminderCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const day = await sendDueReminders('day', now);
      const hour = await sendDueReminders('hour', now);
      if (day || hour) console.log(`[salesMeetingReminder] sent ${day} day-before and ${hour} hour-before reminder(s)`);
    } catch (err) {
      console.error('[salesMeetingReminder] tick failed', err);
    }
  });

  console.log('[salesMeetingReminder] cron started');
}
