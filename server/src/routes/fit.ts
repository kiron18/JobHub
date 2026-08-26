/**
 * /api/fit — "See how well your resume fits this job"
 *
 * The free tier's second step. Onboarding already took their resume and built
 * a profile from it; this is what they do next, and it is the whole reason the
 * free tier exists. One paste, one honest answer.
 *
 *   POST /check        Run a fit report on a pasted ad, save it against the job
 *   GET  /jobs         The jobs they have checked, newest first
 *   GET  /jobs/:id     One saved report, reopened without a second LLM call
 *
 * A check writes a JobApplication row at status SAVED. That is deliberate: a
 * free user's checked jobs are already sitting in the tracker on the day they
 * pay, rather than being a throwaway list they have to rebuild.
 */
import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import { runFitReport, FitReportError, type FitReport } from '../services/fitReport';
import { fetchSeekJobFromUrl, SeekUrlError } from '../services/seekJobUrl';
import { findDuplicateApplication } from '../services/duplicateDetection';

const router = Router();

router.use(authenticate, analyzeRateLimit);

/** Longest ad we will accept from the client, before scrubbing and truncation. */
const MAX_PASTE_CHARS = 60_000;

/**
 * A title we can put in a list. The model is asked for the ad's own wording and
 * returns null when the ad never says, which is common in agency listings, so
 * this is the fallback rather than a guess dressed up as a fact.
 */
function displayTitle(report: FitReport): string {
  return report.jobTitle ?? 'Untitled role';
}

// ── POST /api/fit/check ───────────────────────────────────────────────────────
router.post('/check', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { jobDescription, url } = req.body as { jobDescription?: string; url?: string };

  let jobText = (jobDescription ?? '').trim();
  let sourceUrl: string | null = (url ?? '').trim() || null;

  // A Seek link is the one URL shape we can read reliably, and it is what most
  // people have in the clipboard. Anything else has to be pasted as text.
  if (!jobText && sourceUrl) {
    try {
      const job = await fetchSeekJobFromUrl(sourceUrl);
      jobText = job.description;
      sourceUrl = job.sourceUrl ?? sourceUrl;
    } catch (err) {
      const message =
        err instanceof SeekUrlError
          ? err.message
          : 'We could not open that link. Copy the job ad text and paste it instead.';
      return res.status(400).json({ error: message });
    }
  }

  if (!jobText || jobText.length < 100) {
    return res.status(400).json({ error: 'Paste the full job ad so we have something to read.' });
  }
  if (jobText.length > MAX_PASTE_CHARS) {
    jobText = jobText.slice(0, MAX_PASTE_CHARS);
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true, resumeRawText: true, resumeOriginalText: true },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Upload your resume first.', needsResume: true });
  }

  // resumeRawText is the clean rebuilt resume every generation grounds on, so
  // it is what they would actually send. The original upload is the fallback
  // for anyone whose profile predates the rebuild.
  const resumeText = profile.resumeRawText || profile.resumeOriginalText;

  try {
    const { report, requirements, flagged, ms } = await runFitReport(resumeText, jobText);

    // Checking the same ad twice should update the row, not grow the list. The
    // existing detector needs a company name, so an ad that never named one
    // simply creates a new row rather than merging into an unrelated job.
    const duplicate = report.company
      ? await findDuplicateApplication({
          userId,
          company: report.company,
          role: displayTitle(report),
        })
      : null;

    const data = {
      title: displayTitle(report),
      company: report.company,
      description: jobText,
      sourceUrl,
      fitReport: report as unknown as object,
      fitScore: report.fit,
      fitCheckedAt: new Date(),
    };

    const job = duplicate
      ? await prisma.jobApplication.update({ where: { id: duplicate.applicationId }, data })
      : await prisma.jobApplication.create({
          data: { ...data, userId, candidateProfileId: profile.id, status: 'SAVED' },
        });

    console.log(
      `[fit] user=${userId} job=${job.id} fit=${report.fit} band=${report.band} ` +
      `reqs=${requirements.length} ${(ms / 1000).toFixed(1)}s` +
      (flagged.length ? ` scrubbed=${flagged.length}` : ''),
    );

    return res.json({
      jobId: job.id,
      report,
      // The ad as we actually read it. A Seek link is resolved here, so without
      // this the screen would carry the link forward into generation and the
      // generator would be handed a URL where a job advert should be.
      jobDescription: jobText,
      // Told rather than hidden: someone who checks a job they already applied
      // to should know that, not silently overwrite their own record.
      alreadyTracked: duplicate ? { status: duplicate.status, dateApplied: duplicate.dateApplied } : null,
    });
  } catch (err) {
    if (err instanceof FitReportError) {
      const status = err.code === 'NO_RESUME' ? 404 : 400;
      return res.status(status).json({ error: err.message, needsResume: err.code === 'NO_RESUME' });
    }
    console.error('[fit] check failed:', err);
    return res.status(500).json({ error: 'The fit check did not finish. Try again in a moment.' });
  }
});

// ── GET /api/fit/jobs ─────────────────────────────────────────────────────────
router.get('/jobs', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const jobs = await prisma.jobApplication.findMany({
      where: { userId, fitCheckedAt: { not: null } },
      orderBy: { fitCheckedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        company: true,
        sourceUrl: true,
        status: true,
        fitScore: true,
        fitCheckedAt: true,
        fitReport: true,
      },
    });

    return res.json({
      jobs: jobs.map((j) => ({
        ...j,
        band: (j.fitReport as { band?: string } | null)?.band ?? null,
        // The list only needs the headline. The full report is one click away.
        fitReport: undefined,
      })),
    });
  } catch (err) {
    console.error('[fit] jobs fetch failed:', err);
    return res.status(500).json({ error: 'Could not load your jobs.' });
  }
});

// ── GET /api/fit/jobs/:id ─────────────────────────────────────────────────────
router.get('/jobs/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const job = await prisma.jobApplication.findFirst({
      where: { id: String(req.params.id), userId },
      select: {
        id: true, title: true, company: true, sourceUrl: true,
        status: true, fitReport: true, fitCheckedAt: true,
      },
    });

    if (!job || !job.fitReport) {
      return res.status(404).json({ error: 'No fit report for that job.' });
    }
    return res.json({ ...job, report: job.fitReport, fitReport: undefined });
  } catch (err) {
    console.error('[fit] job fetch failed:', err);
    return res.status(500).json({ error: 'Could not load that report.' });
  }
});

export default router;
