-- Attendance, and the report it unlocks.
--
-- attendedAt is set by the claim link dropped in the Meet chat partway through
-- the session. Only people in the room see that link, so the claim is the
-- attendance record; there is no other signal that someone actually turned up.
ALTER TABLE "SessionRegistration" ADD COLUMN "attendedAt" TIMESTAMP(3);

-- The generated diagnostic, stored whole so the report page is a read rather
-- than a re-run. Regenerating would cost another two LLM calls and, worse,
-- would show them a different report than the one they were emailed.
ALTER TABLE "SessionRegistration" ADD COLUMN "report" JSONB;
ALTER TABLE "SessionRegistration" ADD COLUMN "reportToken" TEXT;
ALTER TABLE "SessionRegistration" ADD COLUMN "reportGeneratedAt" TIMESTAMP(3);
ALTER TABLE "SessionRegistration" ADD COLUMN "reportSentAt" TIMESTAMP(3);
ALTER TABLE "SessionRegistration" ADD COLUMN "reportError" TEXT;

-- The token is the only credential on the report URL, so it must be unique.
CREATE UNIQUE INDEX "SessionRegistration_reportToken_key" ON "SessionRegistration"("reportToken");

-- The generation sweep looks for attended-but-not-yet-generated rows.
CREATE INDEX "SessionRegistration_attendedAt_reportGeneratedAt_idx" ON "SessionRegistration"("attendedAt", "reportGeneratedAt");

-- The original file, not just the extracted text.
--
-- The ATS structural check is the sharpest finding in the whole report ("built
-- in text boxes the ATS cannot read"), and it can only be made by inspecting the
-- actual document: a DOCX is a zip of XML, and the text boxes and tables are
-- invisible once it has been flattened to text. Keeping the bytes is also what
-- lets the sales roster hand back the real resume rather than a text dump.
ALTER TABLE "SessionRegistration" ADD COLUMN "resumeFile" BYTEA;
ALTER TABLE "SessionRegistration" ADD COLUMN "resumeMimetype" TEXT;
