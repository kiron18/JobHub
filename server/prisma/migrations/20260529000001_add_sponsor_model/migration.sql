-- CreateEnum
CREATE TYPE "SponsorConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "cleanName" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "website" TEXT,
    "careersUrl" TEXT,
    "careersSearchUrl" TEXT,
    "industry" TEXT NOT NULL,
    "locations" TEXT[],
    "hiringProfile" TEXT NOT NULL,
    "confidence" "SponsorConfidence" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_cleanName_key" ON "Sponsor"("cleanName");

-- CreateIndex
CREATE INDEX "Sponsor_industry_idx" ON "Sponsor"("industry");

-- CreateIndex
CREATE INDEX "Sponsor_confidence_idx" ON "Sponsor"("confidence");

-- CreateIndex
CREATE INDEX "Sponsor_cleanName_idx" ON "Sponsor"("cleanName");
