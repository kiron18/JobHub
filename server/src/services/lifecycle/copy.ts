/**
 * The ten client lifecycle emails, word for word as Kiron wrote them
 * (2026-10-15). Change the wording here and nowhere else.
 *
 * Each email is a list of blocks so the same copy renders as HTML (tracked by
 * sendLogged) and as a plain-text fallback. No em or en dashes anywhere in the
 * copy: rules.test.ts fails the build if one creeps in.
 *
 * When each one fires lives in rules.ts and send.ts, not here.
 */

export type Block =
  | { p: string }
  | { strong: string }
  | { cta: string; url: string }
  | { ul: string[] }
  | { ol: string[] }
  | { sign: string[] };

export interface LifecycleEmail {
  subject: string;
  blocks: Block[];
}

export type LifecycleEmailKey =
  | 'resume_ready'
  | 'first_application'
  | 'day3_no_card'
  | 'card_added'
  | 'pre_first_charge'
  | 'first_payment'
  | 'weekly_checkin'
  | 'pre_second_charge'
  | 'pre_third_charge'
  | 'plan_completed';

export interface CopyVars {
  firstName: string;
  appUrl: string;
  billingUrl: string;
  /** Formatted money, e.g. "$250". */
  amount: string;
  /** Formatted date, e.g. "Friday 23 October 2026". */
  chargeDate?: string;
  applicationsThisWeek?: number;
  outreachThisWeek?: number;
  followupsDue?: number;
  recommendedNextAction?: string;
  /** Email 1 only: false when the PDF failed and the resume is inline instead. */
  resumeAttached?: boolean;
}

const hi = (v: CopyVars) => ({ p: v.firstName ? `Hi ${v.firstName},` : 'Hi,' });

export function lifecycleEmail(key: LifecycleEmailKey, v: CopyVars): LifecycleEmail {
  const amount = v.amount;
  switch (key) {
    case 'resume_ready':
      return {
        subject: 'Your resume is ready',
        blocks: [
          hi(v),
          { p: v.resumeAttached === false ? 'Your updated resume is below.' : 'Your updated resume is attached.' },
          { p: "Before you start applying for jobs, there's one important thing to understand: a resume is only one part of your job search. You still need to tailor it to each role, prepare your application properly, identify people to contact, and follow up." },
          { p: "That's why I built Aussie Grad Careers. It gives you a system to manage the process rather than starting from scratch every time." },
          { p: 'Your first step is simple: open your workspace, paste in a job ad, and complete one application.' },
          { cta: 'Start here', url: v.appUrl },
          { p: "Don't worry about mastering everything today. Just complete one application from start to finish." },
          { sign: ['Kiron', 'Aussie Grad Careers'] },
        ],
      };

    case 'first_application':
      return {
        subject: 'Your next step is one job application',
        blocks: [
          hi(v),
          { p: "You've got your resume. Now let's put it to work." },
          { p: 'Instead of spending hours browsing job boards or repeatedly editing your resume, start with one suitable job.' },
          { p: 'Inside Aussie Grad Careers, you can work through the application process, tailor your documents, and track the application so you know exactly what happens next.' },
          { p: 'Your goal today is to complete and record one application.' },
          { cta: 'Continue your job search', url: v.appUrl },
          { p: 'Once that\'s done, the next step is to identify someone relevant to contact and plan your follow-up.' },
          { sign: ['Kiron'] },
        ],
      };

    case 'day3_no_card':
      return {
        subject: 'Your initial trial is nearly over',
        blocks: [
          hi(v),
          { p: 'Your initial three days of limited access are nearly up.' },
          { p: "If you haven't had enough time to try the system properly, you can unlock another seven days by adding your card." },
          { strong: `You won't be charged when you add your card. Your extended trial gives you another seven days to explore the system before your first scheduled payment of ${amount}.` },
          { p: "We'll make the upcoming charge date and plan terms clear before you proceed." },
          { p: "My recommendation: don't spend the extra time simply exploring features. Use it to complete applications, contact relevant people, and establish a repeatable job-search routine." },
          { cta: 'Continue your trial', url: v.billingUrl },
          { sign: ['Kiron'] },
        ],
      };

    case 'card_added':
      return {
        subject: 'Your extra seven days are unlocked',
        blocks: [
          hi(v),
          { p: 'Your extended trial is now active.' },
          { p: 'To confirm, you have seven additional days before your first scheduled payment. You have not been charged today.' },
          { p: 'Here are your plan details:' },
          { ul: [
            `First scheduled payment: ${amount} on ${v.chargeDate}`,
            `Commitment: three monthly payments of ${amount}`,
            'After all three payments are completed: 12 months of access included at no additional subscription charge during that period.',
          ] },
          { p: `You can review your plan details here: ${v.billingUrl}` },
          { p: 'Use these extra days to establish your workflow and see how the system fits into your job search.' },
          { sign: ['Kiron'] },
        ],
      };

    case 'pre_first_charge':
      return {
        subject: 'A reminder about your Aussie Grad Careers trial',
        blocks: [
          hi(v),
          { p: 'A quick reminder that your extended trial is approaching its end.' },
          { p: `Your first payment of ${amount} is scheduled for ${v.chargeDate}.` },
          { p: `Your plan covers three monthly payments of ${amount}. Once all three payments have been completed, you'll receive 12 months of access at no additional subscription charge during the included period.` },
          { p: 'The aim is to help you build a consistent job-search process, not simply give you another piece of software to use occasionally.' },
          { p: `Review your plan and billing details here: ${v.billingUrl}` },
          { sign: ['Kiron'] },
        ],
      };

    case 'first_payment':
      return {
        subject: "Let's make the next 90 days count",
        blocks: [
          hi(v),
          { p: "You're now into the paid stage of your Aussie Grad Careers plan." },
          { p: "Here's what I want you to focus on over the coming 90 days." },
          { strong: 'Build a repeatable routine:' },
          { ol: [
            'Identify suitable roles.',
            'Tailor your application and complete it properly.',
            'Track the application and identify someone relevant to contact.',
            'Send outreach and follow up when appropriate.',
            "Review what's working and improve your approach.",
          ] },
          { p: 'Consistency matters more than having one exceptionally productive day followed by a week of inactivity.' },
          { p: "You don't need to do everything perfectly. You need a process you can keep repeating." },
          { cta: 'Continue your job search', url: v.appUrl },
          { p: 'Your next step today is to complete your next suitable application and plan the outreach that goes with it.' },
          { sign: ['Kiron'] },
        ],
      };

    case 'weekly_checkin':
      return {
        subject: 'Your job search this week',
        blocks: [
          hi(v),
          { p: "Here's your job-search check-in for the past seven days." },
          { p: `Applications recorded: ${v.applicationsThisWeek ?? 0}` },
          { p: `Outreach actions recorded: ${v.outreachThisWeek ?? 0}` },
          { p: `Follow-ups due: ${v.followupsDue ?? 0}` },
          { p: "The point of tracking these actions is to make your job search measurable. You should be able to see what you've done, what needs attention, and what to do next." },
          { p: `Your focus for the coming week: ${v.recommendedNextAction ?? ''}` },
          { cta: 'Open your workspace', url: v.appUrl },
          { p: 'Keep showing up. Every completed application and thoughtful outreach gives you another opportunity to learn and move forward.' },
          { sign: ['Kiron'] },
        ],
      };

    case 'pre_second_charge':
      return {
        subject: 'Month one: review your progress',
        blocks: [
          hi(v),
          { p: "You've now spent your first month working with Aussie Grad Careers." },
          { p: "This is a good time to review your process rather than simply judge your progress by whether you've received an offer yet." },
          { p: "Look at the applications you've submitted, the people you've contacted, and the responses you've received. Are you targeting appropriate roles? Are you following up? Are you improving your applications based on feedback?" },
          { p: `Your next scheduled payment is ${amount} on ${v.chargeDate}.` },
          { p: `Remember, this plan consists of three monthly payments of ${amount}. After completing all three, you'll receive 12 months of access at no additional subscription charge during that period.` },
          { p: 'Use this next month to keep building your pipeline and improving your execution.' },
          { cta: 'Review your progress', url: v.appUrl },
          { sign: ['Kiron'] },
        ],
      };

    case 'pre_third_charge':
      return {
        subject: 'Your final scheduled payment is approaching',
        blocks: [
          hi(v),
          { p: "You're approaching the final installment of your three-month Aussie Grad Careers plan." },
          { p: `Your next scheduled payment is ${amount} on ${v.chargeDate}.` },
          { p: 'Once this third payment has been completed, your plan includes a further 12 months of access at no additional subscription charge during that period.' },
          { p: 'That gives you more time to keep working on your applications, outreach, follow-ups, and interview preparation without another subscription payment during the included period.' },
          { p: "Don't treat the end of these three months as the end of your job search. The goal is to develop a repeatable system that you can continue using." },
          { cta: 'Keep moving forward', url: v.appUrl },
          { sign: ['Kiron'] },
        ],
      };

    case 'plan_completed':
      return {
        subject: 'Your 12 months of included access are unlocked',
        blocks: [
          hi(v),
          { p: "You've now completed all three monthly payments for your Aussie Grad Careers plan." },
          { p: 'Your included 12 months of access are now active.' },
          { p: "This is your opportunity to keep refining your job-search process, improve your applications, maintain your outreach pipeline, and build on what you've learned." },
          { p: 'Remember, the platform helps you execute a more consistent job search, but no tool can guarantee a job. What matters is how effectively you use it and how you respond to results.' },
          { cta: 'Continue your job search', url: v.appUrl },
          { p: "Here's to making the most of the time ahead." },
          { sign: ['Kiron'] },
        ],
      };
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Bare URLs inside a sentence become links, so "here: <url>" is clickable. */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#2d5a6e;">${u}</a>`);
}

const FONT = "-apple-system,'Segoe UI',Arial,sans-serif";
const P = `font-family:${FONT};font-size:15px;color:#3d3a35;margin:0 0 16px;line-height:1.65;`;

export function renderText(email: LifecycleEmail): string {
  const out: string[] = [];
  for (const b of email.blocks) {
    if ('p' in b) out.push(b.p);
    else if ('strong' in b) out.push(b.strong);
    else if ('cta' in b) out.push(`${b.cta}: ${b.url}`);
    else if ('ul' in b) out.push(b.ul.map((s) => `- ${s}`).join('\n'));
    else if ('ol' in b) out.push(b.ol.map((s, i) => `${i + 1}. ${s}`).join('\n'));
    else if ('sign' in b) out.push(b.sign.join('\n'));
  }
  return out.join('\n\n');
}

/** `extraHtml` lands just above the sign-off (email 1 uses it for the inline resume fallback). */
export function renderHtml(email: LifecycleEmail, extraHtml = ''): string {
  const parts: string[] = [];
  for (const b of email.blocks) {
    if ('p' in b) parts.push(`<p style="${P}">${linkify(esc(b.p))}</p>`);
    else if ('strong' in b) parts.push(`<p style="${P}color:#1a1814;font-weight:700;">${esc(b.strong)}</p>`);
    else if ('cta' in b) {
      parts.push(
        `<p style="margin:4px 0 22px;"><a href="${b.url}" style="display:inline-block;background:#2d5a6e;color:#faf7f2;text-decoration:none;font-family:${FONT};font-size:14.5px;font-weight:700;padding:13px 26px;border-radius:8px;">${esc(b.cta)}</a></p>`,
      );
    } else if ('ul' in b || 'ol' in b) {
      const tag = 'ul' in b ? 'ul' : 'ol';
      const items = 'ul' in b ? b.ul : b.ol;
      parts.push(
        `<${tag} style="font-family:${FONT};font-size:15px;color:#3d3a35;margin:0 0 16px;padding-left:22px;line-height:1.65;">`
          + items.map((s) => `<li style="margin:0 0 6px;">${esc(s)}</li>`).join('')
          + `</${tag}>`,
      );
    } else if ('sign' in b) {
      if (extraHtml) parts.push(extraHtml);
      parts.push(`<p style="${P}color:#1a1814;">${b.sign.map(esc).join('<br/>')}</p>`);
    }
  }
  return [
    `<div style="background:#faf7f2;padding:28px 12px;">`,
    `<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;"><tr><td>`,
    parts.join(''),
    `</td></tr></table></div>`,
  ].join('');
}
