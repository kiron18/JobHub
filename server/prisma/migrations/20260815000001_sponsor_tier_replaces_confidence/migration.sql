-- Replace the inferred `confidence` rating with the factual `tier` from Home Affairs.
--
-- `confidence` was an LLM guess made when the directory was ~4k rows. Every row now
-- comes off a government sponsor list, so a confidence rating read as if we doubted
-- whether the company sponsors at all. `tier` says which list they are on instead:
-- accredited sponsors get priority visa processing, standard ones do not.

CREATE TYPE "SponsorTier" AS ENUM ('accredited', 'standard');

ALTER TABLE "Sponsor" ADD COLUMN "tier" "SponsorTier" NOT NULL DEFAULT 'standard';
ALTER TABLE "Sponsor" ADD COLUMN "abn" TEXT;
ALTER TABLE "Sponsor" ADD COLUMN "state" TEXT;
ALTER TABLE "Sponsor" ADD COLUMN "postcode" TEXT;

-- Everything already in the table came from the accredited FOI release.
UPDATE "Sponsor" SET "tier" = 'accredited';

DROP INDEX IF EXISTS "Sponsor_confidence_idx";
ALTER TABLE "Sponsor" DROP COLUMN "confidence";
DROP TYPE "SponsorConfidence";

-- Standard-tier sponsors come off the list as a bare company name, so these two
-- are only known once a row has been through enrichment.
ALTER TABLE "Sponsor" ALTER COLUMN "industry" DROP NOT NULL;
ALTER TABLE "Sponsor" ALTER COLUMN "hiringProfile" DROP NOT NULL;

CREATE INDEX "Sponsor_tier_idx" ON "Sponsor"("tier");
CREATE INDEX "Sponsor_state_idx" ON "Sponsor"("state");
