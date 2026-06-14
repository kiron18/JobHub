-- CreateTable
CREATE TABLE "SkippedJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "postedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkippedJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkippedJob_userId_sourceUrl_key" ON "SkippedJob"("userId", "sourceUrl");

-- CreateIndex
CREATE INDEX "SkippedJob_userId_skippedAt_idx" ON "SkippedJob"("userId", "skippedAt");
