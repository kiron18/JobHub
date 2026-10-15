-- Delivery events from Resend's webhook. All nullable, nothing backfilled.
ALTER TABLE "EmailSend" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "EmailSend" ADD COLUMN IF NOT EXISTS "bouncedAt" TIMESTAMP(3);
ALTER TABLE "EmailSend" ADD COLUMN IF NOT EXISTS "bounceReason" TEXT;
ALTER TABLE "EmailSend" ADD COLUMN IF NOT EXISTS "complainedAt" TIMESTAMP(3);

-- The webhook finds the send by Resend's id.
CREATE INDEX IF NOT EXISTS "EmailSend_resendEmailId_idx" ON "EmailSend"("resendEmailId");
