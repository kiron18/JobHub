-- /book-a-call: keep the original resume file, and track hand-off to the sales CRM. Additive only.

-- AlterTable
ALTER TABLE "BookingIntake" ADD COLUMN "resumeFile" BYTEA,
ADD COLUMN "resumeFilename" TEXT,
ADD COLUMN "resumeMime" TEXT,
ADD COLUMN "crmSyncedAt" TIMESTAMP(3);

-- Intakes that predate the CRM hand-off are history, not new leads. Mark them
-- as already handed over so the first sync does not flood the sales board.
UPDATE "BookingIntake" SET "crmSyncedAt" = CURRENT_TIMESTAMP;
