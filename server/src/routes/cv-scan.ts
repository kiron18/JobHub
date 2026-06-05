import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { ipRateLimit } from '../middleware/ipRateLimit';
import { extractTextFromBuffer } from '../services/pdf';
import { runCvGapScan, runRoadmap, CvGapResult } from '../services/cvGapScan';
import { prisma } from '../index';
import { sendRoadmapEmail } from '../services/email';

const router = Router();

// ── Multer setup (same pattern as onboarding.ts) ─────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/octet-stream',
    ];
    const ext = file.originalname.toLowerCase();
    const allowedExt = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt');
    if (allowedMimes.includes(file.mimetype) || allowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and plain-text files are accepted'));
    }
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.fields([{ name: 'resume', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 5MB.' : err.message)
        : err.message;
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

// ── In-memory scan result cache (hash → result, avoids re-running LLM) ──────

const resultCache = new Map<string, { result: CvGapResult; at: number }>();
const RESULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Scan store (scanId → resumeText + result, for later roadmap generation) ──

interface ScanStoreEntry {
  resumeText: string;
  result: CvGapResult;
  at: number;
}
const scanStore = new Map<string, ScanStoreEntry>();
const SCAN_STORE_TTL = 60 * 60 * 1000; // 60 minutes

function trimScanStore() {
  if (scanStore.size <= 100) return;
  const sorted = [...scanStore.entries()].sort((a, b) => b[1].at - a[1].at);
  scanStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) scanStore.set(k, v);
}

function buildScanResponse(scanId: string, result: CvGapResult) {
  return {
    scanId,
    score: result.score,
    inferredRole: result.inferredRole,
    firstName: result.firstName,
    fullName: result.fullName,
    items: result.items,
    quickWins: result.quickWins,
    lockedGapCount: 7,
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  ipRateLimit,
  handleUpload,
  async (req: Request, res: Response) => {
    try {
      const file = (req.files as any)?.resume?.[0];
      if (!file) {
        res.status(400).json({ error: 'Resume file is required' });
        return;
      }

      const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
      if (!text || text.trim().length < 200) {
        res.status(422).json({ error: 'Could not read enough text from that file. Try a text-based PDF or DOCX.' });
        return;
      }

      const hash = crypto.createHash('sha256').update(text).digest('hex');
      const cached = resultCache.get(hash);
      if (cached && Date.now() - cached.at < RESULT_CACHE_TTL) {
        const result = cached.result;
        // Guard: old cache entries may be missing fields from a schema version change
        if ((result as any).quickWins && (result as any).firstName !== undefined) {
          const scanId = randomUUID();
          scanStore.set(scanId, { resumeText: text, result, at: Date.now() });
          trimScanStore();
          res.json(buildScanResponse(scanId, result));
          return;
        }
        // Stale schema — fall through and re-scan
      }

      const result = await runCvGapScan(text);
      resultCache.set(hash, { result, at: Date.now() });

      // Trim cache to newest 50 entries on write
      if (resultCache.size > 50) {
        const sorted = [...resultCache.entries()].sort((a, b) => b[1].at - a[1].at);
        resultCache.clear();
        for (const [k, v] of sorted.slice(0, 50)) {
          resultCache.set(k, v);
        }
      }

      // Store in scanStore for later roadmap generation
      const scanId = randomUUID();
      scanStore.set(scanId, { resumeText: text, result, at: Date.now() });
      trimScanStore();

      res.json(buildScanResponse(scanId, result));
    } catch (err) {
      console.error('[cv-scan] error:', err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err), err instanceof Error ? err.stack : '');
      res.status(502).json({ error: 'Scan failed, please try again.' });
    }
  },
);

// ── §C – POST /api/cv-scan/lead ──────────────────────────────────────────────

router.post(
  '/lead',
  ipRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { scanId, email } = req.body || {};

      // 1. Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        res.status(400).json({ error: 'Enter a valid email' });
        return;
      }

      // 2. Look up scan store
      const entry = scanStore.get(scanId);
      if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) {
        res.status(410).json({ error: 'Your scan expired — please scan again.' });
        return;
      }

      // 3. Generate roadmap
      const roadmap = await runRoadmap(entry.resumeText, entry.result.firstName || '');

      // 4. Upsert lead row
      await prisma.cvScanLead.upsert({
        where: { email },
        create: {
          email,
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
        update: {
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
      });

      // 5. Fire email (await but don't fail request if it throws)
      try {
        await sendRoadmapEmail(email, entry.result.firstName || '', entry.result, roadmap);
      } catch (emailErr) {
        console.error('[cv-scan/lead] email send failed (request continues):', emailErr instanceof Error ? emailErr.message : String(emailErr));
      }

      // 6. Return roadmap
      res.json({ roadmap });
    } catch (err) {
      console.error('[cv-scan/lead]', err instanceof Error ? `${err.name}: ${err.message}` : String(err), err instanceof Error ? err.stack : '');
      res.status(502).json({ error: 'Could not build your roadmap, please try again.' });
    }
  },
);

export { router as cvScanRouter };
