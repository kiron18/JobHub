-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "dashboardAccessRequested" BOOLEAN NOT NULL DEFAULT false;
