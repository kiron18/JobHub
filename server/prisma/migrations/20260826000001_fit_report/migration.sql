-- The free tier's fit check, stored on the job it was run against.
--
-- Deliberately separate columns from "dimensions"/"overallGrade". Those are the
-- paid MatchEngine's output and answer a different question ("how do I write
-- this application"). This answers "is this job worth my time at all", is run
-- before anyone has paid, and must be re-openable without paying for the LLM
-- call a second time.
--
-- "fitScore" duplicates the number inside the JSON on purpose, so a job list
-- can sort and render without deserialising every row.
ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "fitReport" JSONB,
  ADD COLUMN IF NOT EXISTS "fitScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "fitCheckedAt" TIMESTAMP(3);
