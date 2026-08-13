/**
 * The workshop schedule is the one piece of this funnel that cannot fail loudly.
 * When it broke before, the symptom was not an error: registrations kept being
 * accepted, kept being filed against a workshop that had already happened, and
 * the reminder cron kept ticking over an empty result set. It stayed that way
 * for a week.
 *
 * So the roll boundary and the DST switch are pinned here rather than trusted.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { workshopStart, currentSessionKey } from './workshop';

/**
 * A wall-clock reading in the workshop's own zone, which is how a human checks
 * it. Fields are spelled out rather than using dateStyle, whose padding and year
 * width vary by locale and would make these assertions about Node's ICU build
 * rather than about the schedule.
 */
const sydney = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
};

describe('workshop schedule', () => {
  const originalDay = process.env.WORKSHOP_DAY;
  const originalTime = process.env.WORKSHOP_TIME;

  beforeEach(() => {
    process.env.WORKSHOP_DAY = 'tuesday';
    process.env.WORKSHOP_TIME = '17:00';
  });

  afterEach(() => {
    process.env.WORKSHOP_DAY = originalDay;
    process.env.WORKSHOP_TIME = originalTime;
  });

  it('finds the next occurrence from a day earlier in the week', () => {
    // Thursday 13 Aug, 9am. The next Tuesday is the 18th.
    const start = workshopStart(new Date('2026-08-13T09:00:00+10:00'))!;
    expect(currentSessionKey(new Date('2026-08-13T09:00:00+10:00'))).toBe('2026-08-18');
    expect(sydney(start)).toBe('2026-08-18 17:00');
  });

  it('keeps today’s session while the room is still live', () => {
    // 18:00 on the day, 60 minutes into a 90 minute session. Someone registering
    // now belongs to tonight, not next week, or they drop out of tonight's
    // follow-up entirely.
    const now = new Date('2026-08-18T18:00:00+10:00');
    expect(currentSessionKey(now)).toBe('2026-08-18');
  });

  it('rolls to next week once the session has ended, not when it starts', () => {
    const duringLastMinute = new Date('2026-08-18T18:29:00+10:00');
    const justAfter = new Date('2026-08-18T18:31:00+10:00');

    expect(currentSessionKey(duringLastMinute)).toBe('2026-08-18');
    expect(currentSessionKey(justAfter)).toBe('2026-08-25');
  });

  it('holds the local clock time across the October DST switch', () => {
    // Sydney goes to AEDT on the first Sunday in October. The workshop must
    // stay at 7pm for the people attending it, which means the UTC instant
    // moves by an hour. Getting this backwards sends every reminder an hour out.
    const beforeSwitch = workshopStart(new Date('2026-09-29T12:00:00+10:00'))!;
    const afterSwitch = workshopStart(new Date('2026-10-06T12:00:00+11:00'))!;

    expect(sydney(beforeSwitch)).toBe('2026-09-29 17:00');
    expect(sydney(afterSwitch)).toBe('2026-10-06 17:00');

    // Same wall clock, different offset: +10:00 then +11:00.
    expect(beforeSwitch.toISOString()).toBe('2026-09-29T07:00:00.000Z');
    expect(afterSwitch.toISOString()).toBe('2026-10-06T06:00:00.000Z');
  });

  it('follows WORKSHOP_DAY and WORKSHOP_TIME without a deploy', () => {
    process.env.WORKSHOP_DAY = 'thursday';
    process.env.WORKSHOP_TIME = '17:30';

    const start = workshopStart(new Date('2026-08-13T09:00:00+10:00'))!;
    expect(sydney(start)).toBe('2026-08-13 17:30');
  });

  it('falls back to the documented default rather than crashing on a bad value', () => {
    process.env.WORKSHOP_DAY = 'someday';
    process.env.WORKSHOP_TIME = 'whenever';

    const start = workshopStart(new Date('2026-08-13T09:00:00+10:00'))!;
    expect(sydney(start)).toBe('2026-08-18 17:00');
  });
});
