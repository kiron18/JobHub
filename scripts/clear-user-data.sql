-- ============================================================================
-- Clear ALL data for two users (kiron182@hotmail.com, kamiproject2021@gmail.com)
-- Run in Supabase SQL Editor.
-- Dependency-safe: deletes child records before parent records.
-- All identifiers double-quoted for Prisma ORM compatibility.
-- ============================================================================

DO $$
DECLARE
  v_uid1  TEXT;
  v_uid2  TEXT;
  v_cpid1 TEXT;
  v_cpid2 TEXT;
  v_contact_id1 TEXT;
  v_contact_id2 TEXT;
BEGIN

  ------------------------------------------------------------------
  -- 1. Resolve IDs from CandidateProfile.email
  ------------------------------------------------------------------
  SELECT "userId"    INTO v_uid1        FROM "CandidateProfile" WHERE "email" = 'kiron182@hotmail.com';
  SELECT "userId"    INTO v_uid2        FROM "CandidateProfile" WHERE "email" = 'kamiproject2021@gmail.com';
  SELECT "id"        INTO v_cpid1       FROM "CandidateProfile" WHERE "email" = 'kiron182@hotmail.com';
  SELECT "id"        INTO v_cpid2       FROM "CandidateProfile" WHERE "email" = 'kamiproject2021@gmail.com';
  SELECT "contactId" INTO v_contact_id1 FROM "CandidateProfile" WHERE "email" = 'kiron182@hotmail.com';
  SELECT "contactId" INTO v_contact_id2 FROM "CandidateProfile" WHERE "email" = 'kamiproject2021@gmail.com';

  RAISE NOTICE 'User1 uid=% cpid=% contactId=%', v_uid1, v_cpid1, v_contact_id1;
  RAISE NOTICE 'User2 uid=% cpid=% contactId=%', v_uid2, v_cpid2, v_contact_id2;

  IF v_uid1 IS NULL AND v_uid2 IS NULL THEN
    RAISE NOTICE 'Neither email found — nothing to delete.';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 2. Child tables via candidateProfileId
  ------------------------------------------------------------------
  DELETE FROM "Achievement"   WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);
  DELETE FROM "Experience"    WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);
  DELETE FROM "Education"     WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);
  DELETE FROM "Volunteering"  WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);
  DELETE FROM "Certification" WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);
  DELETE FROM "Language"      WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);

  ------------------------------------------------------------------
  -- 3. ResumeVersion — userId + candidateProfileId
  ------------------------------------------------------------------
  DELETE FROM "ResumeVersion" WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);

  ------------------------------------------------------------------
  -- 4. Document + DocumentFeedback
  ------------------------------------------------------------------
  DELETE FROM "DocumentFeedback" WHERE "documentId" IN (
    SELECT "id" FROM "Document" WHERE "userId" IN (v_uid1, v_uid2)
  );
  DELETE FROM "Document" WHERE "userId" IN (v_uid1, v_uid2);

  ------------------------------------------------------------------
  -- 5. JobApplication
  ------------------------------------------------------------------
  DELETE FROM "JobApplication" WHERE "candidateProfileId" IN (v_cpid1, v_cpid2);

  ------------------------------------------------------------------
  -- 6. JobFeedItem
  ------------------------------------------------------------------
  DELETE FROM "JobFeedItem" WHERE "userId" IN (v_uid1, v_uid2);

  ------------------------------------------------------------------
  -- 7. DiagnosticReport + DiagnosticReportFeedback
  ------------------------------------------------------------------
  DELETE FROM "DiagnosticReportFeedback" WHERE "reportId" IN (
    SELECT "id" FROM "DiagnosticReport" WHERE "userId" IN (v_uid1, v_uid2)
  );
  DELETE FROM "DiagnosticReport" WHERE "userId" IN (v_uid1, v_uid2);

  ------------------------------------------------------------------
  -- 8. CvScanLead & SponsorLead — matched by email
  ------------------------------------------------------------------
  DELETE FROM "CvScanLead"   WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com');
  DELETE FROM "SponsorLead"  WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com');

  ------------------------------------------------------------------
  -- 9. Contact-related records (email outreach system)
  ------------------------------------------------------------------
  IF v_contact_id1 IS NOT NULL OR v_contact_id2 IS NOT NULL THEN
    DELETE FROM "ContactNote"     WHERE "contactId" IN (v_contact_id1, v_contact_id2);
    DELETE FROM "ContactSequence" WHERE "contactId" IN (v_contact_id1, v_contact_id2);
    DELETE FROM "EmailClick" WHERE "emailSendId" IN (
      SELECT "id" FROM "EmailSend" WHERE "contactId" IN (v_contact_id1, v_contact_id2)
    );
    DELETE FROM "EmailOpen" WHERE "emailSendId" IN (
      SELECT "id" FROM "EmailSend" WHERE "contactId" IN (v_contact_id1, v_contact_id2)
    );
    DELETE FROM "EmailSend"  WHERE "contactId" IN (v_contact_id1, v_contact_id2);
    DELETE FROM "ContactTag" WHERE "contactId" IN (v_contact_id1, v_contact_id2);
  END IF;

  ------------------------------------------------------------------
  -- 10. CandidateProfile
  ------------------------------------------------------------------
  DELETE FROM "CandidateProfile" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com');

  ------------------------------------------------------------------
  -- 11. Contact (unlinked — cascade handled CandidateProfile FK)
  ------------------------------------------------------------------
  IF v_contact_id1 IS NOT NULL OR v_contact_id2 IS NOT NULL THEN
    DELETE FROM "Contact" WHERE "id" IN (v_contact_id1, v_contact_id2);
  END IF;

  ------------------------------------------------------------------
  -- 12. Catch any orphan Contact rows by email
  ------------------------------------------------------------------
  DELETE FROM "ContactNote" WHERE "contactId" IN (
    SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
  );
  DELETE FROM "ContactSequence" WHERE "contactId" IN (
    SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
  );
  DELETE FROM "EmailClick" WHERE "emailSendId" IN (
    SELECT "id" FROM "EmailSend" WHERE "contactId" IN (
      SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
    )
  );
  DELETE FROM "EmailOpen" WHERE "emailSendId" IN (
    SELECT "id" FROM "EmailSend" WHERE "contactId" IN (
      SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
    )
  );
  DELETE FROM "EmailSend" WHERE "contactId" IN (
    SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
  );
  DELETE FROM "ContactTag" WHERE "contactId" IN (
    SELECT "id" FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com')
  );
  DELETE FROM "Contact" WHERE "email" IN ('kiron182@hotmail.com', 'kamiproject2021@gmail.com');

  RAISE NOTICE 'Deletion complete for kiron182@hotmail.com and kamiproject2021@gmail.com.';
END $$;
