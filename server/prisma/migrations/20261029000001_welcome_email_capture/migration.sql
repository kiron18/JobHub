-- The rest of the diagnosis, and an address captured before signup, so an abandoned welcome flow can be recovered.
-- All nullable, nothing backfilled.
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "findings" JSONB;
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "strengths" JSONB;
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "targetRole" TEXT;
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "emailCapturedAt" TIMESTAMP(3);
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "diagnosisEmailedAt" TIMESTAMP(3);
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "claimReminderSentAt" TIMESTAMP(3);

-- The reminder cron looks for captured, unclaimed sessions.
CREATE INDEX IF NOT EXISTS "WelcomeSession_emailCapturedAt_idx" ON "WelcomeSession"("emailCapturedAt");
