import StripeLib from 'stripe';
import { prisma } from '../../index';
import { PUBLIC_APP_URL } from '../../lib/appUrl';
import { sendLogged } from '../email';
import { hasComplimentaryAccess } from '../../routes/stripe';
import { getRealUserIds } from '../../routes/admin';
import { isPaidOrExempt } from '../../middleware/accessControl';
import { SENT_APPLICATION_FILTER } from '../tracker/metricHelpers';
import { mondayAEST } from '../tracker/goals';
import { todayAEST } from '../jobFeed';
import { lifecycleEmail, renderHtml, renderText, type LifecycleEmailKey, type CopyVars } from './copy';
import {
  DEFAULT_PLAN_AMOUNT, DAY3_WINDOW, FIRST_APPLICATION_WINDOW, PRE_CHARGE_WINDOW,
  hoursBetween, inWindow, includedAccessExpiry, paidEmailFor,
  preChargeEmailFor, recommendedNextAction, willCharge,
} from './rules';

/**
 * Sends the lifecycle emails (copy.ts) at the moments rules.ts decides.
 *
 * Master switch: nothing here sends unless LIFECYCLE_EMAILS=on. Email 1 is the
 * exception because it replaces the welcome email that was already live; it is
 * sent by routes/welcome.ts through services/email.ts.
 *
 * Every send is claimed in NudgeLog first (kind 'lifecycle', one periodKey per
 * email per person or per subscription), so a restart, a second instance or a
 * Stripe webhook redelivery can never send the same email twice. A send that
 * fails releases its claim so the next run retries it.
 */

const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

export const LIFECYCLE_KIND = 'lifecycle';
export const LIFECYCLE_POPUP_KIND = 'lifecycle_popup';

export function lifecycleEmailsEnabled(): boolean {
  return (process.env.LIFECYCLE_EMAILS ?? '').trim().toLowerCase() === 'on';
}

export const APP_LINK = `${PUBLIC_APP_URL}/`;
/** No card yet: the app opens the day-3 card, which carries the checkout button (see LifecycleNotice.tsx). */
export const TRIAL_LINK = `${PUBLIC_APP_URL}/?trial=continue`;
/** Card on file: the app opens their Stripe billing portal (see LifecycleNotice.tsx). */
export const BILLING_LINK = `${PUBLIC_APP_URL}/?billing=portal`;

const HOUR = 60 * 60 * 1000;

export function formatChargeDate(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatAmount(unitAmountCents: number | null | undefined): string {
  if (unitAmountCents == null) return DEFAULT_PLAN_AMOUNT;
  const dollars = unitAmountCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function firstNameOf(name?: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  if (n) return n.charAt(0).toUpperCase() + n.slice(1);
  return '';
}

interface Recipient { userId: string; email: string; name?: string | null }

export interface SendOutcome { email: string; key: LifecycleEmailKey; result: 'sent' | 'already_sent' | 'disabled' | 'dry_run' | 'failed'; reason?: string }

async function claim(userId: string, periodKey: string): Promise<boolean> {
  try {
    await prisma.nudgeLog.create({ data: { userId, kind: LIFECYCLE_KIND, periodKey } });
    return true;
  } catch {
    return false;
  }
}

async function release(userId: string, periodKey: string): Promise<void> {
  await prisma.nudgeLog.deleteMany({ where: { userId, kind: LIFECYCLE_KIND, periodKey } }).catch(() => {});
}

/**
 * The one way a lifecycle email goes out. `periodKey` must start with the
 * email key: the login popups read it back to know which email was sent.
 */
export async function sendLifecycleEmail(
  to: Recipient,
  key: LifecycleEmailKey,
  periodKey: string,
  vars: Omit<CopyVars, 'firstName' | 'appUrl' | 'billingUrl'> & Partial<Pick<CopyVars, 'billingUrl'>>,
  opts: { dryRun?: boolean } = {},
): Promise<SendOutcome> {
  const base = { email: to.email, key };
  if (!lifecycleEmailsEnabled() && !opts.dryRun) return { ...base, result: 'disabled' };
  if (hasComplimentaryAccess(to.email) && !opts.dryRun) return { ...base, result: 'disabled', reason: 'owner/comp account' };
  if (opts.dryRun) return { ...base, result: 'dry_run' };
  if (!(await claim(to.userId, periodKey))) return { ...base, result: 'already_sent' };

  const email = lifecycleEmail(key, {
    firstName: firstNameOf(to.name),
    appUrl: APP_LINK,
    billingUrl: vars.billingUrl ?? BILLING_LINK,
    ...vars,
  });
  try {
    const res = await sendLogged(`lifecycle_${key}`, {
      to: to.email,
      subject: email.subject,
      html: renderHtml(email),
      text: renderText(email),
      firstName: firstNameOf(to.name) || null,
    });
    if (res.error) throw new Error(res.error.message);
    console.log(`[lifecycle] sent ${key} to ${to.email}`);
    return { ...base, result: 'sent' };
  } catch (err: any) {
    await release(to.userId, periodKey);
    console.error(`[lifecycle] ${key} to ${to.email} failed:`, err?.message ?? err);
    return { ...base, result: 'failed', reason: err?.message };
  }
}

// ── Stripe reads ─────────────────────────────────────────────────────────────

/** Invoices that actually took money. The $0 invoice a trial opens with does not count. */
export async function paidInvoiceCount(subscriptionId: string): Promise<number> {
  const list = await stripe.invoices.list({ subscription: subscriptionId, status: 'paid', limit: 100 });
  return list.data.filter((i) => (i.amount_paid ?? 0) > 0).length;
}

interface SubSnapshot {
  status: string;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  nextChargeAt: Date | null;
  amount: string;
}

export async function subscriptionSnapshot(subscriptionId: string): Promise<SubSnapshot> {
  const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items?.data?.[0];
  // current_period_end moved onto the item in API 2025-03; the top-level field is the fallback.
  const periodEnd: number | undefined = item?.current_period_end ?? sub.current_period_end;
  const nextCharge = sub.status === 'trialing' && sub.trial_end ? sub.trial_end : periodEnd;
  return {
    status: sub.status,
    cancel_at: sub.cancel_at ?? null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    nextChargeAt: nextCharge ? new Date(nextCharge * 1000) : null,
    amount: formatAmount(item?.price?.unit_amount),
  };
}

// ── Webhook moments (called from routes/stripe.ts, never allowed to throw) ────

/** Email 4. Card is on file and the four-day card trial has started. */
export async function onTrialStarted(userId: string, subscriptionId: string): Promise<void> {
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { email: true, name: true } });
    if (!profile?.email) return;
    const snap = await subscriptionSnapshot(subscriptionId);
    if (snap.status !== 'trialing' || !snap.nextChargeAt) return;
    await sendLifecycleEmail(
      { userId, email: profile.email, name: profile.name },
      'card_added',
      `card_added:${subscriptionId}`,
      { amount: snap.amount, chargeDate: formatChargeDate(snap.nextChargeAt) },
    );
  } catch (err: any) {
    console.error('[lifecycle] onTrialStarted failed:', err?.message ?? err);
  }
}

/**
 * Emails 6 and 10, and the 12 months of included access.
 *
 * The access grant is NOT behind the email switch: it is what the plan
 * promises, so it happens on the third payment whether or not emails are on.
 */
export async function onInvoicePaid(subscriptionId: string, invoice: any): Promise<void> {
  try {
    if ((invoice?.amount_paid ?? 0) <= 0) return;
    const profile = await prisma.candidateProfile.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { userId: true, email: true, name: true, accessExpiresAt: true },
    });
    if (!profile) return;

    const count = await paidInvoiceCount(subscriptionId);
    const key = paidEmailFor(count);
    if (!key) return;

    if (key === 'plan_completed') {
      const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
      const lineEnd: number | undefined = invoice?.lines?.data?.[0]?.period?.end;
      const termEndSec: number | undefined = sub.cancel_at ?? lineEnd ?? sub.items?.data?.[0]?.current_period_end;
      const termEnd = termEndSec ? new Date(termEndSec * 1000) : new Date();
      const expiry = includedAccessExpiry(termEnd);
      if (!profile.accessExpiresAt || profile.accessExpiresAt < expiry) {
        await prisma.candidateProfile.update({ where: { userId: profile.userId }, data: { accessExpiresAt: expiry } });
        console.log(`[lifecycle] ${profile.email}: plan completed, included access until ${expiry.toISOString().slice(0, 10)}`);
      }
    }

    if (!profile.email) return;
    await sendLifecycleEmail(
      { userId: profile.userId, email: profile.email, name: profile.name },
      key,
      `${key}:${subscriptionId}`,
      { amount: formatAmount(invoice?.amount_paid) },
    );
  } catch (err: any) {
    console.error('[lifecycle] onInvoicePaid failed:', err?.message ?? err);
  }
}

// ── Daily and weekly runs ────────────────────────────────────────────────────

export interface RunResult { job: string; outcomes: SendOutcome[]; skipped: number }

async function realProfiles(where: Record<string, unknown>, select: Record<string, boolean>) {
  const userIds = await getRealUserIds();
  if (userIds.length === 0) return [];
  const rows: any[] = await prisma.candidateProfile.findMany({
    where: { userId: { in: userIds }, email: { not: null }, ...where },
    select: { userId: true, email: true, name: true, ...select },
  });
  return rows.filter((p) => p.email && !p.email.endsWith('@jobhub-test.local') && !hasComplimentaryAccess(p.email));
}

/** Emails 2 and 3, by account age. */
export async function runSignupEmails(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const now = new Date();
  const oldest = new Date(now.getTime() - DAY3_WINDOW.toHours * HOUR);
  const profiles = await realProfiles(
    { createdAt: { gte: oldest } },
    { id: true, createdAt: true, plan: true, planStatus: true, dashboardAccess: true, accessExpiresAt: true, stripeSubscriptionId: true },
  );
  const outcomes: SendOutcome[] = [];
  let skipped = 0;

  for (const p of profiles) {
    const age = hoursBetween(p.createdAt, now);
    const to = { userId: p.userId, email: p.email, name: p.name };

    if (inWindow(age, FIRST_APPLICATION_WINDOW)) {
      const apps = await prisma.jobApplication.count({ where: { userId: p.userId, ...SENT_APPLICATION_FILTER } });
      if (apps > 0) { skipped++; continue; }
      outcomes.push(await sendLifecycleEmail(to, 'first_application', 'first_application', { amount: DEFAULT_PLAN_AMOUNT }, opts));
      continue;
    }

    if (inWindow(age, DAY3_WINDOW)) {
      if (p.stripeSubscriptionId || isPaidOrExempt(p, p.email)) { skipped++; continue; }
      outcomes.push(await sendLifecycleEmail(to, 'day3_no_card', 'day3_no_card', { amount: DEFAULT_PLAN_AMOUNT, billingUrl: TRIAL_LINK }, opts));
      continue;
    }
    skipped++;
  }
  return { job: 'signup', outcomes, skipped };
}

/** Emails 5, 8 and 9: 48 hours before each scheduled charge. */
export async function runPreChargeEmails(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const now = new Date();
  const profiles = await realProfiles(
    { stripeSubscriptionId: { not: null }, planStatus: { in: ['trialing', 'active', 'past_due'] } },
    { stripeSubscriptionId: true },
  );
  const outcomes: SendOutcome[] = [];
  let skipped = 0;

  for (const p of profiles) {
    try {
      const subId = p.stripeSubscriptionId as string;
      const snap = await subscriptionSnapshot(subId);
      if (!snap.nextChargeAt || !inWindow(hoursBetween(now, snap.nextChargeAt), PRE_CHARGE_WINDOW)) { skipped++; continue; }
      if (!willCharge(snap, snap.nextChargeAt)) { skipped++; continue; }

      const paid = snap.status === 'trialing' ? 0 : await paidInvoiceCount(subId);
      const key = preChargeEmailFor(paid);
      if (!key) { skipped++; continue; }
      outcomes.push(await sendLifecycleEmail(
        { userId: p.userId, email: p.email, name: p.name },
        key,
        `${key}:${subId}`,
        { amount: snap.amount, chargeDate: formatChargeDate(snap.nextChargeAt) },
        opts,
      ));
    } catch (err: any) {
      console.error(`[lifecycle] pre-charge check failed for ${p.email}:`, err?.message ?? err);
      skipped++;
    }
  }
  return { job: 'pre_charge', outcomes, skipped };
}

/** Email 7: the weekly check-in, for paying clients only. */
export async function runWeeklyCheckins(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const now = new Date();
  const weekKey = mondayAEST().toISOString().slice(0, 10);
  const lastWeekKey = new Date(mondayAEST().getTime() - 7 * 24 * HOUR).toISOString().slice(0, 10);
  const profiles = await realProfiles(
    {},
    { id: true, plan: true, planStatus: true, accessExpiresAt: true, dashboardAccess: true, trialEndDate: true },
  );
  const outcomes: SendOutcome[] = [];
  let skipped = 0;

  const since = new Date(now.getTime() - 7 * 24 * HOUR);
  const followFrom = new Date(now.getTime() - 30 * 24 * HOUR);

  for (const p of profiles) {
    const paying = (p.plan !== 'free' && ['active', 'past_due'].includes(p.planStatus))
      || (p.accessExpiresAt && p.accessExpiresAt > now);
    if (!paying) { skipped++; continue; }

    // The accountability weekly wrap goes out the same morning, keyed on the
    // week it reports on. One weekly email, not two.
    const wrap = await prisma.nudgeLog.findFirst({ where: { userId: p.userId, kind: 'weekly_wrap', periodKey: lastWeekKey } });
    if (wrap) { skipped++; continue; }

    const [applications, outreach, followupsDue] = await Promise.all([
      prisma.jobApplication.count({ where: { userId: p.userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: since } } }),
      prisma.outreachLog.count({ where: { userId: p.userId, createdAt: { gte: since } } }),
      prisma.jobApplication.count({ where: { userId: p.userId, status: 'APPLIED', dateApplied: { gte: followFrom, lte: since } } }),
    ]);
    outcomes.push(await sendLifecycleEmail(
      { userId: p.userId, email: p.email, name: p.name },
      'weekly_checkin',
      `weekly_checkin:${weekKey}`,
      {
        amount: DEFAULT_PLAN_AMOUNT,
        applicationsThisWeek: applications,
        outreachThisWeek: outreach,
        followupsDue,
        recommendedNextAction: recommendedNextAction({ applications, outreach, followupsDue }),
      },
      opts,
    ));
  }
  return { job: 'weekly', outcomes, skipped };
}

export function aestDayKey(): string {
  return todayAEST().toISOString().slice(0, 10);
}
