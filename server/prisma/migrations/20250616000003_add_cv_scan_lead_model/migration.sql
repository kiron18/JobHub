-- Add CvScanLead model

-- CreateTable CvScanLead
CREATE TABLE "CvScanLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "scanData" JSONB,
    "reportSeen" BOOLEAN NOT NULL DEFAULT false,
    "reportSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvScanLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvScanLead_email_key" ON "CvScanLead"("email");
CREATE INDEX "CvScanLead_reportSeen_idx" ON "CvScanLead"("reportSeen");
CREATE INDEX "CvScanLead_createdAt_idx" ON "CvScanLead"("createdAt");
