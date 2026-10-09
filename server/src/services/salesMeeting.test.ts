/**
 * The two pieces of the meeting feature that are pure arithmetic, and where
 * being wrong means an email at the wrong moment: which reminders are already
 * pointless when a call is booked, and which calls are due one right now.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../index', () => ({ prisma: {} }));
// The cron imports the mailer, which builds a Resend client at module load.
vi.mock('./email', () => ({ sendSalesMeetingReminderEmail: vi.fn() }));

import { reminderStamps } from './salesMeeting';
import { reminderWindow } from '../cron/salesMeetingReminderCron';
import { eventIdFor } from './googleCalendar';
import { fallbackContact, normaliseContact } from './resumeContact';

const now = new Date('2026-10-12T02:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe('reminderStamps', () => {
  it('leaves both reminders to send for a call days away', () => {
    expect(reminderStamps(inHours(72), now)).toEqual({ reminderDaySentAt: null, reminderHourSentAt: null });
  });

  /** Booked this afternoon for tomorrow morning: the invite has just gone, so
   *  "see you tomorrow" seconds later is noise. The hour-before one still goes. */
  it('skips the day-before reminder for a call inside 24 hours', () => {
    const s = reminderStamps(inHours(18), now);
    expect(s.reminderDaySentAt).toEqual(now);
    expect(s.reminderHourSentAt).toBeNull();
  });

  it('skips both for a call starting within the hour', () => {
    const s = reminderStamps(inHours(0.5), now);
    expect(s.reminderDaySentAt).toEqual(now);
    expect(s.reminderHourSentAt).toEqual(now);
  });
});

describe('reminderWindow', () => {
  const due = (kind: 'day' | 'hour', startsAt: Date) => {
    const w = reminderWindow(kind, now);
    return startsAt > w.gt && startsAt <= w.lte;
  };

  it('sends the day-before reminder once the call is 24 hours out', () => {
    expect(due('day', inHours(25))).toBe(false);
    expect(due('day', inHours(23.9))).toBe(true);
  });

  /** A server that was down through the window must not send "tomorrow" a few
   *  hours before the call. */
  it('gives up on the day-before reminder when it is far too late', () => {
    expect(due('day', inHours(6))).toBe(false);
  });

  it('sends the hour-before reminder inside the hour, and not as the call starts', () => {
    expect(due('hour', inHours(1.5))).toBe(false);
    expect(due('hour', inHours(0.9))).toBe(true);
    expect(due('hour', inHours(0.1))).toBe(false);
  });
});

describe('eventIdFor', () => {
  /** Google rejects ids outside base32hex (0-9, a-v) with a flat "Invalid
   *  resource id value", which is how the Python CRM lost bookings. */
  it('only ever uses characters Google accepts, and is stable', () => {
    const id = eventIdFor('cmxyz123WXYZ');
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFor('cmxyz123WXYZ')).toBe(id);
    expect(eventIdFor('other')).not.toBe(id);
  });
});

describe('resume contact', () => {
  const text = 'Priya Sharma\nParramatta NSW | 0412 345 678 | Priya.Sharma@example.com\nGraduate Data Analyst';

  it('still finds an email and a phone when the model is unavailable', () => {
    expect(fallbackContact(text)).toMatchObject({ email: 'priya.sharma@example.com', phone: '0412 345 678', name: null });
  });

  it('turns "not stated" answers into blanks rather than storing them', () => {
    const c = normaliseContact({ name: 'Priya Sharma', visaStatus: 'Not stated', location: 'null', phone: '' }, text);
    expect(c.visaStatus).toBeNull();
    expect(c.location).toBeNull();
    // The model gave no phone, so the one in the document is used.
    expect(c.phone).toBe('0412 345 678');
  });

  it('keeps the profession on the fixed list the board groups by', () => {
    expect(normaliseContact({ profession: 'Data & Analytics' }, text).profession).toBe('Data & Analytics');
    expect(normaliseContact({ profession: 'Data wrangling' }, text).profession).toBe('Other');
  });

  it('does not accept a made-up email over the one in the document', () => {
    expect(normaliseContact({ email: 'priya at example' }, text).email).toBe('priya.sharma@example.com');
  });

  it('drops a "LinkedIn" that is not a LinkedIn link, and completes a bare one', () => {
    expect(normaliseContact({ linkedinUrl: 'github.com/priya' }, text).linkedinUrl).toBeNull();
    expect(normaliseContact({ linkedinUrl: 'linkedin.com/in/priya' }, text).linkedinUrl).toBe('https://linkedin.com/in/priya');
  });
});
