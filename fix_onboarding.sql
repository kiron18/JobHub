-- Fix profiles that have resume data but onboarding not marked complete
UPDATE "CandidateProfile"
SET "hasCompletedOnboarding" = true
WHERE "resumeRawText" IS NOT NULL 
  AND "hasCompletedOnboarding" = false;
