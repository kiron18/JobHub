-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "headshotUrl" TEXT,
ADD COLUMN     "headshotGenerationsToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "headshotGenerationsDate" TIMESTAMP(3);
