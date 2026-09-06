-- CreateEnum
CREATE TYPE "ContactSlot" AS ENUM ('TALENT', 'HIRING_MANAGER', 'TEAM_INSIDER');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('JD', 'HUNTER_DIRECTORY', 'LINKEDIN', 'RECRUITER', 'MANUAL');

-- CreateEnum
CREATE TYPE "DomainSource" AS ENUM ('JD_EMAIL', 'JD_REDACTED', 'HUNTER', 'SEARCH', 'MANUAL');

-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('PUBLISHED', 'JD', 'HUNTER', 'CONSTRUCTED');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('UNREVIEWED', 'RIGHT_PERSON', 'WRONG_FUNCTION', 'WRONG_SENIORITY', 'WRONG_EMPLOYER', 'WRONG_LOCATION', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "ContactOutcome" AS ENUM ('UNSENT', 'SENT', 'BOUNCED', 'REPLIED');

-- CreateTable
CREATE TABLE "ContactDiscovery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobApplicationId" TEXT,
    "company" TEXT,
    "role" TEXT,
    "domain" TEXT,
    "domainSource" "DomainSource",
    "slot" "ContactSlot" NOT NULL,
    "personName" TEXT NOT NULL,
    "personTitle" TEXT,
    "nameSource" "ContactSource" NOT NULL,
    "email" TEXT,
    "emailSource" "EmailSource",
    "emailPattern" TEXT,
    "verification" TEXT,
    "reviewVerdict" "ReviewVerdict" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "outcome" "ContactOutcome" NOT NULL DEFAULT 'UNSENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailPattern" (
    "domain" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPattern_pkey" PRIMARY KEY ("domain")
);

-- CreateIndex
CREATE INDEX "ContactDiscovery_userId_idx" ON "ContactDiscovery"("userId");

-- CreateIndex
CREATE INDEX "ContactDiscovery_domain_idx" ON "ContactDiscovery"("domain");

-- CreateIndex
CREATE INDEX "ContactDiscovery_jobApplicationId_idx" ON "ContactDiscovery"("jobApplicationId");
