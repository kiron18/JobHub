import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { extractTextFromBuffer } from '../../services/pdf';
import { forceAutoExtract } from '../../services/autoExtract';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const allowedExt = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt');
    const allowedMimes = [
      'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'application/octet-stream',
    ];
    if (allowedMimes.includes(file.mimetype) || allowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and plain-text files are accepted'));
    }
  },
});

function handleUpload(req: AuthRequest, res: Response, next: NextFunction) {
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter1', maxCount: 1 },
    { name: 'coverLetter2', maxCount: 1 },
  ])(req as any, res, (err: any) => {
    if (err) {
      const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}

// POST /api/profile/source-documents
router.post('/profile/source-documents', authenticate, handleUpload, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const resumeFile = files?.['resume']?.[0];
  const cl1File    = files?.['coverLetter1']?.[0];
  const cl2File    = files?.['coverLetter2']?.[0];

  if (!resumeFile && !cl1File && !cl2File) {
    return res.status(400).json({ error: 'At least one file must be provided' });
  }

  try {
    const update: Record<string, any> = { documentsUpdatedAt: new Date() };

    let resumeText: string | undefined;
    if (resumeFile) {
      resumeText = await extractTextFromBuffer(resumeFile.buffer, resumeFile.mimetype, resumeFile.originalname);
      update.resumeRawText  = resumeText;
      update.resumeFilename = resumeFile.originalname;
    }
    if (cl1File) {
      update.coverLetterRawText  = await extractTextFromBuffer(cl1File.buffer, cl1File.mimetype, cl1File.originalname);
      update.coverLetterFilename = cl1File.originalname;
    }
    if (cl2File) {
      update.coverLetterRawText2  = await extractTextFromBuffer(cl2File.buffer, cl2File.mimetype, cl2File.originalname);
      update.coverLetterFilename2 = cl2File.originalname;
    }

    await prisma.candidateProfile.update({ where: { userId }, data: update });

    // Re-extract profile structure from new resume — fire and forget
    if (resumeText) {
      forceAutoExtract(userId, resumeText).catch(err =>
        console.error('[SourceDocs] Force re-extract failed:', err)
      );
    }

    res.json({ status: resumeText ? 'processing' : 'updated' });
  } catch (err: any) {
    console.error('[SourceDocs] Update failed:', err);
    res.status(500).json({ error: 'Failed to update source documents' });
  }
});

export default router;
