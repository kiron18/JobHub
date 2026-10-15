import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { emailHasLinks, isTrackableLink } from '../send/sendEmail';

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
  lifecycle_first_application: 'First application nudge',
  lifecycle_day3_no_card: 'Trial nearly over',
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

/** Where each automated email sits in someone's journey, for grouping. */
const STAGE: Record<string, string> = {
  welcome_resume: 'Signup and trial',
  lifecycle_resume_ready: 'Signup and trial',
  lifecycle_first_application: 'Signup and trial',
  lifecycle_day3_no_card: 'Signup and trial',
  trial_ending: 'Signup and trial',
  challenge_day_unlocked: 'Signup and trial',
  cv_roadmap: 'Signup and trial',
  diagnosis_ready: 'Signup and trial',
  lifecycle_card_added: 'Paying clients',
  lifecycle_pre_first_charge: 'Paying clients',
  lifecycle_first_payment: 'Paying clients',
  lifecycle_weekly_checkin: 'Paying clients',
  lifecycle_pre_second_charge: 'Paying clients',
  lifecycle_pre_third_charge: 'Paying clients',
  lifecycle_plan_completed: 'Paying clients',
  client_onboarding: 'Paying clients',
  premium_welcome: 'Paying clients',
  follow_up_reminder: 'Job search nudges',
  application_status: 'Job search nudges',
  pace_nudge: 'Job search nudges',
  weekly_wrap: 'Job search nudges',
  sales_meeting_reminder_day: 'Calls and workshops',
  sales_meeting_reminder_hour: 'Calls and workshops',
  workshop_confirmation: 'Calls and workshops',
  workshop_reminder: 'Calls and workshops',
  gap_report: 'Calls and workshops',
};

const DAY = 86_400_000;
const WINDOWS = [7, 30, 90];

/**
 * When measuring started on production: the Resend webhook and the ?e= click
 * tags went live on 15 October 2026. Before that nothing was recorded (the old
 * pixel and click redirect pointed at localhost), so a send from before this
 * moment is not "unopened", it is unmeasured. Rates only count sends after it.
 */
export const TRACKING_SINCE = new Date('2026-10-15T05:00:00Z');

/** Percent, or null when there is nothing to divide by. */
function rate(n: number, of: number): number | null {
  return of > 0 ? Math.round((n / of) * 100) : null;
}

/** Whether a plain-text body has a link to our site (those are tagged too). */
function textHasLinks(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const m of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
    if (isTrackableLink(m[0].replace(/[.,;:!?)\]]+$/, ''))) return true;
  }
  return false;
}

interface Tally {
  sent: number; measured: number; delivered: number; bounced: number; complained: number;
  openable: number; opened: number; clickable: number; clicked: number;
}
const tally = (): Tally => ({ sent: 0, measured: 0, delivered: 0, bounced: 0, complained: 0, openable: 0, opened: 0, clickable: 0, clicked: 0 });

function summarise(t: Tally) {
  return {
    sent: t.sent,
    /** Sends since measuring started: the base every rate is worked out on. */
    measured: t.measured,
    delivered: t.delivered,
    opened: t.opened,
    clicked: t.clicked,
    /** HTML sends since measuring started: the base for the open rate. */
    openable: t.openable,
    /** Sends with a link to us since measuring started: the base for the click rate. */
    clickable: t.clickable,
    bounced: t.bounced,
    complained: t.complained,
    deliveryRate: rate(t.delivered, t.measured),
    openRate: rate(t.opened, t.openable),
    clickRate: rate(t.clicked, t.clickable),
    /** False when the email cannot show it: plain text has no opens, no link to us has no clicks. */
    canOpen: t.openable > 0 || t.measured === 0,
    canClick: t.clickable > 0 || t.measured === 0,
  };
}

// GET /admin/email-analytics?days=7|30|90
//
// One row per kind of email (each automated email, each broadcast) for the
// window, the headline numbers, the latest sends and the bounces.
//
//   delivered, bounced, spam   Resend's webhook, for every email
//   opened                     Resend's webhook, HTML email only (plain text
//                              has nowhere for an open pixel)
//   clicked                    our own site, for links to it (?e= on landing)
//
// Every rate is worked out over the sends that could have reported it: sent
// after TRACKING_SINCE, and for opens HTML, for clicks with a link to us.
router.get('/admin/email-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const asked = Number(req.query.days);
    const days = WINDOWS.includes(asked) ? asked : 30;
    const since = new Date(Date.now() - days * DAY);
    const measuredFrom = since > TRACKING_SINCE ? since : TRACKING_SINCE;

    const [sends, templates, broadcasts, unsubscribed, contacts] = await Promise.all([
      prisma.emailSend.findMany({
        where: { sentAt: { gte: since } },
        select: {
          id: true, templateId: true, broadcastId: true, sentAt: true, subject: true, toEmail: true,
          deliveredAt: true, bouncedAt: true, bounceReason: true, complainedAt: true,
        },
        orderBy: { sentAt: 'desc' },
      }),
      prisma.emailTemplate.findMany({ select: { id: true, name: true, bodyHtml: true, bodyText: true } }),
      prisma.broadcast.findMany({ select: { id: true, name: true, bodyHtml: true, bodyText: true } }),
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

    const add = (t: Tally, s: typeof real[number], html: boolean, links: boolean) => {
      t.sent++;
      if (s.bouncedAt) t.bounced++;
      if (s.complainedAt) t.complained++;
      if (s.sentAt < measuredFrom) return;
      t.measured++;
      if (s.deliveredAt) t.delivered++;
      if (html) { t.openable++; if (openedSet.has(s.id)) t.opened++; }
      if (links) { t.clickable++; if (clickedSet.has(s.id)) t.clicked++; }
    };

    interface Group {
      id: string; label: string; kind: 'automated' | 'campaign'; stage: string;
      html: boolean; links: boolean; t: Tally; lastSentAt: Date; lastSubject: string;
    }
    const groups = new Map<string, Group>();
    const total = tally();
    const recent: Array<{ id: string; toEmail: string; subject: string; label: string; sentAt: Date; status: string; detail: string | null }> = [];

    for (const s of real) {
      const b = s.broadcastId ? broadcastById.get(s.broadcastId) : undefined;
      const t = !b && s.templateId ? templateById.get(s.templateId) : undefined;
      const source = b ?? t;
      if (!source) continue;
      const key = b ? `b:${b.id}` : `t:${t!.id}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          id: key,
          label: b ? b.name : LABELS[t!.name] ?? t!.name,
          kind: b ? 'campaign' : 'automated',
          stage: b ? 'Marketing' : STAGE[t!.name] ?? 'Other',
          html: !!source.bodyHtml,
          links: emailHasLinks(source.bodyHtml) || textHasLinks(source.bodyText),
          t: tally(),
          // Sends arrive newest first, so the first one seen is the latest.
          lastSentAt: s.sentAt,
          lastSubject: s.subject,
        };
        groups.set(key, g);
      }
      add(g.t, s, g.html, g.links);
      add(total, s, g.html, g.links);

      if (recent.length < 15) {
        const status = s.complainedAt ? 'Marked as spam'
          : s.bouncedAt ? 'Bounced'
          : clickedSet.has(s.id) ? 'Clicked'
          : openedSet.has(s.id) ? 'Opened'
          : s.deliveredAt ? 'Delivered'
          : s.sentAt < TRACKING_SINCE ? 'Sent, not measured'
          : 'Sent';
        recent.push({ id: s.id, toEmail: s.toEmail, subject: s.subject, label: g.label, sentAt: s.sentAt, status, detail: s.bouncedAt ? s.bounceReason : null });
      }
    }

    const rows = [...groups.values()]
      .sort((a, b) => +b.lastSentAt - +a.lastSentAt)
      .map((g) => ({
        id: g.id, label: g.label, kind: g.kind, stage: g.stage,
        lastSentAt: g.lastSentAt, lastSubject: g.lastSubject,
        ...summarise(g.t),
      }));

    // The ones that never arrived, newest first: a missed call reminder is
    // worth knowing about the same day.
    const bounces = real
      .filter((s) => s.bouncedAt)
      .slice(0, 20)
      .map((s) => ({ toEmail: s.toEmail, subject: s.subject, bouncedAt: s.bouncedAt, reason: s.bounceReason }));

    return res.json({
      days,
      trackingSince: TRACKING_SINCE,
      summary: { ...summarise(total), unsubscribed, contacts },
      emails: rows,
      recent,
      bounces,
    });
  } catch (err) {
    console.error('[analyticsRoutes] GET /admin/email-analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch email analytics' });
  }
});

export default router;
