/**
 * Admin funnel — trial conversion action queue.
 *
 * Two endpoints, both admin-only:
 *
 *   GET /api/admin/funnel/overview
 *     Returns funnel-stage counts (signup -> onboarded -> diagnostic ->
 *     first-app -> 5+ apps -> paid) plus a summary block with the metrics a
 *     founder actually opens this page for: active trials, trials ending
 *     this week, paid count, conversion rate over the last 30 days.
 *
 *   GET /api/admin/funnel/trials
 *     Returns trial users with computed signals: apps sent, last active,
 *     quota signal (hot/warm/cold), recency signal (active/stale/inactive).
 *     Sorted by trial end ASC so the most urgent surface first.
 *
 * Real-user filter (exclude internal/test accounts) reuses the same supabase
 * cross-check that admin.ts uses elsewhere.
 */
import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { supabase } from '../lib/supabase';

const router = Router();

const EXCLUDED_EMAILS = new Set([
  'kiron182@gmail.com',
  'yornorik281@gmail.com',
  'kamiproject2021@gmail.com',
  'kironorik182@gmail.com',
  'kironorik@gmail.com',
  'kironoriktest@gmail.com',
]);

const FREE_APP_QUOTA = 5;

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

interface RealUser {
  userId: string;
  email: string | null;
  signupAt: Date;
}

/**
 * Returns real users from Supabase, excluding test/admin accounts. Falls
 * back to profile-level email exclusion if the Supabase admin call fails
 * (matches the pattern in admin.ts).
 */
async function getRealUsers(): Promise<RealUser[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data?.users) {
    console.warn('[admin-funnel] supabase.auth.admin.listUsers failed, falling back:', error?.message);
    const profiles = await prisma.candidateProfile.findMany({
      where: { email: { notIn: [...EXCLUDED_EMAILS] } },
      select: { userId: true, email: true, createdAt: true },
    });
    return profiles.map(p => ({ userId: p.userId, email: p.email, signupAt: p.createdAt }));
  }
  return data.users
    .filter(u => !u.email || !EXCLUDED_EMAILS.has(u.email.toLowerCase()))
    .map(u => ({
      userId: u.id,
      email: u.email ?? null,
      signupAt: new Date(u.created_at),
    }));
}

// ── GET /api/admin/funnel/overview ─────────────────────────────────────────
//
// Funnel stages plus headline summary. One round-trip per stage so each
// number is independently sourced and explainable.
router.get('/overview', authenticate, requireAdmin, async (_req, res) => {
  try {
    const realUsers = await getRealUsers();
    const realUserIds = realUsers.map(u => u.userId);
    const realUserIdSet = new Set(realUserIds);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Stage 1: signups (all real users)
    const signupCount = realUserIds.length;

    // Stage 2: onboarded
    const onboardedCount = await prisma.candidateProfile.count({
      where: { userId: { in: realUserIds }, hasCompletedOnboarding: true },
    });

    // Stage 3: diagnostic complete
    const diagnosticCount = await prisma.diagnosticReport.count({
      where: { userId: { in: realUserIds }, status: 'COMPLETE' },
    });

    // Stage 4: first app sent (any APPLIED status across all apps)
    const usersWithAppliedApps = await prisma.jobApplication.groupBy({
      by: ['userId'],
      where: { userId: { in: realUserIds }, status: { not: 'SAVED' } },
      _count: { _all: true },
    });
    const firstAppCount = usersWithAppliedApps.length;
    const fivePlusCount = usersWithAppliedApps.filter(g => g._count._all >= FREE_APP_QUOTA).length;

    // Stage 6: paid (plan != 'free' OR active subscription)
    const paidProfiles = await prisma.candidateProfile.findMany({
      where: {
        userId: { in: realUserIds },
        OR: [
          { plan: { not: 'free' }, planStatus: 'active' },
          { subscriptionStatus: 'active' },
        ],
      },
      select: { userId: true },
    });
    const paidCount = paidProfiles.length;

    // Summary
    const activeTrials = await prisma.candidateProfile.count({
      where: {
        userId: { in: realUserIds },
        trialEndDate: { gt: now },
        plan: 'free',
      },
    });

    const trialsEndingThisWeek = await prisma.candidateProfile.count({
      where: {
        userId: { in: realUserIds },
        trialEndDate: { gte: now, lte: sevenDaysFromNow },
        plan: 'free',
      },
    });

    // Conversion rate over last 30 days: of trials that ENDED in the last
    // 30 days, how many of those users are now paid?
    const trialsEndedLast30 = await prisma.candidateProfile.findMany({
      where: {
        userId: { in: realUserIds },
        trialEndDate: { gte: thirtyDaysAgo, lt: now },
      },
      select: { userId: true, plan: true, planStatus: true, subscriptionStatus: true },
    });
    const trialsEndedCount = trialsEndedLast30.length;
    const convertedFromEnded = trialsEndedLast30.filter(p =>
      (p.plan !== 'free' && p.planStatus === 'active') || p.subscriptionStatus === 'active'
    ).length;
    const conversionLast30Days = trialsEndedCount > 0 ? convertedFromEnded / trialsEndedCount : null;

    // Defensive: signup count from Supabase, but if some real users have no
    // CandidateProfile row yet we still want the funnel to make sense.
    void realUserIdSet;

    res.json({
      funnel: [
        { stage: 'signup',     label: 'Signed up',             count: signupCount },
        { stage: 'onboarded',  label: 'Completed onboarding',  count: onboardedCount },
        { stage: 'diagnostic', label: 'Saw diagnostic',        count: diagnosticCount },
        { stage: 'firstApp',   label: 'Sent first application', count: firstAppCount },
        { stage: 'fivePlus',   label: `Sent ${FREE_APP_QUOTA}+ applications`, count: fivePlusCount },
        { stage: 'paid',       label: 'Converted to paid',     count: paidCount },
      ],
      summary: {
        activeTrials,
        trialsEndingThisWeek,
        paidUsers: paidCount,
        conversionLast30Days,
        trialsEndedLast30: trialsEndedCount,
        convertedFromEnded,
      },
    });
  } catch (err: any) {
    console.error('[admin-funnel] overview error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to load funnel overview.' });
  }
});

type QuotaStatus = 'hot' | 'warm' | 'cold';
type RecencyStatus = 'active' | 'stale' | 'inactive';

function quotaStatusFor(appsSent: number): QuotaStatus {
  if (appsSent >= 4) return 'hot';
  if (appsSent >= 1) return 'warm';
  return 'cold';
}

function recencyStatusFor(daysSinceActive: number | null): RecencyStatus {
  if (daysSinceActive === null) return 'inactive';
  if (daysSinceActive <= 3) return 'active';
  if (daysSinceActive <= 7) return 'stale';
  return 'inactive';
}

// ── GET /api/admin/funnel/trials ───────────────────────────────────────────
//
// Action queue for trial conversion. Returns users on active trials, sorted
// by trial-end-date ascending so the most urgent surface first.
router.get('/trials', authenticate, requireAdmin, async (_req, res) => {
  try {
    const realUsers = await getRealUsers();
    const realUserIds = realUsers.map(u => u.userId);
    const emailByUserId = new Map(realUsers.map(u => [u.userId, u.email]));

    const now = new Date();

    // Trial users: trialEndDate set, plan='free', not yet converted. Include
    // recently-ended (last 7 days) trials too because those are the highest-
    // value action moments — the decision window has just closed.
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const trialProfiles = await prisma.candidateProfile.findMany({
      where: {
        userId: { in: realUserIds },
        trialEndDate: { gte: sevenDaysAgo },
        plan: 'free',
      },
      select: {
        userId: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        trialEndDate: true,
        targetRole: true,
        targetCity: true,
      },
      orderBy: { trialEndDate: 'asc' },
    });

    // Pull apps-sent counts for these users in one round-trip.
    const trialUserIds = trialProfiles.map(p => p.userId);
    const appCounts = await prisma.jobApplication.groupBy({
      by: ['userId'],
      where: { userId: { in: trialUserIds }, status: { not: 'SAVED' } },
      _count: { _all: true },
    });
    const appCountByUserId = new Map(appCounts.map(g => [g.userId, g._count._all]));

    // Last activity = most recent of (profile updatedAt, latest JobApplication
    // createdAt). One round-trip pulls the latest app per user.
    const latestApps = await prisma.jobApplication.findMany({
      where: { userId: { in: trialUserIds } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true },
      take: trialUserIds.length * 5, // safety cap; we only need the first per user
    });
    const latestAppByUserId = new Map<string, Date>();
    for (const a of latestApps) {
      if (!latestAppByUserId.has(a.userId)) {
        latestAppByUserId.set(a.userId, a.createdAt);
      }
    }

    const trials = trialProfiles.map(p => {
      const appsSent = appCountByUserId.get(p.userId) ?? 0;
      const lastApp = latestAppByUserId.get(p.userId) ?? null;
      const lastActiveAt = lastApp && lastApp > p.updatedAt ? lastApp : p.updatedAt;
      const daysSinceActive = lastActiveAt
        ? Math.floor((now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysToTrialEnd = p.trialEndDate
        ? Math.floor((p.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        userId: p.userId,
        email: p.email ?? emailByUserId.get(p.userId) ?? null,
        name: p.name ?? null,
        targetRole: p.targetRole ?? null,
        targetCity: p.targetCity ?? null,
        signupAt: p.createdAt.toISOString(),
        trialEndDate: p.trialEndDate?.toISOString() ?? null,
        daysToTrialEnd,
        appsSent,
        freeAppQuota: FREE_APP_QUOTA,
        lastActiveAt: lastActiveAt.toISOString(),
        daysSinceActive,
        quotaStatus: quotaStatusFor(appsSent),
        recencyStatus: recencyStatusFor(daysSinceActive),
      };
    });

    res.json({ trials });
  } catch (err: any) {
    console.error('[admin-funnel] trials error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to load trial action queue.' });
  }
});

export default router;
