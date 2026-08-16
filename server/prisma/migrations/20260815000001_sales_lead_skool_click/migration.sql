-- Attributable Skool clicks: turns "14 clicks from the confirm screen" into
-- fourteen named rows on the sales board.
--
-- A click, never a join. Skool has no API to confirm membership.
ALTER TABLE "SalesLead" ADD COLUMN "skoolClickedAt" TIMESTAMP(3);
