-- CreateTable
CREATE TABLE "SessionRegistration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "answers" JSONB NOT NULL,
    "resumeText" TEXT,
    "resumeFilename" TEXT,
    "resumeSkipReason" TEXT,
    "sessionKey" TEXT NOT NULL DEFAULT '2026-08-06',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRegistration_email_key" ON "SessionRegistration"("email");

-- CreateIndex
CREATE INDEX "SessionRegistration_sessionKey_createdAt_idx" ON "SessionRegistration"("sessionKey", "createdAt");
