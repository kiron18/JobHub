import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { ipRateLimit } from '../middleware/ipRateLimit';
import { extractTextFromBuffer } from '../services/pdf';
import { detectAtsStructure } from '../lib/atsStructure';
import { runCvGapScan, runRoadmap, CvGapResult } from '../services/cvGapScan';
import { prisma } from '../index';
import { sendRoadmapEmail } from '../services/email';
import { authenticate, AuthRequest } from '../middleware/auth';
import type { RawJob } from '../services/jobFeed';
import { suggestJobTitles } from '../services/jobTitleSuggest';
import { scrapeJobsForTitles } from '../services/userJobScrape';
import { todayAEST } from '../services/jobFeed';
import { parseResumeToStructure, persistExtracted, autoExtractAchievements, type ParsedResume } from '../services/autoExtract';

const router = Router();

// ── Multer setup (same pattern as onboarding.ts) ─────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/octet-stream',
    ];
    const ext = file.originalname.toLowerCase();
    const allowedExt = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt');
    if (allowedMimes.includes(file.mimetype) || allowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and plain-text files are accepted'));
    }
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.fields([{ name: 'resume', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 5MB.' : err.message)
        : err.message;
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

// ── In-memory scan result cache (hash → result, avoids re-running LLM) ──────

const resultCache = new Map<string, { result: CvGapResult; at: number }>();
const RESULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Scan store (scanId → resumeText + result, for later roadmap generation) ──

interface ScanStoreEntry {
  resumeText: string;
  result: CvGapResult;
  filename: string | null;
  at: number;
}
const scanStore = new Map<string, ScanStoreEntry>();
const SCAN_STORE_TTL = 60 * 60 * 1000; // 60 minutes

function trimScanStore() {
  if (scanStore.size <= 100) return;
  const sorted = [...scanStore.entries()].sort((a, b) => b[1].at - a[1].at);
  scanStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) scanStore.set(k, v);
}

// ── Job scrape store (titles + background scrape, keyed by scanId) ──────────

type ScrapeStatus = 'pending' | 'ready' | 'error';
interface ScrapeEntry { requestId: string; status: ScrapeStatus; titles: string[]; location: string; jobs: RawJob[]; error: string | null; at: number; }
const jobScrapeStore = new Map<string, ScrapeEntry>();

function trimJobScrapeStore() {
  if (jobScrapeStore.size <= 100) return;
  const sorted = [...jobScrapeStore.entries()].sort((a, b) => b[1].at - a[1].at);
  jobScrapeStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) jobScrapeStore.set(k, v);
}

function normalizeTitles(t: unknown): string[] {
  const arr = Array.isArray(t) ? t : [];
  const cleaned = arr.map(x => String(x).trim()).filter(Boolean);
  return [...new Set(cleaned)].slice(0, 3);
}

function fireScrape(scanId: string, titles: string[], location: string) {
  const requestId = randomUUID();
  jobScrapeStore.set(scanId, { requestId, status: 'pending', titles, location, jobs: [], error: null, at: Date.now() });
  trimJobScrapeStore();
  scrapeJobsForTitles(titles, location)
    .then(result => { const e = jobScrapeStore.get(scanId); if (e && e.requestId === requestId) jobScrapeStore.set(scanId, { ...e, status: 'ready', jobs: result.jobs, at: Date.now() }); })
    .catch(err => { const e = jobScrapeStore.get(scanId); if (e && e.requestId === requestId) jobScrapeStore.set(scanId, { ...e, status: 'error', error: err?.message ?? 'scrape failed', at: Date.now() }); });
}

// ── Resume parse store — runs the slow LLM resume parse during the scan so the
// structured bank can be persisted instantly at claim, keeping the funnel snappy ──

type ParseStatus = 'pending' | 'ready' | 'error';
interface ParseEntry { status: ParseStatus; parsed: ParsedResume | null; at: number; }
const resumeParseStore = new Map<string, ParseEntry>();

function trimResumeParseStore() {
  if (resumeParseStore.size <= 100) return;
  const sorted = [...resumeParseStore.entries()].sort((a, b) => b[1].at - a[1].at);
  resumeParseStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) resumeParseStore.set(k, v);
}

// Fire-and-forget: parse the resume into structured data in the background, keyed
// by scanId. Overlaps with the user reading the reveal + entering email/password,
// so the bank is ready to persist by the time they reach claim. Never blocks.
function fireResumeParse(scanId: string, resumeText: string) {
  resumeParseStore.set(scanId, { status: 'pending', parsed: null, at: Date.now() });
  trimResumeParseStore();
  parseResumeToStructure(resumeText)
    .then(parsed => { resumeParseStore.set(scanId, { status: 'ready', parsed, at: Date.now() }); })
    .catch(err => {
      console.warn('[cv-scan/parse] background resume parse failed (non-fatal):', err?.message);
      resumeParseStore.set(scanId, { status: 'error', parsed: null, at: Date.now() });
    });
}

function buildScanResponse(scanId: string, result: CvGapResult) {
  return {
    scanId,
    score: result.score,
    inferredRole: result.inferredRole,
    firstName: result.firstName,
    fullName: result.fullName,
    items: result.items,
    quickWins: result.quickWins,
    // Narrative layer for the reveal. These were being dropped here, so the
    // client always fell back to the hardcoded "Easy to overlook" default and
    // the relief/translation beats lost their CV-specific context.
    firstImpression: result.firstImpression,
    reassurance: result.reassurance,
    hiringManager: result.hiringManager,
    culturalTranslations: result.culturalTranslations,
    lockedGapCount: 7,
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  ipRateLimit,
  handleUpload,
  async (req: Request, res: Response) => {
    try {
      const file = (req.files as any)?.resume?.[0];
      if (!file) {
        res.status(400).json({ error: 'Resume file is required' });
        return;
      }

      const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
      if (!text || text.trim().length < 200) {
        res.status(422).json({ error: 'Could not read enough text from that file. Try a text-based PDF or DOCX.' });
        return;
      }

      // Deterministic ATS-layout check from the raw file (text boxes, tables,
      // images, reading order) so the scan can flag format problems the text
      // alone cannot reveal. Non-fatal — on any failure it reports no risk.
      const ats = await detectAtsStructure(file.buffer, file.mimetype, file.originalname, text)
        .catch(() => ({ risk: false, reasons: [] as string[] }));

      const hash = crypto.createHash('sha256').update(`${text} ${ats.reasons.join('|')}`).digest('hex');
      const cached = resultCache.get(hash);
      if (cached && Date.now() - cached.at < RESULT_CACHE_TTL) {
        const result = cached.result;
        // Guard: old cache entries may be missing fields from a schema version change
        if ((result as any).quickWins && (result as any).firstName !== undefined) {
          const scanId = randomUUID();
          scanStore.set(scanId, { resumeText: text, result, filename: file.originalname ?? null, at: Date.now() });
          trimScanStore();
          fireResumeParse(scanId, text);
          res.json(buildScanResponse(scanId, result));
          return;
        }
        // Stale schema — fall through and re-scan
      }

      const result = await runCvGapScan(text, ats);
      resultCache.set(hash, { result, at: Date.now() });

      // Trim cache to newest 50 entries on write
      if (resultCache.size > 50) {
        const sorted = [...resultCache.entries()].sort((a, b) => b[1].at - a[1].at);
        resultCache.clear();
        for (const [k, v] of sorted.slice(0, 50)) {
          resultCache.set(k, v);
        }
      }

      // Store in scanStore for later roadmap generation
      const scanId = randomUUID();
      scanStore.set(scanId, { resumeText: text, result, filename: file.originalname ?? null, at: Date.now() });
      trimScanStore();
      // Kick off the structured resume parse now so the bank is ready by claim.
      fireResumeParse(scanId, text);

      res.json(buildScanResponse(scanId, result));
    } catch (err) {
      console.error('[cv-scan] error:', err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err), err instanceof Error ? err.stack : '');
      res.status(502).json({ error: 'Scan failed, please try again.' });
    }
  },
);

// ── §C – POST /api/cv-scan/lead ──────────────────────────────────────────────

router.post(
  '/lead',
  ipRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { scanId, email } = req.body || {};

      // 1. Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        res.status(400).json({ error: 'Enter a valid email' });
        return;
      }

      // 2. Look up scan store
      const entry = scanStore.get(scanId);
      if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) {
        res.status(410).json({ error: 'Your scan expired — please scan again.' });
        return;
      }

      // 3. Generate roadmap
      const roadmap = await runRoadmap(entry.resumeText, entry.result.firstName || '');

      // 4. Upsert lead row
      await prisma.cvScanLead.upsert({
        where: { email },
        create: {
          email,
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
        update: {
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
      });

      // 5. Fire email (await but don't fail request if it throws)
      try {
        await sendRoadmapEmail(email, entry.result.firstName || '', entry.result, roadmap);
      } catch (emailErr) {
        console.error('[cv-scan/lead] email send failed (request continues):', emailErr instanceof Error ? emailErr.message : String(emailErr));
      }

      // 6. Return roadmap
      res.json({ roadmap });
    } catch (err) {
      console.error('[cv-scan/lead]', err instanceof Error ? `${err.name}: ${err.message}` : String(err), err instanceof Error ? err.stack : '');
      res.status(502).json({ error: 'Could not build your roadmap, please try again.' });
    }
  },
);

// ── Slice A — Account seam (job-titles, scrape-jobs, claim) ─────────────────

// Safety ceiling only. The scrape is fired in parallel at modal-open and warms
// while the user reads the modal and types a password, so by claim time it is
// almost always already 'ready' and this returns instantly. 45s is the bound for
// a cold worst case, not the expected wait.
async function waitForScrape(scanId: string, maxMs = 45_000): Promise<RawJob[]> {
  const start = Date.now();
  for (;;) {
    const e = jobScrapeStore.get(scanId);
    if (e && e.status === 'ready') return e.jobs;
    if (e && e.status === 'error') return [];
    if (Date.now() - start >= maxMs) return e?.jobs ?? [];
    await new Promise(r => setTimeout(r, 1000));
  }
}

router.post('/job-titles', ipRateLimit, async (req, res) => {
  try {
    const { scanId } = req.body || {};
    const entry = scanStore.get(scanId);
    if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }
    const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result);
    const loc = location ?? 'All Australia';
    fireScrape(scanId, titles, loc);
    res.json({ titles, location: loc, firstName: entry.result.firstName ?? '' });
  } catch (err) {
    console.error('[cv-scan/job-titles]', err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: 'Could not suggest roles, please try again.' });
  }
});

router.post('/scrape-jobs', ipRateLimit, (req, res) => {
  const { scanId, titles, location } = req.body || {};
  if (!scanStore.has(scanId)) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }
  fireScrape(scanId, normalizeTitles(titles), String(location || '').trim() || 'All Australia');
  res.json({ status: 'started' });
});

router.get('/scrape-jobs', (req, res) => {
  const e = jobScrapeStore.get(String(req.query.scanId || ''));
  if (!e) { res.json({ status: 'pending', count: 0 }); return; }
  res.json({ status: e.status, count: e.jobs.length });
});

router.post('/claim', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email ?? null;
    const { scanId, titles, location } = req.body || {};
    const entry = scanStore.get(scanId);
    if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) { res.status(410).json({ error: 'Your scan expired, please scan again.' }); return; }

    const cleanTitles = normalizeTitles(titles);
    const loc = String(location || '').trim() || null;
    const targetRole = cleanTitles[0] || entry.result.inferredRole || null;
    const targetRoles = cleanTitles.length > 0 ? cleanTitles : (targetRole ? [targetRole] : []);

    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const profileData = {
      trialEndDate,
      email,
      name: entry.result.fullName || null,
      resumeRawText: entry.resumeText,
      resumeFilename: entry.filename,
      documentsUpdatedAt: new Date(),
      targetRole,
      targetRoles,
      targetCity: loc,
      location: loc,
      hasCompletedOnboarding: true,
      marketingConsent: true,
      marketingEmail: email,
    };
    console.log(`[cv-scan/claim] userId=${userId}, loc=${loc}, targetRole=${targetRole}`);
    // When we re-bind an existing-by-email profile, its structured bank belongs to
    // a previous resume. The freshly claimed resume is authoritative, so we force a
    // full bank replace below instead of letting the persist guards keep stale rows.
    let rebondExistingProfile = false;
    try {
      const existingProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
      console.log(`[cv-scan/claim] existingProfile:`, existingProfile ? { targetCity: existingProfile.targetCity, location: existingProfile.location } : 'none');
      const result = await prisma.candidateProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });
      console.log(`[cv-scan/claim] upsert result: targetCity=${result.targetCity}, location=${result.location}`);
    } catch (e) {
      // email is @unique: a returning user already has a profile under this email
      // (different userId). Migrate that profile onto the current account rather
      // than 502, which would dump them back into onboarding.
      if ((e as { code?: string })?.code === 'P2002' && email) {
        await prisma.candidateProfile.update({
          where: { email },
          data: { userId, ...profileData },
        });
        rebondExistingProfile = true;
      } else {
        throw e;
      }
    }

    // Populate the structured bank (achievements/experience/education) so the
    // /apply generation pipeline has rich inputs. Fire-and-forget: never block
    // the user landing on the dashboard. Prefer the parse that ran during the
    // scan; fall back to a full background extract if it isn't ready.
    const parseEntry = resumeParseStore.get(scanId);
    if (parseEntry?.status === 'ready' && parseEntry.parsed) {
      persistExtracted(userId, parseEntry.parsed, { replace: rebondExistingProfile }).catch(err => console.warn('[cv-scan/claim] persistExtracted failed (non-fatal):', err?.message));
    } else {
      autoExtractAchievements(userId, entry.resumeText, { replace: rebondExistingProfile }).catch(err => console.warn('[cv-scan/claim] autoExtract failed (non-fatal):', err?.message));
    }

    // make sure the head-start scrape exists; if the modal never fired it, fire now.
    if (!jobScrapeStore.has(scanId) && cleanTitles.length) fireScrape(scanId, cleanTitles, loc || 'All Australia');
    const jobs = await waitForScrape(scanId);

    // feedDate = AEST today, matching jobFeed.ts (reuse its exported helper).
    const today = todayAEST();
    await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });
    if (jobs.length) {
      await prisma.jobFeedItem.createMany({
        data: jobs.map(j => ({
          userId, feedDate: today,
          title: j.title, company: j.company, location: j.location, salary: j.salary,
          description: j.description, sourceUrl: j.sourceUrl, sourcePlatform: j.sourcePlatform,
          postedAt: j.postedAt, matchScore: null,
        })),
      });
    }
    // Hand the first job back so the dashboard can preload it into the apply box
    // instantly, without waiting on the (slow) feed read.
    const f = jobs[0];
    const firstJob = f
      ? { title: f.title, company: f.company, location: f.location, description: f.description, sourceUrl: f.sourceUrl, sourcePlatform: f.sourcePlatform }
      : null;
    res.json({ jobCount: jobs.length, firstJob });
  } catch (err) {
    console.error('[cv-scan/claim]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not set up your workspace, please try again.' });
  }
});

export { router as cvScanRouter };
