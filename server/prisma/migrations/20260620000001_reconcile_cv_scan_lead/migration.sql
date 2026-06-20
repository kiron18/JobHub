-- Reconcile database with schema.prisma (additive, idempotent, safe on EVERY database).
--
-- Background: earlier columns were applied with `prisma db push` (no migration file written),
-- so the production DB has them but a migrate-built DB (staging) does not. This single migration
-- adds every column the schema/code expects but no migration ever created.
--
-- Every statement is ADD COLUMN IF NOT EXISTS: a no-op where the column already exists,
-- so it drops nothing and is safe to run against prod and staging alike.

-- CvScanLead
ALTER TABLE "CvScanLead" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "CvScanLead" ADD COLUMN IF NOT EXISTS "inferredRole" TEXT;
ALTER TABLE "CvScanLead" ADD COLUMN IF NOT EXISTS "score" INTEGER;

-- CandidateProfile (billing / plan / free-usage counters / documents)
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "planStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "trialEndDate" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "freeGenerationsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "freeAnalysesUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "freeJobSearchesUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "freeMatchScoresUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "resumeFilename" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "coverLetterFilename" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "coverLetterFilename2" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "documentsUpdatedAt" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "analysisCache" JSONB;

-- JobApplication
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "companyIntel" JSONB;

-- DiagnosticReport
ALTER TABLE "DiagnosticReport" ADD COLUMN IF NOT EXISTS "overallRating" INTEGER;
ALTER TABLE "DiagnosticReport" ADD COLUMN IF NOT EXISTS "ratingChips" TEXT;
ALTER TABLE "DiagnosticReport" ADD COLUMN IF NOT EXISTS "ratingComment" TEXT;
ALTER TABLE "DiagnosticReport" ADD COLUMN IF NOT EXISTS "ratedAt" TIMESTAMP(3);

-- SponsorJob
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "employerMatched" BOOLEAN;
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "sponsorCleanName" TEXT;
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "positivePhraseHit" BOOLEAN;
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "negationPhraseHit" BOOLEAN;
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "matchedPhrases" JSONB;
ALTER TABLE "SponsorJob" ADD COLUMN IF NOT EXISTS "scanQuery" TEXT;

-- Job
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "locationKey" TEXT;
