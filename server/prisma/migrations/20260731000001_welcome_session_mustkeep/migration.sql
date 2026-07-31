-- The retention gate verifies a rebuilt resume against an inventory of what the
-- original contained. The inventory is produced at /brief and consumed at
-- /build, so it has to survive between the two calls.
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "mustKeep" JSONB;
