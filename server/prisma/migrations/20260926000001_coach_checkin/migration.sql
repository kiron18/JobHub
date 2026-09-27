-- WhatsApp coach check-in: message log + challenge start + welcome-once flag.
-- Additive only, safe to apply to a live database ahead of the feature being on.

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN "challengeStartedAt" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN "coachWelcomedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "topic" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachMessage_userId_createdAt_idx" ON "CoachMessage"("userId", "createdAt");
CREATE INDEX "CoachMessage_flagged_createdAt_idx" ON "CoachMessage"("flagged", "createdAt");
