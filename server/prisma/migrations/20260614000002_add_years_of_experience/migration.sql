-- Add yearsOfExperience computed and stored Int
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER;
