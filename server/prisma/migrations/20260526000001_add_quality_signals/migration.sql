-- AlterTable Document: add quality signals JSON field
-- Stores post-generation quality metadata (ATS coverage, blueprint fallback, etc.)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "qualitySignals" JSONB;
