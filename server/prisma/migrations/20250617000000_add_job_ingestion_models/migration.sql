-- CreateTable Job
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    "location" TEXT,
    "salary" TEXT,
    "workMode" TEXT,
    "description" TEXT NOT NULL,
    "descriptionHydrated" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowRelevance" BOOLEAN NOT NULL DEFAULT false,
    "searchRole" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "feedDate" TEXT NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Job
CREATE UNIQUE INDEX "Job_dedupKey_key" ON "Job"("dedupKey");
CREATE INDEX "Job_normalizedCompany_idx" ON "Job"("normalizedCompany");
CREATE INDEX "Job_feedDate_idx" ON "Job"("feedDate");
CREATE INDEX "Job_lowRelevance_idx" ON "Job"("lowRelevance");

-- CreateTable JobSource
CREATE TABLE "JobSource" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceJobId" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex JobSource
CREATE UNIQUE INDEX "JobSource_source_sourceUrl_key" ON "JobSource"("source", "sourceUrl");
CREATE INDEX "JobSource_jobId_idx" ON "JobSource"("jobId");

-- AddForeignKey JobSource
ALTER TABLE "JobSource" ADD CONSTRAINT "JobSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable IngestionRun
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "trigger" TEXT NOT NULL,
    "totalRaw" INTEGER NOT NULL DEFAULT 0,
    "totalNew" INTEGER NOT NULL DEFAULT 0,
    "totalDup" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable SourceResult
CREATE TABLE "SourceResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "dupCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueCount" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SourceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex SourceResult
CREATE INDEX "SourceResult_runId_idx" ON "SourceResult"("runId");
CREATE INDEX "SourceResult_source_idx" ON "SourceResult"("source");

-- AddForeignKey SourceResult
ALTER TABLE "SourceResult" ADD CONSTRAINT "SourceResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
