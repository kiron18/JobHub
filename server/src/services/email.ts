import { Resend } from 'resend';
import type { CvGapResult, RoadmapStep } from './cvGapScan';
import { PUBLIC_APP_URL } from '../lib/appUrl';

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
