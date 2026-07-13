-- Outreach goal on CandidateProfile
ALTER TABLE "CandidateProfile" ADD COLUMN "dailyOutreachGoal" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "CandidateProfile" ADD COLUMN "outreachGoalType" TEXT NOT NULL DEFAULT 'daily';

-- Interview/offer milestone timestamps on JobApplication, backfilled from updatedAt
ALTER TABLE "JobApplication" ADD COLUMN "interviewReachedAt" TIMESTAMP(3);
ALTER TABLE "JobApplication" ADD COLUMN "offerReachedAt" TIMESTAMP(3);
UPDATE "JobApplication" SET "interviewReachedAt" = "updatedAt" WHERE "status" IN ('INTERVIEW', 'OFFER');
UPDATE "JobApplication" SET "offerReachedAt" = "updatedAt" WHERE "status" = 'OFFER';

-- Goal change audit log (snapshot of full goal settings per save)
CREATE TABLE "GoalChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appGoal" INTEGER NOT NULL,
    "appGoalType" TEXT NOT NULL,
    "outreachGoal" INTEGER NOT NULL,
    "outreachGoalType" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "byCoach" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoalChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GoalChange_userId_createdAt_idx" ON "GoalChange"("userId", "createdAt");
CREATE INDEX "GoalChange_userId_effectiveAt_idx" ON "GoalChange"("userId", "effectiveAt");

-- Coach-granted pause weeks (excluded from miss/streak logic)
CREATE TABLE "PauseWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PauseWeek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PauseWeek_userId_weekStart_key" ON "PauseWeek"("userId", "weekStart");
