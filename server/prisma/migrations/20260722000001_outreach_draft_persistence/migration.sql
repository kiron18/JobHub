-- Persist the four generated outreach templates on the log entry itself.
-- Previously the drafts lived only in React state, so switching person or
-- closing the tab lost them, and an outreach could not be logged until both
-- the connection note and first message had been sent.

ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "connectionNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "followUpDraft" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "directAskDraft" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachLog" ADD COLUMN IF NOT EXISTS "draftsUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
