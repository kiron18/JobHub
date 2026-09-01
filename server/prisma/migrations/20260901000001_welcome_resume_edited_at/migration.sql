-- The candidate can now edit the rebuilt resume on the welcome screen before the
-- single send. This records that they did.
--
-- It is not bookkeeping: /welcome/finish gates resumeRawText in 'authored' mode,
-- where an ungrounded figure is a model fabrication and must never land. Once a
-- human has edited the text, that reading is wrong — a new figure is the
-- candidate telling us something true about themselves — so finish reads this
-- column to choose the mode. Null means the rebuild is still as the model wrote it.
ALTER TABLE "WelcomeSession" ADD COLUMN "resumeEditedAt" TIMESTAMP(3);
