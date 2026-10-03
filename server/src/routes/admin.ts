import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { sendFridayBriefEmail } from '../services/email';
import { EXEMPT_EMAILS, TRIAL_PERIOD_DAYS } from './stripe';
import { supabase } from '../lib/supabase';
import { serpApiKey } from '../services/serpapi';

const router = Router();

// Admin/test accounts excluded from all platform stats
const EXCLUDED_EMAILS = new Set([
  'kiron182@gmail.com',
  'yornorik281@gmail.com',
  'yornorik281@hotmail.com',
  'kamiproject2021@gmail.com',
  'kironorik182@gmail.com',
  'kironorik@gmail.com',
  'kironoriktest@gmail.com',
]);

const ANALYTICS_START_DATE = new Date('2026-04-27T00:00:00Z');

/**
 * Returns the userIds of real, currently-active Supabase auth users,
 * excluding internal test/admin accounts.
 * Cross-referencing with Supabase ensures deleted accounts are never counted —
 * even if their candidateProfile row was not cleaned up in Postgres.
 */
export async function getRealUserIds(): Promise<string[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data?.users) {
    // Fall back to profile-level exclusion if Supabase admin call fails
    console.warn('[admin] supabase.auth.admin.listUsers failed, falling back to email exclusion:', error?.message);
    // `email NOT IN (...)` is NULL for a profile with no email, so a bare
    // notIn silently drops those rows. They are real users, so keep them.
    const profiles = await prisma.candidateProfile.findMany({
      where: { OR: [{ email: null }, { email: { notIn: [...EXCLUDED_EMAILS] } }] },
      select: { userId: true },
    });
    return profiles.map(p => p.userId);
  }
  return data.users
    .filter(u => !u.email || !EXCLUDED_EMAILS.has(u.email.toLowerCase()))
    .map(u => u.id);
}

/**
 * Returns the start and end of the current weekly window.
 * Window: Thursday 19:00 AEST (09:00 UTC) → next Thursday 09:00 UTC
 */
function getCurrentWindow(): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,4=Thu,...,6=Sat
  const hour = now.getUTCHours();

  // How many days ago was the last Thursday 09:00 UTC?
  let daysSince = (day - 4 + 7) % 7;
  // If today is Thursday but before 09:00 UTC, use last Thursday
  if (day === 4 && hour < 9) daysSince = 7;

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysSince);
  from.setUTCHours(9, 0, 0, 0);
  from.setUTCMilliseconds(0);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  return { from, to };
}

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

async function getFirstTimeReportsForWindow(from: Date, to: Date, realUserIds: string[]) {
  const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
  if (actualFrom >= to) return [];

  return prisma.diagnosticReport.findMany({
    where: {
      status: 'COMPLETE',
      createdAt: { gte: actualFrom, lt: to },
      ...(realUserIds.length ? { userId: { in: realUserIds } } : {}),
    },
    include: {
      candidateProfile: {
        select: {
          name: true,
          targetRole: true,
          searchDuration: true,
          perceivedBlocker: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function buildBriefPrompt(
  reports: Awaited<ReturnType<typeof getFirstTimeReportsForWindow>>,
  from: Date,
): string {
  const weekLabel = from.toISOString().split('T')[0];
  const people = reports.map(r => {
    const p = r.candidateProfile;
    return [
      `--- PERSON: ${p?.name ?? 'Unknown'} ---`,
      `Target Role: ${p?.targetRole ?? 'Not specified'}`,
      `Search Duration: ${p?.searchDuration ?? 'Not specified'}`,
      `Perceived Blocker: ${p?.perceivedBlocker ?? 'Not specified'}`,
      `Report:`,
      (r.reportMarkdown ?? '(no report content)').substring(0, 4000),
    ].join('\n');
  }).join('\n\n');

  return `You are writing a spoken Friday call script for Kiron, a career coach running a weekly live call for Australian graduate job seekers. Use first person ("I've looked at your report..."). Write in warm, direct Australian English — like a coach who has genuinely read every report. This is something Kiron will read aloud on a live call.

Week: ${weekLabel}
Number of first-time reports this week: ${reports.length}

${people}

Write a complete spoken script with exactly these four sections:

**OPENING** — Welcome the group. Mention how many reports came in this week. Tease 2-3 themes you noticed across all of them. Keep it warm and energetic (3-4 sentences).

**COMMON THEMES** — Identify 3 to 5 patterns that appear across multiple reports this week. For each theme: name it, explain what you're seeing, and give a concrete talking point Kiron can expand on. Be specific to this cohort — no generic advice.

**INDIVIDUAL CALLOUTS** — One paragraph per person. Address them by first name. State one specific insight from their report that shows you read it carefully. Give them one concrete next step. Make them feel seen and not alone.

**CLOSE** — Encourage questions in the chat. Remind them what the community is for. Hype next week's call. End with energy (2-3 sentences).

Write the full script now, ready for Kiron to read. Do not include any meta-commentary or instructions — just the script.`;
}

// GET /api/admin/stats
router.get('/stats', authenticate, requireAdmin, async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Math.max(now.getTime() - 7 * 24 * 60 * 60 * 1000, ANALYTICS_START_DATE.getTime()));
  const twoWeeksAgo = new Date(Math.max(now.getTime() - 14 * 24 * 60 * 60 * 1000, ANALYTICS_START_DATE.getTime()));

  function buildDailyBuckets(items: { createdAt: Date }[], days: number) {
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().split('T')[0]] = 0;
    }
    for (const item of items) {
      const key = item.createdAt.toISOString().split('T')[0];
      if (key in buckets) buckets[key]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }

  try {
    const realUserIds = await getRealUserIds();
    // Scope every query to only real, currently-active Supabase users.
    // This ensures deleted test accounts never inflate stats, even if their
    // candidateProfile row was not cleaned up in Postgres.
    const userFilter = { in: realUserIds };
    const startFilter = { gte: ANALYTICS_START_DATE };

    // totalAccounts comes directly from Supabase — the authoritative source of truth.
    // No Postgres query needed; deleted accounts are already excluded by getRealUserIds().
    const totalAccounts = realUserIds.length;

    const [
      onboardedProfiles,
      newToday,
      newThisWeek,
      planBreakdown,
      totalDocs,
      docsToday,
      docsThisWeek,
      docsByType,
      recentProfiles,
      recentDocs,
      totalAnalyses,
      analysesThisWeek,
      analysesToday,
      totalDiagnostics,
      diagnosticsComplete,
      diagnosticsThisWeek,
      appsByStatus,
      feedbackStats,
      trialingCount,
      activePaidCount,
      pastDueCount,
    ] = await Promise.all([
      // No date filter on state-based counts — reflects current reality, not activity window
      prisma.candidateProfile.count({ where: { userId: userFilter, hasCompletedOnboarding: true } }),
      prisma.candidateProfile.count({ where: { userId: userFilter, createdAt: { gte: todayStart } } }),
      prisma.candidateProfile.count({ where: { userId: userFilter, createdAt: { gte: weekAgo } } }),
      prisma.candidateProfile.groupBy({ by: ['plan'] as any, _count: { id: true }, where: { userId: userFilter } }),
      // Activity metrics keep the launch-date filter to exclude pre-launch noise
      prisma.document.count({ where: { userId: userFilter, createdAt: startFilter } }),
      prisma.document.count({ where: { userId: userFilter, createdAt: { gte: todayStart } } }),
      prisma.document.count({ where: { userId: userFilter, createdAt: { gte: weekAgo } } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true }, where: { userId: userFilter, createdAt: startFilter } }),
      prisma.candidateProfile.findMany({ where: { userId: userFilter, createdAt: { gte: twoWeeksAgo } }, select: { createdAt: true } }),
      prisma.document.findMany({ where: { userId: userFilter, createdAt: { gte: twoWeeksAgo } }, select: { createdAt: true } }),
      prisma.jobApplication.count({ where: { userId: userFilter, overallGrade: { not: null }, createdAt: startFilter } }),
      prisma.jobApplication.count({ where: { userId: userFilter, overallGrade: { not: null }, createdAt: { gte: weekAgo } } }),
      prisma.jobApplication.count({ where: { userId: userFilter, overallGrade: { not: null }, createdAt: { gte: todayStart } } }),
      prisma.diagnosticReport.count({ where: { userId: userFilter, createdAt: startFilter } }),
      prisma.diagnosticReport.count({ where: { userId: userFilter, status: 'COMPLETE' } }),
      prisma.diagnosticReport.count({ where: { userId: userFilter, createdAt: { gte: weekAgo } } }),
      prisma.jobApplication.groupBy({ by: ['status'], _count: { id: true }, where: { userId: userFilter, createdAt: startFilter } }),
      prisma.documentFeedback.aggregate({ _avg: { rating: true }, _count: { id: true }, where: { userId: userFilter, createdAt: startFilter } }),
      prisma.candidateProfile.count({ where: { userId: userFilter, planStatus: 'trialing' } }),
      prisma.candidateProfile.count({ where: { userId: userFilter, plan: { not: 'free' }, planStatus: 'active' } }),
      prisma.candidateProfile.count({ where: { userId: userFilter, planStatus: { in: ['past_due', 'unpaid'] } } }),
    ]);

    const byPlan: Record<string, number> = {};
    for (const row of planBreakdown as any[]) byPlan[row.plan] = row._count.id;
    const paidCount = Object.entries(byPlan).filter(([k]) => k !== 'free').reduce((s, [, v]) => s + v, 0);

    const byType: Record<string, number> = {};
    for (const row of docsByType) byType[row.type] = row._count.id;

    const byStatus: Record<string, number> = {};
    for (const row of appsByStatus) byStatus[row.status] = row._count.id;

    return res.json({
      users: {
        total: totalAccounts,
        onboarded: onboardedProfiles,
        paid: paidCount,
        trialing: trialingCount,
        activePaid: activePaidCount,
        pastDue: pastDueCount,
        free: totalAccounts - paidCount,
        newToday,
        newThisWeek,
        byPlan,
        daily: buildDailyBuckets(recentProfiles, 14),
      },
      generations: {
        total: totalDocs,
        today: docsToday,
        thisWeek: docsThisWeek,
        byType,
        daily: buildDailyBuckets(recentDocs, 14),
      },
      analyses: { total: totalAnalyses, thisWeek: analysesThisWeek, today: analysesToday },
      diagnostics: { total: totalDiagnostics, complete: diagnosticsComplete, thisWeek: diagnosticsThisWeek },
      applications: { byStatus },
      feedback: { total: feedbackStats._count.id, avgRating: feedbackStats._avg.rating },
    });
  } catch (err) {
    console.error('[admin/stats] error:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /api/admin/friday-brief
router.get('/friday-brief', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const realUserIds = await getRealUserIds();
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
    const firstTimeCount = actualFrom >= to ? 0 : await prisma.diagnosticReport.count({
      where: {
        status: 'COMPLETE',
        createdAt: { gte: actualFrom, lt: to },
        ...(realUserIds.length ? { userId: { in: realUserIds } } : {}),
      },
    });

    if (cached) {
      return res.json({
        window: { from, to },
        reportCount: firstTimeCount,
        cached: true,
        script: cached.script,
        generatedAt: cached.generatedAt,
      });
    }

    return res.json({
      window: { from, to },
      reportCount: firstTimeCount,
      cached: false,
      script: null,
      generatedAt: null,
    });
  } catch (err) {
    console.error('[admin/friday-brief GET] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/admin/friday-brief/generate
router.post('/friday-brief/generate', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const realUserIds = await getRealUserIds();
    const reports = await getFirstTimeReportsForWindow(from, to, realUserIds);

    if (reports.length === 0) {
      return res.json({ script: 'No first-time reports in this window yet.', reportCount: 0 });
    }

    const prompt = buildBriefPrompt(reports, from);
    const { content: script } = await callClaude(prompt, false);

    await prisma.fridayBrief.upsert({
      where: { windowStart: from },
      update: { script, reportCount: reports.length, generatedAt: new Date(), windowEnd: to },
      create: { windowStart: from, windowEnd: to, script, reportCount: reports.length },
    });

    return res.json({ script, reportCount: reports.length });
  } catch (err) {
    console.error('[admin/friday-brief POST] error:', err);
    return res.status(500).json({ error: 'Failed to generate brief' });
  }
});

// POST /api/admin/friday-brief/email — send generated brief to admin email via Resend
router.post('/friday-brief/email', authenticate, requireAdmin, async (_req, res) => {
  const { from } = getCurrentWindow();
  const weekLabel = from.toISOString().split('T')[0];
  try {
    const cached = await prisma.fridayBrief.findUnique({ where: { windowStart: from } });
    if (!cached?.script) {
      return res.status(400).json({ error: 'No brief generated for this week yet. Generate it first.' });
    }
    await sendFridayBriefEmail(cached.script, cached.reportCount, weekLabel);
    return res.json({ ok: true, sentTo: process.env.ADMIN_EMAIL ?? 'kiron@aussiegradcareers.com.au', weekLabel });
  } catch (err: any) {
    console.error('[admin/friday-brief/email] error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// GET /api/admin/analysis — LLM growth intelligence on platform engagement metrics
router.get('/analysis', authenticate, requireAdmin, async (_req, res) => {
  try {
    const realUserIds = await getRealUserIds();
    const userFilter = realUserIds.length ? { in: realUserIds } : undefined;

    const [docsByUser, docsByType, diagnosticUsers, totalUsers, totalOnboarded, profilesRaw] = await Promise.all([
      prisma.document.groupBy({ by: ['userId'], _count: { id: true }, where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true }, where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) } }),
      prisma.diagnosticReport.findMany({ where: { status: 'COMPLETE', createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) }, select: { userId: true } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) } }),
      prisma.candidateProfile.count({ where: { hasCompletedOnboarding: true, createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) } }),
      prisma.candidateProfile.findMany({ where: { hasCompletedOnboarding: true, createdAt: { gte: ANALYTICS_START_DATE }, ...(userFilter ? { userId: userFilter } : {}) }, select: { userId: true, createdAt: true } }),
    ]);

    const inclusionClause = realUserIds.length
      ? Prisma.sql`WHERE "createdAt" >= ${ANALYTICS_START_DATE} AND "userId" IN (${Prisma.join(realUserIds)})`
      : Prisma.sql`WHERE "createdAt" >= ${ANALYTICS_START_DATE}`;

    const firstDocDates = await prisma.$queryRaw<Array<{ userId: string; minCreatedAt: Date }>>`
      SELECT "userId", MIN("createdAt") as "minCreatedAt" FROM "Document" ${inclusionClause} GROUP BY "userId"
    `;

    const docUserIds = new Set(docsByUser.map(d => d.userId));
    const highEngagers = docsByUser.filter(u => u._count.id >= 5).length;
    const lowEngagers = docsByUser.filter(u => u._count.id >= 1 && u._count.id <= 2).length;
    const zeroDocUsers = totalUsers - docsByUser.length;

    const typeMap: Record<string, number> = {};
    for (const row of docsByType) typeMap[row.type] = row._count.id;

    const firstDocMap = new Map(firstDocDates.map(r => [r.userId, new Date(r.minCreatedAt)]));
    let totalGap = 0, gapCount = 0;
    for (const p of profilesRaw) {
      const firstDoc = firstDocMap.get(p.userId);
      if (firstDoc) {
        totalGap += (firstDoc.getTime() - p.createdAt.getTime()) / 86_400_000;
        gapCount++;
      }
    }
    const avgGapDays = gapCount > 0 ? (totalGap / gapCount).toFixed(1) : 'unknown';
    const diagNoDocs = diagnosticUsers.filter(d => !docUserIds.has(d.userId)).length;

    const prompt = `You are a growth strategist analysing a B2C SaaS platform called JobReady — an AI career platform for Australian graduate job seekers. Free users get 5 document generations and 5 analyses before hitting the paywall. The business goal: get free users to feel the product's value and convert to paid within their first 7 days.

Live platform data (admin/test accounts excluded):
- Total users: ${totalUsers} (${totalOnboarded} completed onboarding)
- Users who generated 5+ documents (hit paywall): ${highEngagers}
- Users who generated only 1-2 documents (low engagement): ${lowEngagers}
- Users with zero documents (never started): ${zeroDocUsers}
- Document type breakdown — Resumes: ${typeMap['RESUME'] ?? 0}, Cover Letters: ${typeMap['COVER_LETTER'] ?? 0}, Selection Criteria: ${typeMap['STAR_RESPONSE'] ?? 0}
- Average days from signup to first document: ${avgGapDays} days
- Users who completed a diagnostic but never generated a document: ${diagNoDocs} out of ${diagnosticUsers.length}

Identify the 3 to 5 most financially significant patterns in this data — things that are either leaking revenue or represent the clearest conversion opportunity. Do not answer pre-set questions. Find what actually matters.

For each insight, use exactly this format:

**INSIGHT [N]: [Short title]**
What the data shows: [2-3 sentences grounded in the numbers above]
Revenue impact: [What this costs us or could earn us — be specific, make assumptions if needed]
Action: [One concrete change we can make this week to move the needle]

Be direct. Be specific to this data. No generic SaaS advice — only what the numbers actually tell us.`;

    const { content: analysis } = await callClaude(prompt, false);
    return res.json({ analysis });
  } catch (err) {
    console.error('[admin/analysis] error:', err);
    return res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

// ─── Expenses dashboard ────────────────────────────────────────────────────────

type ExpenseStatus = 'live' | 'manual' | 'error';
type ExpenseUrgency = 'good' | 'warning' | 'critical' | 'unknown';

interface ExpenseEntry {
  id: string;
  name: string;
  category: string;
  status: ExpenseStatus;
  balance?: number;
  used?: number;
  limit?: number;
  usedPct?: number;
  monthlyCostAUD?: number;
  billingCycle: 'monthly' | 'annual' | 'per-transaction' | 'free';
  description: string;
  urgency: ExpenseUrgency;
  lastFetched?: string;
  error?: string;
}

interface ExpensesResponse {
  services: ExpenseEntry[];
  totalMonthlyAUD: number;
  fetchedAt: string;
}

const expensesCache: { data: ExpensesResponse | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const EXPENSES_CACHE_TTL_MS = 60 * 60 * 1000;
const USD_TO_AUD = 1.55;

function computeUrgency(entry: Partial<ExpenseEntry>): ExpenseUrgency {
  if (entry.status === 'error') return 'unknown';
  if (entry.usedPct !== undefined) {
    if (entry.usedPct >= 90) return 'critical';
    if (entry.usedPct >= 70) return 'warning';
    return 'good';
  }
  if (entry.balance !== undefined && entry.limit === undefined) {
    if (entry.balance < 2) return 'critical';
    if (entry.balance < 5) return 'warning';
    return 'good';
  }
  return 'unknown';
}

async function fetchOpenRouter(): Promise<Partial<ExpenseEntry>> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const balance = json?.data?.limit_remaining ?? null;
    const usage = json?.data?.usage ?? null;
    const limit = json?.data?.limit ?? null;
    const usedPct = limit && usage !== null ? Math.round((usage / limit) * 100) : undefined;
    return {
      status: 'live',
      balance: balance !== null ? Math.round(balance * 100) / 100 : undefined,
      used: usage !== null ? Math.round(usage * 100) / 100 : undefined,
      limit: limit !== null ? Math.round(limit * 100) / 100 : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function fetchApify(): Promise<Partial<ExpenseEntry>> {
  try {
    const key = process.env.APIFY_API_KEY?.trim();
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const used = json?.data?.plan?.monthlyUsageCredits ?? null;
    const limit = json?.data?.plan?.maxMonthlyUsageCredits ?? null;
    const usedPct = limit && used !== null ? Math.round((used / limit) * 100) : undefined;
    return {
      status: 'live',
      used: used !== null ? used : undefined,
      limit: limit !== null ? limit : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function fetchSerpApi(): Promise<Partial<ExpenseEntry>> {
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${serpApiKey()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const monthly = json?.searches_per_month ?? null;
    const left = json?.plan_searches_left ?? null;
    const used = monthly !== null && left !== null ? monthly - left : null;
    const usedPct = monthly && used !== null ? Math.round((used / monthly) * 100) : undefined;
    return {
      status: 'live',
      balance: left !== null ? left : undefined,
      used: used !== null ? used : undefined,
      limit: monthly !== null ? monthly : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function buildExpensesData(): Promise<ExpensesResponse> {
  const [orResult, apifyResult, serpResult] = await Promise.allSettled([
    fetchOpenRouter(),
    fetchApify(),
    fetchSerpApi(),
  ]);

  const orData  = orResult.status    === 'fulfilled' ? orResult.value    : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };
  const apifyData = apifyResult.status === 'fulfilled' ? apifyResult.value : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };
  const serpData  = serpResult.status  === 'fulfilled' ? serpResult.value  : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };

  const services: ExpenseEntry[] = [
    {
      id: 'openrouter', name: 'OpenRouter', category: 'AI / LLM',
      ...orData, monthlyCostAUD: undefined, billingCycle: 'per-transaction',
      description: 'LLM API gateway — pay per token (USD credits)',
      urgency: computeUrgency(orData),
    } as ExpenseEntry,
    {
      id: 'railway', name: 'Railway', category: 'Hosting',
      status: 'manual', monthlyCostAUD: Math.round(5 * USD_TO_AUD),
      billingCycle: 'monthly', description: 'Hobby plan — usage-based (~$5 base). Agent usage limit: $5 — monitor closely.',
      urgency: 'warning',
    },
    {
      id: 'godaddy', name: 'GoDaddy', category: 'Domain',
      status: 'manual', monthlyCostAUD: 2.08,
      billingCycle: 'annual', description: 'Domain registration (billed annually)',
      urgency: 'good',
    },
    {
      id: 'apify', name: 'Apify', category: 'Scraping',
      ...apifyData, monthlyCostAUD: undefined, billingCycle: 'monthly',
      description: 'Job board scraping — monthly compute credits',
      urgency: computeUrgency(apifyData),
    } as ExpenseEntry,
    {
      id: 'serpapi', name: 'SERP API', category: 'Search',
      ...serpData, monthlyCostAUD: undefined, billingCycle: 'monthly',
      description: 'Search lookups — free 100/mo tier',
      urgency: computeUrgency(serpData),
    } as ExpenseEntry,
    {
      id: 'resend', name: 'Resend', category: 'Email',
      status: 'manual', billingCycle: 'free',
      description: 'Transactional email — free tier (3,000/mo)',
      urgency: 'good',
    },
    {
      id: 'pinecone', name: 'Pinecone', category: 'Vector DB',
      status: 'manual', billingCycle: 'free',
      description: 'Vector search for achievements — free tier',
      urgency: 'good',
    },
    {
      id: 'skool', name: 'Skool', category: 'Community',
      status: 'manual', monthlyCostAUD: Math.round(99 * USD_TO_AUD),
      billingCycle: 'monthly', description: 'Community platform subscription',
      urgency: 'good',
    },
    {
      id: 'nanobanana', name: 'Nano Banana', category: 'Marketing',
      status: 'manual',
      billingCycle: 'per-transaction', description: 'Marketing / outreach tool — pay per use, no flat monthly fee',
      urgency: 'good',
    },
    {
      id: 'stripe', name: 'Stripe', category: 'Payments',
      status: 'manual', billingCycle: 'per-transaction',
      description: '2.9% + $0.30 per transaction (AU cards slightly higher)',
      urgency: 'good',
    },
    {
      id: 'llamacloud', name: 'LlamaCloud', category: 'AI / Parse',
      status: 'manual', billingCycle: 'per-transaction',
      description: 'Document parsing — pay per page processed',
      urgency: 'unknown',
    },
  ];

  const totalMonthlyAUD = services.reduce((sum, s) => {
    if (s.monthlyCostAUD && (s.billingCycle === 'monthly' || s.billingCycle === 'annual')) {
      return sum + s.monthlyCostAUD;
    }
    return sum;
  }, 0);

  return { services, totalMonthlyAUD, fetchedAt: new Date().toISOString() };
}

// GET /api/admin/posthog-stats
router.get('/posthog-stats', authenticate, requireAdmin, async (_req, res) => {
  // Accepts either env var name — Railway/local .env have historically been
  // set as POSTHOG_API_KEY, which this endpoint never actually read, so this
  // has been silently 503ing. Not renaming the Railway var: fixing it here is
  // additive and does not require touching production config to take effect.
  const key = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY;
  // POSTHOG_PROJECT_ID has been set to the full project URL rather than the
  // numeric id the query URL below needs — pull the digits out of either form.
  const rawProjectId = process.env.POSTHOG_PROJECT_ID;
  const projectId = rawProjectId?.match(/\d+/)?.[0];

  if (!key || !projectId) {
    return res.status(503).json({ error: 'PostHog not configured — set POSTHOG_PERSONAL_API_KEY (or POSTHOG_API_KEY) and POSTHOG_PROJECT_ID in Railway env vars' });
  }

  async function hogql(query: string): Promise<any> {
    const r = await fetch(`https://us.posthog.com/api/projects/${projectId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`PostHog ${r.status}: ${body.slice(0, 200)}`);
    }
    return r.json();
  }

  function rows(result: PromiseSettledResult<any>): { key: string; count: number }[] {
    if (result.status === 'rejected') return [];
    return (result.value?.results ?? [])
      .filter((row: any[]) => row[0] != null && row[0] !== '')
      .map((row: any[]) => ({ key: String(row[0]), count: Number(row[1]) }));
  }

  try {
    const [events7d, onboardingSteps, docTypes, features, cancelReasons, activeUsers] = await Promise.allSettled([
      hogql(`SELECT event, count() as cnt FROM events WHERE timestamp >= now() - interval 7 day GROUP BY event ORDER BY cnt DESC LIMIT 20`),
      hogql(`SELECT properties.step, count() as cnt FROM events WHERE event = 'onboarding_step_viewed' AND timestamp >= now() - interval 30 day GROUP BY properties.step ORDER BY cnt DESC`),
      // Was `properties.type` — document_generated has always carried
      // `doc_type` (see trackDocumentGenerated in src/lib/analytics.ts), so
      // this column was silently empty for every row.
      hogql(`SELECT properties.doc_type, count() as cnt FROM events WHERE event = 'document_generated' AND timestamp >= now() - interval 30 day GROUP BY properties.doc_type ORDER BY cnt DESC`),
      hogql(`SELECT properties.feature, count() as cnt FROM events WHERE event = 'feature_opened' AND timestamp >= now() - interval 30 day GROUP BY properties.feature ORDER BY cnt DESC`),
      hogql(`SELECT properties.reason, count() as cnt FROM events WHERE event = 'cancellation_reason_selected' GROUP BY properties.reason ORDER BY cnt DESC`),
      hogql(`SELECT count(distinct person_id) as cnt FROM events WHERE timestamp >= now() - interval 7 day`),
    ]);

    return res.json({
      activeUsers7d: activeUsers.status === 'fulfilled'
        ? Number(activeUsers.value?.results?.[0]?.[0] ?? 0)
        : null,
      events7d: rows(events7d),
      onboardingSteps: rows(onboardingSteps),
      docTypes: rows(docTypes),
      features: rows(features),
      cancelReasons: rows(cancelReasons),
    });
  } catch (err) {
    console.error('[admin/posthog-stats] error:', err);
    return res.status(500).json({ error: 'Failed to fetch PostHog data' });
  }
});

// GET /api/admin/traffic?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=day|week|month
// Visitors per bucket for the bar chart on /admin/traffic, plus the funnel
// totals for the whole range: visited -> uploaded -> saw resume -> signed up
// -> trial -> paid.
//
// Two sources, on purpose. Visits, uploads and "saw resume" exist only in
// PostHog (live host, test accounts out, a pageview needs a browser so headless
// crawlers drop). From 2026-10-03 every front-door step is recorded on our
// own server (resume_uploaded/built in routes/welcome.ts, the rest relayed by
// routes/track.ts), which ad blockers cannot drop; the browser-only events
// still count for older dates.
// Signups and trials come from the database, because PostHog
// misses them: ad blockers hide whole people, and welcome_completed only fires
// in the /welcome flow, not for someone who signs up at /auth. Checked on
// 2026-10-03: PostHog had 4 signups and 0 trials for a month the database had
// 8 and 9. All buckets are UTC, which is the PostHog project's timezone.
const TRAFFIC_HOST = 'www.aussiegradcareers.com.au';
const TEST_EMAIL = /kiron|norik|kamiproject/i;
const TRAFFIC_NOT_TEST = `not (ifNull(person.properties.email, '') ilike '%kiron%'
  or ifNull(person.properties.email, '') ilike '%norik%'
  or ifNull(person.properties.email, '') ilike 'kamiproject%')`;
const TRAFFIC_COLUMNS = `
  count(distinct if((event = '$pageview' and properties.$browser is not null) or (event = 'welcome_step_viewed' and properties.step_index = 0), person_id, null)) as visitors,
  count(distinct if((event = 'welcome_step_viewed' and properties.step_index = 1) or event = 'resume_uploaded', person_id, null)) as uploaded,
  count(distinct if((event = 'welcome_step_viewed' and properties.step_index = 6) or event = 'resume_built', person_id, null)) as resume,
  count(distinct if(event = 'email_submitted', person_id, null)) as entered_email,
  count(distinct if(event = 'payment_completed', person_id, null)) as paid`;
const POSTHOG_METRICS = ['visitors', 'uploaded', 'resume', 'enteredEmail', 'paid'] as const;
type TrafficInterval = 'day' | 'week' | 'month';

/** The bucket a moment falls in, matching HogQL's toStartOfDay/Week(Sunday)/Month in UTC. */
function trafficBucketOf(d: Date, interval: TrafficInterval): string {
  const b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (interval === 'week') b.setUTCDate(b.getUTCDate() - b.getUTCDay());
  if (interval === 'month') b.setUTCDate(1);
  return b.toISOString().slice(0, 10);
}

/** Every bucket between two YYYY-MM-DD dates, so empty days still get a bar. */
function trafficBuckets(from: string, to: string, interval: TrafficInterval): string[] {
  const out: string[] = [];
  const d = new Date(trafficBucketOf(new Date(`${from}T00:00:00Z`), interval) + 'T00:00:00Z');
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    if (interval === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (interval === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/** Every Supabase auth user, paged. getRealUserIds stops at 1000 and only
 * knows the bare test addresses, not the +tag ones. */
async function allAuthUsers(): Promise<{ id: string; email?: string; created_at: string }[]> {
  const users: { id: string; email?: string; created_at: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

router.get('/traffic', authenticate, requireAdmin, async (req, res) => {
  const key = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID?.match(/\d+/)?.[0];
  if (!key || !projectId) return res.status(503).json({ error: 'PostHog not configured' });

  // Strict shapes only: these values are interpolated into the query.
  const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const { from, to } = req.query;
  const interval = req.query.interval;
  if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'from and to must be YYYY-MM-DD, from <= to' });
  if (interval !== 'day' && interval !== 'week' && interval !== 'month') return res.status(400).json({ error: 'interval must be day, week or month' });

  const rangeStart = new Date(`${from}T00:00:00Z`);
  const rangeEnd = new Date(`${to}T00:00:00Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  const inRange = (d: Date) => d >= rangeStart && d < rangeEnd;

  const bucketFn = { day: 'toStartOfDay', week: 'toStartOfWeek', month: 'toStartOfMonth' }[interval];
  const where = `timestamp >= toDateTime('${from} 00:00:00') and timestamp < toDateTime('${to} 00:00:00') + interval 1 day
    and event in ('$pageview', 'welcome_step_viewed', 'resume_uploaded', 'resume_built', 'email_submitted', 'payment_completed')
    and (properties.$host = '${TRAFFIC_HOST}' or event = 'payment_completed')
    and ${TRAFFIC_NOT_TEST}`;

  async function hogql(query: string): Promise<any[][]> {
    const r = await fetch(`https://us.posthog.com/api/projects/${projectId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!r.ok) throw new Error(`PostHog ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    return ((await r.json()) as { results?: any[][] }).results ?? [];
  }
  const toMetrics = (row: any[] | undefined, offset: number) =>
    Object.fromEntries(POSTHOG_METRICS.map((m, i) => [m, Number(row?.[offset + i] ?? 0)]));

  try {
    const [byBucket, totals, users, challenges, stripeTrials] = await Promise.all([
      hogql(`select toString(toDate(${bucketFn}(timestamp))) as bucket, ${TRAFFIC_COLUMNS} from events where ${where} group by bucket order by bucket`),
      hogql(`select ${TRAFFIC_COLUMNS} from events where ${where}`),
      allAuthUsers(),
      prisma.trialChallenge.findMany({ where: { currentDay: { gte: 1 } }, select: { userId: true, createdAt: true } }),
      // A card-on-file trial stores only its end; the start is TRIAL_PERIOD_DAYS before it.
      prisma.candidateProfile.findMany({ where: { trialEndDate: { not: null } }, select: { userId: true, trialEndDate: true } }),
    ]);

    const realIds = new Set(users.filter(u => !TEST_EMAIL.test(u.email ?? '')).map(u => u.id));
    const signups = users.filter(u => realIds.has(u.id)).map(u => new Date(u.created_at)).filter(inRange);
    // One trial per person: the earliest start across both kinds.
    const trialStart = new Map<string, Date>();
    const addTrial = (userId: string, at: Date) => {
      if (!realIds.has(userId)) return;
      const prev = trialStart.get(userId);
      if (!prev || at < prev) trialStart.set(userId, at);
    };
    for (const c of challenges) addTrial(c.userId, c.createdAt);
    for (const p of stripeTrials) addTrial(p.userId, new Date(p.trialEndDate!.getTime() - TRIAL_PERIOD_DAYS * 86_400_000));
    const trials = [...trialStart.values()].filter(inRange);

    const countBy = (dates: Date[]) => {
      const m = new Map<string, number>();
      for (const d of dates) { const b = trafficBucketOf(d, interval); m.set(b, (m.get(b) ?? 0) + 1); }
      return m;
    };
    const signupsBy = countBy(signups);
    const trialsBy = countBy(trials);
    const found = new Map(byBucket.map(row => [String(row[0]), row]));

    return res.json({
      from, to, interval,
      buckets: trafficBuckets(from, to, interval).map(bucket => ({
        bucket,
        ...toMetrics(found.get(bucket), 1),
        signedUp: signupsBy.get(bucket) ?? 0,
        trials: trialsBy.get(bucket) ?? 0,
      })),
      totals: { ...toMetrics(totals[0], 0), signedUp: signups.length, trials: trials.length },
    });
  } catch (err) {
    console.error('[admin/traffic] error:', err);
    return res.status(500).json({ error: 'Failed to fetch traffic data' });
  }
});

// GET /api/admin/expenses
router.get('/expenses', authenticate, requireAdmin, async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const now = Date.now();

  if (!forceRefresh && expensesCache.data && (now - expensesCache.fetchedAt) < EXPENSES_CACHE_TTL_MS) {
    return res.json({ ...expensesCache.data, cached: true });
  }

  try {
    const data = await buildExpensesData();
    expensesCache.data = data;
    expensesCache.fetchedAt = now;
    return res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[admin/expenses] error:', err);
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// ── GET /api/admin/quality ────────────────────────────────────────────────────
// Team-facing quality dashboard: every generated document carries qualitySignals
// (quality gate outcome, ATS coverage, achievement match, voice scrubber). This
// aggregates them so the team can spot bad output before a student sends it.
router.get('/quality', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? '7'), 10) || 7, 1), 90);
    const since = new Date(Date.now() - days * 86400000);

    const docs = await prisma.document.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true, type: true, createdAt: true, userId: true, qualitySignals: true,
        jobApplication: { select: { title: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const userIds = [...new Set(docs.map(d => d.userId))];
    const profiles = await prisma.candidateProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, name: true, email: true },
    });
    const profileByUser = new Map(profiles.map(p => [p.userId, p]));

    type Signal = { severity: string; category: string; message: string; evidence?: string[] };
    const severityOf = (signals: Signal[] | null): 'clean' | 'info' | 'warning' | 'critical' => {
      if (!signals || signals.length === 0) return 'clean';
      if (signals.some(s => s.severity === 'critical')) return 'critical';
      if (signals.some(s => s.severity === 'warning')) return 'warning';
      return 'info';
    };

    const summary = { total: docs.length, clean: 0, info: 0, warning: 0, critical: 0 };
    const byCategory: Record<string, number> = {};
    const flagged: any[] = [];

    for (const doc of docs) {
      const signals = (doc.qualitySignals as unknown as Signal[] | null) ?? null;
      const level = severityOf(signals);
      summary[level] += 1;
      if (level === 'clean') continue;
      for (const s of signals!) byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
      const p = profileByUser.get(doc.userId);
      flagged.push({
        id: doc.id,
        type: doc.type,
        createdAt: doc.createdAt,
        level,
        student: { name: p?.name ?? null, email: p?.email ?? null },
        job: doc.jobApplication ? { title: doc.jobApplication.title, company: doc.jobApplication.company } : null,
        signals,
      });
    }

    return res.json({ days, summary, byCategory, flagged: flagged.slice(0, 100) });
  } catch (err) {
    console.error('[admin/quality] error:', err);
    return res.status(500).json({ error: 'Failed to load quality data' });
  }
});

export default router;
