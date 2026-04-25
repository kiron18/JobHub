import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractTextFromBuffer } from '../services/pdf';
import { generateDiagnosticReport, DiagnosticReportInput } from '../services/diagnosticReport';
import { sendWelcomeEmail } from '../services/email';
import { autoExtractAchievements } from '../services/autoExtract';

const router = Router();

// multer: memory storage, 5MB per file limit, PDF/text only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and plain-text files are accepted'));
    }
  },
});

// ── POST /api/onboarding/submit ───────────────────────────────────────────────
router.post(
  '/submit',
  authenticate,
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter1', maxCount: 1 },
    { name: 'coverLetter2', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    let answers: DiagnosticReportInput;
    try {
      answers = JSON.parse(req.body.answers || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid answers format — must be JSON string' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const resumeFile = files?.['resume']?.[0];

    if (!resumeFile) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    try {
      const resumeText = await extractTextFromBuffer(
        resumeFile.buffer,
        resumeFile.mimetype,
        resumeFile.originalname
      );

      const cl1File = files?.['coverLetter1']?.[0];
      const cl2File = files?.['coverLetter2']?.[0];

      const coverLetterText1 = cl1File
        ? await extractTextFromBuffer(cl1File.buffer, cl1File.mimetype, cl1File.originalname)
        : undefined;

      const coverLetterText2 = cl2File
        ? await extractTextFromBuffer(cl2File.buffer, cl2File.mimetype, cl2File.originalname)
        : undefined;

      // Upsert — new users have no profile row yet; create it on first onboarding
      await prisma.candidateProfile.upsert({
        where: { userId },
        create: {
          userId,
          hasCompletedOnboarding: true,
          targetRole: answers.targetRole,
          targetCity: answers.targetCity,
          seniority: answers.seniority,
          industry: answers.industry,
          searchDuration: answers.searchDuration,
          applicationsCount: answers.applicationsCount,
          channels: answers.channels,
          responsePattern: answers.responsePattern,
          perceivedBlocker: answers.perceivedBlocker,
          resumeRawText: resumeText,
          coverLetterRawText: coverLetterText1 ?? null,
          coverLetterRawText2: coverLetterText2 ?? null,
          marketingEmail: (answers as any).marketingEmail ?? null,
          marketingConsent: (answers as any).marketingConsent ?? false,
          visaStatus: (answers as any).visaStatus ?? null,
        },
        update: {
          hasCompletedOnboarding: true,
          targetRole: answers.targetRole,
          targetCity: answers.targetCity,
          seniority: answers.seniority,
          industry: answers.industry,
          searchDuration: answers.searchDuration,
          applicationsCount: answers.applicationsCount,
          channels: answers.channels,
          responsePattern: answers.responsePattern,
          perceivedBlocker: answers.perceivedBlocker,
          resumeRawText: resumeText,
          coverLetterRawText: coverLetterText1 ?? null,
          coverLetterRawText2: coverLetterText2 ?? null,
          marketingEmail: (answers as any).marketingEmail ?? null,
          marketingConsent: (answers as any).marketingConsent ?? false,
          visaStatus: (answers as any).visaStatus ?? null,
        },
      });

      // Auto-populate Achievement Bank from resume — fire and forget
      autoExtractAchievements(userId, resumeText).catch(err =>
        console.error('[Onboarding] Auto-extract failed:', err)
      );

      const report = await prisma.diagnosticReport.upsert({
        where: { userId },
        create: {
          userId,
          status: 'PROCESSING',
          intakeAnswers: answers as any,
        },
        update: {
          status: 'PROCESSING',
          reportMarkdown: null,
          intakeAnswers: answers as any,
        },
      });

      const reportInput: DiagnosticReportInput = {
        ...answers,
        resumeText,
        coverLetterText1,
        coverLetterText2,
      };

      generateDiagnosticReport(reportInput)
        .then(async (markdown) => {
          await prisma.diagnosticReport.update({
            where: { id: report.id },
            data: { status: 'COMPLETE', reportMarkdown: markdown },
          });
          await prisma.candidateProfile.update({
            where: { userId },
            data: { hasCompletedOnboarding: true },
          });
          const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
          if ((answers as any).marketingConsent && freshProfile && !freshProfile.marketingEmailSent && (answers as any).marketingEmail) {
            await sendWelcomeEmail((answers as any).marketingEmail);
            await prisma.candidateProfile.update({
              where: { userId },
              data: { marketingEmailSent: true },
            });
          }
          console.log(`[Onboarding] Diagnostic complete for userId: ${userId}`);
        })
        .catch(async (err) => {
          console.error('[Onboarding] Diagnostic generation failed:', err);
          await prisma.diagnosticReport.update({
            where: { id: report.id },
            data: { status: 'FAILED' },
          });
        });

      return res.json({ reportId: report.id, status: 'PROCESSING' });

    } catch (error) {
      console.error('[Onboarding] Submit error:', error);
      return res.status(500).json({ error: 'Failed to process intake submission' });
    }
  }
);

// ── GET /api/onboarding/report ────────────────────────────────────────────────
router.get('/report', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const report = await prisma.diagnosticReport.findUnique({ where: { userId } });
    if (!report) {
      return res.status(404).json({ error: 'No diagnostic report found' });
    }
    return res.json({
      reportId: report.id,
      status: report.status,
      reportMarkdown: report.reportMarkdown ?? null,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[Onboarding] Report fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ── POST /api/onboarding/retry ────────────────────────────────────────────────
router.post('/retry', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const [report, profile] = await Promise.all([
      prisma.diagnosticReport.findUnique({ where: { userId } }),
      prisma.candidateProfile.findUnique({ where: { userId } }),
    ]);

    if (!report || !profile) {
      return res.status(404).json({ error: 'Report or profile not found' });
    }

    await prisma.diagnosticReport.update({
      where: { id: report.id },
      data: { status: 'PROCESSING' },
    });

    const answers = report.intakeAnswers as any;
    const reportInput: DiagnosticReportInput = {
      ...answers,
      resumeText: profile.resumeRawText ?? '',
      coverLetterText1: profile.coverLetterRawText ?? undefined,
      coverLetterText2: profile.coverLetterRawText2 ?? undefined,
    };

    generateDiagnosticReport(reportInput)
      .then(async (markdown) => {
        await prisma.diagnosticReport.update({
          where: { id: report.id },
          data: { status: 'COMPLETE', reportMarkdown: markdown },
        });
        await prisma.candidateProfile.update({
          where: { userId },
          data: { hasCompletedOnboarding: true },
        });
        const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
        if (answers.marketingConsent && freshProfile && !freshProfile.marketingEmailSent && answers.marketingEmail) {
          await sendWelcomeEmail(answers.marketingEmail);
          await prisma.candidateProfile.update({
            where: { userId },
            data: { marketingEmailSent: true },
          });
        }
      })
      .catch(async (err) => {
        console.error('[Onboarding] Retry failed:', err);
        await prisma.diagnosticReport.update({
          where: { id: report.id },
          data: { status: 'FAILED' },
        });
      });

    return res.json({ reportId: report.id, status: 'PROCESSING' });
  } catch (error) {
    console.error('[Onboarding] Retry error:', error);
    return res.status(500).json({ error: 'Failed to retry report generation' });
  }
});

// ── POST /api/onboarding/report/:reportId/feedback ────────────────────────────
router.post(
  '/report/:reportId/feedback',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const reportId = req.params['reportId'] as string;
    const { sectionKey, relevanceScore } = req.body;

    const validSections = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];
    const validScores = ['spot_on', 'partially', 'missed'];

    if (!validSections.includes(sectionKey) || !validScores.includes(relevanceScore)) {
      return res.status(400).json({ error: 'Invalid sectionKey or relevanceScore' });
    }

    try {
      const report = await prisma.diagnosticReport.findUnique({ where: { id: reportId } });
      if (!report || report.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Report not found' });
      }
      await prisma.diagnosticReportFeedback.create({
        data: { reportId, sectionKey, relevanceScore },
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[Onboarding] Feedback error:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
);

// ── POST /api/onboarding/backfill-achievements ────────────────────────────────
// Triggers auto-extraction from stored resumeRawText for users who completed
// onboarding before auto-extraction was introduced. Safe to call repeatedly —
// skips if achievements already exist.
router.post('/backfill-achievements', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile?.resumeRawText) {
      return res.json({ status: 'no_resume', message: 'No resume data found — upload via Profile & Achievements.' });
    }
    const existingCount = await prisma.achievement.count({ where: { userId } });
    if (existingCount > 0) {
      return res.json({ status: 'already_populated', count: existingCount });
    }
    // Fire async — response returns immediately
    autoExtractAchievements(userId, profile.resumeRawText).catch(err =>
      console.error('[Backfill] Auto-extract failed:', err)
    );
    return res.json({ status: 'started' });
  } catch (error) {
    console.error('[Onboarding] Backfill error:', error);
    return res.status(500).json({ error: 'Failed to start backfill' });
  }
});

// ── POST /api/onboarding/backfill-extras ──────────────────────────────────────
// Re-extracts education, volunteering, certifications, and languages from the
// stored resume. Safe to call repeatedly — deduplicates before inserting.
// Does NOT re-run achievements (avoids duplicates).
router.post('/backfill-extras', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile?.resumeRawText) {
      return res.json({ status: 'no_resume', message: 'No resume found — upload via Profile.' });
    }

    const { callLLM } = await import('../services/llm');
    const { STAGE_1_PROMPT } = await import('../services/prompts');
    const { parseLLMJson } = await import('../utils/parseLLMResponse');

    const raw = await callLLM(STAGE_1_PROMPT(profile.resumeRawText));
    let data: any;
    try { data = parseLLMJson(raw); } catch { data = {}; }

    const profileId = profile.id;
    let saved = { education: 0, volunteering: 0, certifications: 0, languages: 0 };

    await prisma.$transaction(async (tx) => {
      // Education
      const eduItems = (data.education || []).filter((e: any) => e.institution || e.degree);
      if (eduItems.length > 0) {
        const existing = await tx.education.findMany({ where: { candidateProfileId: profileId }, select: { institution: true, degree: true } });
        const existingKeys = new Set(existing.map((e: any) => `${e.institution.toLowerCase().trim()}||${e.degree.toLowerCase().trim()}`));
        const toCreate = eduItems.filter((e: any) =>
          !existingKeys.has(`${(e.institution||'Unknown Institution').toLowerCase().trim()}||${(e.degree||'Unknown Degree').toLowerCase().trim()}`)
        ).map((e: any) => ({
          candidateProfileId: profileId,
          institution: e.institution || 'Unknown Institution',
          degree: e.degree || 'Unknown Degree',
          field: e.field ?? null,
          year: e.year ?? null,
          coachingTips: Array.isArray(e.coachingTips) ? e.coachingTips.join(' | ') : (e.coachingTips || null),
        }));
        if (toCreate.length > 0) { await tx.education.createMany({ data: toCreate }); saved.education = toCreate.length; }
      }

      // Volunteering
      const volItems = (data.volunteering || []).filter((v: any) => v.org || v.organization);
      if (volItems.length > 0) {
        const existing = await tx.volunteering.findMany({ where: { candidateProfileId: profileId }, select: { organization: true, role: true } });
        const existingKeys = new Set(existing.map((v: any) => `${v.organization.toLowerCase().trim()}||${v.role.toLowerCase().trim()}`));
        const toCreate = volItems.filter((v: any) => {
          const org = (v.org || v.organization || 'Unknown').toLowerCase().trim();
          const role = (v.role || 'Volunteer').toLowerCase().trim();
          return !existingKeys.has(`${org}||${role}`);
        }).map((v: any) => ({
          candidateProfileId: profileId,
          organization: v.org || v.organization || 'Unknown Organisation',
          role: v.role || 'Volunteer',
          description: v.desc || v.description || null,
        }));
        if (toCreate.length > 0) { await tx.volunteering.createMany({ data: toCreate }); saved.volunteering = toCreate.length; }
      }

      // Certifications
      const certItems = (data.certifications || []).filter((c: any) => c.name);
      if (certItems.length > 0) {
        const existing = await tx.certification.findMany({ where: { candidateProfileId: profileId }, select: { name: true } });
        const existingNames = new Set(existing.map((c: any) => c.name.toLowerCase().trim()));
        const toCreate = certItems.filter((c: any) => !existingNames.has(c.name.toLowerCase().trim())).map((c: any) => ({
          candidateProfileId: profileId,
          name: c.name,
          issuingBody: c.issuer || c.issuingBody || 'Unknown',
          year: c.year ?? null,
        }));
        if (toCreate.length > 0) { await tx.certification.createMany({ data: toCreate }); saved.certifications = toCreate.length; }
      }

      // Languages
      const langItems = (data.languages || []).filter((l: any) => l.name);
      if (langItems.length > 0) {
        const existing = await tx.language.findMany({ where: { candidateProfileId: profileId }, select: { name: true } });
        const existingNames = new Set(existing.map((l: any) => l.name.toLowerCase().trim()));
        const toCreate = langItems.filter((l: any) => !existingNames.has(l.name.toLowerCase().trim())).map((l: any) => ({
          candidateProfileId: profileId,
          name: l.name,
          proficiency: l.proficiency || 'Conversational',
        }));
        if (toCreate.length > 0) { await tx.language.createMany({ data: toCreate }); saved.languages = toCreate.length; }
      }
    });

    return res.json({ status: 'done', saved });
  } catch (error) {
    console.error('[Onboarding] Backfill extras error:', error);
    return res.status(500).json({ error: 'Backfill failed' });
  }
});

export default router;
