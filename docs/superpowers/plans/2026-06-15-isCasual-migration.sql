-- Manual SQL Migration for isCasual Column
-- Run this in Supabase SQL Editor

-- Add isCasual column to Experience table
ALTER TABLE "Experience" ADD COLUMN IF NOT EXISTS "isCasual" BOOLEAN DEFAULT false;

-- Backfill existing rows to false (they were not classified)
UPDATE "Experience" SET "isCasual" = false WHERE "isCasual" IS NULL;

-- Verify the migration
SELECT
  COUNT(*) as total_rows,
  COUNT("isCasual") as with_value,
  SUM(CASE WHEN "isCasual" = true THEN 1 ELSE 0 END) as casual_true,
  SUM(CASE WHEN "isCasual" = false THEN 1 ELSE 0 END) as casual_false
FROM "Experience";
