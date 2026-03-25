import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractTextFromBuffer } from '../services/pdf';
import { generateDiagnosticReport, DiagnosticReportInput } from '../services/diagnosticReport';

const router = Router();

// multer: memory storage, 5MB per file limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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
        },
        update: {
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
        },
      });

      const report = await prisma.diagnosticReport.create({
        data: {
          userId,
          status: 'PROCESSING',
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

export default router;
