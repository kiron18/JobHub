import { renderResumePdf, resumeFilename } from './resumePdf';
import { Resend } from 'resend';
import type { CvGapResult, RoadmapStep } from './cvGapScan';
import { PUBLIC_APP_URL } from '../lib/appUrl';
import { skoolMemberSearchUrl, skoolMemberSearchByName } from '../lib/skoolLinks';
import { unmatchedAlertMode } from '../config/alerts';
import { prisma } from '../index';
import { injectEmailTracking } from '../email/send/sendEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = 'https://aussiegradcareers.com.au';

/**
 * Where "Find out more" in the welcome resume email goes.
 *
 * Points at the app root, not at /how-it-works, because that explainer page is
 * not built yet and an email cannot be fixed once it is sent. A 404 in the
 * inbox is a dead lead. Repoint this the day the page ships; it is the same
 * destination as POSITIONING_EXPLAINER_URL on the front door.
 */
const WELCOME_EMAIL_CTA_URL = APP_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'kiron@aussiegradcareers.com.au';
const FROM_ADDRESS = `Aussie Grad Careers <kiron@aussiegradcareers.com.au>`;

/**
 * The free Skool group, as linked from the workshop emails.
 *
 * Attendance is members-only, so this link is a condition of entry rather than
 * an invitation, which is why it sits directly under the join link in both
 * emails instead of at the bottom with the sign-off.
 *
 * Points at the branded redirect rather than skool.com so the destination can
 * move without a deploy and the click stays attributable to the email.
 */
const SKOOL_GROUP_LINK = `${APP_URL}/community?src=email`;

/**
 * Every email that goes to a client or lead goes out through here, so
 * /admin/email-analytics can say when each kind last went out and how it did.
 * Mail to Kiron himself (alerts, payment notices, the Skool task) does not, and
 * neither do password resets: none of those are things to measure.
 *
 * `kind` names the email, not the send: it becomes the EmailTemplate the sends
 * are grouped under on the dashboard, so keep it stable once it has shipped.
 *
 * Only HTML can be measured. A plain-text email has nowhere to put an open
 * pixel, and its links are left as written rather than swapped for a long
 * tracking URL, so for those the dashboard counts sends and nothing else.
 *
 * Tracking is best-effort: a failure to record a send must never be the reason
 * someone does not get their email.
 */
async function sendLogged(
  kind: string,
  email: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    firstName?: string | null;
  },
  opts: { trackLinks?: boolean } = {},
) {
  const { to, subject, text, html, attachments, firstName } = email;
  let trackingId: string | null = null;
  try {
    // As typed, not lowercased: existing Contact rows were keyed this way, and
    // a lowercased key would split one person into two contacts.
    const contactEmail = to.trim();
    const [contact, template] = await Promise.all([
      prisma.contact.upsert({
        where: { email: contactEmail },
        update: firstName ? { firstName } : {},
        create: { email: contactEmail, firstName: firstName || undefined, source: kind },
      }),
      prisma.emailTemplate.upsert({
        where: { name: kind },
        // The latest copy, so the dashboard's "has links" check never goes stale.
        update: { subject, bodyHtml: html ?? null, bodyText: text ?? null },
        create: { name: kind, subject, bodyHtml: html ?? null, bodyText: text ?? null },
      }),
    ]);
    const row = await prisma.emailSend.create({
      data: { contactId: contact.id, templateId: template.id, subject, fromEmail: FROM_ADDRESS, toEmail: to },
    });
    trackingId = row.id;
  } catch (err) {
    console.warn(`[email] could not record ${kind} send for tracking:`, (err as Error).message);
  }

  const forget = () => trackingId
    ? prisma.emailSend.delete({ where: { id: trackingId } }).catch(() => {})
    : Promise.resolve();

  let result: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html: trackingId ? injectEmailTracking(html, trackingId, opts) : html } : {}),
      ...(attachments ? { attachments } : {}),
    } as Parameters<typeof resend.emails.send>[0]);
  } catch (err) {
    await forget();
    throw err;
  }

  // Resend reports a rejected send in the result rather than throwing. A send
  // that never left must not count as sent on the dashboard.
  if (result.error) {
    console.error(`[email] ${kind} to ${to} was rejected by Resend:`, result.error.message);
    await forget();
  } else if (trackingId && result.data?.id) {
    await prisma.emailSend.update({ where: { id: trackingId }, data: { resendEmailId: result.data.id } }).catch(() => {});
  }
  return result;
}

export async function sendAccessRequestNotification(params: {
  userName: string;
  userEmail: string;
  skoolEmail: string;
  targetRole: string;
  userId: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping access request notification');
    return;
  }
  const { userName, userEmail, skoolEmail, targetRole, userId } = params;
  const supabaseUrl = `https://supabase.com/dashboard/project/${process.env.SUPABASE_PROJECT_REF ?? '_'}/editor`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    subject: `[JobHub Access Request] ${userName || userEmail}${targetRole ? ` — ${targetRole}` : ''}`,
    text: [
      'New dashboard access request',
      '',
      `Name:         ${userName || '(not set)'}`,
      `JobHub email: ${userEmail}`,
      `Skool email:  ${skoolEmail || '(same as above)'}`,
      `Target role:  ${targetRole || '(not set)'}`,
      `User ID:      ${userId}`,
      '',
      'To approve, run this SQL in Supabase:',
      '',
      `UPDATE "CandidateProfile" SET "dashboardAccess" = true WHERE "userId" = '${userId}';`,
      '',
      `Supabase SQL editor: ${supabaseUrl}`,
      '',
      'To deny, no action needed.',
    ].join('\n'),
  });
}

/**
 * "Mail me if shit goes down again" — the gap UptimeRobot doesn't cover.
 *
 * UptimeRobot (see the three monitors on kiron182@gmail.com) catches the site
 * or API being fully unreachable. It never catches a route that answers with
 * its own 500 — the health check still returns 200, so nothing trips. That's
 * exactly how the OpenRouter-credit 402 and the trial-challenge dead-end both
 * went unnoticed until a client hit them. Sentry.captureMessage below already
 * records every 5xx (see the middleware in index.ts), but SENTRY_DSN was
 * never actually set on either Railway environment, so nothing was reading
 * those events either. This is the direct line until that's plugged in.
 *
 * Cooldown, not a queue: an outage produces a burst of 500s from the same
 * cause, and mailing once per request during that burst is the failure mode
 * this exists to prevent, not the thing it exists to do. One email per
 * cooldown window names the first failure and how many followed; Railway's
 * own log stream is still the place to read the rest. Per-process only — this
 * resets on a redeploy, which just means a fresh deploy gets its own first
 * warning, not silence.
 */
const ERROR_ALERT_COOLDOWN_MS = 10 * 60 * 1000;
let lastErrorAlertAt = 0;
let suppressedSinceLastAlert = 0;

/**
 * Tells Kiron someone filled in the /book-a-call form, with their resume
 * attached, so it is in his inbox before the call whether or not the CRM is
 * open. Reply-to is the lead, so answering the email answers them.
 */
export async function sendBookingIntakeNotification(params: {
  name: string;
  email: string;
  visaStatus: string | null;
  biggestChallenge: string | null;
  resume: { filename: string; content: Buffer } | null;
  resumeReadable: boolean;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping booking intake notification');
    return;
  }
  const { name, email, visaStatus, biggestChallenge, resume, resumeReadable } = params;
  const resumeLine = !resume
    ? 'No resume uploaded.'
    : resumeReadable
      ? `Resume attached: ${resume.filename}`
      : `Resume attached: ${resume.filename} (could not read text from it, open the file)`;

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    replyTo: email,
    subject: `[Book a call] ${name}${resume ? ' (resume attached)' : ''}`,
    text: [
      'New /book-a-call form submission.',
      '',
      `Name:   ${name}`,
      `Email:  ${email}`,
      `Visa:   ${visaStatus || '(not given)'}`,
      '',
      'Biggest challenge right now:',
      biggestChallenge || '(not given)',
      '',
      resumeLine,
      '',
      'They were sent on to Calendly to pick a slot. This email means the form',
      'was filled in, not that a call is booked. The lead and resume also land',
      'on the sales board the next time the CRM is running.',
    ].join('\n'),
    ...(resume ? { attachments: [{ filename: resume.filename, content: resume.content }] } : {}),
  });
  if (result.error) {
    console.error('[email] booking intake notification rejected by Resend:', result.error.message);
  }
}

export function alertOnServerError(params: { method: string; url: string; status: number; body: unknown }): void {
  if (!process.env.RESEND_API_KEY) return; // same silent-skip as every other sender here
  const now = Date.now();
  if (now - lastErrorAlertAt < ERROR_ALERT_COOLDOWN_MS) {
    suppressedSinceLastAlert += 1;
    return;
  }
  const suppressedNote = suppressedSinceLastAlert > 0
    ? `${suppressedSinceLastAlert} more 5xx response${suppressedSinceLastAlert === 1 ? '' : 's'} followed in the next ${Math.round(ERROR_ALERT_COOLDOWN_MS / 60000)} minutes, not each mailed separately.`
    : 'First 5xx seen since this cooldown started.';
  lastErrorAlertAt = now;
  suppressedSinceLastAlert = 0;

  const { method, url, status, body } = params;
  let bodyText: string;
  try { bodyText = JSON.stringify(body, null, 2); } catch { bodyText = String(body); }

  resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    // Staging runs on its own Railway service and emails the same inbox, so
    // say which one it was; otherwise a test run reads as a production outage.
    subject: `[JobHub${/staging/i.test(process.env.RAILWAY_SERVICE_NAME ?? '') ? ' STAGING' : ''}] ${status} on ${method} ${url}`,
    text: [
      `${method} ${url} -> ${status}`,
      '',
      'Response body:',
      bodyText,
      '',
      suppressedNote,
      '',
      'Railway logs: https://railway.com/project/90ab3119-8aa0-406f-876c-2a579144c690',
    ].join('\n'),
  }).catch((err) => console.error('[email] server-error alert failed to send:', err));
}

export async function sendFridayBriefEmail(script: string, reportCount: number, weekLabel: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping Friday Brief email');
    return;
  }
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    subject: `Friday Brief — ${weekLabel} (${reportCount} report${reportCount === 1 ? '' : 's'})`,
    text: [
      `Friday Brief — Week of ${weekLabel}`,
      `Reports this week: ${reportCount}`,
      '',
      '─'.repeat(60),
      '',
      script,
      '',
      '─'.repeat(60),
      'Sent automatically from JobHub Admin',
    ].join('\n'),
  });
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }
  await sendLogged('diagnosis_ready', {
    to,
    subject: 'Your diagnosis is ready - here\'s what we found',
    text: [
      "G'day,",
      '',
      "Your diagnostic report is ready.",
      '',
      "We've gone through your resume, your answers, and your situation. What's in there is written specifically for you, not a template.",
      '',
      "Click below to read your full diagnosis and three-step fix:",
      '',
      `${APP_URL}/?view=report`,
      '',
      "The Aussie Grad Careers team",
      `aussiegradcareers.com.au`,
    ].join('\n'),
  });
}

function icsEscape(value: string): string {
  // RFC 5545: backslash, semicolon and comma are escaped, newlines become \n.
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * RFC 5545 caps a content line at 75 octets and continues it with CRLF plus a
 * single space. Gmail tolerates long lines; Outlook is less forgiving, so fold.
 * Counts bytes rather than characters so a multi-byte name cannot push a line
 * over the limit unnoticed.
 */
function icsFold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte character: back off to a lead byte boundary.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join('\r\n ');
}

/**
 * A calendar invite for the workshop, as an .ics attachment.
 *
 * This is the reminder mechanism. Google only sends reminders itself for events
 * created through the Calendar API with the person added as an attendee, which
 * needs OAuth we do not have here. An .ics attachment needs no auth, is
 * rendered by Gmail as a real invite with an add-to-calendar button, and once
 * it is in their calendar their own default reminders do the work. It also
 * covers Outlook and Apple Calendar, which a Google-only path would not.
 *
 * METHOD:REQUEST with an organizer and an attendee is what makes Gmail show the
 * rich invite card rather than a bare file attachment.
 */
export function buildWorkshopIcs(params: {
  to: string;
  meetLink: string;
  workshopTitle: string;
  start: Date;
  end: Date;
  uid: string;
}): string {
  const { to, meetLink, workshopTitle, start, end, uid } = params;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aussie Grad Careers//Workshop//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(workshopTitle)}`,
    `DESCRIPTION:${icsEscape(`Join here: ${meetLink}`)}`,
    `LOCATION:${icsEscape(meetLink)}`,
    `URL:${meetLink}`,
    // CN is quoted because it contains a comma, which is otherwise read as a
    // parameter value separator.
    'ORGANIZER;CN="Kiron, Aussie Grad Careers":mailto:kiron@aussiegradcareers.com.au',
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${to}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Belt and braces. Most clients apply the user's own defaults over these,
    // which is fine, but a client with no defaults still nudges them.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(workshopTitle)} starts in an hour`,
    'END:VALARM',
    // Matches the reminder email so the calendar and the inbox nudge at the
    // same moment rather than pestering them twice a few minutes apart.
    'BEGIN:VALARM',
    'TRIGGER:-PT20M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(workshopTitle)} starts in 20 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(icsFold).join('\r\n');
}

/**
 * Confirmation for a workshop registration, sent the moment the form is
 * submitted. Its whole job is to put the join link in their inbox while they
 * are still paying attention, so the link is the first thing in the body and
 * is not buried behind a button.
 *
 * When a start time is configured, a calendar invite rides along so the event
 * lands in their calendar and their own reminders fire. Without one the email
 * still sends, just without the invite.
 *
 * Deliberately no em dashes in this copy.
 */
export async function sendWorkshopConfirmationEmail(params: {
  to: string;
  name: string;
  meetLink: string;
  workshopTitle: string;
  start?: Date | null;
  durationMinutes?: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping workshop confirmation');
    return;
  }
  const { to, name, meetLink, workshopTitle, start, durationMinutes = 60 } = params;
  // They typed their own name, so it can be anything. Take the first word and
  // fall back to a bare greeting rather than printing "Hey ,".
  const firstName = (name || '').trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hey ${firstName}, thanks for filling the form.` : 'Hey, thanks for filling the form.';

  const attachments = [];
  if (start && !Number.isNaN(start.getTime())) {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const ics = buildWorkshopIcs({
      to,
      meetLink,
      workshopTitle,
      start,
      end,
      // Stable per person per workshop, so a resend updates the same calendar
      // entry instead of creating a duplicate.
      uid: `workshop-${start.toISOString().slice(0, 10)}-${Buffer.from(to).toString('hex').slice(0, 24)}@aussiegradcareers.com.au`,
    });
    attachments.push({
      filename: 'workshop.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      contentType: 'text/calendar; method=REQUEST; charset=utf-8',
    });
  }

  await sendLogged('workshop_confirmation', {
    to,
    subject: `You're in. Here's your ${workshopTitle} link`,
    text: [
      greeting,
      '',
      `You're registered for the ${workshopTitle}.`,
      '',
      'Here is the link to join:',
      meetLink,
      '',
      start
        ? 'The calendar invite is attached, so add it and your calendar will remind you before we start.'
        : 'Save it now or drop it straight into your calendar, so you are not hunting for it when we start.',
      '',
      // Membership is a real condition of entry, so it is stated here rather
      // than discovered at the door. It sits directly under the link because
      // that is the only place someone is guaranteed to read on the way in.
      'One condition: the workshop is for members of the free group only.',
      'Join here with this same email address, it takes twenty seconds:',
      SKOOL_GROUP_LINK,
      '',
      'The full resource pack and every past session live in there too.',
      '',
      // The form no longer asks qualifying questions, so the running order now
      // comes from the group thread instead. This line and the confirmation
      // screen have to keep saying the same thing.
      'While you are in there, post the one thing that is actually stopping you.',
      'I build the running order from that thread, and the most liked ones get answered live.',
      '',
      'See you there,',
      'Kiron',
      'aussiegradcareers.com.au',
    ].join('\n'),
    ...(attachments.length ? { attachments } : {}),
  });
}

/**
 * The nudge that goes out shortly before the workshop starts.
 *
 * This exists because the calendar alarm only fires for people who actually
 * added the invite. This one lands regardless.
 *
 * Deliberately no em dashes in this copy.
 */
export async function sendWorkshopReminderEmail(params: {
  to: string;
  name: string;
  meetLink: string;
  workshopTitle: string;
  minutesBefore: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping workshop reminder');
    return;
  }
  const { to, name, meetLink, workshopTitle, minutesBefore } = params;
  const firstName = (name || '').trim().split(/\s+/)[0] || '';

  await sendLogged('workshop_reminder', {
    to,
    subject: `Starting in ${minutesBefore} minutes`,
    text: [
      firstName ? `Hey ${firstName},` : 'Hey,',
      '',
      `The ${workshopTitle} starts in ${minutesBefore} minutes.`,
      '',
      'Here is the link:',
      meetLink,
      '',
      // Short version of the same condition. Anyone who ignored it in the
      // confirmation has twenty minutes left to fix it, which is enough.
      'Members of the free group only, so if you have not joined yet, do it now:',
      SKOOL_GROUP_LINK,
      '',
      'Come with the thing you actually want answered. See you in there.',
      '',
      'Kiron',
      'aussiegradcareers.com.au',
    ].join('\n'),
  });
}

/**
 * The reminder before a booked sales call: one the day before, one an hour out.
 *
 * Sent by salesMeetingReminderCron. The calendar invite Google sends at booking
 * only helps the people who accept it, and a no-show on a sales call costs the
 * whole slot, so this lands regardless.
 *
 * The time is written in Sydney time with the zone spelled out. The server
 * runs in UTC, and "3:00 pm" without a zone, rendered there, would be ten or
 * eleven hours wrong.
 *
 * Deliberately no em dashes in this copy.
 */
export async function sendSalesMeetingReminderEmail(params: {
  to: string;
  name: string;
  startsAt: Date;
  meetLink: string | null;
  kind: 'day' | 'hour';
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping sales meeting reminder');
    return;
  }
  const { to, name, startsAt, meetLink, kind } = params;
  const firstName = (name || '').trim().split(/\s+/)[0] || '';
  const tz = process.env.WORKSHOP_TZ || 'Australia/Sydney';
  const time = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).format(startsAt);
  const day = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long',
  }).format(startsAt);

  const link = meetLink
    ? ['Here is the link:', meetLink, '']
    // No room on file means the calendar write failed, so there is no invite
    // to point at either. Saying nothing beats promising a link that is not there.
    : [];

  await sendLogged(kind === 'day' ? 'sales_meeting_reminder_day' : 'sales_meeting_reminder_hour', {
    to,
    firstName: firstName || null,
    subject: kind === 'day' ? `Our call tomorrow at ${time}` : 'Our call starts in an hour',
    text: [
      firstName ? `Hey ${firstName},` : 'Hey,',
      '',
      kind === 'day'
        ? `A quick reminder that we are talking tomorrow, ${day}, at ${time}.`
        : `We are on in an hour, at ${time}.`,
      '',
      ...link,
      kind === 'day'
        ? 'If the time no longer works, reply to this email and we will move it.'
        : 'Have your resume open and bring the thing you most want sorted.',
      '',
      'Kiron',
      'aussiegradcareers.com.au',
    ].join('\n'),
  });
}

export async function sendClientOnboardingEmail(params: {
  to: string;
  actionLink: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping client onboarding email');
    return;
  }
  const { to, actionLink } = params;

  await sendLogged('client_onboarding', {
    to,
    subject: "You're in — set your password and get started",
    html: [
      `<table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 560px; margin: 0 auto; font-family: Arial, sans-serif;">`,
      `<tr><td style="padding: 32px 24px; background: #f5f3ef; border-radius: 12px;">`,
      `<h1 style="font-size: 20px; font-weight: 600; color: #1a1814; margin: 0 0 12px;">Welcome to Aussie Grad Careers</h1>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 16px; line-height: 1.6;">Your payment is confirmed and your account is ready. Your login is this email address (<strong>${to}</strong>) — use the same email that's on your resume so everything stays in sync.</p>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 20px; line-height: 1.6;">First, set your password:</p>`,
      `<p style="margin: 0 0 24px;"><a href="${actionLink}" style="display: inline-block; background: #2d5a6e; color: #faf7f2; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">Set your password</a></p>`,
      `<p style="font-size: 13px; color: #6b6559; margin: 0 0 8px; line-height: 1.6;"><strong>How to get started once you're in:</strong></p>`,
      `<ol style="font-size: 13px; color: #6b6559; margin: 0 0 20px; padding-left: 18px; line-height: 1.7;">`,
      `<li>Upload your resume so we can tailor everything to you.</li>`,
      `<li>Tell us your target roles — every application gets positioned for them automatically.</li>`,
      `<li>Work your daily application goal from the dashboard — every application is a rep.</li>`,
      `</ol>`,
      `<p style="font-size: 12px; color: #9b9488; margin: 0 0 0; border-top: 1px solid #dddad2; padding-top: 16px; line-height: 1.6;">The set-password link expires for security — if it's lapsed, just use "forgot password" on the sign-in page. Any trouble, reply to this email.<br/><br/>The Aussie Grad Careers team &middot; <a href="${APP_URL}" style="color: #2d5a6e;">aussiegradcareers.com.au</a></p>`,
      `</td></tr>`,
      `</table>`,
    ].join(''),
    // The set-password link is a login token: it must not pass through the
    // click redirect, which would write it into the database.
  }, { trackLinks: false });
}

/**
 * Fresh password link, sent when someone asks for one: either their onboarding
 * link lapsed (Supabase recovery tokens are single-use and time-limited) or
 * they used "forgot password" on the sign-in page.
 *
 * Deliberately separate from sendClientOnboardingEmail, which opens with
 * "your payment is confirmed" and would read as a duplicate receipt here.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  actionLink: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping password reset email');
    return;
  }
  const { to, actionLink } = params;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Your new password link',
    html: [
      `<table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 560px; margin: 0 auto; font-family: Arial, sans-serif;">`,
      `<tr><td style="padding: 32px 24px; background: #f5f3ef; border-radius: 12px;">`,
      `<h1 style="font-size: 20px; font-weight: 600; color: #1a1814; margin: 0 0 12px;">Set your password</h1>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 20px; line-height: 1.6;">Here's a fresh link for <strong>${to}</strong>. Your account and access are unchanged, you just need to choose a password.</p>`,
      `<p style="margin: 0 0 24px;"><a href="${actionLink}" style="display: inline-block; background: #2d5a6e; color: #faf7f2; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">Choose your password</a></p>`,
      `<p style="font-size: 12px; color: #9b9488; margin: 0 0 0; border-top: 1px solid #dddad2; padding-top: 16px; line-height: 1.6;">This link works once and expires for security. If it lapses, request another from the sign-in page. If you didn't ask for this, you can ignore it, nothing has changed.<br/><br/>The Aussie Grad Careers team &middot; <a href="${APP_URL}" style="color: #2d5a6e;">aussiegradcareers.com.au</a></p>`,
      `</td></tr>`,
      `</table>`,
    ].join(''),
  });
}

export async function sendStatusEmail(params: {
  to: string;
  status: 'APPLIED' | 'REJECTED';
  jobTitle: string;
  /** Null when the ad never named the employer, which is common. */
  company: string | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping status email');
    return;
  }
  const { to, status, jobTitle, company } = params;
  // "Business Analyst at null" is how a placeholder leaks into a real inbox.
  // With no employer the role title stands on its own.
  const role = company ? `${jobTitle} at ${company}` : jobTitle;

  const applied = {
    subject: `Following up on your ${jobTitle} application — a reminder`,
    text: [
      'Nice work submitting.',
      '',
      `We'll remind you to follow up on your ${role} application in 7 days if you haven't heard back. A short, polite check-in is often all it takes to stay top of mind.`,
      '',
      'Keep the momentum going — every application is a rep.',
      '',
      'The Aussie Grad Careers team',
    ].join('\n'),
  };

  const rejected = {
    subject: 'It happens — here\'s what to do next',
    text: [
      `The ${role} application didn't go your way this time — that's genuinely tough, and it's okay to feel it.`,
      '',
      'One move worth making: send a short, gracious email to the hiring manager asking for feedback. Most candidates don\'t do this. It shows maturity, and occasionally it even reverses the decision.',
      '',
      'Keep going — the right role is still out there.',
      '',
      'The Aussie Grad Careers team',
    ].join('\n'),
  };

  const template = status === 'APPLIED' ? applied : rejected;

  await sendLogged('application_status', {
    to,
    subject: template.subject,
    text: template.text,
  });
}

/**
 * "<role> at <employer>", or just "<role>" when the ad never named one.
 * Many Australian listings are posted anonymously or through an agency, so a
 * missing employer is the normal case, not an error to paper over.
 */
function describeJob(job: { title: string; company: string | null }): string {
  return job.company ? `${job.title} at ${job.company}` : job.title;
}

export async function sendFollowUpReminderEmail(params: {
  to: string;
  firstName?: string;
  jobs: { title: string; company: string | null }[];
  totalCount: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping follow-up email');
    return;
  }
  const { to, firstName, jobs, totalCount } = params;
  // Env-aware origin so the screenshot + links resolve to the right host on
  // staging vs production (a hardcoded prod URL would 404 the image on staging).
  const dashboardUrl = `${PUBLIC_APP_URL}/`;
  const screenshotUrl = `${PUBLIC_APP_URL}/followup-section.png`;

  const greeting = firstName ? `Hey ${firstName},` : 'Hey there,';
  const countLabel =
    totalCount === 1 ? '1 application' : `${totalCount} applications`;
  const remaining = totalCount - jobs.length;

  // Subject leads with the most relevant single job when there's one, otherwise
  // frames the batch.
  const subject =
    totalCount === 1
      ? `Time to follow up — ${describeJob(jobs[0])}`
      : `${countLabel} worth a follow-up — here's exactly how`;

  const jobListItems = jobs
    .map(
      j =>
        `<li style="margin: 0 0 4px;"><strong style="color: #1a1814;">${j.title}</strong>` +
        (j.company ? ` <span style="color: #6b6559;">at ${j.company}</span>` : '') +
        `</li>`,
    )
    .join('');
  const moreLine =
    remaining > 0
      ? `<li style="margin: 4px 0 0; color: #9b9488;">…and ${remaining} more in your dashboard</li>`
      : '';

  const A = '#2d5a6e'; // petrol accent, matches the dashboard buttons
  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display: inline-block; background: ${A}; color: #faf7f2; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">${label}</a>`;
  const tool = (href: string, name: string, how: string) =>
    `<li style="margin: 0 0 10px;"><a href="${href}" style="color: ${A}; font-weight: 700; text-decoration: none;">${name}</a> — <span style="color: #6b6559;">${how}</span></li>`;

  await sendLogged('follow_up_reminder', {
    to,
    subject,
    html: [
      `<table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 560px; margin: 0 auto; font-family: Arial, sans-serif;">`,
      `<tr><td style="padding: 32px 24px; background: #f5f3ef; border-radius: 12px;">`,

      `<h1 style="font-size: 20px; font-weight: 600; color: #1a1814; margin: 0 0 12px;">${greeting}</h1>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 12px; line-height: 1.6;">You've got <strong>${countLabel}</strong> from over a week ago that are worth a follow-up. If you haven't heard back, this is the moment — not next week.</p>`,
      `<ul style="font-size: 14px; margin: 0 0 20px; padding-left: 18px; line-height: 1.6;">${jobListItems}${moreLine}</ul>`,

      // Why it's worth doing
      `<p style="font-size: 13px; color: #1a1814; font-weight: 700; margin: 0 0 8px;">Why it's worth two minutes:</p>`,
      `<ul style="font-size: 13px; color: #6b6559; margin: 0 0 24px; padding-left: 18px; line-height: 1.7;">`,
      `<li>Recruiters sift through dozens of applicants — a follow-up moves you back to the top of the pile.</li>`,
      `<li>It signals initiative and genuine interest, the exact traits they're hiring for.</li>`,
      `<li>Applications genuinely get buried or stalled; a nudge at the right time can be the difference between a callback and silence.</li>`,
      `<li><strong>Most candidates never follow up.</strong> That's exactly why it works.</li>`,
      `</ul>`,

      // Step 1 — the template
      `<p style="font-size: 14px; color: #1a1814; font-weight: 700; margin: 0 0 6px;">1. Grab your ready-made message</p>`,
      `<p style="font-size: 13px; color: #6b6559; margin: 0 0 14px; line-height: 1.6;">Open your dashboard, find the job under <strong>Follow up</strong>, and click the <strong>Follow up</strong> button. A template is already written and waiting — just copy it.</p>`,
      `<p style="margin: 0 0 14px;">${btn(dashboardUrl, 'Open your dashboard')}</p>`,
      `<p style="margin: 0 0 24px;"><img src="${screenshotUrl}" alt="The Follow up section on your dashboard" width="512" style="width: 100%; max-width: 512px; border: 1px solid #dddad2; border-radius: 10px; display: block;" /></p>`,

      // Step 2 — who to send it to
      `<p style="font-size: 14px; color: #1a1814; font-weight: 700; margin: 0 0 6px;">2. Work out who to send it to</p>`,
      `<p style="font-size: 13px; color: #6b6559; margin: 0 0 24px; line-height: 1.6;">Best target is <strong>HR / talent acquisition / the recruiter</strong> on the listing. If there's no HR contact, go to the <strong>hiring manager</strong> — the person who'd be your department head if you got the role.</p>`,

      // Step 3 — find the email
      `<p style="font-size: 14px; color: #1a1814; font-weight: 700; margin: 0 0 6px;">3. Find their email</p>`,
      `<p style="font-size: 13px; color: #6b6559; margin: 0 0 10px; line-height: 1.6;">Use any one of these (all have free tiers):</p>`,
      `<ul style="font-size: 13px; margin: 0 0 24px; padding-left: 18px; line-height: 1.6; list-style: none;">`,
      tool('https://hunter.io', 'Hunter.io', "enter the company's website; it shows staff emails and the pattern (e.g. firstname@company.com)."),
      tool('https://rocketreach.co', 'RocketReach.co', 'search the person’s name + company; reveals their verified work email.'),
      tool('https://apollo.io', 'Apollo.io', 'search the company, filter by role or department (e.g. “HR”), pull the verified email.'),
      `</ul>`,

      `<p style="font-size: 13px; color: #6b6559; margin: 0 0 24px; line-height: 1.6;">Then send. Two minutes of effort that most people skip.</p>`,

      // Sign-off
      `<p style="font-size: 13px; color: #6b6559; margin: 0; line-height: 1.6; border-top: 1px solid #dddad2; padding-top: 16px;">Kiron<br/><strong style="color: #1a1814;">Aussie Grad Careers</strong><br/>Rooting for your success 🇦🇺<br/><br/><a href="${PUBLIC_APP_URL}" style="color: ${A};">aussiegradcareers.com.au</a></p>`,

      `</td></tr>`,
      `</table>`,
    ].join(''),
  });
}

export async function sendAdminPaymentAlert(params: {
  event: 'payment_succeeded' | 'payment_failed' | 'payment_unmatched';
  userEmail: string;
  plan: string;
  subscriptionId: string;
  /** Unmatched only: how long this payer has been outstanding. */
  firstSeenAt?: Date;
  /** Unmatched only: how many times this alert has now been sent. */
  alertCount?: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const { event, userEmail, plan, subscriptionId, firstSeenAt, alertCount } = params;

  // A payment Stripe collected that we could NOT tie to a JobHub account
  // (e.g. a manually-created payment link with no userId metadata and an
  // email that matches no profile). Needs manual reconciliation — the
  // customer has paid but won't have access until granted.
  if (event === 'payment_unmatched') {
    // Silent by default — see config/alerts.ts. The caller has already logged
    // and recorded the payer, so this only decides whether mail goes out.
    if (unmatchedAlertMode() === 'off') {
      console.warn(`[email] unmatched payer ${userEmail} (${plan}) — alert mail suppressed by UNMATCHED_PAYMENT_ALERTS=off`);
      return;
    }

    const outstandingDays = firstSeenAt
      ? Math.max(0, Math.floor((Date.now() - firstSeenAt.getTime()) / 86400000))
      : null;
    const repeat = (alertCount ?? 1) > 1;

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: repeat
        ? `[JobHub] ⚠️ STILL UNRESOLVED (${outstandingDays}d) — ${userEmail}`
        : `[JobHub] ⚠️ PAID BUT UNMATCHED — ${userEmail}`,
      text: [
        'A payment was collected but could NOT be matched to a JobHub account.',
        'This customer has paid and has no way in until you create their account.',
        '',
        `Customer email: ${userEmail}`,
        `Plan / amount:  ${plan}`,
        `Reference:      ${subscriptionId}`,
        ...(outstandingDays !== null ? [`Outstanding:    ${outstandingDays} day(s)`] : []),
        '',
        'They have NO account, so this is not a grant_access case. Run from server/:',
        `  npx tsx src/scripts/onboard_paid.ts ${userEmail}`,
        '',
        'That creates their login, opens their access window, and emails them a',
        'set-password link. Add --dry-run first to see it without sending.',
        '',
        'One reminder a week while this stays unresolved, then nothing once they',
        'have an account.',
        '',
        `Stripe: https://dashboard.stripe.com/payments`,
      ].join('\n'),
    });
    return;
  }

  const succeeded = event === 'payment_succeeded';
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    subject: succeeded
      ? `[JobHub] Payment succeeded — ${userEmail}`
      : `[JobHub] PAYMENT FAILED — ${userEmail}`,
    text: [
      succeeded ? 'A subscription payment was collected.' : 'A subscription payment failed.',
      '',
      `Customer:       ${userEmail}`,
      `Plan:           ${plan}`,
      `Subscription:   ${subscriptionId}`,
      '',
      succeeded
        ? 'Access remains active. No action needed.'
        : 'Access has been revoked and the user downgraded to free.',
      '',
      `Stripe: https://dashboard.stripe.com/subscriptions/${subscriptionId}`,
    ].join('\n'),
  });
}

export async function sendTrialReminderEmail(to: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping trial reminder');
    return;
  }
  const displayName = name || 'there';
  const cancelUrl = `${APP_URL}/pricing`;
  await sendLogged('trial_ending', {
    to,
    subject: 'Your free trial ends tomorrow',
    text: [
      `Hi ${displayName},`,
      '',
      "Your 7-day free trial with Aussie Grad Careers ends tomorrow.",
      '',
      'After tomorrow, your card will be charged and your subscription will continue automatically.',
      'If you want to cancel before being charged, you can do so here:',
      '',
      cancelUrl,
      '',
      "If you're happy to continue, great - no action needed.",
      '',
      'Good luck with the applications,',
      'The Aussie Grad Careers team',
    ].join('\n'),
  });
}

/**
 * "You've unlocked tomorrow, come finish it" — the unpaid trial-challenge
 * reminder. Unrelated to sendTrialReminderEmail above, which is about the
 * PAID Stripe trial ending; this is about the free-trial challenge's
 * next-day window being forfeited if the candidate doesn't come back.
 */
export async function sendTrialChallengeReminderEmail(
  to: string,
  name: string,
  day: number,
  forfeitureDeadline: Date,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping trial challenge reminder');
    return;
  }
  const displayName = name || 'there';
  const deadlineStr = forfeitureDeadline.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', dateStyle: 'full', timeStyle: 'short',
  });
  const appUrl = `${PUBLIC_APP_URL}/check`;
  await sendLogged('challenge_day_unlocked', {
    to,
    subject: `Day ${day} is unlocked — don't lose it`,
    text: [
      `Hi ${displayName},`,
      '',
      `You passed yesterday's challenge — day ${day} is ready for you.`,
      '',
      `If you don't start it before ${deadlineStr} (AEST), it's gone for good.`,
      '',
      appUrl,
      '',
      'One hour. That\'s the whole ask.',
      '',
      'The Aussie Grad Careers team',
    ].join('\n'),
  });
}

export async function sendRoadmapEmail(
  to: string,
  firstName: string,
  result: { score: number; inferredRole: string },
  roadmap: RoadmapStep[],
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping roadmap email');
    return;
  }

  const salutation = firstName ? `Hi ${firstName},` : "G'day,";

  const stepsHtml = roadmap
    .map(
      (s) =>
        `<tr><td style="padding: 0 0 16px 0; vertical-align: top; font-family: Arial, sans-serif; font-size: 14px; color: #1a1814;">
          <table cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 28px; vertical-align: top; padding: 0 8px 0 0;">
                <span style="display: inline-block; width: 24px; height: 24px; background: #2d5a6e; color: #faf7f2; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">${s.rank}</span>
              </td>
              <td>
                <strong style="font-size: 14px; color: #1a1814;">${s.title}</strong><br/>
                <span style="font-size: 13px; color: #6b6559;">${s.why}</span>
              </td>
            </tr>
          </table>
        </td></tr>`,
    )
    .join('');

  await sendLogged('cv_roadmap', {
    to,
    subject: `${firstName ? firstName + ', ' : ''}your CV roadmap — 7 fixes, in order`,
    html: [
      `<table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 560px; margin: 0 auto; font-family: Arial, sans-serif;">`,
      `<tr><td style="padding: 32px 24px; background: #f5f3ef; border-radius: 12px;">`,
      `<h1 style="font-size: 20px; font-weight: 600; color: #1a1814; margin: 0 0 8px;">Your CV Roadmap</h1>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 16px;">${salutation}</p>`,
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 4px;"><strong>Your CV score: ${result.score}/100</strong></p>`,
      result.inferredRole ? `<p style="font-size: 14px; color: #6b6559; margin: 0 0 20px;">Scanned as: ${result.inferredRole}</p>` : '',
      `<p style="font-size: 14px; color: #6b6559; margin: 0 0 20px;">Here are your 7 prioritised fixes, ranked by impact:</p>`,
      `<table cellpadding="0" cellspacing="0" style="width: 100%;">`,
      stepsHtml,
      `</table>`,
      `<p style="font-size: 13px; color: #6b6559; margin: 24px 0 0; border-top: 1px solid #dddad2; padding-top: 16px;">`,
      `Start with step 1 this week. Each fix builds on the one before.<br/>`,
      `The Aussie Grad Careers team &middot; <a href="${APP_URL}" style="color: #2d5a6e;">aussiegradcareers.com.au</a>`,
      `</p>`,
      `</td></tr>`,
      `</table>`,
    ].join(''),
  });
}

// ─── Accountability nudges (AGC program) ────────────────────────────────────

export async function sendPaceNudgeEmail(params: {
  to: string;
  name: string;
  applications: number;
  applicationsPace: number;
  outreach: number;
  outreachPace: number;
  weeklyAppTarget: number;
  weeklyOutreachTarget: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping pace nudge');
    return;
  }
  const { to, name, applications, applicationsPace, outreach, outreachPace, weeklyAppTarget, weeklyOutreachTarget } = params;
  const displayName = name || 'there';
  const lines: string[] = [`Hi ${displayName},`, '', 'Quick pace check for this week:', ''];
  if (applications < applicationsPace) {
    lines.push(`- Applications: ${applications} sent, pace says ${applicationsPace} by tonight (target ${weeklyAppTarget} this week)`);
  }
  if (outreach < outreachPace) {
    lines.push(`- Outreach: ${outreach} logged, pace says ${outreachPace} by tonight (target ${weeklyOutreachTarget} this week)`);
  }
  lines.push(
    '',
    'There is still time today. Even two applications or a couple of outreach messages keeps the week alive.',
    '',
    `${APP_URL}/tracker`,
    '',
    'Keep going,',
    'Kiron — Aussie Grad Careers',
  );
  await sendLogged('pace_nudge', {
    to,
    subject: "You're behind pace this week — still fixable today",
    text: lines.join('\n'),
  });
}

export async function sendWeeklyWrapEmail(params: {
  to: string;
  name: string;
  hit: boolean;
  applications: number;
  outreach: number;
  appsTarget: number;
  outreachTarget: number;
  streak: number;
  consecutiveMisses: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping weekly wrap');
    return;
  }
  const { to, name, hit, applications, outreach, appsTarget, outreachTarget, streak, consecutiveMisses } = params;
  const displayName = name || 'there';

  const lines: string[] = [`Hi ${displayName},`, ''];
  if (hit) {
    lines.push(
      `Last week: ${applications} applications and ${outreach} outreach. Both minimums hit — that's how it's done.`,
      streak > 1 ? `Your streak is now ${streak} weeks. Protect it.` : 'That starts a streak. Protect it.',
    );
  } else {
    lines.push(
      `Last week: ${applications} of ${appsTarget} applications, ${outreach} of ${outreachTarget} outreach. That's a missed week.`,
      '',
      consecutiveMisses >= 2
        ? `That's ${consecutiveMisses} weeks in a row under the minimum. This is coming up on our next call — come ready to talk about what's blocking you.`
        : 'One missed week is a signal, not a verdict. This week decides which way it goes.',
    );
  }
  lines.push(
    '',
    'This week the counter is back to zero for everyone. Leaderboard:',
    `${APP_URL}/leaderboard`,
    '',
    'Kiron — Aussie Grad Careers',
  );
  await sendLogged('weekly_wrap', {
    to,
    subject: hit
      ? `Week hit: ${applications} applications, ${outreach} outreach ✔`
      : 'Last week came up short — reset starts now',
    text: lines.join('\n'),
  });
}

export async function sendCoachDigestEmail(params: {
  to: string;
  weekLabel: string;
  missed: Array<{ name: string; email: string; applications: number; outreach: number; consecutiveMisses: number }>;
  hit: Array<{ name: string; applications: number; outreach: number; streak: number }>;
  backdated: Array<{ name: string; count: number }>;
  goalChanges: Array<{ name: string; summary: string }>;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping coach digest');
    return;
  }
  const { to, weekLabel, missed, hit, backdated, goalChanges } = params;
  const lines: string[] = [`Accountability digest — week of ${weekLabel}`, ''];

  lines.push(`MISSED THE MINIMUM (${missed.length})`);
  if (missed.length === 0) lines.push('  Nobody. Great week.');
  for (const m of missed) {
    lines.push(`  ${m.name} <${m.email}> — ${m.applications} apps, ${m.outreach} outreach${m.consecutiveMisses >= 2 ? ` — ${m.consecutiveMisses} weeks in a row, TALK TO THEM` : ''}`);
  }
  lines.push('', `HIT THE MINIMUM (${hit.length})`);
  for (const h of hit) {
    lines.push(`  ${h.name} — ${h.applications} apps, ${h.outreach} outreach${h.streak > 1 ? ` (streak ${h.streak}w)` : ''}`);
  }
  if (backdated.length > 0) {
    lines.push('', 'BACKDATED ENTRIES (last 14 days)');
    for (const b of backdated) lines.push(`  ${b.name} — ${b.count} entr${b.count === 1 ? 'y' : 'ies'}`);
  }
  if (goalChanges.length > 0) {
    lines.push('', 'GOAL CHANGES (last 7 days)');
    for (const g of goalChanges) lines.push(`  ${g.name} — ${g.summary}`);
  }
  lines.push('', `Coach view: ${APP_URL}/admin/coach`);

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `AGC accountability digest — ${missed.length} missed, ${hit.length} hit`,
    text: lines.join('\n'),
  });
}

// ── The welcome payoff: their rewritten resume, emailed ──────────────────────
// Sent the moment an account is created at the end of /welcome. Two jobs: give
// them the artefact they just earned so it exists outside our app, and make the
// address they typed matter — an email they want is the only verification that
// never feels like friction.

/** Email-safe escape. Resume text is user-supplied and goes into an HTML email. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Inline **bold** and *italic* only, after escaping. */
function inlineMd(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;color:#101828;">$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em style="color:#475467;">$2</em>');
}

/**
 * Minimal markdown to email HTML, styled to match the resume as it appears in
 * the app: Georgia standing in for Fraunces on headings, a system sans for body,
 * petrol section rules. Deliberately hand-rolled — a general markdown library
 * emits class-based HTML, and email clients need inline styles on every node.
 */
export function resumeMarkdownToHtml(md: string): string {
  const out: string[] = [];
  let inList = false;

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (const rawLine of String(md || '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!line.trim()) { closeList(); continue; }

    if (/^#{1}\s+/.test(line)) {
      closeList();
      out.push(`<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:600;color:#101828;margin:0 0 4px;letter-spacing:.01em;">${inlineMd(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }
    if (/^#{2}\s+/.test(line)) {
      closeList();
      out.push(`<h2 style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#2d5a6e;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid #dddad2;">${inlineMd(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#{3,}\s+/.test(line)) {
      closeList();
      out.push(`<h3 style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#101828;margin:16px 0 2px;">${inlineMd(line.replace(/^#{3,}\s+/, ''))}</h3>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      out.push('<hr style="border:0;border-top:1px solid #dddad2;margin:20px 0;">');
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      if (!inList) { out.push('<ul style="margin:8px 0 14px;padding-left:22px;">'); inList = true; }
      out.push(`<li style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#344054;margin:0 0 7px;">${inlineMd(line.replace(/^\s*[-*•]\s+/, ''))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#344054;margin:0 0 10px;">${inlineMd(line)}</p>`);
  }
  closeList();
  return out.join('');
}

export async function sendWelcomeResumeEmail(params: {
  to: string;
  firstName?: string | null;
  resumeMarkdown: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome resume email');
    return;
  }
  const { to, firstName, resumeMarkdown } = params;
  const name = (firstName || '').trim();
  const hi = name ? `Hey ${esc(name)},` : 'Hey,';

  // The resume travels as a file, not as text in the body.
  //
  // It used to be both, which made the email enormous: two pages of somebody's
  // career rendered inline, with the one thing we actually want them to read
  // sitting under all of it. Nobody attaches an email to a job application
  // either, so the inline copy was never the usable one.
  //
  // The inline render survives as the fallback below and only that. If the PDF
  // fails we still owe them the resume the subject line promises.
  let attachments: Array<{ filename: string; content: string }> | undefined;
  try {
    const { buffer } = await renderResumePdf(resumeMarkdown);
    attachments = [{
      filename: resumeFilename(nameFromResumeMarkdown(resumeMarkdown) || name),
      content: buffer.toString('base64'),
    }];
  } catch (err) {
    console.warn('[email] resume PDF render failed, falling back to inline text:', (err as Error).message);
  }

  const html = [
    `<div style="background:#faf7f2;padding:28px 12px;">`,
    `<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;">`,
    `<tr><td>`,

    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1814;margin:0 0 14px;line-height:1.6;">${hi}</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#5c5750;margin:0 0 16px;line-height:1.65;">Here is your new and improved resume.</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#5c5750;margin:0 0 16px;line-height:1.65;">Imagine sending a highly personalised resume and cover letter of this quality to every company you apply to, along with a short personalised email to a key decision maker. All in under five minutes.</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#5c5750;margin:0 0 16px;line-height:1.65;">Finding your dream role takes time, but it doesn't need to take stress.</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1814;margin:0 0 22px;line-height:1.65;font-weight:600;">Work smart. Try the 90-day challenge today.</p>`,

    `<p style="margin:0 0 24px;"><a href="${WELCOME_EMAIL_CTA_URL}" style="display:inline-block;background:#2d5a6e;color:#faf7f2;text-decoration:none;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;font-weight:700;padding:13px 26px;border-radius:8px;">Start the free challenge</a></p>`,

    // Only when there is no file to point at. Reading a resume in an email is a
    // poor second to holding one, but it beats an email that promises a resume
    // and carries nothing.
    ...(attachments ? [] : [
      `<div style="background:#ffffff;border:1px solid #dddad2;border-radius:12px;padding:34px 34px 30px;margin:0 0 24px;">`,
      resumeMarkdownToHtml(resumeMarkdown),
      `</div>`,
    ]),

    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#9b9488;margin:22px 0 0;line-height:1.6;">Sent to ${esc(to)} because you created an Aussie Grad Careers account. Kiron.</p>`,
    `</td></tr></table></div>`,
  ].join('');

  const subject = name ? `${name}, here is your rewritten resume` : 'Here is your rewritten resume';

  await sendLogged('welcome_resume', { to, subject, html, attachments, firstName: name || null });
}

/** The candidate's full name off the resume's own H1, for the filename. */
function nameFromResumeMarkdown(markdown: string): string {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

/**
 * Delivers the post-workshop diagnostic.
 *
 * Plain text, and short. The email is not the asset, the report is; every extra
 * line here is another chance to lose them before they click. What earns the
 * click is that the summary is unmistakably about them: their first name, their
 * counted numbers, and the promise of the one line we rewrote.
 */
export async function sendGapReportEmail(params: {
  to: string;
  name: string;
  reportUrl: string;
  dutyBullets: number;
  totalBullets: number;
  atsRisk: boolean;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping gap report');
    return;
  }
  const { to, name, reportUrl, dutyBullets, totalBullets, atsRisk } = params;
  const firstName = (name || '').trim().split(/\s+/)[0] || '';

  // Only state a count when there is a real one behind it. A report that opens
  // with "0 of 0 bullet points" reads as broken and undoes the personalisation
  // the rest of the email is doing.
  const findings: string[] = [];
  if (totalBullets > 0 && dutyBullets > 0) {
    findings.push(
      `${dutyBullets} of your ${totalBullets} bullet points open with a duty instead of a result`,
    );
  }
  if (atsRisk) {
    findings.push('the file itself is built in a way applicant tracking systems cannot read');
  }

  const summary = findings.length
    ? `The short version: ${findings.join(', and ')}.`
    : 'I went through it properly and pulled out what is holding it back.';

  await sendLogged('gap_report', {
    to,
    subject: firstName ? `${firstName}, the line I would change first` : 'The line I would change first',
    text: [
      firstName ? `Hey ${firstName},` : 'Hey,',
      '',
      'Thanks for being in the room tonight. I said I would look at your resume properly and send you what I found, so here it is.',
      '',
      summary,
      '',
      'I have rewritten one of your own lines so you can see the difference. It is the first thing in the report.',
      '',
      reportUrl,
      '',
      'Kiron',
      'aussiegradcareers.com.au',
    ].join('\n'),
  });
}

/**
 * Tells Kiron to add a paying customer to the Skool Premium tier.
 *
 * Skool has no API, so this one step cannot be automated: the grant is a manual
 * toggle in the Skool members admin. Everything either side of it is automatic,
 * which makes this email the whole handoff, so it leads with the address to
 * paste and says plainly that the customer is already waiting.
 */
export async function sendSkoolUpgradeTask(params: {
  customerEmail: string;
  customerName?: string | null;
  plan: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping Skool upgrade task');
    return;
  }
  const { customerEmail, customerName, plan } = params;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    subject: `Add to Skool Premium: ${customerEmail}`,
    text: [
      `${customerEmail} has paid (${plan}) and needs Premium access in Skool.`,
      customerName ? `Name: ${customerName}` : '',
      '',
      'Open them directly, already filtered to this one member:',
      skoolMemberSearchUrl(customerEmail),
      '',
      'Then change their plan to Premium. That is the whole job.',
      '',
      ...(customerName && skoolMemberSearchByName(customerName)
        ? [
            'Empty? They may have joined under a different address. By name:',
            skoolMemberSearchByName(customerName)!,
            '',
            'Check the name match carefully before upgrading anyone found this way,',
            'since names are not unique and the wrong upgrade is hard to notice.',
            '',
          ]
        : []),
      'Still nothing means they have paid but never joined the group, so there is',
      'no account to upgrade yet. They have been emailed asking them to join with',
      'this same address, so it is worth checking again later.',
      '',
      'This task is raised once per customer. If you see it twice for the same',
      'address, something is wrong with the dedupe and worth a look.',
    ].filter(Boolean).join('\n'),
  });
}

/**
 * Tells the buyer what happens next, immediately after paying.
 *
 * Sent because the Skool grant is manual and therefore not instant. Silence
 * between paying $750 and getting access is exactly where a new customer starts
 * wondering whether they have been had, so this email exists to fill that gap
 * honestly rather than to sell anything.
 */
export async function sendPremiumWelcomeEmail(params: {
  to: string;
  name?: string | null;
  skoolUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping premium welcome');
    return;
  }
  const { to, name, skoolUrl } = params;
  const firstName = (name || '').trim().split(/\s+/)[0] || '';

  await sendLogged('premium_welcome', {
    to,
    subject: firstName ? `You're in, ${firstName}. Here is what happens now.` : "You're in. Here is what happens now.",
    text: [
      firstName ? `Hey ${firstName},` : 'Hey,',
      '',
      'Payment came through. Thank you, genuinely.',
      '',
      'Two things happen next.',
      '',
      'I am upgrading your Skool account to Premium by hand, so give it a few',
      'hours rather than a few seconds. You do not need to do anything, and you',
      'will see the Premium classroom appear when it is done.',
      '',
      'If you are not in the group yet, join here first with this same email',
      'address, otherwise I have nothing to upgrade:',
      skoolUrl,
      '',
      'Then reply to this email with your current resume, and I will have it read',
      'before our first session.',
      '',
      'Kiron',
      'aussiegradcareers.com.au',
    ].join('\n'),
  });
}
