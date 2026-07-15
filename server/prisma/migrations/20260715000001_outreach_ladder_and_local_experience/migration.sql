-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('ACTIVE', 'REPLIED', 'CALL_BOOKED', 'REFERRAL', 'CLOSED_NO_REPLY', 'CLOSED_MANUAL');

-- CreateEnum
CREATE TYPE "LocalExperienceType" AS ENUM ('VOLUNTEERING', 'TEMP_WORK', 'INTERNSHIP', 'PART_TIME', 'PROJECT', 'COMMUNITY', 'OTHER');

-- Add status column to OutreachLog
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "status" "OutreachStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable OutreachMessage
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "outreachLogId" TEXT NOT NULL,
    "touchNumber" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "copiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachMessage_outreachLogId_touchNumber_key" ON "OutreachMessage"("outreachLogId", "touchNumber");

-- CreateIndex
CREATE INDEX "OutreachMessage_outreachLogId_idx" ON "OutreachMessage"("outreachLogId");

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_outreachLogId_fkey" FOREIGN KEY ("outreachLogId") REFERENCES "OutreachLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable LocalExperienceEntry
CREATE TABLE "LocalExperienceEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LocalExperienceType" NOT NULL,
    "organisation" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hoursPerWeek" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalExperienceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocalExperienceEntry_userId_idx" ON "LocalExperienceEntry"("userId");

-- Backfill: Create OutreachMessage touch 1 for existing OutreachLog rows with firstMessage
INSERT INTO "OutreachMessage" ("id", "outreachLogId", "touchNumber", "body", "copiedAt")
SELECT
    gen_random_uuid()::text,
    ol."id",
    1,
    ol."firstMessage",
    ol."createdAt"
FROM "OutreachLog" ol
WHERE ol."firstMessage" IS NOT NULL
  AND ol."firstMessage" != ''
  AND NOT EXISTS (
    SELECT 1 FROM "OutreachMessage" om
    WHERE om."outreachLogId" = ol."id" AND om."touchNumber" = 1
  );
