import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { isPaidOrExempt } from '../middleware/accessControl';
import { hasComplimentaryAccess } from './stripe';
import { noticeFor, DEFAULT_PLAN_AMOUNT, INCLUDED_ACCESS_MONTHS, hoursBetween, type NoticeKey } from '../services/lifecycle/rules';
import {
  LIFECYCLE_KIND, LIFECYCLE_POPUP_KIND, aestDayKey, formatChargeDate, subscriptionSnapshot,
  runSignupEmails, runPreChargeEmails, runWeeklyCheckins,
} from '../services/lifecycle/send';
import { lifecycleEmail, renderHtml, type LifecycleEmailKey } from '../services/lifecycle/copy';

/**
 * The login popups that sit alongside the lifecycle emails.
 *
 * GET  /api/lifecycle/notice        the one popup due for this person, or null
 *                                   (?want=day3_commit forces the day-3 card if they have no card yet)
 * POST /api/lifecycle/notice/ack    { ackKey } so it does not come back
 *
 * Admin only:
 * GET  /api/lifecycle/notice?preview=<key>   any popup, for checking the copy
 * GET  /api/lifecycle/preview/:key           any email, rendered as HTML
 * POST /api/lifecycle/dry-run                who the crons would email right now, nothing sent
 */

const router = Router();

const PREVIEW_KEYS: NoticeKey[] = [
  'day3_commit', 'card_added', 'pre_first_charge', 'first_payment',
  'pre_second_charge', 'pre_third_charge', 'plan_completed',
];

router.get('/notice', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const email = req.user!.email ?? '';
  const preview = String(req.query.preview ?? '') as NoticeKey;

  try {
    if (preview && PREVIEW_KEYS.includes(preview) && hasComplimentaryAccess(email)) {
      const fakeCharge = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      res.json({ notice: {
        key: preview, ackKey: `preview:${preview}`, amount: DEFAULT_PLAN_AMOUNT,
        chargeDate: formatChargeDate(fakeCharge), daysSinceSignup: 3, includedMonths: INCLUDED_ACCESS_MONTHS,
      } });
      return;
    }
    // Owner and comp logins have nothing to be charged for.
    if (hasComplimentaryAccess(email)) { res.json({ notice: null }); return; }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        createdAt: true, plan: true, planStatus: true, trialEndDate: true, dashboardAccess: true,
        accessExpiresAt: true, stripeSubscriptionId: true,
      },
    });
    if (!profile) { res.json({ notice: null }); return; }

    const [sent, acked] = await Promise.all([
      prisma.nudgeLog.findMany({ where: { userId, kind: LIFECYCLE_KIND }, select: { periodKey: true, sentAt: true } }),
      prisma.nudgeLog.findMany({ where: { userId, kind: LIFECYCLE_POPUP_KIND }, select: { periodKey: true } }),
    ]);
    // periodKey is "<email key>" or "<email key>:<subscription or week>".
    const emailsSent: Record<string, Date> = {};
    for (const row of sent) {
      const key = row.periodKey.split(':')[0];
      if (!emailsSent[key] || emailsSent[key] < row.sentAt) emailsSent[key] = row.sentAt;
    }

    const now = new Date();
    const hasPaidAccess = isPaidOrExempt(profile, email);
    // The day-3 email's button (/?trial=continue) opens the day-3 card on demand,
    // whatever day it is, for anyone who still has no card on file.
    const wantsTrial = req.query.want === 'day3_commit' && !hasPaidAccess && !profile.stripeSubscriptionId;
    const decision = wantsTrial ? { key: 'day3_commit' as const, ackKey: `day3_commit:${aestDayKey()}` } : noticeFor({
      now,
      signedUpAt: profile.createdAt,
      hasPaidAccess,
      hasSubscription: !!profile.stripeSubscriptionId,
      planStatus: profile.planStatus,
      trialEndDate: profile.trialEndDate,
      emailsSent,
      acked: new Set(acked.map((a) => a.periodKey)),
    }, aestDayKey());
    if (!decision) { res.json({ notice: null }); return; }

    // The popups that quote a date and an amount read them from Stripe, so
    // what the popup says is what the card will be charged.
    let amount = DEFAULT_PLAN_AMOUNT;
    let chargeDate: string | null = null;
    if (profile.stripeSubscriptionId && decision.key !== 'day3_commit') {
      try {
        const snap = await subscriptionSnapshot(profile.stripeSubscriptionId);
        amount = snap.amount;
        if (snap.nextChargeAt) chargeDate = formatChargeDate(snap.nextChargeAt);
      } catch { /* the popup still makes sense without the date */ }
    }

    res.json({ notice: {
      ...decision,
      amount,
      chargeDate,
      daysSinceSignup: Math.floor(hoursBetween(profile.createdAt, now) / 24) + 1,
      includedMonths: INCLUDED_ACCESS_MONTHS,
    } });
  } catch (err: any) {
    console.error('[lifecycle] notice failed:', err?.message ?? err);
    res.json({ notice: null });
  }
});

router.post('/notice/ack', authenticate, async (req: AuthRequest, res: Response) => {
  const ackKey = String(req.body?.ackKey ?? '').slice(0, 80);
  if (!ackKey || ackKey.startsWith('preview:')) { res.json({ ok: true }); return; }
  await prisma.nudgeLog.create({ data: { userId: req.user!.id, kind: LIFECYCLE_POPUP_KIND, periodKey: ackKey } }).catch(() => {});
  res.json({ ok: true });
});

const EMAIL_KEYS: LifecycleEmailKey[] = [
  'resume_ready', 'first_application', 'day3_no_card', 'card_added', 'pre_first_charge',
  'first_payment', 'weekly_checkin', 'pre_second_charge', 'pre_third_charge', 'plan_completed',
];

router.get('/preview/:key', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const key = req.params.key as LifecycleEmailKey;
  if (!EMAIL_KEYS.includes(key)) { res.status(404).json({ error: `one of: ${EMAIL_KEYS.join(', ')}` }); return; }
  const email = lifecycleEmail(key, {
    firstName: 'Priya', appUrl: 'https://www.aussiegradcareers.com.au/', billingUrl: 'https://www.aussiegradcareers.com.au/?billing=portal',
    amount: DEFAULT_PLAN_AMOUNT, chargeDate: formatChargeDate(new Date(Date.now() + 2 * 86400000)),
    applicationsThisWeek: 12, outreachThisWeek: 4, followupsDue: 3,
    recommendedNextAction: 'send your 3 follow-ups first. They are the quickest wins sitting in your pipeline.',
  });
  res.type('html').send(`<h3 style="font-family:Arial">Subject: ${email.subject}</h3>${renderHtml(email)}`);
});

router.post('/dry-run', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const opts = { dryRun: true };
  const [signup, preCharge, weekly] = await Promise.all([
    runSignupEmails(opts), runPreChargeEmails(opts), runWeeklyCheckins(opts),
  ]);
  res.json({ signup, preCharge, weekly });
});

export default router;
