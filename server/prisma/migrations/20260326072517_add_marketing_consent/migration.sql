-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingEmail" TEXT,
ADD COLUMN     "marketingEmailSent" BOOLEAN NOT NULL DEFAULT false;
