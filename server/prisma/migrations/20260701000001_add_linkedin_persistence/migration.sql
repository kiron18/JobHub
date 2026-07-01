-- AlterTable CandidateProfile: add LinkedIn Hub persistence columns
-- Saves generated profile text, banner config, and first-visit onboarding timestamp.
-- All columns are nullable and additive — safe to apply without data loss.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "linkedinProfile" JSONB;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "linkedinBanner" JSONB;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "linkedinOnboardedAt" TIMESTAMP(3);
