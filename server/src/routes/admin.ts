import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { sendFridayBriefEmail } from '../services/email';
import { EXEMPT_EMAILS } from './stripe';

const router = Router();

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

async function getFirstTimeReportsForWindow(from: Date, to: Date) {
  return prisma.diagnosticReport.findMany({
    where: { status: 'COMPLETE', createdAt: { gte: from, lt: to } },
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
  const weekAgo    = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

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
      prisma.candidateProfile.count(),
      prisma.candidateProfile.count({ where: { hasCompletedOnboarding: true } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.candidateProfile.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.candidateProfile.groupBy({ by: ['plan'] as any, _count: { id: true } }),
      prisma.document.count(),
      prisma.document.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.document.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.candidateProfile.findMany({ where: { createdAt: { gte: twoWeeksAgo } }, select: { createdAt: true } }),
      prisma.document.findMany({ where: { createdAt: { gte: twoWeeksAgo } }, select: { createdAt: true } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null } } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null }, createdAt: { gte: weekAgo } } }),
      prisma.jobApplication.count({ where: { overallGrade: { not: null }, createdAt: { gte: todayStart } } }),
      prisma.diagnosticReport.count(),
      prisma.diagnosticReport.count({ where: { status: 'COMPLETE' } }),
      prisma.diagnosticReport.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.jobApplication.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.documentFeedback.aggregate({ _avg: { rating: true }, _count: { id: true } }),
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
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const firstTimeCount = await prisma.diagnosticReport.count({
      where: { status: 'COMPLETE', createdAt: { gte: from, lt: to } },
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
    const reports = await getFirstTimeReportsForWindow(from, to);

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
  const { from, to } = getCurrentWindow();
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

// GET /api/admin/analysis — LLM insight on platform engagement metrics
router.get('/analysis', authenticate, requireAdmin, async (_req, res) => {
  try {
    const [docsByUser, docsByType, diagnosticUsers, totalUsers, totalOnboarded, profilesRaw, firstDocDates] = await Promise.all([
      prisma.document.groupBy({ by: ['userId'], _count: { id: true } }),
      prisma.document.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.diagnosticReport.findMany({ where: { status: 'COMPLETE' }, select: { userId: true } }),
      prisma.candidateProfile.count(),
      prisma.candidateProfile.count({ where: { hasCompletedOnboarding: true } }),
      prisma.candidateProfile.findMany({ where: { hasCompletedOnboarding: true }, select: { userId: true, createdAt: true } }),
      prisma.$queryRaw<Array<{ userId: string; minCreatedAt: Date }>>`
        SELECT "userId", MIN("createdAt") as "minCreatedAt" FROM "Document" GROUP BY "userId"
      `,
    ]);

    const docUserIds = new Set(docsByUser.map(d => d.userId));
    const highEngagers = docsByUser.filter(u => u._count.id >= 5).length;
    const lowEngagers = docsByUser.filter(u => u._count.id >= 1 && u._count.id <= 2).length;

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

    const prompt = `You are the growth advisor for JobReady, an AI career platform for Australian graduate job seekers. The business goal is clear: close the gap between free and paid users and build a frictionless conversion funnel. Free users get 5 document generations and 5 analyses — the mission is to get them to the moment they feel they need more.

Platform data:
- Total users: ${totalUsers} (${totalOnboarded} completed onboarding)
- Users who generated 5+ documents: ${highEngagers}
- Users who generated only 1-2 documents: ${lowEngagers}
- Users with zero documents: ${totalUsers - docsByUser.length}
- Document type breakdown: Resumes: ${typeMap['RESUME'] ?? 0}, Cover Letters: ${typeMap['COVER_LETTER'] ?? 0}, Selection Criteria: ${typeMap['STAR_RESPONSE'] ?? 0}
- Average days from signup to first document generated: ${avgGapDays} days
- Users who completed a diagnostic but never generated a document: ${diagNoDocs} out of ${diagnosticUsers.length} diagnostic completions

For each question below, answer in 2-3 sentences. Ground every answer in the numbers above. End each answer with one concrete action the business should take to drive free-to-paid conversion.

1. What's the engagement difference between users who generated 5+ documents vs 1-2, and what does it mean for conversion?
2. Which document type correlates with highest engagement, and how should we use that to pull free users toward the paywall?
3. What does the ${avgGapDays}-day gap between signup and first document tell us about where users are losing momentum — and how do we fix it?
4. ${diagNoDocs} out of ${diagnosticUsers.length} users who ran diagnostics never generated a document — where is this funnel breaking and what's the one intervention that would fix it?`;

    const { content: analysis } = await callClaude(prompt, false);
    return res.json({ analysis });
  } catch (err) {
    console.error('[admin/analysis] error:', err);
    return res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

export default router;
