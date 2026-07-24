-- Per-person throttle for the follow-up reminder cron: the timestamp of the
-- last nudge email we sent this candidate. Enforces one reminder per person
-- every few days instead of one per application. Nullable — NULL means "never
-- nudged", which always qualifies for the first send.

ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "lastFollowUpNudgeAt" TIMESTAMP(3);
