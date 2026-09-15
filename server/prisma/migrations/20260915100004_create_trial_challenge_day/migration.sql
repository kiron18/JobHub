-- CreateTable
CREATE TABLE "TrialChallengeDay" (
    "id" TEXT NOT NULL,
    "trialChallengeId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "minimumRequired" INTEGER NOT NULL,
    "outcome" TEXT,
    "crossedMinimumAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "TrialChallengeDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialChallengeDay_trialChallengeId_day_key" ON "TrialChallengeDay"("trialChallengeId", "day");

ALTER TABLE "TrialChallengeDay" ADD CONSTRAINT "TrialChallengeDay_trialChallengeId_fkey" FOREIGN KEY ("trialChallengeId") REFERENCES "TrialChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
