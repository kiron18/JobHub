-- Add skipped/skippedAt to JobFeedItem for skip/undo feed feature
ALTER TABLE "JobFeedItem" ADD COLUMN IF NOT EXISTS "skipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobFeedItem" ADD COLUMN IF NOT EXISTS "skippedAt" TIMESTAMP(3);
