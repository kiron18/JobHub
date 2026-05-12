-- AlterTable CandidateProfile: add derived positioning statement
-- (Floor signal for Dual-Signal analysis — see docs/product-decisions/2026-05-12-Job Hub Revamped.md)
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "positioningStatement" JSONB;
