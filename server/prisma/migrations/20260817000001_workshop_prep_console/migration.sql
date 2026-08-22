-- The workshop prep console: what each attendee asked, and the fact sheet read
-- off it while the room is live.
--
-- The qualifying questions were removed from the signup form, so the question a
-- person actually wants answered now only exists in the Skool thread, and Skool
-- has no API. It gets pasted in by hand once, matched to the roster, and lands
-- here. Verbatim, never a summary: the whole point is being able to read it back
-- to them in their own words.
ALTER TABLE "SessionRegistration" ADD COLUMN "question" TEXT;

-- The generated fact sheet, stored whole and never regenerated on read. Same
-- reasoning as `report` above it: a re-run costs an LLM call and, worse, would
-- hand back something different from what was read five minutes earlier.
ALTER TABLE "SessionRegistration" ADD COLUMN "coachBrief" JSONB;
ALTER TABLE "SessionRegistration" ADD COLUMN "coachBriefAt" TIMESTAMP(3);

-- A question from the pasted thread that belongs to nobody on the roster.
--
-- These exist because the thread is public and the roster is not: people who
-- never registered still post in it, and a name can be spelled two ways between
-- Skool and the signup form. Dropping those questions would silently lose the
-- part of the thread most likely to be interesting, so they survive here as
-- floor questions and get answered to the room instead of to a person.
--
-- Keyed by sessionKey rather than by a registration, because that is exactly
-- what they lack. No unique constraint: two people are allowed to ask the same
-- thing, and re-pasting replaces the whole set for a session rather than merging.
CREATE TABLE "SessionFloorQuestion" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "poster" TEXT,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFloorQuestion_pkey" PRIMARY KEY ("id")
);

-- The console reads one session at a time, always.
CREATE INDEX "SessionFloorQuestion_sessionKey_idx" ON "SessionFloorQuestion"("sessionKey");
