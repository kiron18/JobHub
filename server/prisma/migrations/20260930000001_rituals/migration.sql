-- Morning commit swap (option B) and the evening check-out. Additive only.

-- AlterTable
ALTER TABLE "DailyTarget" ADD COLUMN "swappedAt" TIMESTAMP(3);
ALTER TABLE "DailyTarget" ADD COLUMN "swapFiled" INTEGER;

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "outcomes" TEXT[],
    "tomorrow" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionLog_userId_date_key" ON "SessionLog"("userId", "date");
CREATE INDEX "SessionLog_userId_date_idx" ON "SessionLog"("userId", "date");
