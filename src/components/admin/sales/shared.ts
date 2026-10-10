/* Shared by the sales board (pages/AdminSales.tsx) and the pieces it is built
   from: the resume upload, the meeting editor and the week and month overview. */
import type { CSSProperties } from 'react';

export const C = {
  bg: '#FFFFFF', alt: '#F7FAFC', line: '#E3EAF0', lineStrong: '#CBD7E1',
  ink: '#0F1E2B', ink2: '#4A5A68', ink3: '#8496A4', blue: '#1857A0', danger: '#B4432F',
  good: '#1E7A56',
};

export interface Meeting {
  id: string;
  startsAt: string;
  minutes: number;
  /** Whether they get the calendar invite and the reminder emails. */
  notify: boolean;
  meetLink: string | null;
  calendarLink: string | null;
  /** Why the meeting is on the board but not on the calendar, when it is not. */
  calendarError: string | null;
  /** True while that reminder email has not gone and is still going to. */
  reminderDayPending: boolean;
  reminderHourPending: boolean;
}

/** One entry in the overview: every meeting, for everyone, not just this page. */
export interface MeetingDot {
  id: string;
  leadId: string;
  name: string;
  startsAt: string;
  minutes: number;
}

/** The details read off a resume. All of them can be typed over. */
export const CONTACT_FIELDS = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['jobTitle', 'Job title'],
  ['profession', 'Profession'],
  ['company', 'Employer'],
  ['visaStatus', 'Visa'],
  ['education', 'Education'],
  ['linkedinUrl', 'LinkedIn'],
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number][0];
export type ContactValues = Record<ContactField, string>;

export function contactValuesOf(lead: Partial<Record<ContactField, string | null>>): ContactValues {
  const out = {} as ContactValues;
  for (const [key] of CONTACT_FIELDS) out[key] = lead[key] ?? '';
  return out;
}

export const sectionLabel: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
  color: C.ink3, margin: '0 0 7px',
};

export const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7,
  border: `1.5px solid ${C.lineStrong}`, fontSize: 13, fontFamily: 'inherit',
  background: C.bg, color: C.ink,
};

export const buttonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1.5px solid ${C.line}`, background: C.bg, color: C.ink2,
};

export const primaryButtonStyle: CSSProperties = {
  ...buttonStyle, border: `1.5px solid ${C.blue}`, background: C.blue, color: '#fff',
};

/** How long a call can be booked for, in minutes. */
export const DURATIONS = [15, 30, 45, 60, 90];

/** The value a `datetime-local` input wants, in the browser's own zone.
 *  `toISOString` would give UTC and put a 3pm Sydney call in the box as 4am. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `Tue 14 Oct, 3:00 pm`, in the browser's zone. */
export function meetingLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${timeLabel(iso)}`;
}

export function timeLabel(iso: string): string {
  // Twelve-hour on purpose: "6:03" on a sales call could be either end of the day.
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

/**
 * When the next reminder email goes, or why none will.
 *
 * Here so the board can answer "will they actually be reminded" without
 * anyone having to trust that a cron somewhere is doing its job.
 */
export function nextReminder(m: Meeting, hasEmail: boolean, now = Date.now()): string {
  if (!hasEmail) return 'No reminders: there is no email on file.';
  if (!m.notify) return 'No reminders: the invite and reminders are switched off for this meeting.';
  const start = new Date(m.startsAt).getTime();
  const at = (ms: number) => meetingLabel(new Date(ms).toISOString());
  // Each reminder has a cut-off after which it is skipped rather than sent late.
  if (m.reminderDayPending && now < start - 12 * 3_600_000) return `Next reminder email: ${at(start - 24 * 3_600_000)} (the day before).`;
  if (m.reminderHourPending && now < start - 20 * 60_000) return `Next reminder email: ${at(start - 3_600_000)} (an hour before).`;
  return 'No more reminder emails to send for this meeting.';
}

export function isFinished(m: { startsAt: string; minutes: number }, now = Date.now()): boolean {
  return new Date(m.startsAt).getTime() + m.minutes * 60_000 <= now;
}

/** What a failed request has to say for itself. */
export function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string } | null;
  return e?.response?.data?.error ?? e?.message ?? fallback;
}
