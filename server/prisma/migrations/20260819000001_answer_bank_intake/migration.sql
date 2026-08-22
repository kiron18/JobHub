-- The story intake: the interview that builds a candidate's answer bank.
--
-- Two tables rather than one JSON blob on the profile, because the intake is
-- eighteen questions long and nobody sits through that in one go. Every answer
-- commits on its own, so closing the tab loses at most the question in progress.
CREATE TABLE "AnswerBankIntake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "candidateProfileId" TEXT NOT NULL,
    -- The resume as it was when the questions were generated. Snapshotted because
    -- the candidate can edit their resume mid-intake, and the questions must not
    -- move underneath answers that have already been given against them.
    "resumeSnapshot" TEXT NOT NULL,
    "industry" TEXT,
    -- The generated question set, stored whole and never regenerated on read.
    "plan" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerBankIntake_pkey" PRIMARY KEY ("id")
);

-- One question and what was said in answer to it.
--
-- `spoken`, `cleaned` and `approved` sit side by side and none of them ever
-- overwrites another. Keeping `spoken` forever is the safety net: if a clean or
-- a variant is later found to have drifted from what the person actually said,
-- their own words are still here to recut from. That is precisely what was
-- missing when structured extraction dropped a client's publication.
CREATE TABLE "AnswerBankEntry" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "themes" TEXT[],
    -- Every turn of the exchange: asked, said, and why it was asked again.
    "turns" JSONB NOT NULL DEFAULT '[]',
    "spoken" TEXT,
    "cleaned" TEXT,
    "approved" TEXT,
    "variants" JSONB,
    "approvedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "followUps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerBankEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnswerBankIntake_userId_key" ON "AnswerBankIntake"("userId");
CREATE UNIQUE INDEX "AnswerBankIntake_candidateProfileId_key" ON "AnswerBankIntake"("candidateProfileId");
CREATE INDEX "AnswerBankEntry_intakeId_idx" ON "AnswerBankEntry"("intakeId");

-- An answer belongs to exactly one question. Without this a double-submit from a
-- flaky connection files the same story twice and the bank offers it twice.
CREATE UNIQUE INDEX "AnswerBankEntry_intakeId_questionId_key" ON "AnswerBankEntry"("intakeId", "questionId");

ALTER TABLE "AnswerBankIntake" ADD CONSTRAINT "AnswerBankIntake_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerBankEntry" ADD CONSTRAINT "AnswerBankEntry_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "AnswerBankIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
