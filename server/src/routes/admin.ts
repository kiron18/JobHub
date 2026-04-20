import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callClaude } from '../services/llm';

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

async function requireAdmin(req: any, res: any, next: any) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorised' });
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { dashboardAccess: true },
  });
  if (!profile?.dashboardAccess) return res.status(403).json({ error: 'Forbidden' });
  next();
}

async function getFirstTimeReportsForWindow(from: Date, to: Date) {
  const windowReports = await prisma.diagnosticReport.findMany({
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

  const firstTime = [];
  for (const report of windowReports) {
    const totalComplete = await prisma.diagnosticReport.count({
      where: { userId: report.userId, status: 'COMPLETE' },
    });
    if (totalComplete === 1) firstTime.push(report);
  }
  return firstTime;
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
      r.reportMarkdown ?? '(no report content)',
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

// GET /api/admin/friday-brief
router.get('/friday-brief', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const allWindowReports = await prisma.diagnosticReport.findMany({
      where: { status: 'COMPLETE', createdAt: { gte: from, lt: to } },
      select: { userId: true },
    });

    let firstTimeCount = 0;
    for (const r of allWindowReports) {
      const total = await prisma.diagnosticReport.count({
        where: { userId: r.userId, status: 'COMPLETE' },
      });
      if (total === 1) firstTimeCount++;
    }

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

export default router;
