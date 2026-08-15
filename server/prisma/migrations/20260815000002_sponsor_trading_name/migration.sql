-- The name a sponsor trades under, from the ABN Bulk Extract.
--
-- About one in six standard-tier sponsors is registered to a trust or a family
-- partnership, whose legal name describes an ownership structure rather than a
-- business: 'THE TRUSTEE FOR A & J GANDHI FAMILY TRUST'. The ABR usually also holds
-- the name on the door, which for that example is 'BOMBAY BY NIGHT'.
--
-- Recovering it let the industry classifier read 7,995 more rows, taking industry
-- coverage from 58% to 80%.

ALTER TABLE "Sponsor" ADD COLUMN "tradingName" TEXT;
