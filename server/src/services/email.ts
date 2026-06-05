import { Resend } from 'resend';
import type { CvGapResult, RoadmapStep } from './cvGapScan';

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
  event: 'payment_succeeded' | 'payment_failed' | 'payment_unmatched';
  userEmail: string;
  plan: string;
  subscriptionId: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const { event, userEmail, plan, subscriptionId } = params;

  // A payment Stripe collected that we could NOT tie to a JobHub account
  // (e.g. a manually-created payment link with no userId metadata and an
  // email that matches no profile). Needs manual reconciliation — the
  // customer has paid but won't have access until granted.
  if (event === 'payment_unmatched') {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[JobHub] ⚠️ PAID BUT UNMATCHED — ${userEmail}`,
      text: [
        'A payment was collected but could NOT be matched to a JobHub account.',
        'The customer has paid and will be capped until you grant access manually.',
        '',
        `Customer email: ${userEmail}`,
        `Plan / amount:  ${plan}`,
        `Reference:      ${subscriptionId}`,
        '',
        'To grant access, run from server/:',
        `  npx tsx src/scripts/grant_access.ts ${userEmail} three_month`,
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
