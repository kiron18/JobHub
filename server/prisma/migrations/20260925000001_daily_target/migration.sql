-- Today's target: how many applications a member committed to for one AEST day.
-- Additive only. Nothing existing is altered or dropped, so this is safe to
-- apply to a live database ahead of the feature being switched on.

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN "commitExplainerSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "target" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "undoUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTarget_userId_date_key" ON "DailyTarget"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyTarget_userId_date_idx" ON "DailyTarget"("userId", "date");
