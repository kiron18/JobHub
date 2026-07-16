-- Create OutreachLog table if it doesn't exist (for shadow database compatibility)
CREATE TABLE IF NOT EXISTS "OutreachLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutreachLog_userId_idx" ON "OutreachLog"("userId");

-- Add columns to OutreachLog
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "specificQuestion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "firstMessage" TEXT NOT NULL DEFAULT '';
