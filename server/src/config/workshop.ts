/**
 * One source of truth for the live workshop, shared by the signup route and the
 * reminder cron. Keeping these together matters: if the route and the cron
 * disagreed about the start time or the meet link, the confirmation email and
 * the reminder would quietly point people at different things.
 *
 * Every value can be overridden by env on Railway, so the next workshop is a
 * variable change rather than a deploy.
 */

/** Which workshop new registrations belong to. Bump before the next one. */
export const CURRENT_SESSION_KEY = process.env.SESSION_KEY || '2026-08-06';

/** Where the workshop actually happens. */
export const MEET_LINK = process.env.WORKSHOP_MEET_LINK || 'https://meet.google.com/mjm-domw-oyv';

/** Used in the subject line and body of both emails, and in the calendar entry. */
export const WORKSHOP_TITLE = process.env.WORKSHOP_TITLE || '"Your first Aussie Job" Workshop';

/**
 * Start time as an ISO timestamp with an explicit offset. The offset is not
 * optional: without it the server parses this in UTC and everyone is reminded
 * ten hours late.
 */
const WORKSHOP_START_RAW = process.env.WORKSHOP_START || '2026-08-06T17:00:00+10:00';

export const WORKSHOP_DURATION_MINUTES = Number(process.env.WORKSHOP_DURATION_MINUTES || 90);

/** How long before the start the reminder email goes out. */
export const REMINDER_MINUTES_BEFORE = Number(process.env.WORKSHOP_REMINDER_MINUTES || 20);

/**
 * Guards the roster export, which returns names, emails and resume text. The
 * fallback exists so the endpoint works locally without setup and is not a
 * secret; set SESSION_EXPORT_KEY on Railway.
 */
export const EXPORT_KEY = process.env.SESSION_EXPORT_KEY || 'agc-session-export';

export function workshopStart(): Date | null {
  if (!WORKSHOP_START_RAW) return null;
  const d = new Date(WORKSHOP_START_RAW);
  if (Number.isNaN(d.getTime())) {
    console.warn('[workshop] WORKSHOP_START is not a valid date, calendar invite and reminder disabled:', WORKSHOP_START_RAW);
    return null;
  }
  return d;
}
