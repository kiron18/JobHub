/**
 * One source of truth for the live workshop, shared by the signup route and the
 * reminder cron. Keeping these together matters: if the route and the cron
 * disagreed about the start time or the meet link, the confirmation email and
 * the reminder would quietly point people at different things.
 *
 * ⚠️ THE SCHEDULE IS RECURRING, NOT A DATE. It used to be a fixed ISO timestamp,
 * which meant the workshop silently expired the moment it ran: the session key
 * kept filing new registrations against a workshop that was already over, and
 * the reminder cron had nothing left in the future to fire at. It stayed broken
 * for a week without a single error in the logs, because nothing here can fail
 * loudly. So the schedule is now a weekday plus a wall-clock time, and the next
 * occurrence is re-derived from the clock every time it is asked for.
 *
 * That also means NOTHING IN THIS FILE MAY BE READ ONCE AT MODULE LOAD. The
 * server process on Railway lives for weeks. A `const CURRENT_SESSION_KEY`
 * evaluated at boot freezes on whatever week the server happened to start in,
 * which is the exact bug this file exists to prevent. Everything time-dependent
 * is a function, and callers must call it per request or per tick.
 *
 * Every value can be overridden by env on Railway, so moving the workshop is a
 * variable change rather than a deploy.
 */

// ── The recurring slot ───────────────────────────────────────────────────────

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Which weekday the workshop runs on, as a name or a 0-6 index (0 = Sunday).
 *
 * Tuesday by default. The reasoning is in the follow-up cadence rather than the
 * room: the D1/D3/D5/D7 sequence out of a Tuesday puts D5 on a Sunday, which is
 * when a job seeker feels the week ahead most sharply, and puts D7 on the next
 * workshop day, so the deadline in that last email is a real one.
 */
function workshopDayIndex(): number {
  const raw = String(process.env.WORKSHOP_DAY || 'tuesday').trim().toLowerCase();
  const byName = DAY_NAMES.indexOf(raw);
  if (byName >= 0) return byName;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  console.warn('[workshop] WORKSHOP_DAY is not a weekday, falling back to Tuesday:', raw);
  return 2;
}

/**
 * Local start time as HH:MM in WORKSHOP_TZ.
 *
 * 5pm, because the room is essentially all Australia-based. An offshore
 * attendee is rare enough that optimising the slot for them would cost more
 * attendance than it wins. The signup page still renders the time in each
 * reader's own zone, so the rare one is not left doing arithmetic.
 */
function workshopTimeOfDay(): { hour: number; minute: number } {
  const raw = String(process.env.WORKSHOP_TIME || '17:00').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  const hour = m ? Number(m[1]) : 17;
  const minute = m ? Number(m[2]) : 0;
  if (!m || hour > 23 || minute > 59) {
    console.warn('[workshop] WORKSHOP_TIME is not HH:MM, falling back to 17:00:', raw);
    return { hour: 17, minute: 0 };
  }
  return { hour, minute };
}

/**
 * The zone the wall-clock time is written in. Not optional and not a display
 * detail: without it the server does this arithmetic in UTC and every reminder
 * lands ten hours out. Sydney and Melbourne are the same zone.
 */
export const WORKSHOP_TZ = process.env.WORKSHOP_TZ || 'Australia/Sydney';
const TZ = WORKSHOP_TZ;

export const WORKSHOP_DURATION_MINUTES = Number(process.env.WORKSHOP_DURATION_MINUTES || 90);

/**
 * Pin a single one-off workshop to an exact instant, disabling the weekly roll.
 * For a rescheduled or extra session. Needs an explicit offset (…+10:00) for the
 * same reason TZ above is not optional.
 *
 * Leave it unset for normal weekly operation. A stale value here reintroduces
 * precisely the bug documented at the top of this file, so it warns on boot.
 */
const PINNED_START = process.env.WORKSHOP_START || '';

// ── Timezone arithmetic ──────────────────────────────────────────────────────
//
// Done with Intl rather than a date library because the server has none, and
// pulling one in for two functions is not worth the dependency. Intl carries the
// full IANA database, so this handles the October and April DST switches without
// a table to maintain.

/** How far ahead of UTC `timeZone` is at `date`, in minutes. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // hourCycle h23 can report midnight as 24; Date.UTC normalises it either way.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asIfUtc - date.getTime()) / 60_000;
}

/** The wall-clock date in `timeZone` right now, as plain numbers. */
function wallClockNow(now: Date, timeZone: string): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdayShort = get('weekday').toLowerCase();
  const weekday = DAY_NAMES.findIndex((d) => d.startsWith(weekdayShort));

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekday >= 0 ? weekday : 0,
  };
}

/**
 * Turn a wall-clock time in `timeZone` into the UTC instant it names.
 *
 * The offset is applied twice on purpose. The first pass guesses the offset
 * using the wall-clock numbers read as if they were UTC, which is wrong by up to
 * an hour across a DST boundary; the second pass re-reads the offset at the
 * corrected instant and fixes it. Without the second pass, a workshop scheduled
 * in AEST but occurring after the October switch fires an hour late.
 */
function zonedToUtc(
  y: number, month: number, d: number, hour: number, minute: number, timeZone: string,
): Date {
  const naive = Date.UTC(y, month - 1, d, hour, minute, 0, 0);
  const firstGuess = naive - tzOffsetMinutes(new Date(naive), timeZone) * 60_000;
  const corrected = naive - tzOffsetMinutes(new Date(firstGuess), timeZone) * 60_000;
  return new Date(corrected);
}

/** YYYY-MM-DD as read in `timeZone`, which is what names the session. */
function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ── The schedule ─────────────────────────────────────────────────────────────

/**
 * When the next workshop starts.
 *
 * It rolls over at the END of the session, not the start, so that someone
 * registering while the room is live still lands in tonight's session and still
 * gets tonight's report. Rolling at the start would file a late registrant
 * against next week and quietly exclude them from the follow-up that actually
 * sells.
 *
 * Returns null only when a pinned WORKSHOP_START is unparseable, which is the
 * one case where guessing a date would be worse than sending nothing.
 */
export function workshopStart(now: Date = new Date()): Date | null {
  if (PINNED_START) {
    const pinned = new Date(PINNED_START);
    if (Number.isNaN(pinned.getTime())) {
      console.warn('[workshop] WORKSHOP_START is not a valid date, calendar invite and reminder disabled:', PINNED_START);
      return null;
    }
    return pinned;
  }

  const targetDay = workshopDayIndex();
  const { hour, minute } = workshopTimeOfDay();
  const today = wallClockNow(now, TZ);

  // Start at today and walk forward. Eight candidates, not seven: if today IS
  // the workshop day and the room has already finished, the answer is the same
  // weekday next week, which is offset 7.
  let daysAhead = (targetDay - today.weekday + 7) % 7;
  for (let i = 0; i <= 7; i++) {
    const candidate = zonedToUtc(today.year, today.month, today.day + daysAhead, hour, minute, TZ);
    const endsAt = candidate.getTime() + WORKSHOP_DURATION_MINUTES * 60_000;
    if (endsAt > now.getTime()) return candidate;
    daysAhead += 7;
  }

  // Unreachable: one of the first two candidates always ends in the future.
  return zonedToUtc(today.year, today.month, today.day + 7, hour, minute, TZ);
}

/**
 * Which workshop new registrations belong to, as the local date of the session.
 *
 * ⚠️ Call this per request. Do not hoist it into a module-level constant: it is
 * the value that goes stale, and a stale one files people against a workshop
 * that has already happened, where the reminder cron will never find them.
 */
export function currentSessionKey(now: Date = new Date()): string {
  const start = workshopStart(now);
  if (!start) return localDateKey(now, TZ);
  return localDateKey(start, TZ);
}

/** Human-readable slot, for logs and for the admin roster header. */
export function workshopSlotLabel(): string {
  const { hour, minute } = workshopTimeOfDay();
  const day = DAY_NAMES[workshopDayIndex()];
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${day[0].toUpperCase()}${day.slice(1)} ${hh}:${mm} ${TZ}`;
}

// ── The rest ─────────────────────────────────────────────────────────────────

/**
 * Where the workshop actually happens.
 *
 * ⚠️ This default is the room people are actually sent to. On 25 Aug 2026 it
 * still held the 6 Aug room (`mjm-domw-oyv`) while the session ran somewhere
 * else, so the confirmation and reminder emails both pointed at an empty room:
 * two of the three attendees sat in a waiting room for twelve minutes and one
 * of them dropped out entirely. Whenever the room changes, change it here, and
 * check `WORKSHOP_MEET_LINK` in the Railway environment, because a value set
 * there silently wins over this line.
 */
export const MEET_LINK = process.env.WORKSHOP_MEET_LINK || 'https://meet.google.com/zgj-shhk-xus';

/** Used in the subject line and body of both emails, and in the calendar entry. */
export const WORKSHOP_TITLE = process.env.WORKSHOP_TITLE || '"Your first Aussie Job" Workshop';

/** How long before the start the reminder email goes out. */
export const REMINDER_MINUTES_BEFORE = Number(process.env.WORKSHOP_REMINDER_MINUTES || 20);

/**
 * The free Skool group. This is the payoff on the confirmation screen and the
 * single door to everything else: the resource pack, the workshop schedule and
 * the community thread.
 *
 * Points at the branded redirect rather than skool.com so the destination can
 * move without a deploy and so the click is attributable by ?src=.
 */
export const SKOOL_URL =
  process.env.SKOOL_GROUP_URL || 'https://aussiegradcareers.com.au/community';

/**
 * Guards the roster export, which returns names, emails and the full text of
 * everyone's resume.
 *
 * ⚠️ NO FALLBACK, DELIBERATELY. This used to default to a placeholder string
 * that was committed to the repo, which meant the roster was readable by anyone
 * who had read the source: a public URL, a known key, twelve people's resumes.
 * An unset key now disables the endpoint rather than opening it. If you are
 * tempted to add a default back so it "works locally", set the variable in your
 * local .env instead.
 */
export const EXPORT_KEY: string | null = process.env.SESSION_EXPORT_KEY || null;

// Surfaced at boot because every failure mode in this file is silent otherwise.
if (PINNED_START) {
  console.warn(
    `[workshop] pinned to a single session (${PINNED_START}); the weekly roll is OFF. ` +
    'Unset WORKSHOP_START to resume the recurring schedule.',
  );
} else {
  console.log(`[workshop] weekly slot: ${workshopSlotLabel()} — next: ${workshopStart()?.toISOString()}`);
}
if (!EXPORT_KEY) {
  console.warn('[workshop] SESSION_EXPORT_KEY is not set — the roster export is disabled.');
}
