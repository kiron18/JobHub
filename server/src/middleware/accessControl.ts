import { prisma } from '../index';
import { hasComplimentaryAccess } from '../routes/stripe';
import { isGateEnforced } from '../config/accessGate';

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

/**
 * Inside a window somebody has already paid for.
 *
 * `accessExpiresAt` is a promise about a DATE, and it deliberately outranks
 * everything the subscription is doing. A client who paid for a year and whose
 * card then stops recurring in month four has not stopped being owed the year;
 * a three-month bundle is a single payment with no recurrence at all, so its
 * `plan` and `planStatus` say nothing useful about whether access is still
 * owed. Only the date does.
 *
 * This is why it survives cancellation. `customer.subscription.deleted` writes
 * plan=free, planStatus=cancelled, dashboardAccess=false, and does not touch
 * accessExpiresAt — so the window keeps running underneath a cancelled
 * subscription, which is exactly the intent.
 *
 * A billing hold still outranks it. That is checked by both callers below.
 */
export function withinPaidWindow(p: AccessProfileLike): boolean {
  return p.accessExpiresAt != null && p.accessExpiresAt > new Date();
}

// True when the user should have unlimited feature access: a paid-for window,
// an explicit grant, a live paid plan, or an active 7-day trial (free plan with
// a future trialEndDate).
export function hasActiveAccess(p: AccessProfileLike): boolean {
  if (isOnBillingHold(p)) return false;
  if (withinPaidWindow(p)) return true;
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
//
// A paid-for window counts here for the same reason it counts above: somebody
// inside a year they bought is a paying customer, and throttling them with a
// cost guard aimed at free trials would be charging them for our own caution.
export function isPaidOrExempt(p: AccessProfileLike, email?: string | null): boolean {
  if (hasComplimentaryAccess(email)) return true;
  if (withinPaidWindow(p)) return true;
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

const COUNTER_FIELD = {
  generation: 'freeGenerationsUsed',
  analysis: 'freeAnalysesUsed',
  job_search: 'freeJobSearchesUsed',
  match_score: 'freeMatchScoresUsed',
} as const satisfies Record<FeatureType, string>;

export interface AccessResult {
  allowed: boolean;
  upgradeRequired?: boolean;
  remaining?: number;
  reason?: string;
  payUrl?: string | null;
}

export async function checkAccess(
  userId: string,
  featureType: FeatureType,
  userEmail: string
): Promise<AccessResult> {
  // Owner and complimentary accounts never meet a limit, in either mode, and
  // never need the database read below to find that out.
  if (hasComplimentaryAccess(userEmail)) return { allowed: true };

  /*
    One read, not two.

    The paused version read the profile twice on every generation — once for
    the billing hold and once, in the commented-out body, for everything else.
    Every field either branch needs is selected here.
  */
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      plan: true,
      planStatus: true,
      accessExpiresAt: true,
      trialEndDate: true,
      dashboardAccess: true,
      billingHoldAt: true,
      billingHoldInvoiceUrl: true,
      freeGenerationsUsed: true,
      freeAnalysesUsed: true,
      freeJobSearchesUsed: true,
      freeMatchScoresUsed: true,
    },
  });

  if (!profile) return { allowed: false, reason: 'Profile not found' };

  /*
    A hold is checked ABOVE the pause switch, and it is the only denial that
    survives the gate being off. It exists to withhold access from a paying
    client whose payment failed, so it has to bite whatever mode the product is
    in, and it only ever applies to profiles explicitly put on hold.
  */
  if (isOnBillingHold(profile, userEmail)) {
    return { allowed: false, reason: 'BILLING_HOLD', payUrl: profile.billingHoldInvoiceUrl };
  }

  if (!isGateEnforced()) return { allowed: true };

  const plan = profile.plan ?? 'free';

  /*
    The three-month bundle is the one plan that ends on a date rather than on a
    cancellation, so its expiry is checked here and nowhere else. An expired
    bundle is written down as expired the first time anybody notices, because
    leaving it `active` means every later read has to re-derive the same fact.

    Note what this costs the moment the gate is switched on: any bundle whose
    accessExpiresAt has already passed is downgraded on that client's next
    request. Check for those BEFORE turning the gate on. On 9 Sep 2026 there
    was one, and two more inside a fortnight.
  */
  if (plan === 'three_month') {
    if (profile.accessExpiresAt && profile.accessExpiresAt < new Date()) {
      await prisma.candidateProfile.update({
        where: { userId },
        data: { plan: 'free', planStatus: 'expired', dashboardAccess: false },
      });
      return checkFree(userId, featureType, profile);
    }
    return { allowed: true };
  }

  // A live paid plan, an explicit grant, or an unexpired trial.
  if (hasActiveAccess(profile)) return { allowed: true };

  // Expired or cancelled: they are a free account again, with free limits.
  return checkFree(userId, featureType, profile);
}

/** The four counters, as checkFree needs to read them. */
type FreeCounters = Record<(typeof COUNTER_FIELD)[FeatureType], number | null>;

async function checkFree(
  userId: string,
  featureType: FeatureType,
  profile: FreeCounters,
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
