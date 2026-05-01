import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { sendFridayBriefEmail } from '../services/email';
import { EXEMPT_EMAILS } from './stripe';

const router = Router();

// Admin/test accounts excluded from all platform stats
const EXCLUDED_EMAILS = [
  'kiron182@gmail.com',
  'yornorik281@gmail.com',
  'kamiproject2021@gmail.com',
  'kironorik182@gmail.com',
  'kironorik@gmail.com',
  'kironoriktest@gmail.com',
];

const ANALYTICS_START_DATE = new Date('2026-04-27T00:00:00Z');

async function getExcludedUserIds(): Promise<string[]> {
  const profiles = await prisma.candidateProfile.findMany({
    where: {
      OR: [
        { email: { in: EXCLUDED_EMAILS } },
        { email: null },
        { email: '' },
      ]
    },
    select: { userId: true },
  });
  return profiles.map(p => p.userId);
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

async function getFirstTimeReportsForWindow(from: Date, to: Date, excludedUserIds: string[]) {
  const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
  if (actualFrom >= to) return [];

  return prisma.diagnosticReport.findMany({
    where: {
      status: 'COMPLETE',
      createdAt: { gte: actualFrom, lt: to },
      ...(excludedUserIds.length ? { userId: { notIn: excludedUserIds } } : {}),
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
    const excludedUserIds = await getExcludedUserIds();
    const ex = excludedUserIds.length ? { notIn: excludedUserIds } : undefined;
    const startFilter = { gte: ANALYTICS_START_DATE };

    const [
      totalProfiles,
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
    ] = await Promise.all([
      prisma.candidateProfile.count({ where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.count({ where: { hasCompletedOnboarding: true, createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: todayStart }, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: weekAgo }, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.groupBy({ by: ['plan'] as any, _count: { id: true }, where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.document.count({ where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.document.count({ where: { createdAt: { gte: todayStart }, ...(ex ? { userId: ex } : {}) } }),
      prisma.document.count({ where: { createdAt: { gte: weekAgo }, ...(ex ? { userId: ex } : {}) } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true }, where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.findMany({ where: { createdAt: { gte: twoWeeksAgo }, ...(ex ? { userId: ex } : {}) }, select: { createdAt: true } }),
      prisma.document.findMany({ where: { createdAt: { gte: twoWeeksAgo }, ...(ex ? { userId: ex } : {}) }, select: { createdAt: true } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null }, createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null }, createdAt: { gte: weekAgo }, ...(ex ? { userId: ex } : {}) } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null }, createdAt: { gte: todayStart }, ...(ex ? { userId: ex } : {}) } }),
      prisma.diagnosticReport.count({ where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.diagnosticReport.count({ where: { status: 'COMPLETE', createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.diagnosticReport.count({ where: { createdAt: { gte: weekAgo }, ...(ex ? { userId: ex } : {}) } }),
      prisma.jobApplication.groupBy({ by: ['status'], _count: { id: true }, where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
      prisma.documentFeedback.aggregate({ _avg: { rating: true }, _count: { id: true }, where: { createdAt: startFilter, ...(ex ? { userId: ex } : {}) } }),
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
        total: totalProfiles,
        onboarded: onboardedProfiles,
        paid: paidCount,
        free: totalProfiles - paidCount,
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
    const excludedUserIds = await getExcludedUserIds();
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
    const firstTimeCount = actualFrom >= to ? 0 : await prisma.diagnosticReport.count({
      where: {
        status: 'COMPLETE',
        createdAt: { gte: actualFrom, lt: to },
        ...(excludedUserIds.length ? { userId: { notIn: excludedUserIds } } : {}),
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
    const excludedUserIds = await getExcludedUserIds();
    const reports = await getFirstTimeReportsForWindow(from, to, excludedUserIds);

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
    const excludedUserIds = await getExcludedUserIds();
    const ex = excludedUserIds.length ? { notIn: excludedUserIds } : undefined;

    const [docsByUser, docsByType, diagnosticUsers, totalUsers, totalOnboarded, profilesRaw] = await Promise.all([
      prisma.document.groupBy({ by: ['userId'], _count: { id: true }, where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true }, where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) } }),
      prisma.diagnosticReport.findMany({ where: { status: 'COMPLETE', createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) }, select: { userId: true } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.count({ where: { hasCompletedOnboarding: true, createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) } }),
      prisma.candidateProfile.findMany({ where: { hasCompletedOnboarding: true, createdAt: { gte: ANALYTICS_START_DATE }, ...(ex ? { userId: ex } : {}) }, select: { userId: true, createdAt: true } }),
    ]);

    const exclusionClause = Prisma.sql`WHERE "createdAt" >= ${ANALYTICS_START_DATE} ${excludedUserIds.length ? Prisma.sql`AND "userId" NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}`;

    const firstDocDates = await prisma.$queryRaw<Array<{ userId: string; minCreatedAt: Date }>>`
      SELECT "userId", MIN("createdAt") as "minCreatedAt" FROM "Document" ${exclusionClause} GROUP BY "userId"
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
    const res = await fetch(`https://serpapi.com/account.json?api_key=${process.env.SERPAPI_KEY}`);
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

export default router;
