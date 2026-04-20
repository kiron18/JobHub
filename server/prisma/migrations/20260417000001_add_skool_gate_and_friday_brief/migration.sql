-- AlterTable: add skool gate fields to CandidateProfile
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "skoolJoined" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "skoolCommunityEmail" TEXT;

-- CreateTable: FridayBrief
CREATE TABLE IF NOT EXISTS "FridayBrief" (
  "id"          TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd"   TIMESTAMP(3) NOT NULL,
  "script"      TEXT NOT NULL,
  "reportCount" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FridayBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on windowStart
CREATE UNIQUE INDEX IF NOT EXISTS "FridayBrief_windowStart_key" ON "FridayBrief"("windowStart");
