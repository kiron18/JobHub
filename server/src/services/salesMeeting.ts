/**
 * Booking, moving and cancelling a call with someone on the sales board.
 *
 * The database row is the meeting. The Google Calendar event is a copy of it,
 * written afterwards and allowed to fail: see the warning at the top of
 * googleCalendar.ts for why it is that way round.
 */
import { prisma } from '../index';
import {
  calendarConfigured,
  calendarErrorMessage,
  cancelMeetingEvent,
  upsertMeetingEvent,
} from './googleCalendar';

export const DEFAULT_MEETING_MINUTES = 30;

/** How long before the start each reminder email goes out. */
export const DAY_REMINDER_MS = 24 * 60 * 60_000;
export const HOUR_REMINDER_MS = 60 * 60_000;

/**
 * Which reminders are already pointless for a meeting starting at `startsAt`.
 *
 * A call booked this afternoon for tomorrow morning is inside the 24 hour
 * window the moment it is saved, so without this the "see you tomorrow" email
 * would land seconds after the calendar invite. Stamping a reminder as sent
 * is how it is skipped: the cron only ever looks for nulls.
 */
export function reminderStamps(startsAt: Date, now: Date = new Date()) {
  const lead = startsAt.getTime() - now.getTime();
  return {
    reminderDaySentAt: lead <= DAY_REMINDER_MS ? now : null,
    reminderHourSentAt: lead <= HOUR_REMINDER_MS ? now : null,
  };
}

/**
 * The meeting a "set" or "cancel" applies to: the latest one that is not
 * cancelled and has not finished. Once a call has happened it is history, and
 * setting a time again books the next call instead of rewriting the last one.
 */
export async function activeMeeting(leadId: string, now: Date = new Date()) {
  const candidates = await prisma.salesMeeting.findMany({
    where: { leadId, cancelledAt: null, startsAt: { gte: new Date(now.getTime() - 6 * 60 * 60_000) } },
    orderBy: { startsAt: 'desc' },
  });
  return candidates.find((m) => m.startsAt.getTime() + m.minutes * 60_000 > now.getTime()) ?? null;
}

/**
 * Book a call, or move the one already booked.
 *
 * Returns the saved row either way. A calendar problem is reported on the row
 * (`calendarError`), never thrown.
 */
export async function setMeeting(params: {
  leadId: string;
  startsAt: Date;
  minutes?: number;
  notify?: boolean;
}) {
  const lead = await prisma.salesLead.findUnique({
    where: { id: params.leadId },
    select: { id: true, name: true, email: true, phone: true, jobTitle: true },
  });
  if (!lead) return null;

  const now = new Date();
  const existing = await activeMeeting(lead.id, now);
  const minutes = params.minutes ?? existing?.minutes ?? DEFAULT_MEETING_MINUTES;
  const notify = params.notify ?? existing?.notify ?? true;
  const moved = !existing || existing.startsAt.getTime() !== params.startsAt.getTime();

  const data = {
    startsAt: params.startsAt,
    minutes,
    notify,
    // Only a change of time resets the reminders. Re-saving the same slot, to
    // retry a failed calendar write, must not send "see you tomorrow" twice.
    ...(moved ? reminderStamps(params.startsAt, now) : {}),
  };

  let meeting = existing
    ? await prisma.salesMeeting.update({ where: { id: existing.id }, data })
    : await prisma.salesMeeting.create({ data: { leadId: lead.id, ...data } });

  if (!calendarConfigured()) {
    meeting = await prisma.salesMeeting.update({
      where: { id: meeting.id },
      data: { calendarError: 'Google Calendar is not connected, so this is on the board only.' },
    });
  } else {
    try {
      const event = await upsertMeetingEvent({
        meetingId: meeting.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        jobTitle: lead.jobTitle,
        startsAt: meeting.startsAt,
        minutes: meeting.minutes,
        notify: meeting.notify,
      });
      meeting = await prisma.salesMeeting.update({
        where: { id: meeting.id },
        data: {
          googleEventId: event.eventId,
          // A patch does not always echo the room back; keep the one we have.
          meetLink: event.meetLink ?? meeting.meetLink,
          calendarLink: event.calendarLink ?? meeting.calendarLink,
          calendarError: null,
        },
      });
    } catch (err) {
      const message = calendarErrorMessage(err);
      console.error(`[salesMeeting] calendar write failed for meeting ${meeting.id}: ${message}`);
      meeting = await prisma.salesMeeting.update({ where: { id: meeting.id }, data: { calendarError: message } });
    }
  }

  // Booking a call is the most recent thing that happened to this person, so
  // it should lift them to the top of a board sorted by last touched.
  await prisma.salesLead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } });

  return meeting;
}

/** Cancel the upcoming call. Returns false when there was nothing to cancel. */
export async function cancelMeeting(leadId: string): Promise<boolean> {
  const meeting = await activeMeeting(leadId);
  if (!meeting) return false;

  await prisma.salesMeeting.update({ where: { id: meeting.id }, data: { cancelledAt: new Date() } });
  await removeCalendarEvents([meeting]);
  return true;
}

/**
 * Take events off the calendar, best effort.
 *
 * Also used when people are deleted from the board: the rows cascade away with
 * the lead, and without this the calls would stay on the calendar with nobody
 * behind them.
 */
export async function removeCalendarEvents(
  meetings: { id: string; googleEventId: string | null; notify: boolean }[],
): Promise<void> {
  if (!calendarConfigured()) return;
  for (const m of meetings) {
    if (!m.googleEventId) continue;
    try {
      await cancelMeetingEvent(m.googleEventId, m.notify);
    } catch (err) {
      console.error(`[salesMeeting] could not remove calendar event for meeting ${m.id}: ${calendarErrorMessage(err)}`);
    }
  }
}
