/**
 * Every email the server can send, rendered as it would leave, and every link
 * in it checked.
 *
 * Written on 2026-10-15 after every button in every client email had pointed
 * at http://localhost:3002 for nine days, and the site address had been saved
 * without its https://. Nothing caught either. This does:
 *
 *   - every link is https, on our site or a known outside site
 *   - every link to our site is a page the app actually has (read from App.tsx)
 *     or a file in public/
 *   - links to our site carry ?e=<send id>, so the click is counted
 *   - no localhost, no "undefined" or "null" in a link
 *   - no em or en dash anywhere a client reads
 *
 * PUBLIC_APP_URL is set the broken way production had it, bare host and no
 * scheme, so this also proves withScheme() covers that.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SEND_ID = '0b5c8a52-3f0e-4c3e-9a51-6f1d2b7e9c10';
const sent: Array<{ to: string; subject: string; text?: string; html?: string }> = [];

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (p: any) => {
        sent.push(p);
        return { data: { id: 'resend-id' }, error: null };
      },
    };
  },
}));

vi.mock('../index', () => ({
  prisma: {
    contact: { upsert: async () => ({ id: 'contact-1' }) },
    emailTemplate: { upsert: async () => ({ id: 'template-1' }) },
    emailSend: {
      create: async () => ({ id: SEND_ID }),
      update: async () => ({}),
      delete: async () => ({}),
    },
  },
}));

vi.mock('./resumePdf', () => ({
  renderResumePdf: async () => ({ buffer: Buffer.from('%PDF-1.4') }),
  resumeFilename: () => 'Resume.pdf',
}));

// ── what counts as a real destination ───────────────────────────────────────
const ROOT = path.resolve(__dirname, '../../..');
const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');

/** Top-level routes, plus the /admin children written relative to it. */
const ROUTES: RegExp[] = (() => {
  const paths = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  const full = paths.map((p) => (p.startsWith('/') || p === '*' ? p : `/admin/${p}`));
  return full
    .filter((p) => p !== '*' && p !== '/*')
    .map((p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\/$/, '') + '/?$'));
})();

const PUBLIC_DIR = path.join(ROOT, 'public');
const isPage = (p: string) => p === '/' || ROUTES.some((r) => r.test(p));
const isPublicFile = (p: string) => p !== '/' && fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(p)));

const OUR_HOSTS = new Set(['aussiegradcareers.com.au', 'www.aussiegradcareers.com.au']);
/** Outside sites an email may send people to on purpose. */
const OUTSIDE_HOSTS = new Set([
  'hunter.io', 'rocketreach.co', 'apollo.io',
  'meet.google.com', 'www.skool.com',
  'dashboard.stripe.com', 'supabase.com', 'railway.com',
]);

const DASH = /[–—]/;

function linksIn(email: { text?: string; html?: string }): string[] {
  const out: string[] = [];
  for (const m of (email.html ?? '').matchAll(/(?:href|src)="([^"]+)"/g)) out.push(m[1].replace(/&amp;/g, '&'));
  for (const m of (email.text ?? '').matchAll(/https?:\/\/[^\s<>"']+/g)) out.push(m[0].replace(/[.,;:!?)\]]+$/, ''));
  return out;
}

function problemsWith(link: string, opts: { mustTag: boolean }): string[] {
  const problems: string[] = [];
  if (/localhost|127\.0\.0\.1|undefined|null/i.test(link)) problems.push('localhost, undefined or null in the link');
  let u: URL;
  try { u = new URL(link); } catch { return [...problems, 'not an absolute address']; }
  if (u.protocol !== 'https:') problems.push('not https');
  if (OUR_HOSTS.has(u.hostname)) {
    if (!isPage(u.pathname) && !isPublicFile(u.pathname)) problems.push(`no such page: ${u.pathname}`);
    const isFile = isPublicFile(u.pathname);
    if (opts.mustTag && !isFile && u.searchParams.get('e') !== SEND_ID) problems.push('not tagged with the send id');
  } else if (!OUTSIDE_HOSTS.has(u.hostname)) {
    problems.push(`unexpected host ${u.hostname}`);
  }
  return problems;
}

// ── every sender, with realistic arguments ──────────────────────────────────
type Sender = { name: string; client: boolean; tagged: boolean; run: (m: any) => Promise<unknown> };

const SENDERS: Sender[] = [
  { name: 'workshop confirmation', client: true, tagged: true, run: (m) => m.sendWorkshopConfirmationEmail({ to: 'a@b.co', name: 'Asha Rao', meetLink: 'https://meet.google.com/abc-defg-hij', workshopTitle: 'Job Search Workshop', start: new Date('2026-11-01T08:00:00Z') }) },
  { name: 'workshop reminder', client: true, tagged: true, run: (m) => m.sendWorkshopReminderEmail({ to: 'a@b.co', name: 'Asha', meetLink: 'https://meet.google.com/abc-defg-hij', workshopTitle: 'Job Search Workshop', minutesBefore: 20 }) },
  { name: 'call reminder, day', client: true, tagged: true, run: (m) => m.sendSalesMeetingReminderEmail({ to: 'a@b.co', name: 'Asha', startsAt: new Date('2026-11-01T04:00:00Z'), meetLink: 'https://meet.google.com/abc-defg-hij', kind: 'day' }) },
  { name: 'call reminder, hour', client: true, tagged: true, run: (m) => m.sendSalesMeetingReminderEmail({ to: 'a@b.co', name: 'Asha', startsAt: new Date('2026-11-01T04:00:00Z'), meetLink: null, kind: 'hour' }) },
  { name: 'client onboarding', client: true, tagged: false, run: (m) => m.sendClientOnboardingEmail({ to: 'a@b.co', actionLink: 'https://www.aussiegradcareers.com.au/set-password' }) },
  { name: 'password reset', client: true, tagged: false, run: (m) => m.sendPasswordResetEmail({ to: 'a@b.co', actionLink: 'https://www.aussiegradcareers.com.au/set-password' }) },
  { name: 'status: applied', client: true, tagged: true, run: (m) => m.sendStatusEmail({ to: 'a@b.co', status: 'APPLIED', jobTitle: 'Analyst', company: 'Acme' }) },
  { name: 'status: rejected', client: true, tagged: true, run: (m) => m.sendStatusEmail({ to: 'a@b.co', status: 'REJECTED', jobTitle: 'Analyst', company: null }) },
  { name: 'follow-up reminder, one', client: true, tagged: true, run: (m) => m.sendFollowUpReminderEmail({ to: 'a@b.co', firstName: 'Asha', jobs: [{ title: 'Analyst', company: 'Acme' }], totalCount: 1 }) },
  { name: 'follow-up reminder, many', client: true, tagged: true, run: (m) => m.sendFollowUpReminderEmail({ to: 'a@b.co', jobs: [{ title: 'Analyst', company: null }, { title: 'Clerk', company: 'Acme' }], totalCount: 5 }) },
  { name: 'trial ending', client: true, tagged: true, run: (m) => m.sendTrialReminderEmail('a@b.co', 'Asha') },
  { name: 'challenge day unlocked', client: true, tagged: true, run: (m) => m.sendTrialChallengeReminderEmail('a@b.co', 'Asha', 2, new Date('2026-11-02T08:00:00Z')) },
  { name: 'CV roadmap', client: true, tagged: true, run: (m) => m.sendRoadmapEmail('a@b.co', 'Asha', { score: 61, inferredRole: 'Analyst' }, [{ rank: 1, title: 'Lead with results', why: 'Duties do not get interviews.' }]) },
  { name: 'pace nudge', client: true, tagged: true, run: (m) => m.sendPaceNudgeEmail({ to: 'a@b.co', name: 'Asha', applications: 1, applicationsPace: 3, outreach: 0, outreachPace: 2, weeklyAppTarget: 25, weeklyOutreachTarget: 10 }) },
  { name: 'weekly wrap, hit', client: true, tagged: true, run: (m) => m.sendWeeklyWrapEmail({ to: 'a@b.co', name: 'Asha', hit: true, applications: 26, outreach: 11, appsTarget: 25, outreachTarget: 10, streak: 3, consecutiveMisses: 0 }) },
  { name: 'weekly wrap, missed', client: true, tagged: true, run: (m) => m.sendWeeklyWrapEmail({ to: 'a@b.co', name: 'Asha', hit: false, applications: 9, outreach: 2, appsTarget: 25, outreachTarget: 10, streak: 0, consecutiveMisses: 2 }) },
  { name: 'welcome resume', client: true, tagged: true, run: (m) => m.sendWelcomeResumeEmail({ to: 'a@b.co', firstName: 'Asha', resumeMarkdown: '# Asha Rao\n\n## Experience\n- Did things' }) },
  { name: 'gap report', client: true, tagged: true, run: (m) => m.sendGapReportEmail({ to: 'a@b.co', name: 'Asha Rao', reportUrl: 'https://www.aussiegradcareers.com.au/report/tok123', dutyBullets: 4, totalBullets: 9, atsRisk: true }) },
  { name: 'premium welcome', client: true, tagged: true, run: (m) => m.sendPremiumWelcomeEmail({ to: 'a@b.co', name: 'Asha', skoolUrl: 'https://www.skool.com/touch-grass-5787/about' }) },
  // To Kiron. Not tagged, links still checked, dashes still banned.
  { name: 'admin: access request', client: false, tagged: false, run: (m) => m.sendAccessRequestNotification({ userName: 'Asha', userEmail: 'a@b.co', skoolEmail: '', targetRole: 'Analyst', userId: 'u1' }) },
  { name: 'admin: payment succeeded', client: false, tagged: false, run: (m) => m.sendAdminPaymentAlert({ event: 'payment_succeeded', userEmail: 'a@b.co', plan: '$250', subscriptionId: 'sub_1' }) },
  { name: 'admin: payment unmatched', client: false, tagged: false, run: (m) => m.sendAdminPaymentAlert({ event: 'payment_unmatched', userEmail: 'a@b.co', plan: '$250', subscriptionId: 'sub_1', firstSeenAt: new Date(), alertCount: 2 }) },
  { name: 'admin: coach digest', client: false, tagged: false, run: (m) => m.sendCoachDigestEmail({ to: 'k@agc', weekLabel: '12 Oct', missed: [{ name: 'A', email: 'a@b.co', applications: 1, outreach: 0, consecutiveMisses: 2 }], hit: [{ name: 'B', applications: 30, outreach: 12, streak: 2 }], backdated: [{ name: 'C', count: 2 }], goalChanges: [{ name: 'D', summary: 'raised' }] }) },
  { name: 'admin: friday brief', client: false, tagged: false, run: (m) => m.sendFridayBriefEmail('The script.', 3, '12 Oct') },
];

describe('every email the server sends', () => {
  let mod: any;
  let lifecycle: any;
  beforeAll(async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.PUBLIC_APP_URL = 'www.aussiegradcareers.com.au';
    process.env.UNMATCHED_PAYMENT_ALERTS = 'weekly';
    process.env.STRIPE_SECRET_KEY = 'sk_test_audit';
    mod = await import('./email');
    lifecycle = await import('./lifecycle/copy');
  });

  for (const s of SENDERS) {
    it(s.name, async () => {
      sent.length = 0;
      await s.run(mod);
      expect(sent.length, 'nothing was sent').toBeGreaterThan(0);
      const email = sent[sent.length - 1];
      const problems: string[] = [];
      for (const link of linksIn(email)) {
        for (const p of problemsWith(link, { mustTag: s.tagged })) problems.push(`${link}: ${p}`);
      }
      if (DASH.test(email.subject)) problems.push(`dash in subject: ${email.subject}`);
      if (DASH.test(email.text ?? '')) problems.push('dash in text');
      if (DASH.test(email.html ?? '')) problems.push('dash in html');
      expect(problems).toEqual([]);
    });
  }

  it('the ten lifecycle emails', async () => {
    const send = await import('./lifecycle/send');
    const keys = ['resume_ready', 'first_application', 'day3_no_card', 'card_added', 'pre_first_charge',
      'first_payment', 'weekly_checkin', 'pre_second_charge', 'pre_third_charge', 'plan_completed'];
    const problems: string[] = [];
    for (const key of keys) {
      for (const billingUrl of [send.BILLING_LINK, send.TRIAL_LINK]) {
        const e = lifecycle.lifecycleEmail(key, {
          firstName: 'Asha', appUrl: send.APP_LINK, billingUrl, amount: '$250',
          chargeDate: 'Friday 23 October 2026', applicationsThisWeek: 4, outreachThisWeek: 2,
          followupsDue: 1, recommendedNextAction: 'Follow up on Acme.',
        });
        const { tagEmailLinks } = await import('../email/send/sendEmail');
        const html = tagEmailLinks(lifecycle.renderHtml(e), SEND_ID);
        for (const link of linksIn({ html })) {
          for (const p of problemsWith(link, { mustTag: true })) problems.push(`${key}: ${link}: ${p}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the checker itself catches the bugs it is for', () => {
    expect(problemsWith('http://localhost:3002/api/email/track/click/x', { mustTag: false }).length).toBeGreaterThan(0);
    expect(problemsWith('www.aussiegradcareers.com.au/', { mustTag: false })).toContain('not an absolute address');
    expect(problemsWith('https://www.aussiegradcareers.com.au/no-such-page', { mustTag: false })[0]).toMatch(/no such page/);
    expect(problemsWith(`https://www.aussiegradcareers.com.au/tracker?e=${SEND_ID}`, { mustTag: true })).toEqual([]);
  });
});
