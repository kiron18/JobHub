/**
 * /api/admin/revenue: what came in, from whom, and who is paying now.
 *
 *   GET /?days=90&refresh=1
 *
 * Two sources, on purpose. Amounts come live from Stripe, because JobHub has
 * never stored one: the profile knows a client is paying, not what they paid.
 * The "paying now" counts come from the database, by the same rule
 * /admin/people uses, so the two pages cannot disagree about who is a client.
 *
 * No page reads this yet. It exists so the admin redesign has a number to
 * show; the shape is in services/revenue.ts.
 *
 * Cached for ten minutes: a page of charges is several Stripe calls, and the
 * answer does not move faster than that. `refresh=1` skips the cache.
 */
import { Router, Response } from 'express';
import StripeLib from 'stripe';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { isPaidNow } from './admin-people';
import { summariseRevenue, type ChargeLike } from '../services/revenue';

const router = Router();

router.use(authenticate, requireAdmin);

const CACHE_TTL_MS = 10 * 60 * 1000;
/** A ceiling, not a target: the whole account is a few dozen charges today. */
const MAX_CHARGES = 2000;
const cache = new Map<number, { at: number; body: unknown }>();

/** Our own inboxes, +tag variants included. Same rule /admin/people uses. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;

function stripeClient(): InstanceType<typeof StripeLib> | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new StripeLib(key, { apiVersion: '2026-03-25.dahlia' as any });
}

router.get('/', async (req: AuthRequest, res: Response) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? '90'), 10) || 90, 1), 730);
  const hit = cache.get(days);
  if (req.query.refresh !== '1' && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return res.json({ ...(hit.body as object), cached: true });
  }

  const stripe = stripeClient();
  if (!stripe) return res.status(503).json({ error: 'Stripe is not configured on this server.' });

  try {
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);

    const charges: ChargeLike[] = [];
    let truncated = false;
    for await (const ch of stripe.charges.list({ limit: 100, created: { gte: Math.floor(from.getTime() / 1000) } })) {
      if (charges.length >= MAX_CHARGES) { truncated = true; break; }
      charges.push(ch as unknown as ChargeLike);
    }

    const profiles = await prisma.candidateProfile.findMany({
      select: {
        userId: true, name: true, email: true, stripeCustomerId: true,
        plan: true, planStatus: true, subscriptionStatus: true, accessExpiresAt: true, billingHoldAt: true,
      },
    });
    const real = profiles.filter((p) => !TEST_EMAIL.test(p.email ?? ''));

    const clients = { payingNow: 0, trialing: 0, pastDue: 0, onHold: 0 };
    for (const p of real) {
      const planStatus = (p.planStatus ?? '').toLowerCase();
      const sub = (p.subscriptionStatus ?? '').toLowerCase();
      if (isPaidNow(p, now)) clients.payingNow++;
      if (planStatus === 'trialing' || sub === 'trialing') clients.trialing++;
      if (planStatus === 'past_due' || planStatus === 'unpaid' || sub === 'past_due' || sub === 'unpaid') clients.pastDue++;
      if (p.billingHoldAt) clients.onHold++;
    }

    const body = {
      days,
      from: from.toISOString(),
      to: now.toISOString(),
      ...summariseRevenue(charges, profiles, { from, to: now }),
      clients,
      // True only if the ceiling was hit, in which case the totals are short.
      truncated,
      fetchedAt: now.toISOString(),
    };
    cache.set(days, { at: Date.now(), body });
    res.json({ ...body, cached: false });
  } catch (err: any) {
    console.error('[admin-revenue] failed', err?.message ?? err);
    res.status(500).json({ error: 'Could not load revenue from Stripe.' });
  }
});

export default router;
