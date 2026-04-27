import { prisma } from '../index';
import { EXEMPT_EMAILS } from '../routes/stripe';

export type FeatureType = 'generation' | 'analysis' | 'job_search' | 'match_score';

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
  userId: string,
  featureType: FeatureType,
  userEmail: string
): Promise<AccessResult> {
  if (EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
    return { allowed: true };
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      plan: true,
      planStatus: true,
      accessExpiresAt: true,
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

  // Active/trialing paid plan
  if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) {
    return { allowed: true };
  }

  // Expired/cancelled paid plan → treat as free
  return checkFree(userId, featureType, profile);
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
