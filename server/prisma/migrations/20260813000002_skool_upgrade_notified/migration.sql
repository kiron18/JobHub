-- Marks that the "add this buyer to Skool Premium" task has been raised.
--
-- Skool has no API, so granting Premium is a manual toggle in its admin. The
-- only thing that can be automated is the reminder, which makes it critical
-- that the reminder is trustworthy: Stripe retries webhook deliveries, and an
-- admin task that arrives three times is one that stops being read.
ALTER TABLE "CandidateProfile" ADD COLUMN "skoolUpgradeNotifiedAt" TIMESTAMP(3);
