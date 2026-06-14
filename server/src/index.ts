import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from './db';
export { prisma };

// Routers
import extractRouter from './routes/extract';
import analyzeRouter from './routes/analyze';
import aiToolsRouter from './routes/ai-tools';
import documentQaRouter from './routes/document-qa';
import generateRouter from './routes/generate';
import profileRouter from './routes/profile/index';
import documentsRouter from './routes/documents';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import researchRouter from './routes/research';
import feedbackRouter from './routes/feedback';
import linkedinRouter from './routes/linkedin';
import webhooksRouter from './routes/webhooks';
import skoolRouter from './routes/skool';
import jobFeedRouter from './routes/job-feed';
import adminRouter from './routes/admin';
import adminFunnelRouter from './routes/admin-funnel';
import stripeRouter, { stripeWebhookHandler } from './routes/stripe';
import enrichmentRouter from './routes/enrichment';
import insightsRouter from './routes/insights';
import sponsorsRouter, { loadFilterCache as loadSponsorFilterCache } from './routes/sponsors';
import { cvScanRouter } from './routes/cv-scan';
import { startJobFeedCron } from './cron/jobFeedCron';
import { startSponsorJobScanCron } from './cron/sponsorJobScanCron';
import { startTrialReminderCron } from './cron/trialReminderCron';
import { startFollowUpReminderCron } from './cron/followUpReminderCron';
import { analyzeRateLimit } from './middleware/analyzeRateLimit';
import { ensureSponsorJobTable } from './db/ensureSponsorJobTable';
import { ensureEmailTables } from './db/ensureEmailTables';
import { seedTags, seedTemplates, seedSequences } from './email/admin/seedData';
import { startSequenceCron } from './cron/sequenceCron';
import { linkCandidateProfiles } from './email/sync/linkCandidateProfiles';
import emailOpenRouter from './email/tracking/openTracker';
import emailClickRouter from './email/tracking/clickTracker';
import emailContactRouter from './email/admin/contactRoutes';
import emailTagRouter from './email/admin/tagRoutes';
import emailBroadcastRouter from './email/admin/broadcastRoutes';
import emailAnalyticsRouter from './email/admin/analyticsRoutes';

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN, // only active when DSN is set
  tracesSampleRate: 0.1,
});

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3002;

const staticOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : [];

const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true);
      // Explicit allowlist from env
      if (staticOrigins.includes(origin)) return cb(null, true);
      // Allow any Vercel preview deployment
      if (/^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/.test(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true);
      // Allow production custom domains (.com and .com.au)
      if (/^https?:\/\/(www\.)?aussiegradcareers\.com(\.au)?$/.test(origin)) return cb(null, true);
      // Allow localhost in any form
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      // Reject with null (not an Error) so Express does NOT call the 500 error handler.
      // The cors package will simply omit the Access-Control-Allow-Origin header,
      // causing the browser to block the request with a CORS error — not a 500.
      console.warn(`[CORS] Blocked origin: ${origin}`);
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
};
app.use(cors(corsOptions));

// Stripe webhook — raw body required for signature verification, must be before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const isDev = process.env.NODE_ENV !== 'production';

// In dev only: mirror console output to a local log file for easy tailing.
// In production Railway captures stdout natively; no file needed.
if (isDev) {
  const logFile = path.join(__dirname, '../server.log');
  const originalLog = console.log.bind(console);
  const originalErr = console.error.bind(console);

  const fileAppend = (msg: string) => {
    try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch {}
  };

  console.log = (...args: any[]) => {
    fileAppend(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalLog(...args);
  };

  console.error = (...args: any[]) => {
    fileAppend(`[ERR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalErr(...args);
  };
}

// Request timing log (stdout only — works in both envs)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/analyze', aiToolsRouter);
app.use('/api/analyze', documentQaRouter);
app.use('/api/extract', extractRouter);
app.use('/api/generate', generateRouter);
app.use('/api', profileRouter);
app.use('/api', documentsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/research', researchRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/linkedin', linkedinRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/skool', skoolRouter);
app.use('/api/job-feed', jobFeedRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/funnel', adminFunnelRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/enrichment', enrichmentRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/sponsors', sponsorsRouter);
app.use('/api/cv-scan', cvScanRouter);
app.use('/api', emailOpenRouter);
app.use('/api', emailClickRouter);
app.use('/api', emailContactRouter);
app.use('/api', emailTagRouter);
app.use('/api', emailBroadcastRouter);
app.use('/api', emailAnalyticsRouter);

// Sentry error handler - must be before any other error handling middleware
Sentry.setupExpressErrorHandler(app);

// Final error handler - must be after all routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err.message, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

async function ensureColumns() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "JobApplication"
        ADD COLUMN IF NOT EXISTS "australianFlags" JSONB,
        ADD COLUMN IF NOT EXISTS "dimensions" JSONB,
        ADD COLUMN IF NOT EXISTS "matchedIdentityCard" TEXT,
        ADD COLUMN IF NOT EXISTS "overallGrade" TEXT,
        ADD COLUMN IF NOT EXISTS "followUpSentAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "companyIntel" JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Document"
        ADD COLUMN IF NOT EXISTS "qualitySignals" JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "CandidateProfile"
        ADD COLUMN IF NOT EXISTS "achievementCountAtDerivation" INTEGER,
        ADD COLUMN IF NOT EXISTS "identityCards" JSONB,
        ADD COLUMN IF NOT EXISTS "identityCardsUpdatedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "profileAdvisorCallsToday" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "profileAdvisorCallsDate" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "marketingEmail" TEXT,
        ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "marketingEmailSent" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "visaStatus" TEXT,
        ADD COLUMN IF NOT EXISTS "positioningStatement" JSONB,
        ADD COLUMN IF NOT EXISTS "coachingAlerts" JSONB,
        ADD COLUMN IF NOT EXISTS "dashboardAccess" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "dashboardAccessRequested" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "skoolJoined" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "skoolCommunityEmail" TEXT,
        ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
        ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
        ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT,
        ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS "planStatus" TEXT NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "trialEndDate" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "freeGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "freeAnalysesUsed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "freeJobSearchesUsed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "freeMatchScoresUsed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "headshotUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "headshotGenerationsToday" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "headshotGenerationsDate" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "resumeFilename" TEXT,
        ADD COLUMN IF NOT EXISTS "coverLetterFilename" TEXT,
        ADD COLUMN IF NOT EXISTS "coverLetterFilename2" TEXT,
        ADD COLUMN IF NOT EXISTS "documentsUpdatedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "analysisCache" JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DiagnosticReport"
        ADD COLUMN IF NOT EXISTS "overallRating" INTEGER,
        ADD COLUMN IF NOT EXISTS "ratingChips" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ADD COLUMN IF NOT EXISTS "ratingComment" TEXT,
        ADD COLUMN IF NOT EXISTS "ratedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SponsorLead" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT NOT NULL UNIQUE,
        "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CvScanLead" (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        "firstName" TEXT,
        "fullName" TEXT,
        "inferredRole" TEXT,
        score INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await ensureSponsorJobTable(prisma);
    await ensureEmailTables(prisma);
    await seedTags(prisma);
    await seedTemplates(prisma);
    await seedSequences(prisma);
    await linkCandidateProfiles();
    console.log('[startup] schema columns verified');
  } catch (err) {
    console.warn('[startup] ensureColumns skipped:', err);
  }
}

// Seed the Sponsor table from the bundled JSON if it is empty. The dataset ships
// in the repo, so this makes every environment self-seed on first boot — no
// manual seed command, and it can't wipe an already-populated table (it only
// runs when count === 0).
async function ensureSponsorsSeeded() {
  try {
    const count = await prisma.sponsor.count();
    if (count > 0) {
      console.log(`[startup] sponsors already seeded (${count} rows)`);
      return;
    }

    const dataPath = path.join(__dirname, '../data/sponsors_enriched.json');
    if (!fs.existsSync(dataPath)) {
      console.warn(`[startup] sponsor seed file not found at ${dataPath} — skipping seed`);
      return;
    }

    const records: any[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Dedupe by cleanName (last occurrence wins — the enriched version).
    const deduped = new Map<string, any>();
    for (const r of records) {
      const key = (r.cleanName ?? '').trim();
      if (key) deduped.set(key, r);
    }
    const unique = Array.from(deduped.values());

    const BATCH = 500;
    for (let i = 0; i < unique.length; i += BATCH) {
      const batch = unique.slice(i, i + BATCH);
      await prisma.sponsor.createMany({
        data: batch.map((r) => ({
          cleanName: r.cleanName,
          rawName: r.rawName,
          website: r.website ?? null,
          careersUrl: r.careersUrl ?? null,
          careersSearchUrl: r.careersSearchUrl ?? null,
          industry: r.industry,
          locations: Array.isArray(r.locations) ? r.locations : [],
          hiringProfile: r.hiringProfile ?? '',
          confidence: r.confidence,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`[startup] seeded ${unique.length} sponsors`);
  } catch (err) {
    console.warn('[startup] ensureSponsorsSeeded skipped:', err);
  }
}

if (process.env.SKIP_SERVER === 'true') {
  console.log('[index] SKIP_SERVER=true — script mode, HTTP server not started.');
} else {
  app.listen(PORT, async () => {
      console.log(`Job Ready Backend running on http://localhost:${PORT}`);
      await ensureColumns();
      await ensureSponsorsSeeded();
      await loadSponsorFilterCache();
      // Job feed removed — app runs on pasted jobs. Cron left off so the daily
      // prewarm never scrapes Seek (was 403-blocked). Re-enable to restore.
      // startJobFeedCron();
      startSponsorJobScanCron();
      startTrialReminderCron();
      startFollowUpReminderCron();
      startSequenceCron();
      console.log('[cron] Trial reminder cron scheduled (10:00 UTC daily)');
      console.log('[cron] Follow-up reminder cron scheduled (09:00 UTC daily)');
  });
}
