-- Add targetRoles Json array to store all 3 onboarding roles
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "targetRoles" JSONB;
