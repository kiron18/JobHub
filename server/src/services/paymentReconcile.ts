/**
 * Safety net: nobody who has paid stays marked as free.
 *
 * The Stripe webhook is the primary path and it is thorough — since 2026-07-13
 * it matches the buyer by email when there is no `metadata.userId`, and
 * auto-onboards cold buyers who paid before ever creating an account. What it
 * cannot survive is never receiving the event at all: a failed delivery, a
 * deploy window, a signature mismatch, a payment taken by hand in the Stripe
 * dashboard.
 *
 * Both clients found unmarked in the 2026-07-31 audit (Mayank Parekh, paid
 * 11 Jul; Kangeshvar Nagarajan, paid 26 Jun) predate the webhook's email
 * fallback, so neither is evidence against it. This exists so the next miss —
 * whatever its cause — is caught within a day instead of by an audit.
 *
 * Deliberately narrow: it only ever GRANTS access. It never downgrades or
 * revokes, because a missing Stripe record is far more likely to mean an API
 * hiccup than a genuine cancellation, and wrongly cutting off a paying client
 * is the worse failure. Cancellations stay the webhook's job.
 */
import StripeLib from 'stripe';
import { prisma } from '../index';
import { onboardPaidCustomer } from './onboarding';

const THREE_MONTH_DAYS = 90;

export interface ReconcileResult {
  scanned: number;
  granted: Array<{ email: string; plan: string; reason: string }>;
  onboarded: string[];
  unmatched: string[];
  /** Unmatched payers seen for the first time, or due a re-nag. Only these
   *  warrant an admin email — see UnmatchedPayment in the schema. */
  toAlert: Array<{ email: string; plan: string; amount: number | null; reason: string; firstSeenAt: Date; alertCount: number }>;
  /** Previously-unmatched payers that now have a profile. */
  resolved: string[];
  errors: string[];
}

/** How long an unresolved payer stays quiet between admin reminders. */
const RENAG_DAYS = 7;

function stripeClient(): InstanceType<typeof StripeLib> | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new StripeLib(key, { apiVersion: '2026-03-25.dahlia' as any });
}

/**
 * Record a payer we could not match, and decide whether it is worth an email.
 *
 * The rule: alert the first time we ever see them, then at most once every
 * RENAG_DAYS while they stay unresolved. Before this table existed the sweep
 * had no memory and re-sent the same alert every night.
 */
async function noteUnmatched(
  result: ReconcileResult,
  email: string,
  payer: { plan: string; reason: string; customerId: string | null; amount: number | null },
): Promise<void> {
  const now = new Date();
  const existing = await prisma.unmatchedPayment.findUnique({ where: { email } });

  // A row that was resolved before but is unmatched again is a fresh problem.
  const reopened = existing?.resolvedAt != null;
  const lastAlert = reopened ? null : existing?.alertedAt ?? null;
  const due = !lastAlert || now.getTime() - lastAlert.getTime() >= RENAG_DAYS * 86400000;

  const record = await prisma.unmatchedPayment.upsert({
    where: { email },
    create: {
      email,
      plan: payer.plan,
      amount: payer.amount,
      reason: payer.reason,
      stripeCustomerId: payer.customerId,
      alertedAt: due ? now : null,
      alertCount: due ? 1 : 0,
    },
    update: {
      plan: payer.plan,
      amount: payer.amount,
      reason: payer.reason,
      stripeCustomerId: payer.customerId,
      resolvedAt: null,
      ...(due ? { alertedAt: now, alertCount: { increment: 1 } } : {}),
      ...(reopened ? { firstSeenAt: now } : {}),
    },
  });

  if (due) {
    result.toAlert.push({
      email,
      plan: payer.plan,
      amount: payer.amount,
      reason: payer.reason,
      firstSeenAt: record.firstSeenAt,
      alertCount: record.alertCount,
    });
  }
}

/** Close an open unmatched record now that the payer has a profile. */
async function markResolved(result: ReconcileResult, email: string): Promise<void> {
  const open = await prisma.unmatchedPayment.findFirst({
    where: { email, resolvedAt: null },
    select: { id: true },
  });
  if (!open) return;
  await prisma.unmatchedPayment.update({ where: { id: open.id }, data: { resolvedAt: new Date() } });
  result.resolved.push(email);
}

/**
 * @param opts.autoOnboard create a login for a payer who has no account at all.
 *   Off by default — a reconciliation pass emailing set-password links to
 *   strangers is a surprise, so the caller opts in.
 * @param opts.write actually write. Off by default so a dry run is the default.
 */
export async function reconcileStripePayments(opts: {
  write?: boolean;
  autoOnboard?: boolean;
  lookbackDays?: number;
} = {}): Promise<ReconcileResult> {
  const { write = false, autoOnboard = false, lookbackDays = 120 } = opts;
  const result: ReconcileResult = { scanned: 0, granted: [], onboarded: [], unmatched: [], toAlert: [], resolved: [], errors: [] };

  const stripe = stripeClient();
  if (!stripe) {
    result.errors.push('STRIPE_SECRET_KEY not set — reconciliation skipped');
    return result;
  }

  // Who is paying, according to Stripe? Two sources, because the two plan
  // shapes leave different traces: subscriptions for monthly/annual, bare
  // charges for the one-off bundle bought through a payment link.
  const payers = new Map<string, { plan: string; reason: string; customerId: string | null; subscriptionId: string | null; paidAt: Date; amount: number | null }>();

  try {
    const subs = await stripe.subscriptions.list({ limit: 100, status: 'all', expand: ['data.customer'] });
    for (const s of subs.data) {
      if (s.status !== 'active' && s.status !== 'trialing') continue;
      const customer: any = s.customer;
      const email = (customer?.email ?? '').toLowerCase().trim();
      if (!email) continue;
      payers.set(email, {
        plan: s.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        reason: `active Stripe subscription ${s.id}`,
        customerId: typeof customer === 'string' ? customer : customer?.id ?? null,
        subscriptionId: s.id,
        paidAt: new Date(s.created * 1000),
        amount: s.items.data[0]?.price?.unit_amount != null ? s.items.data[0].price.unit_amount / 100 : null,
      });
    }
  } catch (err: any) {
    result.errors.push(`subscriptions.list failed: ${err.message}`);
  }

  const since = Math.floor((Date.now() - lookbackDays * 86400000) / 1000);
  try {
    const charges = await stripe.charges.list({ limit: 100, created: { gte: since } });
    for (const ch of charges.data) {
      if (ch.status !== 'succeeded' || ch.refunded) continue;
      const email = (ch.billing_details?.email ?? ch.receipt_email ?? '').toLowerCase().trim();
      if (!email || payers.has(email)) continue; // a live subscription outranks a one-off
      payers.set(email, {
        plan: 'three_month',
        reason: `one-off charge ${ch.id} ($${(ch.amount / 100).toFixed(2)})`,
        customerId: typeof ch.customer === 'string' ? ch.customer : null,
        subscriptionId: null,
        paidAt: new Date(ch.created * 1000),
        amount: ch.amount / 100,
      });
    }
  } catch (err: any) {
    result.errors.push(`charges.list failed: ${err.message}`);
  }

  result.scanned = payers.size;

  for (const [email, payer] of payers) {
    try {
      // Case-insensitive: Stripe emails are lowercased above, but a profile
      // written by any other path may not be, and Postgres `=` is exact.
      let profile = await prisma.candidateProfile.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { userId: true, plan: true, planStatus: true, accessExpiresAt: true },
      });

      if (!profile) {
        if (!autoOnboard) {
          result.unmatched.push(email);
          if (write) await noteUnmatched(result, email, payer);
          continue;
        }
        const onboard = await onboardPaidCustomer({ email, stripeCustomerId: payer.customerId });
        result.onboarded.push(email);
        profile = await prisma.candidateProfile.findFirst({
          where: { userId: onboard.userId },
          select: { userId: true, plan: true, planStatus: true, accessExpiresAt: true },
        });
        if (!profile) {
          result.unmatched.push(email);
          if (write) await noteUnmatched(result, email, payer);
          continue;
        }
      }

      // They have an account now, so close out any open unmatched record —
      // whether a human fixed it or they signed up themselves.
      if (write) await markResolved(result, email);

      // Already correctly marked — nothing to do.
      const alreadyPaid = (profile.plan ?? 'free') !== 'free'
        && ['active', 'trialing'].includes((profile.planStatus ?? 'active').toLowerCase());
      if (alreadyPaid) continue;

      const data: Record<string, unknown> = {
        plan: payer.plan,
        planStatus: 'active',
        dashboardAccess: true,
        ...(payer.customerId ? { stripeCustomerId: payer.customerId } : {}),
        ...(payer.subscriptionId ? { stripeSubscriptionId: payer.subscriptionId } : {}),
      };
      // The one-off bundle carries its own window, measured from the payment.
      if (payer.plan === 'three_month' && !profile.accessExpiresAt) {
        data.accessExpiresAt = new Date(payer.paidAt.getTime() + THREE_MONTH_DAYS * 86400000);
      }

      if (write) {
        await prisma.candidateProfile.update({ where: { userId: profile.userId }, data });
      }
      result.granted.push({ email, plan: payer.plan, reason: payer.reason });
    } catch (err: any) {
      result.errors.push(`${email}: ${err.message}`);
    }
  }

  return result;
}
