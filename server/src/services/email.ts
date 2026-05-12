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
  jobTitle: string;
  company: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping follow-up email');
    return;
  }
  const { to, jobTitle, company } = params;
  const role = `${jobTitle} at ${company}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Time to follow up — ${jobTitle} at ${company}`,
    text: [
      `It's been 7 days since you applied for ${role}.`,
      '',
      "If you haven't heard back, now is the right time for a short follow-up.",
      '',
      "Keep it to 3-4 lines: confirm your interest, reference something specific about the role, and ask if there's anything else they need from you.",
      '',
      "Most candidates don't follow up. You should.",
      '',
      'The JobReady team',
    ].join('\n'),
  });
}

export async function sendAdminPaymentAlert(params: {
  event: 'payment_succeeded' | 'payment_failed';
  userEmail: string;
  plan: string;
  subscriptionId: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const { event, userEmail, plan, subscriptionId } = params;
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
