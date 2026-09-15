-- CreateTable
CREATE TABLE "TrialChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "windowStartedAt" TIMESTAMP(3),
    "windowEndsAt" TIMESTAMP(3),
    "linkedinUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "passedDayAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrialChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialChallenge_userId_key" ON "TrialChallenge"("userId");
CREATE INDEX "TrialChallenge_status_windowEndsAt_idx" ON "TrialChallenge"("status", "windowEndsAt");
