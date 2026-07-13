-- Exactly-once guard for accountability nudge emails
CREATE TABLE "NudgeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NudgeLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NudgeLog_userId_kind_periodKey_key" ON "NudgeLog"("userId", "kind", "periodKey");
