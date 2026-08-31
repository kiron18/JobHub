-- The eligibility intro modal is a per-account event, not a per-browser one.
ALTER TABLE "CandidateProfile" ADD COLUMN "eligibilityIntroSeenAt" TIMESTAMP(3);

-- Everyone who already had an account is treated as having seen it, so the
-- interrupt only ever meets a new signup. Stamped with createdAt rather than
-- now() so the column keeps meaning "an account this old predates the modal".
UPDATE "CandidateProfile" SET "eligibilityIntroSeenAt" = "createdAt";
