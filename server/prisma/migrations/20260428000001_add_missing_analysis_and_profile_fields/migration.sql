-- AlterTable JobApplication: add job analysis fields
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "australianFlags" JSONB;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "dimensions" JSONB;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "matchedIdentityCard" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "overallGrade" TEXT;

-- AlterTable CandidateProfile: add identity cards and profile advisor tracking
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "achievementCountAtDerivation" INTEGER;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "identityCards" JSONB;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "identityCardsUpdatedAt" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "profileAdvisorCallsToday" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "profileAdvisorCallsDate" TIMESTAMP(3);
