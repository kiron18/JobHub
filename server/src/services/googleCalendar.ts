/**
 * Puts a booked sales call on Kiron's real Google Calendar, with a Meet room.
 *
 * Written against the REST API with axios rather than the googleapis package:
 * three calls do not justify a dependency that size, and the server already
 * talks to everything else this way.
 *
 * ⚠️ A CALENDAR FAILURE MUST NEVER LOSE THE MEETING. Every function here either
 * returns a result or throws, and the caller stores the message on the meeting
 * row (`calendarError`) and carries on. The board then shows "not on your
 * calendar" beside a meeting that is still booked, which is recoverable. The
 * other order, where a dead token stops the meeting being saved at all, is not.
 *
 * ⚠️ THE REFRESH TOKEN CAN DIE. The local Python CRM used the same OAuth
 * client and its token stopped working with `invalid_grant` after a few weeks.
 * That is what Google does to a consent screen left in "Testing": refresh
 * tokens expire after seven days. Set the consent screen's user type to
 * Internal (the account is a Workspace one) and it stops. Re-mint with
 * `npx tsx src/scripts/google_calendar_auth.ts`.
 *
 * Env:
 *   GOOGLE_CALENDAR_CLIENT_ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET
 *   GOOGLE_CALENDAR_REFRESH_TOKEN   for kiron@aussiegradcareers.com.au
 *   GOOGLE_CALENDAR_ID              optional, defaults to `primary`
 */
import axios from 'axios';
import { createHash } from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/** Read per call, not at module load, so a variable set after boot in a test
 *  or a script is seen. */
function env() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

export function calendarConfigured(): boolean {
  const e = env();
  return !!(e.clientId && e.clientSecret && e.refreshToken);
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const e = env();
  const r = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      client_id: e.clientId,
      client_secret: e.clientSecret,
      refresh_token: e.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 },
  );
  cached = { token: r.data.access_token, expiresAt: Date.now() + Number(r.data.expires_in ?? 3000) * 1000 };
  return cached.token;
}

/**
 * The Google event id for a meeting.
 *
 * Deterministic, so a retry after a timeout patches the event the first attempt
 * may already have created rather than making a second one. Google's alphabet
 * for ids is base32hex (0-9, a-v), not ordinary base32; a hex digest is always
 * inside it, which is the lesson the Python CRM learned the hard way.
 */
export function eventIdFor(meetingId: string): string {
  return 'agcsales' + createHash('sha1').update(meetingId).digest('hex');
}

/** One line a person can act on, from whatever axios or Google threw. */
export function calendarErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (data?.error === 'invalid_grant') {
    return 'Google rejected the saved login (invalid_grant). Reconnect the calendar.';
  }
  const detail = data?.error?.message || data?.error_description || err?.message || 'Unknown error';
  return String(detail).slice(0, 300);
}

export interface CalendarEventInput {
  meetingId: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  startsAt: Date;
  minutes: number;
  /** Whether Google emails the invite, and every later change, to the person. */
  notify: boolean;
}

export interface CalendarEventResult {
  eventId: string;
  meetLink: string | null;
  calendarLink: string | null;
}

/**
 * Create the event, or move it if it already exists.
 *
 * Insert first and fall back to patch on a 409, rather than checking for the
 * event beforehand: the id is deterministic, so the conflict is the check, and
 * it costs one round trip in the common case instead of two.
 */
export async function upsertMeetingEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
  const { calendarId } = env();
  const token = await accessToken();
  const eventId = eventIdFor(input.meetingId);
  const end = new Date(input.startsAt.getTime() + input.minutes * 60_000);

  const about = [input.jobTitle, input.email, input.phone].filter(Boolean).join('\n');
  const body: Record<string, unknown> = {
    summary: `Call: ${input.name}`,
    description: ['Career strategy call, Aussie Grad Careers.', about, 'Booked from the sales board.']
      .filter(Boolean)
      .join('\n\n'),
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: end.toISOString() },
    // Kiron's own alarms. The person's reminders are emails, sent by
    // salesMeetingReminderCron, because a calendar popup only reaches someone
    // who accepted the invite.
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }, { method: 'popup', minutes: 10 }] },
    // Always sent, so turning `notify` off on a later edit removes them.
    attendees: input.notify && input.email ? [{ email: input.email, displayName: input.name }] : [],
  };

  const config = {
    headers: { Authorization: `Bearer ${token}` },
    params: { conferenceDataVersion: 1, sendUpdates: input.notify ? 'all' : 'none' },
    timeout: 20_000,
  };
  const base = `${API}/calendars/${encodeURIComponent(calendarId)}/events`;

  let event: any;
  try {
    const r = await axios.post(
      base,
      {
        ...body,
        id: eventId,
        // Only on create. Sending a createRequest on a patch would mint a new
        // room and strand anyone holding the first link.
        conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      },
      config,
    );
    event = r.data;
  } catch (err: any) {
    if (err?.response?.status !== 409) throw err;
    // `status: confirmed` brings back an event that was cancelled and is now
    // being booked again under the same id.
    const r = await axios.patch(`${base}/${eventId}`, { ...body, status: 'confirmed' }, config);
    event = r.data;
  }

  return {
    eventId,
    meetLink: event?.hangoutLink ?? null,
    calendarLink: event?.htmlLink ?? null,
  };
}

/** Take the event off the calendar. Already gone counts as done. */
export async function cancelMeetingEvent(eventId: string, notify: boolean): Promise<void> {
  const { calendarId } = env();
  const token = await accessToken();
  try {
    await axios.delete(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { sendUpdates: notify ? 'all' : 'none' },
      timeout: 20_000,
    });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

/**
 * Which calendar the saved login actually writes to.
 *
 * With only the events scope there is no "who am I" call, but an events list
 * on `primary` comes back with the calendar's summary, which for a primary
 * calendar is the account's email address.
 */
export async function calendarAccount(): Promise<string | null> {
  const { calendarId } = env();
  const token = await accessToken();
  const r = await axios.get(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { maxResults: 1 },
    timeout: 15_000,
  });
  return r.data?.summary ?? null;
}
