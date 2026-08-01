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
import { SENT_APPLICATION_FILTER } from '../services/tracker/metricHelpers';

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
      where: { userId: { in: realUserIds }, ...SENT_APPLICATION_FILTER },
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
      where: { userId: { in: trialUserIds }, ...SENT_APPLICATION_FILTER },
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

/**
 * Lowercased, with any +tag stripped from the local part. Used only to decide
 * whether an address is one of ours: kiron182+onboardtest@gmail.com is the
 * same mailbox as kiron182@gmail.com and must be excluded with it. Grouping
 * still keys on the raw address, so two clients who deliberately use +tags are
 * never merged into one person.
 */
function normaliseEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return lower;
  const local = lower.slice(0, at).split('+')[0];
  return `${local}${lower.slice(at)}`;
}

/**
 * Is this profile a paying client right now?
 *
 * Three independent signals, any one of which is proof of payment. They are
 * separate because payments reach us by three different routes: a Stripe
 * subscription (plan/planStatus, set by the webhook), a subscription recorded
 * only on subscriptionStatus, and a one-off 3-month bundle whose access window
 * lives on accessExpiresAt. Reading only `plan` — what this endpoint used to do
 * — misses anyone whose payment never got matched back to their account.
 */
function isPaidNow(p: {
  plan: string | null;
  planStatus: string | null;
  subscriptionStatus: string | null;
  accessExpiresAt: Date | null;
}, now: Date): boolean {
  const plan = (p.plan ?? 'free').toLowerCase();
  const planStatus = (p.planStatus ?? 'active').toLowerCase();
  if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) return true;

  const sub = (p.subscriptionStatus ?? '').toLowerCase();
  if (sub === 'active' || sub === 'trialing') return true;

  // A paid-for access window that has not closed yet counts, even if the plan
  // field was never updated.
  if (p.accessExpiresAt && p.accessExpiresAt > now) return true;

  return false;
}

// GET /api/admin/funnel/user-usage — usage snapshot for PAYING CLIENTS ONLY.
//
// Accuracy rules this endpoint has to hold to, each of which it previously broke:
//
//   1. Paying clients only. Test signups (136 of 163 profiles at the time of
//      writing) drowned the real ones and made the page unreadable.
//   2. Payment is judged on all three billing signals, not just `plan` — see
//      isPaidNow. Clients who paid before their account existed land as
//      plan='free' because the webhook had no userId to match against.
//   3. Counts are grouped by EMAIL, not userId. One person can hold several
//      profiles (duplicate signups), and keying on userId reported only
//      whichever profile was picked, silently dropping the rest of their work.
router.get('/user-usage', authenticate, requireAdmin, async (_req, res) => {
  try {
    const now = new Date();

    // Test/internal accounts never belong on a client roster.
    const testEmails = new Set<string>(
      [...EXCLUDED_EMAILS, ...EXEMPT_EMAILS].map(normaliseEmail)
    );

    const allProfiles = await prisma.candidateProfile.findMany({
      select: {
        userId: true, name: true, email: true, plan: true, planStatus: true,
        subscriptionStatus: true, accessExpiresAt: true, trialEndDate: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const paidCandidates = allProfiles.filter(p => {
      const email = p.email ?? '';
      if (email && testEmails.has(normaliseEmail(email))) return false;
      return isPaidNow(p, now);
    });

    // A real paying client always has an email — Stripe cannot bill without
    // one. A paid-looking profile with no email is an internal test signup, so
    // it stays off the roster. It is reported separately rather than dropped
    // silently, because the one case where that assumption is wrong is a
    // client whose email failed to save, and that needs fixing, not hiding.
    const paidProfiles = paidCandidates.filter(p => (p.email ?? '').trim().length > 0);
    const unidentified = paidCandidates.filter(p => !(p.email ?? '').trim());

    // Every userId belonging to a paying client, including their duplicate
    // profiles. Counts are summed across all of them.
    const paidUserIds = paidProfiles.map(p => p.userId);
    const paidUserIdSet = new Set(paidUserIds);

    // Application counts, scoped to paying clients.
    const appsAll = await prisma.jobApplication.groupBy({
      by: ['userId'], where: { userId: { in: paidUserIds } }, _count: { _all: true },
    });
    const appsApplied = await prisma.jobApplication.groupBy({
      by: ['userId'], where: { userId: { in: paidUserIds }, status: 'APPLIED' }, _count: { _all: true },
    });
    const appsNotSaved = await prisma.jobApplication.groupBy({
      by: ['userId'], where: { userId: { in: paidUserIds }, ...SENT_APPLICATION_FILTER }, _count: { _all: true },
    });
    const latestApp = await prisma.jobApplication.findMany({
      where: { userId: { in: paidUserIds } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Documents, scoped to paying clients. One row per generation — a
    // regenerated resume is a second row, which is what "resumes generated"
    // means here.
    const docs = await prisma.document.findMany({
      where: { userId: { in: paidUserIds } },
      select: { userId: true, type: true, createdAt: true, updatedAt: true },
    });

    const totalApps = new Map<string, number>();
    for (const a of appsAll) totalApps.set(a.userId, a._count._all);
    const appliedApps = new Map<string, number>();
    for (const a of appsApplied) appliedApps.set(a.userId, a._count._all);
    const notSavedApps = new Map<string, number>();
    for (const a of appsNotSaved) notSavedApps.set(a.userId, a._count._all);
    const lastAppAt = new Map<string, number>();
    for (const a of latestApp) if (!lastAppAt.has(a.userId)) lastAppAt.set(a.userId, a.createdAt.getTime());

    const resumes = new Map<string, number>();
    const covers = new Map<string, number>();
    const criteria = new Map<string, number>();
    const edited = new Map<string, number>();
    const lastDocAt = new Map<string, number>();
    const firstDocAt = new Map<string, number>();
    for (const d of docs) {
      if (!paidUserIdSet.has(d.userId)) continue;
      if (d.type === 'RESUME') resumes.set(d.userId, (resumes.get(d.userId) ?? 0) + 1);
      if (d.type === 'COVER_LETTER') covers.set(d.userId, (covers.get(d.userId) ?? 0) + 1);
      if (d.type === 'STAR_RESPONSE') criteria.set(d.userId, (criteria.get(d.userId) ?? 0) + 1);
      if (d.updatedAt.getTime() > d.createdAt.getTime() + 1000) edited.set(d.userId, (edited.get(d.userId) ?? 0) + 1);
      const updated = d.updatedAt.getTime();
      if (updated > (lastDocAt.get(d.userId) ?? 0)) lastDocAt.set(d.userId, updated);
      const created = d.createdAt.getTime();
      if (created < (firstDocAt.get(d.userId) ?? Infinity)) firstDocAt.set(d.userId, created);
    }

    // ── Collapse duplicate profiles into one row per person ────────────────
    interface Row {
      userIds: string[];
      name: string | null;
      email: string | null;
      plan: string;
      planStatus: string;
      accessExpiresAt: string | null;
      signedUpAt: number;
      lastActiveAt: number;
      firstGeneratedAt: number | null;
      applicationsStarted: number;
      applicationsSent: number;
      applicationsApplied: number;
      resumesGenerated: number;
      coverLettersGenerated: number;
      selectionCriteriaGenerated: number;
      documentsEdited: number;
    }

    const byPerson = new Map<string, Row>();
    for (const p of paidProfiles) {
      // No email means no way to tell duplicates apart — key on userId so the
      // row still appears rather than being merged into a bogus group.
      const key = (p.email ?? '').toLowerCase() || `userid:${p.userId}`;
      const existing = byPerson.get(key);
      const lastActive = Math.max(
        p.createdAt.getTime(),
        lastAppAt.get(p.userId) ?? 0,
        lastDocAt.get(p.userId) ?? 0,
      );
      const firstGen = firstDocAt.get(p.userId) ?? null;

      if (!existing) {
        byPerson.set(key, {
          userIds: [p.userId],
          name: p.name ?? null,
          email: p.email ?? null,
          plan: p.plan ?? 'free',
          planStatus: p.planStatus ?? 'active',
          accessExpiresAt: p.accessExpiresAt?.toISOString() ?? null,
          signedUpAt: p.createdAt.getTime(),
          lastActiveAt: lastActive,
          firstGeneratedAt: firstGen,
          applicationsStarted: totalApps.get(p.userId) ?? 0,
          applicationsSent: notSavedApps.get(p.userId) ?? 0,
          applicationsApplied: appliedApps.get(p.userId) ?? 0,
          resumesGenerated: resumes.get(p.userId) ?? 0,
          coverLettersGenerated: covers.get(p.userId) ?? 0,
          selectionCriteriaGenerated: criteria.get(p.userId) ?? 0,
          documentsEdited: edited.get(p.userId) ?? 0,
        });
        continue;
      }

      existing.userIds.push(p.userId);
      existing.name = existing.name ?? p.name ?? null;
      // Earliest signup is when this person actually started with us.
      existing.signedUpAt = Math.min(existing.signedUpAt, p.createdAt.getTime());
      existing.lastActiveAt = Math.max(existing.lastActiveAt, lastActive);
      if (firstGen !== null) {
        existing.firstGeneratedAt = existing.firstGeneratedAt === null
          ? firstGen
          : Math.min(existing.firstGeneratedAt, firstGen);
      }
      existing.applicationsStarted += totalApps.get(p.userId) ?? 0;
      existing.applicationsSent += notSavedApps.get(p.userId) ?? 0;
      existing.applicationsApplied += appliedApps.get(p.userId) ?? 0;
      existing.resumesGenerated += resumes.get(p.userId) ?? 0;
      existing.coverLettersGenerated += covers.get(p.userId) ?? 0;
      existing.selectionCriteriaGenerated += criteria.get(p.userId) ?? 0;
      existing.documentsEdited += edited.get(p.userId) ?? 0;
    }

    const users = [...byPerson.values()]
      .sort((a, b) => b.resumesGenerated - a.resumesGenerated)
      .map(r => ({
        userId: r.userIds[0],
        userIds: r.userIds,
        accountCount: r.userIds.length,
        name: r.name,
        email: r.email,
        plan: r.plan,
        planStatus: r.planStatus,
        accessExpiresAt: r.accessExpiresAt,
        trialDay: null,
        signedUpAt: new Date(r.signedUpAt).toISOString(),
        lastActiveAt: new Date(r.lastActiveAt).toISOString(),
        firstGeneratedAt: r.firstGeneratedAt ? new Date(r.firstGeneratedAt).toISOString() : null,
        applicationsStarted: r.applicationsStarted,
        applicationsSent: r.applicationsSent,
        applicationsApplied: r.applicationsApplied,
        resumesGenerated: r.resumesGenerated,
        coverLettersGenerated: r.coverLettersGenerated,
        selectionCriteriaGenerated: r.selectionCriteriaGenerated,
        documentsEdited: r.documentsEdited,
      }));

    res.json({
      users,
      unidentified: unidentified.map(p => ({
        userId: p.userId,
        name: p.name ?? null,
        plan: p.plan ?? 'free',
        planStatus: p.planStatus ?? 'active',
        signedUpAt: p.createdAt.toISOString(),
      })),
      totals: {
        paidClients: users.length,
        resumesGenerated: users.reduce((n, u) => n + u.resumesGenerated, 0),
        coverLettersGenerated: users.reduce((n, u) => n + u.coverLettersGenerated, 0),
        applicationsSent: users.reduce((n, u) => n + u.applicationsSent, 0),
      },
    });
  } catch (err: any) {
    console.error('[admin/user-usage]', err?.message ?? err);
    res.status(500).json({ error: 'Failed to load user usage' });
  }
});

export default router;
