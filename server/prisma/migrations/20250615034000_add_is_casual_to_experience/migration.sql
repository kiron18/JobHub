-- AlterTable
ALTER TABLE "Experience" ADD COLUMN IF NOT EXISTS "isCasual" BOOLEAN DEFAULT false;

-- Backfill existing rows to false (they were not classified)
UPDATE "Experience" SET "isCasual" = false WHERE "isCasual" IS NULL;
