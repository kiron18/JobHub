import { Router, Request, Response } from 'express';
import StripeLib from 'stripe';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

export const EXEMPT_EMAILS = [
  'kamiproject2021@gmail.com',
  'kiron182@gmail.com',
  'kiron@aussiegradcareers.com.au',
];

const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

const APP_URL = (process.env.ALLOWED_ORIGIN ?? 'https://aussiegradcareers.com.au')
  .split(',')[0]
  .trim();

const PRICE_IDS: Record<string, string> = {
  monthly: process.env.MONTHLY_PRICE_ID!,
  annual: process.env.ANNUAL_PRICE_ID!,
  three_month: process.env.STRIPE_THREE_MONTH_PRICE_ID!,
};

// ── Webhook handler — raw body, registered before express.json() ──────────────

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature error: ${err.message}` });
    return;
  }

  console.log(`[stripe/webhook] Event: ${event.type}`);

  try {
    switch (event.type as string) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId: string | undefined = session.metadata?.userId;
        if (!userId) {
          console.warn('[stripe/webhook] No userId in session metadata — skipping');
          break;
        }

        const isOneTime = session.mode === 'payment';
        const subscriptionId = session.subscription as string | null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;

        if (isOneTime) {
          // 3-month bundle: one-time payment
          const accessExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          await prisma.candidateProfile.update({
            where: { userId },
            data: {
              stripeCustomerId: customerId ?? undefined,
              plan: 'three_month',
              planStatus: 'active',
              accessExpiresAt,
              dashboardAccess: true,
            },
          });
          console.log(`[stripe/webhook] 3-month access granted to userId=${userId}, expires=${accessExpiresAt.toISOString()}`);
        } else {
          // Monthly or annual subscription — may be in trial
          let trialEndDate: Date | null = null;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              if (sub.trial_end) trialEndDate = new Date(sub.trial_end * 1000);
            } catch { /* non-fatal */ }
          }
          const isTrialing = trialEndDate !== null && trialEndDate > new Date();
          await prisma.candidateProfile.update({
            where: { userId },
            data: {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
              plan: session.metadata?.plan ?? 'monthly',
              planStatus: isTrialing ? 'trialing' : 'active',
              trialEndDate: trialEndDate ?? undefined,
              dashboardAccess: true,
            },
          });
          console.log(`[stripe/webhook] Subscription access granted to userId=${userId}, trialing=${isTrialing}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) break;

        const isActive = sub.status === 'active';
        const isTrialing = sub.status === 'trialing';
        const isPastDue = sub.status === 'past_due' || sub.status === 'unpaid';

        let trialEndDate: Date | undefined;
        if (sub.trial_end) trialEndDate = new Date(sub.trial_end * 1000);

        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            planStatus: sub.status,
            trialEndDate: trialEndDate ?? null,
            dashboardAccess: isActive || isTrialing || isPastDue,
          },
        });
        console.log(`[stripe/webhook] Subscription ${sub.id} → status=${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) break;
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            plan: 'free',
            planStatus: 'cancelled',
            dashboardAccess: false,
          },
        });
        console.log(`[stripe/webhook] Access revoked for subscriptionId=${sub.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId: string | null = invoice.subscription ?? null;
        if (!subId) break;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: subId },
        });
        if (!profile) break;

        const isFirstPayment = invoice.billing_reason === 'subscription_cycle'
          && profile.planStatus === 'trialing';

        if (isFirstPayment) {
          // Trial ended, card declined — downgrade immediately
          await prisma.candidateProfile.update({
            where: { id: profile.id },
            data: { plan: 'free', planStatus: 'expired', dashboardAccess: false },
          });
          console.log(`[stripe/webhook] Trial payment failed for ${subId} — downgraded to free`);
        } else {
          await prisma.candidateProfile.update({
            where: { id: profile.id },
            data: { planStatus: 'past_due' },
          });
          console.log(`[stripe/webhook] Payment failed for ${subId} — marked past_due`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId: string | null = invoice.subscription ?? null;
        if (!subId) break;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: subId },
        });
        if (!profile) break;
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: { planStatus: 'active', dashboardAccess: true },
        });
        console.log(`[stripe/webhook] Payment succeeded for ${subId} — plan active`);
        break;
      }

      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err);
    res.status(500).json({ error: 'Webhook handler error' });
    return;
  }

  res.json({ received: true });
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// POST /api/stripe/checkout
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email ?? '';
  const { plan } = req.body as { plan?: string };

  if (!plan || !['monthly', 'annual', 'three_month'].includes(plan)) {
    res.status(400).json({ error: 'plan must be "monthly", "annual", or "three_month"' });
    return;
  }

  if (EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
    res.status(400).json({ error: 'This account has complimentary access.' });
    return;
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    res.status(500).json({ error: `Price ID not configured for plan: ${plan}` });
    return;
  }

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    const isOneTime = plan === 'three_month';

    const sessionParams: any = {
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, plan },
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/pricing`,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    };

    if (profile?.stripeCustomerId) {
      sessionParams.customer = profile.stripeCustomerId;
    } else {
      sessionParams.customer_email = userEmail;
    }

    if (!isOneTime) {
      sessionParams.subscription_data = {
        trial_period_days: 7,
        metadata: { userId, plan },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/checkout] Error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/portal
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile?.stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer found for this account' });
      return;
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: APP_URL,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/portal] Error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// GET /api/stripe/status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        plan: true,
        planStatus: true,
        trialEndDate: true,
        accessExpiresAt: true,
        freeGenerationsUsed: true,
        freeAnalysesUsed: true,
        freeJobSearchesUsed: true,
        freeMatchScoresUsed: true,
        stripeCustomerId: true,
      },
    });
    res.json(profile ?? {});
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

export default router;
