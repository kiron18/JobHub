-- ============================================================
-- RLS: Production tables
-- Run in Supabase SQL Editor.
-- Re-runnable: each CREATE POLICY is preceded by DROP IF EXISTS.
-- ============================================================

-- Enable RLS on all user-data tables
ALTER TABLE "CandidateProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResumeVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Experience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Education" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Volunteering" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Language" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobFeedItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticReportFeedback" ENABLE ROW LEVEL SECURITY;

-- CandidateProfile: direct userId
DROP POLICY IF EXISTS "Users can view own profile" ON "CandidateProfile";
CREATE POLICY "Users can view own profile" ON "CandidateProfile"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own profile" ON "CandidateProfile";
CREATE POLICY "Users can insert own profile" ON "CandidateProfile"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own profile" ON "CandidateProfile";
CREATE POLICY "Users can update own profile" ON "CandidateProfile"
  FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own profile" ON "CandidateProfile";
CREATE POLICY "Users can delete own profile" ON "CandidateProfile"
  FOR DELETE USING (auth.uid()::text = "userId");

-- ResumeVersion: direct userId
DROP POLICY IF EXISTS "Users can view own resume versions" ON "ResumeVersion";
CREATE POLICY "Users can view own resume versions" ON "ResumeVersion"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own resume versions" ON "ResumeVersion";
CREATE POLICY "Users can insert own resume versions" ON "ResumeVersion"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own resume versions" ON "ResumeVersion";
CREATE POLICY "Users can update own resume versions" ON "ResumeVersion"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own resume versions" ON "ResumeVersion";
CREATE POLICY "Users can delete own resume versions" ON "ResumeVersion"
  FOR DELETE USING (auth.uid()::text = "userId");

-- Experience: linked via CandidateProfile
DROP POLICY IF EXISTS "Users can view own experience" ON "Experience";
CREATE POLICY "Users can view own experience" ON "Experience"
  FOR SELECT USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own experience" ON "Experience";
CREATE POLICY "Users can insert own experience" ON "Experience"
  FOR INSERT WITH CHECK ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own experience" ON "Experience";
CREATE POLICY "Users can update own experience" ON "Experience"
  FOR UPDATE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own experience" ON "Experience";
CREATE POLICY "Users can delete own experience" ON "Experience"
  FOR DELETE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));

-- Education: linked via CandidateProfile
DROP POLICY IF EXISTS "Users can view own education" ON "Education";
CREATE POLICY "Users can view own education" ON "Education"
  FOR SELECT USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own education" ON "Education";
CREATE POLICY "Users can insert own education" ON "Education"
  FOR INSERT WITH CHECK ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own education" ON "Education";
CREATE POLICY "Users can update own education" ON "Education"
  FOR UPDATE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own education" ON "Education";
CREATE POLICY "Users can delete own education" ON "Education"
  FOR DELETE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));

-- Volunteering: linked via CandidateProfile
DROP POLICY IF EXISTS "Users can view own volunteering" ON "Volunteering";
CREATE POLICY "Users can view own volunteering" ON "Volunteering"
  FOR SELECT USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own volunteering" ON "Volunteering";
CREATE POLICY "Users can insert own volunteering" ON "Volunteering"
  FOR INSERT WITH CHECK ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own volunteering" ON "Volunteering";
CREATE POLICY "Users can update own volunteering" ON "Volunteering"
  FOR UPDATE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own volunteering" ON "Volunteering";
CREATE POLICY "Users can delete own volunteering" ON "Volunteering"
  FOR DELETE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));

-- Certification: linked via CandidateProfile
DROP POLICY IF EXISTS "Users can view own certifications" ON "Certification";
CREATE POLICY "Users can view own certifications" ON "Certification"
  FOR SELECT USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own certifications" ON "Certification";
CREATE POLICY "Users can insert own certifications" ON "Certification"
  FOR INSERT WITH CHECK ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own certifications" ON "Certification";
CREATE POLICY "Users can update own certifications" ON "Certification"
  FOR UPDATE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own certifications" ON "Certification";
CREATE POLICY "Users can delete own certifications" ON "Certification"
  FOR DELETE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));

-- Language: linked via CandidateProfile
DROP POLICY IF EXISTS "Users can view own languages" ON "Language";
CREATE POLICY "Users can view own languages" ON "Language"
  FOR SELECT USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own languages" ON "Language";
CREATE POLICY "Users can insert own languages" ON "Language"
  FOR INSERT WITH CHECK ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own languages" ON "Language";
CREATE POLICY "Users can update own languages" ON "Language"
  FOR UPDATE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own languages" ON "Language";
CREATE POLICY "Users can delete own languages" ON "Language"
  FOR DELETE USING ("candidateProfileId" IN (SELECT id FROM "CandidateProfile" WHERE "userId" = auth.uid()::text));

-- Achievement: direct userId
DROP POLICY IF EXISTS "Users can view own achievements" ON "Achievement";
CREATE POLICY "Users can view own achievements" ON "Achievement"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own achievements" ON "Achievement";
CREATE POLICY "Users can insert own achievements" ON "Achievement"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own achievements" ON "Achievement";
CREATE POLICY "Users can update own achievements" ON "Achievement"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own achievements" ON "Achievement";
CREATE POLICY "Users can delete own achievements" ON "Achievement"
  FOR DELETE USING (auth.uid()::text = "userId");

-- JobApplication: direct userId
DROP POLICY IF EXISTS "Users can view own job applications" ON "JobApplication";
CREATE POLICY "Users can view own job applications" ON "JobApplication"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own job applications" ON "JobApplication";
CREATE POLICY "Users can insert own job applications" ON "JobApplication"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own job applications" ON "JobApplication";
CREATE POLICY "Users can update own job applications" ON "JobApplication"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own job applications" ON "JobApplication";
CREATE POLICY "Users can delete own job applications" ON "JobApplication"
  FOR DELETE USING (auth.uid()::text = "userId");

-- JobFeedItem: direct userId
DROP POLICY IF EXISTS "Users can view own job feed items" ON "JobFeedItem";
CREATE POLICY "Users can view own job feed items" ON "JobFeedItem"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own job feed items" ON "JobFeedItem";
CREATE POLICY "Users can insert own job feed items" ON "JobFeedItem"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own job feed items" ON "JobFeedItem";
CREATE POLICY "Users can update own job feed items" ON "JobFeedItem"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own job feed items" ON "JobFeedItem";
CREATE POLICY "Users can delete own job feed items" ON "JobFeedItem"
  FOR DELETE USING (auth.uid()::text = "userId");

-- Document: direct userId
DROP POLICY IF EXISTS "Users can view own documents" ON "Document";
CREATE POLICY "Users can view own documents" ON "Document"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own documents" ON "Document";
CREATE POLICY "Users can insert own documents" ON "Document"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own documents" ON "Document";
CREATE POLICY "Users can update own documents" ON "Document"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own documents" ON "Document";
CREATE POLICY "Users can delete own documents" ON "Document"
  FOR DELETE USING (auth.uid()::text = "userId");

-- DocumentFeedback: direct userId
DROP POLICY IF EXISTS "Users can view own document feedback" ON "DocumentFeedback";
CREATE POLICY "Users can view own document feedback" ON "DocumentFeedback"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own document feedback" ON "DocumentFeedback";
CREATE POLICY "Users can insert own document feedback" ON "DocumentFeedback"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own document feedback" ON "DocumentFeedback";
CREATE POLICY "Users can update own document feedback" ON "DocumentFeedback"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own document feedback" ON "DocumentFeedback";
CREATE POLICY "Users can delete own document feedback" ON "DocumentFeedback"
  FOR DELETE USING (auth.uid()::text = "userId");

-- DiagnosticReport: direct userId
DROP POLICY IF EXISTS "Users can view own diagnostic report" ON "DiagnosticReport";
CREATE POLICY "Users can view own diagnostic report" ON "DiagnosticReport"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can insert own diagnostic report" ON "DiagnosticReport";
CREATE POLICY "Users can insert own diagnostic report" ON "DiagnosticReport"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can update own diagnostic report" ON "DiagnosticReport";
CREATE POLICY "Users can update own diagnostic report" ON "DiagnosticReport"
  FOR UPDATE USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "Users can delete own diagnostic report" ON "DiagnosticReport";
CREATE POLICY "Users can delete own diagnostic report" ON "DiagnosticReport"
  FOR DELETE USING (auth.uid()::text = "userId");

-- DiagnosticReportFeedback: linked via reportId -> DiagnosticReport -> userId
DROP POLICY IF EXISTS "Users can view own report feedback" ON "DiagnosticReportFeedback";
CREATE POLICY "Users can view own report feedback" ON "DiagnosticReportFeedback"
  FOR SELECT USING ("reportId" IN (SELECT id FROM "DiagnosticReport" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can insert own report feedback" ON "DiagnosticReportFeedback";
CREATE POLICY "Users can insert own report feedback" ON "DiagnosticReportFeedback"
  FOR INSERT WITH CHECK ("reportId" IN (SELECT id FROM "DiagnosticReport" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can update own report feedback" ON "DiagnosticReportFeedback";
CREATE POLICY "Users can update own report feedback" ON "DiagnosticReportFeedback"
  FOR UPDATE USING ("reportId" IN (SELECT id FROM "DiagnosticReport" WHERE "userId" = auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own report feedback" ON "DiagnosticReportFeedback";
CREATE POLICY "Users can delete own report feedback" ON "DiagnosticReportFeedback"
  FOR DELETE USING ("reportId" IN (SELECT id FROM "DiagnosticReport" WHERE "userId" = auth.uid()::text));

-- ============================================================
-- ROLLBACK (uncomment and run if something breaks):
-- Drops all policies and disables RLS -- back to open access.
-- ============================================================
-- DROP POLICY IF EXISTS "Users can view own profile" ON "CandidateProfile";
-- DROP POLICY IF EXISTS "Users can insert own profile" ON "CandidateProfile";
-- DROP POLICY IF EXISTS "Users can update own profile" ON "CandidateProfile";
-- DROP POLICY IF EXISTS "Users can delete own profile" ON "CandidateProfile";
-- DROP POLICY IF EXISTS "Users can view own resume versions" ON "ResumeVersion";
-- DROP POLICY IF EXISTS "Users can insert own resume versions" ON "ResumeVersion";
-- DROP POLICY IF EXISTS "Users can update own resume versions" ON "ResumeVersion";
-- DROP POLICY IF EXISTS "Users can delete own resume versions" ON "ResumeVersion";
-- DROP POLICY IF EXISTS "Users can view own experience" ON "Experience";
-- DROP POLICY IF EXISTS "Users can insert own experience" ON "Experience";
-- DROP POLICY IF EXISTS "Users can update own experience" ON "Experience";
-- DROP POLICY IF EXISTS "Users can delete own experience" ON "Experience";
-- DROP POLICY IF EXISTS "Users can view own education" ON "Education";
-- DROP POLICY IF EXISTS "Users can insert own education" ON "Education";
-- DROP POLICY IF EXISTS "Users can update own education" ON "Education";
-- DROP POLICY IF EXISTS "Users can delete own education" ON "Education";
-- DROP POLICY IF EXISTS "Users can view own volunteering" ON "Volunteering";
-- DROP POLICY IF EXISTS "Users can insert own volunteering" ON "Volunteering";
-- DROP POLICY IF EXISTS "Users can update own volunteering" ON "Volunteering";
-- DROP POLICY IF EXISTS "Users can delete own volunteering" ON "Volunteering";
-- DROP POLICY IF EXISTS "Users can view own certifications" ON "Certification";
-- DROP POLICY IF EXISTS "Users can insert own certifications" ON "Certification";
-- DROP POLICY IF EXISTS "Users can update own certifications" ON "Certification";
-- DROP POLICY IF EXISTS "Users can delete own certifications" ON "Certification";
-- DROP POLICY IF EXISTS "Users can view own languages" ON "Language";
-- DROP POLICY IF EXISTS "Users can insert own languages" ON "Language";
-- DROP POLICY IF EXISTS "Users can update own languages" ON "Language";
-- DROP POLICY IF EXISTS "Users can delete own languages" ON "Language";
-- DROP POLICY IF EXISTS "Users can view own achievements" ON "Achievement";
-- DROP POLICY IF EXISTS "Users can insert own achievements" ON "Achievement";
-- DROP POLICY IF EXISTS "Users can update own achievements" ON "Achievement";
-- DROP POLICY IF EXISTS "Users can delete own achievements" ON "Achievement";
-- DROP POLICY IF EXISTS "Users can view own job applications" ON "JobApplication";
-- DROP POLICY IF EXISTS "Users can insert own job applications" ON "JobApplication";
-- DROP POLICY IF EXISTS "Users can update own job applications" ON "JobApplication";
-- DROP POLICY IF EXISTS "Users can delete own job applications" ON "JobApplication";
-- DROP POLICY IF EXISTS "Users can view own job feed items" ON "JobFeedItem";
-- DROP POLICY IF EXISTS "Users can insert own job feed items" ON "JobFeedItem";
-- DROP POLICY IF EXISTS "Users can update own job feed items" ON "JobFeedItem";
-- DROP POLICY IF EXISTS "Users can delete own job feed items" ON "JobFeedItem";
-- DROP POLICY IF EXISTS "Users can view own documents" ON "Document";
-- DROP POLICY IF EXISTS "Users can insert own documents" ON "Document";
-- DROP POLICY IF EXISTS "Users can update own documents" ON "Document";
-- DROP POLICY IF EXISTS "Users can delete own documents" ON "Document";
-- DROP POLICY IF EXISTS "Users can view own document feedback" ON "DocumentFeedback";
-- DROP POLICY IF EXISTS "Users can insert own document feedback" ON "DocumentFeedback";
-- DROP POLICY IF EXISTS "Users can update own document feedback" ON "DocumentFeedback";
-- DROP POLICY IF EXISTS "Users can delete own document feedback" ON "DocumentFeedback";
-- DROP POLICY IF EXISTS "Users can view own diagnostic report" ON "DiagnosticReport";
-- DROP POLICY IF EXISTS "Users can insert own diagnostic report" ON "DiagnosticReport";
-- DROP POLICY IF EXISTS "Users can update own diagnostic report" ON "DiagnosticReport";
-- DROP POLICY IF EXISTS "Users can delete own diagnostic report" ON "DiagnosticReport";
-- DROP POLICY IF EXISTS "Users can view own report feedback" ON "DiagnosticReportFeedback";
-- DROP POLICY IF EXISTS "Users can insert own report feedback" ON "DiagnosticReportFeedback";
-- DROP POLICY IF EXISTS "Users can update own report feedback" ON "DiagnosticReportFeedback";
-- DROP POLICY IF EXISTS "Users can delete own report feedback" ON "DiagnosticReportFeedback";
-- ALTER TABLE "CandidateProfile" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "ResumeVersion" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Experience" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Education" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Volunteering" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Certification" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Language" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Achievement" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "JobApplication" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "JobFeedItem" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Document" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "DocumentFeedback" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "DiagnosticReport" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "DiagnosticReportFeedback" DISABLE ROW LEVEL SECURITY;
