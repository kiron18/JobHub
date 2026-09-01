import { prisma } from '../index';
import { hasComplimentaryAccess } from '../routes/stripe';

export type FeatureType = 'generation' | 'analysis' | 'job_search' | 'match_score';

export interface AccessProfileLike {
  plan?: string | null;
  planStatus?: string | null;
  trialEndDate?: Date | null;
  dashboardAccess?: boolean | null;
  accessExpiresAt?: Date | null;
  billingHoldAt?: Date | null;
}

// A billing hold outranks every other access signal, including an explicit
// dashboardAccess grant, because it exists precisely to overrule one: these are
// paying clients whose access was granted and is now being withheld. Exempt
// accounts (owner + test logins) are never holdable.
export function isOnBillingHold(p: AccessProfileLike, email?: string | null): boolean {
  if (hasComplimentaryAccess(email)) return false;
  return p.billingHoldAt != null;
}

// The 402 body for a denied request. Callers used to hardcode "limit reached",
// which is the wrong sentence for someone whose card bounced — it tells them to
// upgrade when they need to pay an invoice they already owe.
export function denyPayload(access: AccessResult, feature: string): Record<string, unknown> {
  if (access.reason === 'BILLING_HOLD') {
    return {
      error: 'BILLING_HOLD',
      message: "Your access is paused until this month's payment goes through.",
      billingHold: true,
      payUrl: access.payUrl ?? null,
    };
  }
  return { error: `${feature} limit reached`, upgradeRequired: true, remaining: 0 };
}

// True when the user should have unlimited feature access: an explicit grant,
// a live paid plan, or an active 7-day trial (free plan with a future trialEndDate).
export function hasActiveAccess(p: AccessProfileLike): boolean {
  if (isOnBillingHold(p)) return false;
  if (p.dashboardAccess === true) return true;
  const plan = p.plan ?? 'free';
  const planStatus = p.planStatus ?? 'active';
  if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) return true;
  if (p.trialEndDate && p.trialEndDate > new Date()) return true;
  return false;
}

// True when the user is a genuinely PAID/exempt customer (NOT the free 7-day
// trial). Used to exempt paying customers from the trial-only daily cap so they
// are never throttled. Trial-by-default users (free plan + trialEndDate) are NOT
// paid, so the cap still applies to them.
export function isPaidOrExempt(p: AccessProfileLike, email?: string | null): boolean {
  if (hasComplimentaryAccess(email)) return true;
  if (p.dashboardAccess === true) return true;
  const plan = p.plan ?? 'free';
  const planStatus = p.planStatus ?? 'active';
  return plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing');
}

const FREE_LIMITS: Record<FeatureType, number> = {
  generation: 5,
  analysis: 5,
  job_search: 1,
  match_score: 1,
};

const COUNTER_FIELD: Record<FeatureType, string> = {
  generation: 'freeGenerationsUsed',
  analysis: 'freeAnalysesUsed',
  job_search: 'freeJobSearchesUsed',
  match_score: 'freeMatchScoresUsed',
};

export interface AccessResult {
  allowed: boolean;
  upgradeRequired?: boolean;
  remaining?: number;
  reason?: string;
  payUrl?: string | null;
}

export async function checkAccess(
  _userId: string,
  _featureType: FeatureType,
  _userEmail: string
): Promise<AccessResult> {
  // A billing hold is checked ABOVE the PAYMENTS PAUSED switch below. That
  // switch opens the product to everyone during the pricing rework, so a hold
  // placed underneath it would do nothing at all. This is the one denial that
  // still has to bite while payments are otherwise ungated, and it only ever
  // applies to the handful of profiles explicitly put on hold.
  const held = await prisma.candidateProfile.findUnique({
    where: { userId: _userId },
    select: { billingHoldAt: true, billingHoldInvoiceUrl: true },
  });
  if (held && isOnBillingHold(held, _userEmail)) {
    return { allowed: false, reason: 'BILLING_HOLD', payUrl: held.billingHoldInvoiceUrl };
  }

  // PAYMENTS PAUSED: unlimited access for all users during pricing rework
  return { allowed: true };

  /* ORIGINAL CODE - restore when payments resume
  if (hasComplimentaryAccess(userEmail)) {
    return { allowed: true };
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      plan: true,
      planStatus: true,
      accessExpiresAt: true,
      trialEndDate: true,
      dashboardAccess: true,
      freeGenerationsUsed: true,
      freeAnalysesUsed: true,
      freeJobSearchesUsed: true,
      freeMatchScoresUsed: true,
    },
  });

  if (!profile) return { allowed: false, reason: 'Profile not found' };

  const plan = profile.plan ?? 'free';
  const planStatus = profile.planStatus ?? 'active';

  // 3-month bundle: check expiry
  if (plan === 'three_month') {
    if (profile.accessExpiresAt && profile.accessExpiresAt < new Date()) {
      // Auto-downgrade
      await prisma.candidateProfile.update({
        where: { userId },
        data: { plan: 'free', planStatus: 'expired', dashboardAccess: false },
      });
      return checkFree(userId, featureType, profile);
    }
    return { allowed: true };
  }

  // Active trial or paid plan: unlimited feature access.
  if (hasActiveAccess(profile)) {
    return { allowed: true };
  }

  // Expired/cancelled paid plan → treat as free
  return checkFree(userId, featureType, profile);
  */
}

async function checkFree(
  userId: string,
  featureType: FeatureType,
  profile: Record<string, any>
): Promise<AccessResult> {
  const limit = FREE_LIMITS[featureType];
  const field = COUNTER_FIELD[featureType];
  const used: number = profile[field] ?? 0;

  if (used >= limit) {
    return { allowed: false, upgradeRequired: true, remaining: 0 };
  }

  await prisma.candidateProfile.update({
    where: { userId },
    data: { [field]: { increment: 1 } },
  });

  return { allowed: true, remaining: limit - used - 1 };
}
