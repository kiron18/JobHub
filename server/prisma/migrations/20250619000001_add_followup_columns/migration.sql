-- Add follow-up tracking columns to JobApplication

-- Add followUpSentAt column
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "followUpSentAt" TIMESTAMP(3);

-- Add followUpDismissedAt column
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "followUpDismissedAt" TIMESTAMP(3);
