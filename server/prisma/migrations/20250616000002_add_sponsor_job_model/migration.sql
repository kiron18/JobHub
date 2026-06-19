-- Add SponsorJob model

-- CreateTable SponsorJob
CREATE TABLE IF NOT EXISTS "SponsorJob" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "salary" TEXT,
    "visaSponsorship" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SponsorJob_externalId_key" ON "SponsorJob"("externalId");
CREATE INDEX IF NOT EXISTS "SponsorJob_active_idx" ON "SponsorJob"("active");
CREATE INDEX IF NOT EXISTS "SponsorJob_visaSponsorship_idx" ON "SponsorJob"("visaSponsorship");
CREATE INDEX IF NOT EXISTS "SponsorJob_publishedAt_idx" ON "SponsorJob"("publishedAt");
