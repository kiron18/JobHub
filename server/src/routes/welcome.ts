/**
 * /api/welcome — the paid-client onboarding (mirror of the CV scan, but calmer).
 *
 * These users have already paid, so there is NO selling and NO scoring. The flow
 * is: upload resume -> a short, warm, educational read on the gaps (a single
 * Claude prompt, written as prose) -> we tell them we'll fix it -> capture target
 * roles -> mark onboarding complete and send them to the dashboard.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { extractTextFromBuffer } from '../services/pdf';
import { callLLM } from '../services/llm';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { autoExtractAchievements } from '../services/autoExtract';
import { reconcileProfileEmail } from '../services/onboarding';
import { parseLLMJson } from '../utils/parseLLMResponse';

const router = Router();

// ── Upload (same shape as cv-scan / onboarding) ──────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const ok = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt');
    cb(null, ok);
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

// token -> stored resume text, so /finish can persist the exact resume they saw.
const welcomeStore = new Map<string, { resumeText: string; filename: string | null; at: number }>();
const TTL = 60 * 60 * 1000;
function trimStore() {
  if (welcomeStore.size <= 100) return;
  const sorted = [...welcomeStore.entries()].sort((a, b) => b[1].at - a[1].at);
  welcomeStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) welcomeStore.set(k, v);
}

const WELCOME_BRIEF_PROMPT = (resumeText: string): string => `You are a warm, expert Australian career coach welcoming a NEW PAYING CLIENT who has just uploaded their resume. They have already committed to the program, so do NOT sell, pitch, congratulate them on joining, or mention price. Your only job is to educate them, briefly and kindly, about where their resume stands.

Read the resume and write a short, human read in flowing prose. Rules:
- 2 or 3 short paragraphs. Plain sentences. NO bullet points, NO numbered lists, NO headings, NO score.
- Name the two or three most important things holding it back in the Australian market (for example: bullets that describe duties instead of outcomes, missing keywords local employers scan for, formatting that trips the automated screen, or unclear positioning). Explain each as understanding, not as a verdict or a failure.
- Warm and direct, second person ("your resume", "you"). Never clinical or alarming.
- End by reassuring them that this is exactly what we will fix together, starting now.
- Australian English. No em dashes or en dashes. About 90 to 140 words total.

Return ONLY this JSON object, nothing else:
{ "firstName": "their first name, or an empty string if unclear", "brief": "the prose read, as one string with \\n\\n between paragraphs" }

RESUME:
${resumeText}`;

// POST /api/welcome/brief — upload resume, get the educational prose read.
router.post('/brief', authenticate, handleUpload, async (req: Request, res: Response) => {
  try {
    const file = (req.files as any)?.resume?.[0];
    if (!file) { res.status(400).json({ error: 'Resume file is required' }); return; }

    const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
    if (!text || text.trim().length < 200) {
      res.status(422).json({ error: 'Could not read enough text from that file. Try a text-based PDF or DOCX.' });
      return;
    }

    const raw = await callLLM(WELCOME_BRIEF_PROMPT(text), true, 0.4);
    const parsed = typeof raw === 'string' ? parseLLMJson(raw) : raw;
    const firstName = String(parsed.firstName ?? '').trim();
    const brief = String(parsed.brief ?? '').trim();
    if (!brief) { res.status(502).json({ error: 'Could not read your resume, please try again.' }); return; }

    const token = randomUUID();
    welcomeStore.set(token, { resumeText: text, filename: file.originalname ?? null, at: Date.now() });
    trimStore();

    res.json({ token, firstName, brief });
  } catch (err) {
    console.error('[welcome/brief]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not read your resume, please try again.' });
  }
});

// POST /api/welcome/finish — persist resume + target roles, complete onboarding.
router.post('/finish', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email ?? null;
    const { token, targetRoles, targetCity } = req.body || {};

    const roles = (Array.isArray(targetRoles) ? targetRoles : [])
      .map((r: unknown) => String(r).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (roles.length === 0) { res.status(400).json({ error: 'Add at least one target role' }); return; }

    const entry = welcomeStore.get(token);
    if (!entry || Date.now() - entry.at >= TTL) {
      res.status(410).json({ error: 'Your session expired, please upload your resume again.' });
      return;
    }

    const loc = String(targetCity || '').trim() || null;
    const data = {
      email,
      resumeRawText: entry.resumeText,
      resumeFilename: entry.filename,
      documentsUpdatedAt: new Date(),
      targetRole: roles[0],
      targetRoles: roles,
      targetCity: loc,
      location: loc,
      hasCompletedOnboarding: true,
    };

    // email is unique on CandidateProfile — a previous free-scan row under an
    // old userId can already hold it, which would make the upsert throw.
    await reconcileProfileEmail(userId, email);

    await prisma.candidateProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    // Build the structured bank in the background so /apply has rich inputs.
    autoExtractAchievements(userId, entry.resumeText)
      .catch((err) => console.warn('[welcome/finish] autoExtract failed (non-fatal):', err?.message));

    res.json({ ok: true });
  } catch (err) {
    console.error('[welcome/finish]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not complete setup, please try again.' });
  }
});

export { router as welcomeRouter };
