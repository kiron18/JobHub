-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "dashboardAccess" BOOLEAN NOT NULL DEFAULT false;
