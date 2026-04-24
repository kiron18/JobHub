-- Migration: seek_cache_and_sourceurl
-- Adds SeekJobCache table and sourceUrl column to JobApplication

-- Add sourceUrl to JobApplication
ALTER TABLE "JobApplication" ADD COLUMN "sourceUrl" TEXT;

-- Create SeekJobCache table
CREATE TABLE "SeekJobCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryMeta" JSONB NOT NULL,
    "feedDate" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeekJobCache_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on (queryHash, feedDate)
CREATE UNIQUE INDEX "SeekJobCache_queryHash_feedDate_key" ON "SeekJobCache"("queryHash", "feedDate");

-- Index on feedDate
CREATE INDEX "SeekJobCache_feedDate_idx" ON "SeekJobCache"("feedDate");

-- Down migration note:
-- ALTER TABLE "JobApplication" DROP COLUMN "sourceUrl";
-- DROP TABLE "SeekJobCache";
