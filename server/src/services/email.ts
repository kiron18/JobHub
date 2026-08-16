import { Resend } from 'resend';
import type { CvGapResult, RoadmapStep } from './cvGapScan';
import { PUBLIC_APP_URL } from '../lib/appUrl';
import { skoolMemberSearchUrl, skoolMemberSearchByName } from '../lib/skoolLinks';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = 'https://aussiegradcareers.com.au';
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
  await resend.emails.send({
    from: FROM_ADDRESS,
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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

export async function sendClientOnboardingEmail(params: {
  to: string;
  actionLink: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping client onboarding email');
    return;
  }
  const { to, actionLink } = params;

  await resend.emails.send({
    from: FROM_ADDRESS,
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
  });
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
  company: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping status email');
    return;
  }
  const { to, status, jobTitle, company } = params;
  const role = `${jobTitle} at ${company}`;

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

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: template.subject,
    text: template.text,
  });
}

export async function sendFollowUpReminderEmail(params: {
  to: string;
  firstName?: string;
  jobs: { title: string; company: string }[];
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
      ? `Time to follow up — ${jobs[0].title} at ${jobs[0].company}`
      : `${countLabel} worth a follow-up — here's exactly how`;

  const jobListItems = jobs
    .map(
      j =>
        `<li style="margin: 0 0 4px;"><strong style="color: #1a1814;">${j.title}</strong> <span style="color: #6b6559;">at ${j.company}</span></li>`,
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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
        'That creates their login, opens 90 days of access, and emails them a',
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
  await resend.emails.send({
    from: FROM_ADDRESS,
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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
  await resend.emails.send({
    from: FROM_ADDRESS,
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
  await resend.emails.send({
    from: FROM_ADDRESS,
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

  const html = [
    `<div style="background:#faf7f2;padding:28px 12px;">`,
    `<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;">`,
    `<tr><td>`,

    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1814;margin:0 0 14px;line-height:1.6;">${hi}</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#5c5750;margin:0 0 22px;line-height:1.65;">Here is your rewritten resume. Keep this email — it is your copy, and it says what you actually did instead of what you were responsible for.</p>`,

    // The resume itself, on white paper inside the warm canvas.
    `<div style="background:#ffffff;border:1px solid #dddad2;border-radius:12px;padding:34px 34px 30px;">`,
    resumeMarkdownToHtml(resumeMarkdown),
    `</div>`,

    // The anticipation beat: the resume is the ticket, not the job.
    `<div style="margin:26px 0 0;padding:22px 24px;background:#ffffff;border:1px solid #dddad2;border-radius:12px;">`,
    `<p style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:#101828;margin:0 0 10px;line-height:1.35;">A resume gets you read. It does not get you hired.</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;color:#5c5750;margin:0 0 14px;line-height:1.65;">This was the part you could see. The reason most people here never hear back is the part they cannot: who you contact before you apply, how the visa question gets read when you do not raise it first, and what happens in the 48 hours after you hit submit.</p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;color:#5c5750;margin:0 0 20px;line-height:1.65;">That is all waiting in your dashboard, along with the achievement bank we built with you.</p>`,
    `<p style="margin:0;"><a href="${APP_URL}" style="display:inline-block;background:#2d5a6e;color:#faf7f2;text-decoration:none;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;font-weight:700;padding:13px 26px;border-radius:8px;">See what else is missing</a></p>`,
    `</div>`,

    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#9b9488;margin:22px 0 0;line-height:1.6;">Sent to ${esc(to)} because you created an Aussie Grad Careers account. Kiron.</p>`,
    `</td></tr></table></div>`,
  ].join('');

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: name ? `${name}, here is your rewritten resume` : 'Here is your rewritten resume',
    html,
  });
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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

  await resend.emails.send({
    from: FROM_ADDRESS,
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
