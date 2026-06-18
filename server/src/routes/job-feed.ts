import { Router, Response } from 'express';
import axios from 'axios';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { checkAccess, hasActiveAccess, isPaidOrExempt } from '../middleware/accessControl';
import { DAILY_APPLICATION_CAP, countTodaysApplications } from '../services/applicationCap';
import {
  generateBullets,
  findAddressee,
  todayAEST,
  type RawJob,
} from '../services/jobFeed';
import { scoreJobForFeed } from '../services/jobAnalysis';
import { reconcileApplication } from '../lib/applicationReconcile';
import { scrapeJobsForTitles, type ScrapeResult } from '../services/userJobScrape';
import { runIngestionForTitle } from '../services/ingestion/runIngestion';

const router = Router();

// Tracks which userIds have a feed build currently in flight
const buildingNow = new Set<string>();

// Tracks feed items whose bullets are currently being generated (by item id), so
// repeated /feed polls while generation is in flight don't double-fire the LLM.
const bulletGenInFlight = new Set<string>();

// Fire-and-forget bullet generation. Returns immediately; writes bullets to the
// DB as they land so the next /feed read (client polls while bulletsPending) picks
// them up. The feed itself renders instantly instead of blocking ~26s on the LLM.
interface BulletGenItem {
  id: string; title: string; company: string; location: string | null;
  salary: string | null; description: string; sourceUrl: string;
  sourcePlatform: string; postedAt: Date | null;
}

function kickoffBulletGeneration(items: BulletGenItem[]): void {
  const toGenerate = items.filter(i => !bulletGenInFlight.has(i.id));
  if (toGenerate.length === 0) return;
  toGenerate.forEach(i => bulletGenInFlight.add(i.id));

  const rawJobs = toGenerate.map(i => ({
    title: i.title,
    company: i.company,
    location: i.location ?? '',
    salary: i.salary,
    description: i.description,
    sourceUrl: i.sourceUrl,
    sourcePlatform: i.sourcePlatform,
    postedAt: i.postedAt,
  })) as RawJob[];

  generateBullets(rawJobs)
    .then((bulletArrays) =>
      Promise.all(
        toGenerate.map((item, idx) =>
          bulletArrays[idx]
            ? prisma.jobFeedItem.update({ where: { id: item.id }, data: { bullets: bulletArrays[idx] } })
            : Promise.resolve()
        )
      )
    )
    .catch((err: any) => console.error('[job-feed] background bullet gen failed:', err?.message ?? err))
    .finally(() => toGenerate.forEach(i => bulletGenInFlight.delete(i.id)));
}

// NEW: Multi-source feed build using ingestion pipeline - FAST FIRST approach
// Scrapes primary role immediately, inserts jobs, then scrapes remaining roles in background
async function buildDailyFeedMultiSource(userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetRoles: true, targetCity: true, location: true, skills: true },
  });

  const effectiveCity = profile?.targetCity || profile?.location;
  if (!profile?.targetRole || !effectiveCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  // Use targetRoles if available (3 roles from CV scan), fallback to single targetRole
  const rolesArray: string[] = Array.isArray(profile.targetRoles) && profile.targetRoles.length > 0
    ? (profile.targetRoles as string[])
    : [profile.targetRole];

  const today = todayAEST();
  console.log(`[job-feed] Building feed for ${userId} with roles:`, rolesArray);

  // PHASE 1: Fast first - scrape primary role only for immediate display
  const primaryRole = rolesArray[0];
  const remainingRoles = rolesArray.slice(1);

  console.log(`[job-feed] PHASE 1: Fast scrape for primary role: "${primaryRole}"`);
  const startFast = Date.now();
  const { jobs: fastJobs, reports: fastReports } = await scrapeJobsForTitles([primaryRole], effectiveCity);
  console.log(`[job-feed] PHASE 1 complete: ${fastJobs.length} jobs in ${Date.now() - startFast}ms`);

  // Insert fast jobs immediately so user sees them
  if (fastJobs.length > 0) {
    const skills = profile.skills;
    const scoredFastJobs = fastJobs.map(j => ({
      ...j,
      matchScore: quickScore(skills, j),
    }));

    await prisma.jobFeedItem.createMany({
      data: scoredFastJobs.map(j => ({
        userId,
        feedDate: today,
        title: j.title,
        company: j.company,
        location: j.location,
        salary: j.salary,
        description: j.description,
        sourceUrl: j.sourceUrl,
        sourcePlatform: j.sourcePlatform,
        postedAt: j.postedAt,
        matchScore: j.matchScore,
      })),
    });
    console.log(`[job-feed] Inserted ${scoredFastJobs.length} fast jobs for immediate display`);
  }

  // PHASE 2: Background scrape for remaining roles
  if (remainingRoles.length > 0) {
    console.log(`[job-feed] PHASE 2: Background scrape for remaining roles:`, remainingRoles);

    // Fire and forget - don't await, let it complete in background
    scrapeJobsForTitles(remainingRoles, effectiveCity)
      .then(async ({ jobs: bgJobs, reports: bgReports }) => {
        if (bgJobs.length === 0) {
          console.log(`[job-feed] PHASE 2: No additional jobs found`);
          return;
        }

        const skills = profile.skills;
        const scoredBgJobs = bgJobs.map(j => ({
          ...j,
          matchScore: quickScore(skills, j),
        }));

        await prisma.jobFeedItem.createMany({
          data: scoredBgJobs.map(j => ({
            userId,
            feedDate: today,
            title: j.title,
            company: j.company,
            location: j.location,
            salary: j.salary,
            description: j.description,
            sourceUrl: j.sourceUrl,
            sourcePlatform: j.sourcePlatform,
            postedAt: j.postedAt,
            matchScore: j.matchScore,
          })),
        });

        console.log(`[job-feed] PHASE 2 complete: Inserted ${scoredBgJobs.length} additional jobs`);
        console.log(`[job-feed] Reports:`, [...fastReports, ...bgReports].map(r =>
          `${r.source}=${r.rawCount}${r.source === 'cache' ? '(cached)' : `(${r.latencyMs}ms)`}`
        ).join(', '));
      })
      .catch((err: any) => {
        console.error(`[job-feed] PHASE 2 background scrape failed:`, err.message);
      });
  }
}

// Quick scoring helper (moved from jobFeed.ts)
function quickScore(skillsJson: any, job: RawJob): number {
  if (!skillsJson) return 50;
  try {
    const parsed = typeof skillsJson === 'string' ? JSON.parse(skillsJson) : skillsJson;
    const allSkills: string[] = [
      ...(parsed.technical || []),
      ...(parsed.industryKnowledge || []),
      ...(parsed.tools || []),
      ...(parsed.soft || []),
    ].map((s: string) => String(s).toLowerCase()).filter(s => s.length > 2);

    if (allSkills.length === 0) return 50;

    const haystack = `${job.title} ${job.description}`.toLowerCase();
    const matches = allSkills.filter(s => haystack.includes(s));
    return Math.min(99, Math.round((matches.length / allSkills.length) * 100));
  } catch {
    return 50;
  }
}

// All routes require auth
router.use(authenticate);

// Helper: check paid access (for routes that require full subscription)
async function requirePremium(userId: string, res: Response): Promise<boolean> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { plan: true, planStatus: true, accessExpiresAt: true, dashboardAccess: true, trialEndDate: true },
  });
  if (!profile || !hasActiveAccess(profile)) {
    res.status(403).json({ error: 'Subscription required' });
    return false;
  }
  return true;
}

// POST /api/job-feed/refresh — rebuild today's feed (30-min cooldown)
router.post('/refresh', async (req: any, res: any) => {
  const userId = req.user.id;
  const today = todayAEST();
  const COOLDOWN_MS = 30 * 60 * 1000;

  try {
    const newest = await prisma.jobFeedItem.findFirst({
      where: { userId, feedDate: today },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (newest) {
      const elapsed = Date.now() - new Date(newest.createdAt).getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ error: 'Feed was refreshed recently.', retryAfter });
      }
      await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });
    }

    if (!buildingNow.has(userId)) {
      buildingNow.add(userId);
      buildDailyFeedMultiSource(userId).finally(() => buildingNow.delete(userId));
    }

    return res.json({ ok: true, building: true });
  } catch (err: any) {
    console.error('[job-feed/refresh]', err);
    return res.status(500).json({ error: 'Could not refresh feed' });
  }
});

// GET /api/job-feed/feed?offset=0
router.get('/feed', async (req: any, res: any) => {
  const userId = req.user.id;
  let offset = parseInt((req.query.offset as string) || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;
  const today = todayAEST();

  try {
    const userEmail = (req.user?.email ?? '').toLowerCase();

    // Pre-check profile completeness before attempting any build
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { targetRole: true, targetCity: true, location: true },
    });
    const effectiveCity = profile?.targetCity || profile?.location;
    if (!profile?.targetRole || !effectiveCity) {
      return res.json({ jobs: [], total: 0, hasMore: false, feedDate: today.toISOString().slice(0, 10), profileIncomplete: true });
    }

    // Has ANY feed been built for today? Gates the build trigger independently of
    // exclusions, so a user who acted on everything does not loop-rebuild.
    const builtToday = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });

    if (builtToday === 0) {
      // Gate the BUILD (not the read) — free tier gets 1 lifetime feed build
      const access = await checkAccess(userId, 'job_search', userEmail);
      if (!access.allowed) {
        return res.status(402).json({ error: 'Job search limit reached', upgradeRequired: true, remaining: 0 });
      }
      if (!buildingNow.has(userId)) {
        buildingNow.add(userId);
        buildDailyFeedMultiSource(userId)
          .catch((err: any) => {
            console.error(`[job-feed] Background build failed for ${userId}:`, err.message);
          })
          .finally(() => buildingNow.delete(userId));
      }
      return res.json({
        jobs: [],
        total: 0,
        hasMore: false,
        feedDate: today.toISOString().slice(0, 10),
        building: true,
      });
    }

    // Never show jobs the user applied to or skipped.
    const [appliedRows, skippedRows] = await Promise.all([
      prisma.jobApplication.findMany({ where: { userId, sourceUrl: { not: null } }, select: { sourceUrl: true } }),
      prisma.skippedJob.findMany({ where: { userId }, select: { sourceUrl: true } }),
    ]);
    const excludedUrls = Array.from(new Set<string>([
      ...appliedRows.map(r => r.sourceUrl as string),
      ...skippedRows.map(r => r.sourceUrl),
    ]));

    const where: any = { userId, feedDate: today, skipped: false };
    if (excludedUrls.length > 0) where.sourceUrl = { notIn: excludedUrls };

    const total = await prisma.jobFeedItem.count({ where });
    const items = await prisma.jobFeedItem.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { postedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: 10,
    });

    // Enrich items with application status from the tracker (matched by sourceUrl)
    const applications = await prisma.jobApplication.findMany({
      where: { userId },
      select: { sourceUrl: true, status: true },
    });
    const appStatusMap = new Map(applications.map(a => [a.sourceUrl, a.status]));

    // Kick off bullet generation for any items lacking them, but DON'T block the
    // response on it. The feed renders immediately with skeleton rows; the client
    // polls while bulletsPending and the bullets fill in as they land server-side.
    const nullBulletItems = items.filter(i => i.bullets === null);
    if (nullBulletItems.length > 0) {
      kickoffBulletGeneration(nullBulletItems);
    }

    // Mark as read (fire and forget)
    prisma.jobFeedItem
      .updateMany({
        where: { id: { in: items.map(i => i.id) } },
        data: { isRead: true },
      })
      .catch(() => {/* silent */});

    return res.json({
      jobs: items.map(item => ({
        ...item,
        applicationStatus: appStatusMap.get(item.sourceUrl) ?? null,
      })),
      total,
      hasMore: offset + items.length < total,
      feedDate: today.toISOString().slice(0, 10),
      bulletsPending: nullBulletItems.length > 0,
    });
  } catch (err: any) {
    console.error('[job-feed/feed]', err);
    return res.status(500).json({ error: 'Failed to load job feed' });
  }
});

// POST /api/job-feed/:id/score
router.post('/:id/score', analyzeRateLimit, async (req: any, res: any) => {
  const userId = req.user.id;
  const userEmail = (req.user?.email ?? '').toLowerCase();
  const { id } = req.params;

  try {
    const access = await checkAccess(userId, 'match_score', userEmail);
    if (!access.allowed) {
      return res.status(402).json({ error: 'Match score limit reached', upgradeRequired: true, remaining: 0 });
    }
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    if (item.matchScore !== null) {
      return res.json({ matchScore: item.matchScore, matchDetails: item.matchDetails });
    }

    const result = await scoreJobForFeed(userId, item.description);

    await prisma.jobFeedItem.update({
      where: { id },
      data: { matchScore: result.matchScore, matchDetails: result.matchDetails as any },
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[job-feed/score]', err);
    return res.status(500).json({ error: 'Scoring failed — try again shortly.' });
  }
});

// POST /api/job-feed/:id/find-addressee
router.post('/:id/find-addressee', analyzeRateLimit, async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    // Return cached if already searched (addresseeSource is set even when no name found)
    if (item.addresseeSource !== null) {
      return res.json({
        suggestedAddressee: item.suggestedAddressee,
        addresseeTitle: item.addresseeTitle,
        addresseeConfidence: item.addresseeConfidence,
        addresseeSource: item.addresseeSource,
      });
    }

    const suggestion = await findAddressee(item.company, item.title, item.description);

    const update = suggestion
      ? {
          suggestedAddressee: suggestion.name,
          addresseeTitle: suggestion.title,
          addresseeConfidence: suggestion.confidence,
          addresseeSource: suggestion.source,
        }
      : {
          // Store empty string as sentinel so we don't re-search next time
          suggestedAddressee: '',
          addresseeTitle: '',
          addresseeConfidence: 'low' as const,
          addresseeSource: 'web-search' as const,
        };

    await prisma.jobFeedItem.update({ where: { id }, data: update });

    return res.json({
      suggestedAddressee: suggestion?.name ?? null,
      addresseeTitle: suggestion?.title ?? null,
      addresseeConfidence: suggestion?.confidence ?? null,
      addresseeSource: suggestion?.source ?? null,
    });
  } catch (err: any) {
    console.error('[job-feed/find-addressee]', err);
    return res.json({
      suggestedAddressee: null,
      addresseeTitle: null,
      addresseeConfidence: null,
      addresseeSource: null,
    });
  }
});

// POST /api/job-feed/:id/save
router.post('/:id/save', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });
    if (item.isSaved) return res.status(409).json({ error: 'Already saved' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const jobApp = await prisma.jobApplication.create({
      data: {
        userId,
        candidateProfileId: profile.id,
        title: item.title,
        company: item.company,
        description: item.description,
        sourceUrl: item.sourceUrl,
        notes: `Source: ${item.sourceUrl}`,
        status: 'SAVED',
      },
    });

    await prisma.jobFeedItem.update({ where: { id }, data: { isSaved: true } });

    return res.json({ jobApplicationId: jobApp.id });
  } catch (err: any) {
    console.error('[job-feed/save]', err);
    return res.status(500).json({ error: 'Failed to save job' });
  }
});

// POST /api/job-feed/:id/mark-applied — reconcile the feed item against the tracker
// and ensure it ends up APPLIED. Matches an existing application by sourceUrl first
// (the key the feed read uses), then title+company. Reports whether we created a
// fresh row (likely an external apply) so the client can offer Undo.
router.post('/:id/mark-applied', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;

    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Match by sourceUrl first (what the feed uses to tag applicationStatus), then
    // fall back to title+company for older rows that never stored a sourceUrl.
    let existing = item.sourceUrl
      ? await prisma.jobApplication.findFirst({
          where: { userId, sourceUrl: item.sourceUrl },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    if (!existing) {
      existing = await prisma.jobApplication.findFirst({
        where: { userId, title: item.title, company: item.company },
        orderBy: { createdAt: 'desc' },
      });
    }

    const action = reconcileApplication(existing);

    if (action.kind === 'already_applied') {
      return res.json({
        ok: true,
        jobApplicationId: existing!.id,
        created: false,
        previousStatus: 'APPLIED',
        alreadyApplied: true,
      });
    }

    if (action.kind === 'promote') {
      await prisma.jobApplication.update({
        where: { id: existing!.id },
        data: {
          status: 'APPLIED',
          dateApplied: new Date(),
          // Backfill sourceUrl so future feed reads match this row by URL.
          ...(existing!.sourceUrl ? {} : { sourceUrl: item.sourceUrl }),
        },
      });
      return res.json({
        ok: true,
        jobApplicationId: existing!.id,
        created: false,
        previousStatus: action.previousStatus,
        alreadyApplied: false,
      });
    }

    // action.kind === 'create'
    const jobApp = await prisma.jobApplication.create({
      data: {
        userId,
        candidateProfileId: profile.id,
        title: item.title,
        company: item.company,
        description: item.description,
        sourceUrl: item.sourceUrl,
        notes: `Source: ${item.sourceUrl}`,
        status: 'APPLIED',
        dateApplied: new Date(),
      },
    });
    await prisma.jobFeedItem.update({ where: { id }, data: { isSaved: true } });

    return res.json({
      ok: true,
      jobApplicationId: jobApp.id,
      created: true,
      previousStatus: null,
      alreadyApplied: false,
    });
  } catch (err: any) {
    console.error('[job-feed/mark-applied]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to mark as applied' });
  }
});

// POST /api/job-feed/application/:applicationId/revert — Undo for a just-applied
// job. body.restore === 'DELETE' deletes the row we just created; any other value
// is treated as a status to restore (and clears dateApplied).
router.post('/application/:applicationId/revert', async (req: any, res: any) => {
  const userId = req.user.id;
  const { applicationId } = req.params;
  const restore = String((req.body?.restore ?? '')).trim();

  try {
    if (!(await requirePremium(userId, res))) return;

    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.userId !== userId) return res.status(404).json({ error: 'Not found' });

    if (restore === 'DELETE') {
      await prisma.jobApplication.delete({ where: { id: applicationId } });
      return res.json({ ok: true, deleted: true });
    }

    const allowed = new Set(['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED']);
    if (!allowed.has(restore)) return res.status(400).json({ error: 'Invalid restore status' });

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: restore as any, dateApplied: restore === 'APPLIED' ? new Date() : null },
    });
    return res.json({ ok: true, status: restore });
  } catch (err: any) {
    console.error('[job-feed/revert]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to undo' });
  }
});

// POST /api/job-feed/:id/start-apply — enforce the daily cap and seed the
// application row before the user enters the generation flow.
router.post('/:id/start-apply', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    if (!(await requirePremium(userId, res))) return;

    const userEmail = (req.user?.email ?? '').toLowerCase();
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true, plan: true, planStatus: true, dashboardAccess: true, trialEndDate: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // The daily cap is a TRIAL cost-guard only. Paid/exempt customers are never
    // throttled. Trial-by-default users (free plan + trialEndDate) still get it.
    let used = 0;
    if (!isPaidOrExempt(profile, userEmail)) {
      used = await countTodaysApplications(userId);
      if (used >= DAILY_APPLICATION_CAP) {
        return res.status(429).json({ error: 'DAILY_CAP_REACHED', cap: DAILY_APPLICATION_CAP, used });
      }
    }

    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    // Hydrate SEEK job descriptions (which come as teasers from search results)
    if (item.sourcePlatform === 'seek' && item.description.length < 500) {
      console.log(`[start-apply] Hydrating SEEK job: ${item.id}`);
      try {
        const { firecrawlScrape } = await import('../services/ingestion/firecrawl');
        const { markdown, blocked } = await firecrawlScrape(item.sourceUrl);
        if (!blocked && markdown.length > 500) {
          await prisma.jobFeedItem.update({
            where: { id },
            data: { description: markdown.slice(0, 8000) },
          });
          item.description = markdown.slice(0, 8000);
          console.log(`[start-apply] Hydrated ${item.id}: ${markdown.length} chars`);
        }
      } catch (e: any) {
        console.error(`[start-apply] Hydration failed for ${item.id}:`, e.message);
        // Continue with original description - don't block the apply flow
      }
    }

    // Reuse an existing row for this job if present (avoids duplicates on retry),
    // else create one in SAVED status. mark-applied later flips it to APPLIED.
    let jobApp = await prisma.jobApplication.findFirst({
      where: { userId, title: item.title, company: item.company },
      orderBy: { createdAt: 'desc' },
    });
    if (!jobApp) {
      jobApp = await prisma.jobApplication.create({
        data: {
          userId,
          candidateProfileId: profile.id,
          title: item.title,
          company: item.company,
          description: item.description,
          sourceUrl: item.sourceUrl,
          status: 'SAVED',
        },
      });
    }

    return res.json({ ok: true, jobApplicationId: jobApp.id, used: used + 1, cap: DAILY_APPLICATION_CAP });
  } catch (err: any) {
    console.error('[job-feed/start-apply]', err?.message ?? err);
    return res.status(500).json({ error: 'Could not start the application' });
  }
});

// Job board hostname allowlist for fetch-description SSRF protection
const JOB_BOARD_HOSTS = [
  /^(www\.)?seek\.com\.au$/,
  /^au\.seek\.com$/,  // SEEK Australia uses au.seek.com
  /^(www\.)?linkedin\.com$/,
  /^(www\.)?indeed\.com(\.au)?$/,
  /^(www\.)?jora\.com$/,
  /^(www\.)?apsjobs\.gov\.au$/,
  /^[a-z0-9-]+\.lever\.co$/,
  /^[a-z0-9-]+\.greenhouse\.io$/,
  /^[a-z0-9-]+\.workday\.com$/,
  /^[a-z0-9-]+\.smartrecruiters\.com$/,
];

// POST /api/job-feed/:id/fetch-description — fetch full description from source URL
router.post('/:id/fetch-description', analyzeRateLimit, async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    // Validate sourceUrl hostname to prevent SSRF
    let parsedSource: URL;
    try { parsedSource = new URL(item.sourceUrl); } catch {
      return res.status(422).json({ error: 'Invalid source URL for this listing.' });
    }
    if (!JOB_BOARD_HOSTS.some(p => p.test(parsedSource.hostname))) {
      return res.status(422).json({ error: 'Cannot fetch description from this source.' });
    }

    const response = await axios.get(item.sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
      timeout: 12000,
      maxRedirects: 5,
    });

    let html = response.data as string;

    // Convert block elements to newlines BEFORE stripping tags (preserves structure)
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    // Replace block-level tags with newlines to preserve paragraph breaks
    html = html.replace(/<(\/p|br\s*\/?|div|h[1-6]|li)[^>]*>/gi, '\n');
    // Strip remaining tags
    html = html.replace(/<[^>]+>/g, ' ');
    // Decode entities and normalize whitespace
    html = html
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
      .trim();

    if (html.length < 200) {
      return res.status(422).json({ error: 'Could not extract description from this page. Please open the listing directly.' });
    }

    // No truncation — users need the full job description for tailoring
    const fullDescription = html;

    await prisma.jobFeedItem.update({
      where: { id },
      data: { description: fullDescription },
    });

    return res.json({ description: fullDescription });
  } catch (err: any) {
    console.error('[job-feed/fetch-description]', err.message);
    return res.status(500).json({ error: 'Could not load the full description — open the listing directly and paste the job description.' });
  }
});

// PATCH /api/job-feed/:id/skip  body: { skipped: boolean }
router.patch('/:id/skip', async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  const { skipped } = req.body;
  const item = await prisma.jobFeedItem.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: 'Job not found' });

  await prisma.jobFeedItem.update({
    where: { id },
    data: { skipped: !!skipped, skippedAt: skipped ? new Date() : null },
  });

  if (skipped) {
    // Durable skip keyed by sourceUrl so it survives daily feed rebuilds.
    await prisma.skippedJob.upsert({
      where: { userId_sourceUrl: { userId, sourceUrl: item.sourceUrl } },
      update: {
        skippedAt: new Date(),
        title: item.title,
        company: item.company,
        location: item.location,
        postedAt: item.postedAt,
      },
      create: {
        userId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        company: item.company,
        location: item.location,
        postedAt: item.postedAt,
      },
    });
  } else {
    // Undo — drop the durable record so the job can return to the feed.
    await prisma.skippedJob.deleteMany({ where: { userId, sourceUrl: item.sourceUrl } });
  }

  res.json({ ok: true, skipped: !!skipped });
});

// GET /api/job-feed/skipped — durable list of jobs the user skipped
router.get('/skipped', async (req: any, res: any) => {
  const userId = req.user.id as string;
  try {
    const items = await prisma.skippedJob.findMany({
      where: { userId },
      orderBy: { skippedAt: 'desc' },
      take: 100,
    });
    return res.json({ jobs: items });
  } catch (err: any) {
    console.error('[job-feed/skipped]', err.message);
    return res.status(500).json({ error: 'Failed to load skipped jobs' });
  }
});

// POST /api/job-feed/skipped/restore  body: { sourceUrl } — undo a skip
router.post('/skipped/restore', async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { sourceUrl } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl required' });
  try {
    await prisma.skippedJob.deleteMany({ where: { userId, sourceUrl } });
    // If today's feed still has this row, un-skip it so it reappears immediately.
    await prisma.jobFeedItem.updateMany({
      where: { userId, sourceUrl },
      data: { skipped: false, skippedAt: null },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[job-feed/skipped/restore]', err.message);
    return res.status(500).json({ error: 'Failed to restore job' });
  }
});

export default router;
