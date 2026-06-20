import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { checkAccess, hasActiveAccess, isPaidOrExempt } from '../middleware/accessControl';
import { DAILY_APPLICATION_CAP, countTodaysApplications } from '../services/applicationCap';
import {
  findAddressee,
  todayAEST,
  type RawJob,
} from '../services/jobFeed';
import { scoreJobForFeed } from '../services/jobAnalysis';
import { reconcileApplication } from '../lib/applicationReconcile';
import { scrapeJobsForTitles, type ScrapeResult } from '../services/userJobScrape';
import { runIngestionForTitle } from '../services/ingestion/runIngestion';
import { fetchJobDescription } from '../services/ingestion/firecrawl';
import { normalizeLocation } from '../services/ingestion/locationNormalize';
import type { SourceReport } from '../services/ingestion/types';

const router = Router();

// Tracks which userIds have a feed build currently in flight
const buildingNow = new Set<string>();

// Records the feedDate (YYYY-MM-DD) of the most recent COMPLETED build per user.
// When a build finishes with zero results, builtToday stays 0; without this marker
// GET /feed would keep returning building:true forever. With it, we return an
// "empty" state ("No listings found") once the build has actually completed.
const lastBuildCompleted = new Map<string, string>();



// FAST: Scrape all 3 roles in parallel, keep top 10 jobs
async function buildDailyFeedMultiSource(userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetRoles: true, targetCity: true, location: true, skills: true },
  });

  const effectiveCity = normalizeLocation(profile?.targetCity || profile?.location);
  if (!profile?.targetRole || !effectiveCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  // Use targetRoles (3 roles from CV scan), fallback to single targetRole
  const rolesArray: string[] = Array.isArray(profile.targetRoles) && profile.targetRoles.length > 0
    ? (profile.targetRoles as string[])
    : [profile.targetRole];

  const today = todayAEST();
  console.log(`[job-feed] FAST build for ${userId}, roles:`, rolesArray);

  // Scrape ALL roles in parallel
  const start = Date.now();
  const allScrapes = await Promise.all(
    rolesArray.map(role =>
      scrapeJobsForTitles([role], effectiveCity)
        .catch(e => {
          console.error(`[job-feed] Scrape failed for "${role}":`, e.message);
          return { jobs: [] as RawJob[], reports: [] as SourceReport[] };
        })
    )
  );

  // Merge all jobs, dedupe by URL
  const seenUrls = new Set<string>();
  let allJobs: RawJob[] = [];

  for (const scrape of allScrapes) {
    for (const job of scrape.jobs) {
      if (!seenUrls.has(job.sourceUrl)) {
        seenUrls.add(job.sourceUrl);
        allJobs.push(job);
      }
      // Stop collecting once we have 15
      if (allJobs.length >= 15) break;
    }
    if (allJobs.length >= 15) break;
  }

  console.log(`[job-feed] Scraped ${allJobs.length} unique jobs in ${Date.now() - start}ms`);

  if (allJobs.length === 0) {
    console.log('[job-feed] No jobs found');
    return;
  }

  // Score and take top 10
  const skills = profile.skills;
  const scoredJobs = allJobs
    .map(j => ({ ...j, matchScore: quickScore(skills, j) }))
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 10);

  // Insert to DB
  await prisma.jobFeedItem.createMany({
    data: scoredJobs.map(j => ({
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

  console.log(`[job-feed] Inserted ${scoredJobs.length} jobs for user`);
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
      // Clear any prior "completed empty" marker so this forced rebuild scrapes fresh.
      lastBuildCompleted.delete(userId);
      buildDailyFeedMultiSource(userId).finally(() => {
        buildingNow.delete(userId);
        lastBuildCompleted.set(userId, today.toISOString().slice(0, 10));
      });
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
    const effectiveCity = normalizeLocation(profile?.targetCity || profile?.location);
    console.log(`[job-feed/feed] userId=${userId}, targetRole=${profile?.targetRole}, targetCity=${profile?.targetCity}, location=${profile?.location}, effectiveCity=${effectiveCity}`);
    if (!profile?.targetRole || !effectiveCity) {
      return res.json({ jobs: [], total: 0, hasMore: false, feedDate: today.toISOString().slice(0, 10), profileIncomplete: true });
    }

    // Has ANY feed been built for today? Gates the build trigger independently of
    // exclusions, so a user who acted on everything does not loop-rebuild.
    const builtToday = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });

    if (builtToday === 0) {
      const feedDateStr = today.toISOString().slice(0, 10);
      // A build already finished today and produced nothing — surface the empty
      // state ("No listings found") instead of spinning on building:true forever.
      if (lastBuildCompleted.get(userId) === feedDateStr && !buildingNow.has(userId)) {
        return res.json({ jobs: [], total: 0, hasMore: false, feedDate: feedDateStr, building: false });
      }
      // Only evaluate access + trigger a build when one isn't already running for
      // this user, so the frontend's poll loop doesn't re-check access every tick.
      if (!buildingNow.has(userId)) {
        // Gate the BUILD (not the read) — free tier gets 1 lifetime feed build
        const access = await checkAccess(userId, 'job_search', userEmail);
        if (!access.allowed) {
          return res.status(402).json({ error: 'Job search limit reached', upgradeRequired: true, remaining: 0 });
        }
        buildingNow.add(userId);
        buildDailyFeedMultiSource(userId)
          .catch((err: any) => {
            console.error(`[job-feed] Background build failed for ${userId}:`, err.message);
          })
          .finally(() => {
            buildingNow.delete(userId);
            lastBuildCompleted.set(userId, feedDateStr);
          });
      }
      return res.json({
        jobs: [],
        total: 0,
        hasMore: false,
        feedDate: feedDateStr,
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

    // Hydrate thin descriptions so the resume + cover letter generator always gets
    // the FULL posting, for ANY source — not just SEEK. Search results give teasers,
    // and Adzuna's API caps its description at 500 chars; the full text only lives on
    // the listing page. Validate the host against the same allowlist the view path
    // uses, then scrape + clean once and persist.
    const HYDRATE_BELOW_CHARS = 1500;
    if (item.description.length < HYDRATE_BELOW_CHARS) {
      let host: string | null = null;
      try { host = new URL(item.sourceUrl).hostname; } catch { host = null; }
      if (host && JOB_BOARD_HOSTS.some(p => p.test(host as string))) {
        console.log(`[start-apply] Hydrating ${item.sourcePlatform} job ${item.id} (had ${item.description.length} chars)`);
        try {
          const { description: full, blocked } = await fetchJobDescription(item.sourceUrl);
          if (!blocked && full.length > item.description.length) {
            const trimmed = full.slice(0, 8000);
            await prisma.jobFeedItem.update({ where: { id }, data: { description: trimmed } });
            item.description = trimmed;
            console.log(`[start-apply] Hydrated ${item.id}: ${full.length} chars`);
          }
        } catch (e: any) {
          console.error(`[start-apply] Hydration failed for ${item.id}:`, e.message);
          // Continue with original description - don't block the apply flow
        }
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
    } else if (item.description.length > (jobApp.description?.length ?? 0)) {
      // Reused row from an earlier apply — keep its stored JD in sync with the
      // freshly hydrated full description so the tracker/record isn't left thin.
      jobApp = await prisma.jobApplication.update({
        where: { id: jobApp.id },
        data: { description: item.description },
      });
    }

    // Return the (possibly hydrated) description so the generator's JD panel is
    // filled with the full posting, not the truncated card teaser.
    return res.json({
      ok: true,
      jobApplicationId: jobApp.id,
      description: item.description,
      used: used + 1,
      cap: DAILY_APPLICATION_CAP,
    });
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
  /^au\.linkedin\.com$/,  // LinkedIn AU
  /^(www\.)?indeed\.com(\.au)?$/,
  /^au\.indeed\.com$/,  // Indeed AU uses au.indeed.com
  /^(www\.)?jora\.com$/,
  /^au\.jora\.com$/,  // Jora AU uses au.jora.com
  /^(www\.)?apsjobs\.gov\.au$/,
  /^(www\.)?adzuna\.com\.au$/,
  /^[a-z0-9-]+\.lever\.co$/,
  /^[a-z0-9-]+\.greenhouse\.io$/,
  /^[a-z0-9-]+\.workday\.com$/,
  /^[a-z0-9-]+\.smartrecruiters\.com$/,
];

// POST /api/job-feed/:id/fetch-description — fetch full description from source URL
// Uses Firecrawl for reliable extraction with JS rendering support
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

    // Use Firecrawl for reliable extraction with JS rendering
    const { description, blocked } = await fetchJobDescription(item.sourceUrl);

    if (blocked || !description) {
      return res.status(422).json({ error: 'Could not extract description from this page. Please open the listing directly.' });
    }

    await prisma.jobFeedItem.update({
      where: { id },
      data: { description },
    });

    return res.json({ description });
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
