-- A long-lived, revocable token for the browser extension.
--
-- The app authenticates with a Supabase JWT, which expires. An extension that
-- lives in a toolbar for months cannot hold one of those, and asking a client
-- to re-paste a token every week is a support queue, not a feature.
--
-- Only the SHA-256 hash is stored: a database leak must not yield working
-- tokens. The plaintext is shown once, at mint time, and never again.
ALTER TABLE "CandidateProfile"
  ADD COLUMN IF NOT EXISTS "extensionTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "extensionTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CandidateProfile_extensionTokenHash_key"
  ON "CandidateProfile" ("extensionTokenHash");
