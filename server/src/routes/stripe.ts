import { Router, Request, Response } from 'express';
import StripeLib from 'stripe';
import type { Checkout } from 'stripe/cjs/resources/Checkout/index.js';
import type { Subscription } from 'stripe/cjs/resources/Subscriptions.js';
import type { Invoice } from 'stripe/cjs/resources/Invoices.js';
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

const APP_URL = (process.env.ALLOWED_ORIGIN ?? 'https://job-hub-snowy-ten.vercel.app')
  .split(',')[0]
  .trim();

// ── Webhook handler — must receive raw body, registered before express.json() ──
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Checkout.Session;
        const userId: string | undefined = session.metadata?.userId;
        if (!userId) {
          console.warn('[stripe/webhook] No userId in session metadata — skipping');
          break;
        }
        const subscriptionId = session.subscription as string | null;
        await prisma.candidateProfile.upsert({
          where: { userId },
          update: {
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            subscriptionStatus: 'active',
            dashboardAccess: true,
          },
          create: {
            userId,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            subscriptionStatus: 'active',
            dashboardAccess: true,
          },
        });
        console.log(`[stripe/webhook] Granted access to userId=${userId}`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Checkout.Session;
        console.warn(`[stripe/webhook] Async payment failed for session=${session.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Subscription;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) {
          console.warn(`[stripe/webhook] No profile for subscriptionId=${sub.id}`);
          break;
        }
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        const isPastDue = sub.status === 'past_due' || sub.status === 'unpaid';
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: sub.status as string,
            dashboardAccess: isActive || isPastDue ? true : false,
          },
        });
        console.log(`[stripe/webhook] Subscription ${sub.id} → status=${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Subscription;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) break;
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'canceled',
            dashboardAccess: false,
          },
        });
        console.log(`[stripe/webhook] Revoked access for subscriptionId=${sub.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        // Invoice.subscription was removed from Stripe SDK types in v17+; cast via unknown to read it safely.
        const invoice = event.data.object as Invoice & { subscription?: string | null };
        const subId: string | null = invoice.subscription ?? null;
        if (!subId) break;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: subId },
        });
        if (!profile) break;
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: { subscriptionStatus: 'past_due' },
        });
        console.log(`[stripe/webhook] Payment failed for subscriptionId=${subId} — marked past_due`);
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

// ── Router — checkout and portal (registered after express.json()) ──
const router = Router();

// POST /api/stripe/checkout
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email ?? '';
  const { plan } = req.body as { plan?: string };

  if (plan !== 'monthly' && plan !== 'annual') {
    res.status(400).json({ error: 'plan must be "monthly" or "annual"' });
    return;
  }

  if (EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
    res.status(400).json({ error: 'This account has complimentary access.' });
    return;
  }

  const priceId = plan === 'monthly'
    ? process.env.MONTHLY_PRICE_ID!
    : process.env.ANNUAL_PRICE_ID!;

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(profile?.stripeCustomerId
        ? { customer: profile.stripeCustomerId }
        : { customer_email: userEmail }
      ),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      success_url: `${APP_URL}/dashboard?payment=success`,
      cancel_url: `${APP_URL}/dashboard`,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

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
      return_url: `${APP_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/portal] Error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
