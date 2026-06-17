import { prisma } from '../index';
import { EXEMPT_EMAILS } from '../routes/stripe';

export type FeatureType = 'generation' | 'analysis' | 'job_search' | 'match_score';

export interface AccessProfileLike {
  plan?: string | null;
  planStatus?: string | null;
  trialEndDate?: Date | null;
  dashboardAccess?: boolean | null;
  accessExpiresAt?: Date | null;
}

// True when the user should have unlimited feature access: an explicit grant,
// a live paid plan, or an active 7-day trial (free plan with a future trialEndDate).
export function hasActiveAccess(p: AccessProfileLike): boolean {
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
  if (email && EXEMPT_EMAILS.includes(email.toLowerCase())) return true;
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
}

export async function checkAccess(
  _userId: string,
  _featureType: FeatureType,
  _userEmail: string
): Promise<AccessResult> {
  // PAYMENTS PAUSED: unlimited access for all users during pricing rework
  return { allowed: true };

  /* ORIGINAL CODE - restore when payments resume
  if (EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
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
