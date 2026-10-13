/* The arithmetic behind the journey bar (JourneyBar.tsx), kept apart from the
   component so the Daily page can ask "is a call due" without drawing one. */
import { isFinished, type MeetingDot } from './shared';

export const DAY = 86_400_000;
/** A week without a call, once the first one has happened, is a call due. */
const CALL_DUE_DAYS = 7;

export interface JourneyLead {
  createdAt: string;
  registeredAt: string | null;
  skoolClickedAt: string | null;
  attendedAt: string | null;
  reportSentAt: string | null;
  paidAt: string | null;
  emailsSent: { at: string; subject: string }[];
}

export interface Journey {
  /** When this was worked out, so the bar and its numbers agree. */
  now: number;
  start: number;
  /** 1 on the day they first showed up. */
  day: number;
  scaleDays: number;
  steps: { label: string; at: number }[];
  emails: { at: number; subject: string }[];
  calls: { at: number; done: boolean }[];
  lastCallAt: number | null;
  nextCallAt: number | null;
  /** Emails sent after the most recent finished call. */
  sinceCall: number;
  lastContactAt: number | null;
  callDue: boolean;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export function buildJourney(lead: JourneyLead, meetings: MeetingDot[], now = Date.now()): Journey {
  const emails = lead.emailsSent.map((e) => ({ at: new Date(e.at).getTime(), subject: e.subject }));
  const calls = meetings
    .map((m) => ({ at: new Date(m.startsAt).getTime(), done: isFinished(m, now) }))
    .sort((a, b) => a.at - b.at);

  const steps = ([
    ['Registered', ms(lead.registeredAt)],
    ['Skool click', ms(lead.skoolClickedAt)],
    ['Attended', ms(lead.attendedAt)],
    ['Report sent', ms(lead.reportSentAt)],
    ['Paid', ms(lead.paidAt)],
  ] as const).flatMap(([label, at]) => (at ? [{ label, at }] : []));

  // The first thing that ever happened, not the row's creation: an imported
  // lead can have a registration older than the row that now holds it.
  const start = Math.min(
    new Date(lead.createdAt).getTime(),
    ...steps.map((s) => s.at),
    ...emails.map((e) => e.at),
    ...calls.filter((c) => c.done).map((c) => c.at),
  );
  const day = Math.max(1, Math.floor((now - start) / DAY) + 1);
  const scaleDays = day <= 10 ? 10 : day <= 30 ? 30 : 90;

  const doneCalls = calls.filter((c) => c.done);
  const lastCallAt = doneCalls.length ? doneCalls[doneCalls.length - 1].at : null;
  const nextCallAt = calls.find((c) => !c.done)?.at ?? null;
  const lastEmailAt = emails.length ? emails[emails.length - 1].at : null;
  const lastContactAt = Math.max(lastCallAt ?? 0, lastEmailAt ?? 0) || null;

  return {
    now, start, day, scaleDays, steps, emails, calls, lastCallAt, nextCallAt,
    sinceCall: lastCallAt ? emails.filter((e) => e.at > lastCallAt).length : 0,
    lastContactAt,
    callDue: !!lastCallAt && !nextCallAt && now - lastCallAt >= CALL_DUE_DAYS * DAY,
  };
}

export const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function daysAgo(t: number, now = Date.now()): string {
  const d = Math.floor((now - t) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}
