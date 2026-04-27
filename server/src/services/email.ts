import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = 'https://aussiegradcareers.com.au';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'kiron@aussiegradcareers.com.au';
const FROM_ADDRESS = `Aussie Grad Careers <kiron@aussiegradcareers.com.au>`;

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
