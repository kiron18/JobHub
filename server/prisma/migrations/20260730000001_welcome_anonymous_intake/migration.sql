-- The /welcome intake rebuilds the resume before asking for an email.
--
-- resumeOriginalText: resumeRawText is what every generation grounds on, and it
-- now holds the CLEAN rebuilt resume. Keep the untouched upload here so we can
-- diff, audit, or recover.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "resumeOriginalText" TEXT;

-- WelcomeSession: the anonymous run itself. Persisted rather than held in memory
-- because the whole rebuild happens pre-signup and a redeploy would otherwise
-- discard it.
CREATE TABLE IF NOT EXISTS "WelcomeSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "resumeOriginalText" TEXT NOT NULL,
    "resumeFilename" TEXT,
    "firstName" TEXT,
    "currentRole" TEXT,
    "brief" TEXT,
    "questions" JSONB,
    "answers" JSONB,
    "resumeCleanText" TEXT,
    "buildCount" INTEGER NOT NULL DEFAULT 0,
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WelcomeSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeSession_token_key" ON "WelcomeSession"("token");
CREATE INDEX IF NOT EXISTS "WelcomeSession_createdAt_idx" ON "WelcomeSession"("createdAt");
