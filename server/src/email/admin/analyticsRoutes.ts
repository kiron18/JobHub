import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { EXEMPT_EMAILS } from '../../routes/stripe';
import { emailHasLinks } from '../send/sendEmail';

const router = Router();

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.use(authenticate, requireAdmin);

/** Mail to our own test inboxes would flatter every rate on the page. Same
 * pattern /admin/traffic drops. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;

/** Plain names for the automated emails, keyed on the `kind` services/email.ts
 * sends them under. Anything not listed shows its raw name. */
const LABELS: Record<string, string> = {
  welcome_resume: 'Rewritten resume (welcome)',
  diagnosis_ready: 'Diagnosis ready',
  workshop_confirmation: 'Workshop confirmation',
  workshop_reminder: 'Workshop reminder',
  gap_report: 'Post-workshop gap report',
  client_onboarding: 'Paid: set your password',
  premium_welcome: 'Paid: what happens now',
  trial_ending: 'Trial ends tomorrow',
  challenge_day_unlocked: 'Challenge day unlocked',
  cv_roadmap: 'CV roadmap',
  application_status: 'Application status',
  follow_up_reminder: 'Follow-up reminder',
  pace_nudge: 'Behind pace nudge',
  weekly_wrap: 'Weekly wrap',
};

const DAY = 86_400_000;

/** Percent, or null when there is nothing to divide by. */
function rate(n: number, of: number): number | null {
  return of > 0 ? Math.round((n / of) * 100) : null;
}

// GET /admin/email-analytics
//
// One row per kind of email (each automated email, each broadcast), with when
// it last went out and how it did. Opens and clicks only exist for HTML email:
// plain text has nowhere to put a pixel and its links are left as written, so
// for those rows the rates are null and the page says "not tracked" rather than
// a 0% that would read as "nobody opened it".
router.get('/admin/email-analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const since30 = new Date(Date.now() - 30 * DAY);
    const since7 = new Date(Date.now() - 7 * DAY);

    const [sends, templates, broadcasts, unsubscribed, contacts] = await Promise.all([
      prisma.emailSend.findMany({
        select: { id: true, templateId: true, broadcastId: true, sentAt: true, subject: true, toEmail: true },
        orderBy: { sentAt: 'desc' },
      }),
      prisma.emailTemplate.findMany({ select: { id: true, name: true, bodyHtml: true } }),
      prisma.broadcast.findMany({ select: { id: true, name: true, bodyHtml: true } }),
      prisma.contact.count({ where: { unsubscribedAt: { not: null } } }),
      prisma.contact.count(),
    ]);

    const real = sends.filter((s) => !TEST_EMAIL.test(s.toEmail));
    const ids = real.map((s) => s.id);
    const [opened, clicked] = ids.length
      ? await Promise.all([
          prisma.emailOpen.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: ids } } }),
          prisma.emailClick.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: ids } } }),
        ])
      : [[], []];
    const openedSet = new Set(opened.map((o) => o.emailSendId));
    const clickedSet = new Set(clicked.map((c) => c.emailSendId));

    const templateById = new Map(templates.map((t) => [t.id, t]));
    const broadcastById = new Map(broadcasts.map((b) => [b.id, b]));

    interface Group {
      id: string;
      label: string;
      kind: 'automated' | 'campaign';
      tracked: boolean;
      hasLinks: boolean;
      sent: number;
      sent30: number;
      opened30: number;
      clicked30: number;
      lastSentAt: Date;
      lastSubject: string;
    }
    const groups = new Map<string, Group>();

    for (const s of real) {
      const b = s.broadcastId ? broadcastById.get(s.broadcastId) : undefined;
      const t = !b && s.templateId ? templateById.get(s.templateId) : undefined;
      if (!b && !t) continue;
      const key = b ? `b:${b.id}` : `t:${t!.id}`;
      let g = groups.get(key);
      if (!g) {
        const html = (b ?? t)!.bodyHtml;
        g = {
          id: key,
          label: b ? b.name : LABELS[t!.name] ?? t!.name,
          kind: b ? 'campaign' : 'automated',
          tracked: !!html,
          hasLinks: emailHasLinks(html),
          sent: 0, sent30: 0, opened30: 0, clicked30: 0,
          // Sends arrive newest first, so the first one seen is the latest.
          lastSentAt: s.sentAt,
          lastSubject: s.subject,
        };
        groups.set(key, g);
      }
      g.sent++;
      if (s.sentAt >= since30) {
        g.sent30++;
        if (openedSet.has(s.id)) g.opened30++;
        if (clickedSet.has(s.id)) g.clicked30++;
      }
    }

    const rows = [...groups.values()]
      .sort((a, b) => +b.lastSentAt - +a.lastSentAt)
      .map((g) => ({
        id: g.id,
        label: g.label,
        kind: g.kind,
        tracked: g.tracked,
        lastSentAt: g.lastSentAt,
        lastSubject: g.lastSubject,
        sent: g.sent,
        sent30: g.sent30,
        openRate: g.tracked ? rate(g.opened30, g.sent30) : null,
        clickRate: g.tracked && g.hasLinks ? rate(g.clicked30, g.sent30) : null,
        hasLinks: g.hasLinks,
      }));

    // Headline rates only count the sends that could have recorded an open or
    // a click, or plain-text volume would drag both towards zero.
    let trackedSent = 0, trackedOpened = 0, linkSent = 0, linkClicked = 0;
    for (const g of groups.values()) {
      if (!g.tracked) continue;
      trackedSent += g.sent30;
      trackedOpened += g.opened30;
      if (g.hasLinks) { linkSent += g.sent30; linkClicked += g.clicked30; }
    }

    const last = real[0];
    return res.json({
      summary: {
        lastSentAt: last?.sentAt ?? null,
        lastSubject: last?.subject ?? null,
        sent7: real.filter((s) => s.sentAt >= since7).length,
        sent30: real.filter((s) => s.sentAt >= since30).length,
        openRate30: rate(trackedOpened, trackedSent),
        clickRate30: rate(linkClicked, linkSent),
        trackedSent30: trackedSent,
        unsubscribed,
        contacts,
      },
      emails: rows,
    });
  } catch (err) {
    console.error('[analyticsRoutes] GET /admin/email-analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch email analytics' });
  }
});

export default router;
