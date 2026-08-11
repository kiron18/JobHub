-- Fifth outreach template: the 3-4 week re-contact.
-- Additive and defaulted, so existing rows keep working untouched.
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "reContactDraft" TEXT NOT NULL DEFAULT '';
