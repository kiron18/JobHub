-- Company is unknown far more often than it is missing.
--
-- 36% of JobApplication rows held the literal 'Unknown company'. Measuring a
-- sample of them showed only ~3% had a recoverable employer name in the ad
-- text: ~30% named only the recruitment agency, and ~67% were genuinely
-- anonymous listings ("The Company is a well-established...", "Our valued
-- client is a leading provider of..."). The extractor was returning null
-- correctly; the write path replaced that null with a placeholder string.
--
-- So: let the column hold null, and give the agency a column of its own,
-- because on an agency listing the recruiter is the right follow-up contact.

ALTER TABLE "JobApplication" ALTER COLUMN "company" DROP NOT NULL;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "agency" TEXT;

-- Retire the placeholders. Every variant that has ever been written by the
-- app: 'Unknown company' (StepperWorkspace / seekJobUrl), 'Unknown Company'
-- (analyze / documents routes), and the bare/empty cases.
UPDATE "JobApplication"
SET "company" = NULL
WHERE btrim(lower(coalesce("company", ''))) IN ('unknown company', 'unknown', 'unknown position', 'n/a', '');
