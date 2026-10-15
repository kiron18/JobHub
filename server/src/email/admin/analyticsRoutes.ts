import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { emailHasLinks } from '../send/sendEmail';

const router = Router();

// Scoped to /admin: this router is mounted at /api, and an unscoped guard
// would put the admin check in front of every route mounted after it.
router.use('/admin', authenticate, requireAdmin);

/** Mail to our own test inboxes would flatter every rate on the page. Same
 * pattern /admin/traffic drops. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;

/** Plain names for the automated emails, keyed on the `kind` services/email.ts
 * sends them under. Anything not listed shows its raw name. */
const LABELS: Record<string, string> = {
  welcome_resume: 'Welcome: your resume is ready',
  lifecycle_resume_ready: 'Welcome: your resume is ready',
  lifecycle_first_application:'Signup: first application',
  lifecycle_day3_no_card: 'Signup: trial nearly over',
  lifecycle_card_added: 'Card added',
  lifecycle_pre_first_charge: 'Before first charge',
  lifecycle_first_payment: 'First payment',
  lifecycle_weekly_checkin: 'Weekly check-in',
  lifecycle_pre_second_charge: 'Before second charge',
  lifecycle_pre_third_charge: 'Before third charge',
  lifecycle_plan_completed: 'Plan completed',
  sales_meeting_reminder_day: 'Call reminder, day before',
  sales_meeting_reminder_hour: 'Call reminder, hour before',
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
// it last went out and how it did.
//
//   delivered, bounced, spam   Resend's webhook, for every email
//   opened                     Resend's webhook, HTML email only (plain text has
//                              nowhere for an open pixel), else null: "not
//                              tracked" rather than a 0% that reads as "nobody"
//   clicked                    our own site, for links to it (?e= on landing)
//
// Delivery numbers only exist from 2026-10-15, when the webhook went in, so
// rates are worked out over the sends that could have reported one.
router.get('/admin/email-analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const since30 = new Date(Date.now() - 30 * DAY);
    const since7 = new Date(Date.now() - 7 * DAY);

    const [sends, templates, broadcasts, unsubscribed, contacts] = await Promise.all([
      prisma.emailSend.findMany({
        select: {
          id: true, templateId: true, broadcastId: true, sentAt: true, subject: true, toEmail: true,
          deliveredAt: true, bouncedAt: true, bounceReason: true, complainedAt: true,
        },
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
      /** Sends in the window that Resend has reported on at all. */
      reported30: number;
      delivered30: number;
      bounced30: number;
      complained30: number;
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
          reported30: 0, delivered30: 0, bounced30: 0, complained30: 0,
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
        if (s.deliveredAt || s.bouncedAt) g.reported30++;
        if (s.deliveredAt) g.delivered30++;
        if (s.bouncedAt) g.bounced30++;
        if (s.complainedAt) g.complained30++;
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
        clickRate: g.hasLinks ? rate(g.clicked30, g.sent30) : null,
        hasLinks: g.hasLinks,
        bounced30: g.bounced30,
        complained30: g.complained30,
        deliveryRate: rate(g.delivered30, g.reported30),
      }));

    // Headline rates only count the sends that could have recorded an open or
    // a click, or plain-text volume would drag both towards zero.
    let trackedSent = 0, trackedOpened = 0, linkSent = 0, linkClicked = 0;
    for (const g of groups.values()) {
      if (!g.tracked) continue;
      trackedSent += g.sent30;
      trackedOpened += g.opened30;
    }
    for (const g of groups.values()) {
      if (g.hasLinks) { linkSent += g.sent30; linkClicked += g.clicked30; }
    }

    // The ones that never arrived, newest first: a missed call reminder is
    // worth knowing about the same day.
    const bounces = real
      .filter((s) => s.bouncedAt && s.sentAt >= since30)
      .slice(0, 20)
      .map((s) => ({ toEmail: s.toEmail, subject: s.subject, bouncedAt: s.bouncedAt, reason: s.bounceReason }));

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
        bounced30: real.filter((s) => s.bouncedAt && s.sentAt >= since30).length,
        complained30: real.filter((s) => s.complainedAt && s.sentAt >= since30).length,
        unsubscribed,
        contacts,
      },
      emails: rows,
      bounces,
    });
  } catch (err) {
    console.error('[analyticsRoutes] GET /admin/email-analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch email analytics' });
  }
});

export default router;
