/**
 * /api/welcome — the paid-client onboarding.
 *
 * The whole point of this flow is that the resume gets fixed ONCE, properly,
 * before anything else happens. `profile.resumeRawText` is what generate.ts
 * grounds every future resume and cover letter on, so whatever lands there is
 * what the client's applications are built from for the life of their account.
 * This route puts the CLEAN rebuilt resume there and keeps the original upload
 * in resumeOriginalText.
 *
 * The flow, and why it is shaped this way:
 *
 *   POST /brief   (anonymous) upload -> read + the questions only they can answer
 *   POST /build   (anonymous) answers -> the finished clean resume, shown to them
 *   POST /finish  (authed)    claim the session onto their account
 *
 * Everything up to /finish is anonymous on purpose: they do the work, they see
 * the finished resume, and only then are they asked for an email to save it.
 * Asking first loses people who have not yet been given a reason to trust us.
 *
 * State lives in the WelcomeSession table rather than in memory because a
 * Railway redeploy mid-flow would otherwise discard ten minutes of someone's
 * work.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { extractTextFromBuffer } from '../services/pdf';
import { prisma } from '../index';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth';
import { autoExtractAchievements } from '../services/autoExtract';
import { reconcileProfileEmail } from '../services/onboarding';
import { analyseIntakeResume, IntakeQuestion } from '../services/intakeAnalysis';
import { detectDocumentSignals, DocumentSignals } from '../services/documentSignals';
import {
  buildCleanResume,
  BlankLeakError,
  IntakeAnswer,
  IntakeAnswerStatus,
} from '../services/buildCleanResume';

const router = Router();

/** A session is good for a day — long enough to finish, short enough to sweep. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Rebuilds allowed per anonymous session. Each one costs an LLM call. */
const MAX_BUILDS = 3;

// ── Upload ───────────────────────────────────────────────────────────────────
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

/**
 * Unclaimed sessions hold a full resume for someone who never signed up, so they
 * are not kept indefinitely. Swept opportunistically on upload rather than by a
 * cron — this runs often enough and costs one indexed delete.
 */
function sweepExpiredSessions(): void {
  prisma.welcomeSession
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - SESSION_TTL_MS) } } })
    .then(({ count }) => { if (count) console.log(`[welcome] swept ${count} expired session(s)`); })
    .catch((err) => console.warn('[welcome] session sweep failed (non-fatal):', err?.message));
}

/** Loads a live, unclaimed session or returns null so the caller can 410. */
async function loadSession(token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  const session = await prisma.welcomeSession.findUnique({ where: { token } });
  if (!session) return null;
  if (Date.now() - session.createdAt.getTime() >= SESSION_TTL_MS) return null;
  return session;
}

// ── POST /api/welcome/brief ──────────────────────────────────────────────────
// Upload the resume. Returns the prose read plus the question list. Anonymous:
// optionalAuthenticate so a signed-in client can also re-run this.
router.post('/brief', optionalAuthenticate, handleUpload, async (req: Request, res: Response) => {
  try {
    const file = (req.files as any)?.resume?.[0];
    if (!file) { res.status(400).json({ error: 'Resume file is required' }); return; }

    const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
    if (!text || text.trim().length < 200) {
      res.status(422).json({ error: 'Could not read enough text from that file. Try a text-based PDF or DOCX.' });
      return;
    }

    sweepExpiredSessions();

    // Text extraction cannot see a photo, a logo or any other embedded image, so
    // inspect the raw file for what the text is structurally missing. Without
    // this the model could never mention a photo, no matter how it was prompted.
    const signals = detectDocumentSignals(file.buffer, file.mimetype, file.originalname);
    if (signals.likelyPhoto) console.log('[welcome/brief] photo detected on upload');

    const analysis = await analyseIntakeResume(text, signals);
    const token = randomUUID();

    await prisma.welcomeSession.create({
      data: {
        token,
        resumeOriginalText: text,
        resumeFilename: file.originalname ?? null,
        firstName: analysis.firstName || null,
        currentRole: analysis.currentRole || null,
        brief: analysis.brief,
        questions: analysis.questions as any,
        signals: signals as any,
      },
    });

    res.json({
      token,
      firstName: analysis.firstName,
      currentRole: analysis.currentRole,
      brief: analysis.brief,
      questions: analysis.questions,
    });
  } catch (err) {
    console.error('[welcome/brief]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not read your resume, please try again.' });
  }
});

// ── POST /api/welcome/build ──────────────────────────────────────────────────
// Their answers in, the finished clean resume out. Still anonymous — this is the
// value we hand over before asking for anything.
router.post('/build', async (req: Request, res: Response) => {
  try {
    const { token, answers, targetRole } = req.body || {};

    const session = await loadSession(token);
    if (!session) {
      res.status(410).json({ error: 'Your session expired, please upload your resume again.' });
      return;
    }
    if (session.claimedByUserId) {
      res.status(409).json({ error: 'This resume has already been saved to an account.' });
      return;
    }
    if (session.buildCount >= MAX_BUILDS) {
      res.status(429).json({ error: 'You have rebuilt this resume a few times already. Upload it again to start fresh.' });
      return;
    }

    // Only accept answers to questions we actually asked, and take the question
    // wording from OUR stored copy so a client cannot rewrite the prompt.
    const asked = (session.questions as unknown as IntakeQuestion[] | null) ?? [];
    const byId = new Map(asked.map((q) => [q.id, q]));
    const submitted: Record<string, { status?: string; value?: string }> =
      answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};

    const resolved: IntakeAnswer[] = asked.map((q) => {
      const raw = submitted[q.id] ?? {};
      const value = String(raw.value ?? '').trim().slice(0, 500);
      let status = String(raw.status ?? '') as IntakeAnswerStatus;
      if (status !== 'answered' && status !== 'later' && status !== 'unknown') {
        status = value ? 'answered' : 'unknown';
      }
      if (status === 'answered' && !value) status = 'unknown';
      return { questionId: q.id, question: q.question, anchor: byId.get(q.id)?.anchor ?? '', status, value };
    });

    await prisma.welcomeSession.update({
      where: { id: session.id },
      data: { buildCount: { increment: 1 }, answers: resolved as any },
    });

    const clean = await buildCleanResume({
      resumeText: session.resumeOriginalText,
      answers: resolved,
      targetRole: typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : null,
      signals: (session.signals as unknown as DocumentSignals | null) ?? undefined,
    });

    await prisma.welcomeSession.update({
      where: { id: session.id },
      data: { resumeCleanText: clean },
    });

    const unanswered = resolved.filter((a) => a.status !== 'answered');
    res.json({
      resume: clean,
      answeredCount: resolved.length - unanswered.length,
      outstanding: unanswered.map((a) => ({ questionId: a.questionId, question: a.question, status: a.status })),
    });
  } catch (err) {
    if (err instanceof BlankLeakError) {
      // Never persist this. Better to ask them to retry than to poison every
      // future generation with "[how many]" sitting in their resume text.
      console.error('[welcome/build] blank leak, refused to save:', err.message);
      res.status(502).json({ error: 'We could not finish your resume cleanly. Please try again.' });
      return;
    }
    console.error('[welcome/build]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not build your resume, please try again.' });
  }
});

// ── POST /api/welcome/finish ─────────────────────────────────────────────────
// Now they have an account. Claim the session onto it. Works identically whether
// this email is brand new (the OTP created it) or an existing client signing in.
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

    const session = await loadSession(token);
    if (!session) {
      res.status(410).json({ error: 'Your session expired, please upload your resume again.' });
      return;
    }
    if (session.claimedByUserId && session.claimedByUserId !== userId) {
      res.status(409).json({ error: 'This resume has already been saved to another account.' });
      return;
    }
    if (!session.resumeCleanText) {
      res.status(409).json({ error: 'Your resume has not been built yet.' });
      return;
    }

    const loc = String(targetCity || '').trim() || null;

    // email is unique on CandidateProfile — a previous free-scan row under an
    // old userId can already hold it, which would make the upsert throw.
    await reconcileProfileEmail(userId, email);

    const existing = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { resumeOriginalText: true },
    });

    const data = {
      email,
      // The CLEAN resume is what every generation grounds on. This is the line
      // the entire intake exists to make true.
      resumeRawText: session.resumeCleanText,
      // Keep the untouched upload, but never clobber an earlier original.
      resumeOriginalText: existing?.resumeOriginalText ?? session.resumeOriginalText,
      resumeFilename: session.resumeFilename,
      documentsUpdatedAt: new Date(),
      targetRole: roles[0],
      targetRoles: roles,
      targetCity: loc,
      location: loc,
      hasCompletedOnboarding: true,
    };

    await prisma.candidateProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    await prisma.welcomeSession.update({
      where: { id: session.id },
      data: { claimedByUserId: userId },
    });

    // Build the structured bank from the CLEAN text, not the messy upload.
    autoExtractAchievements(userId, session.resumeCleanText)
      .catch((err) => console.warn('[welcome/finish] autoExtract failed (non-fatal):', err?.message));

    res.json({ ok: true });
  } catch (err) {
    console.error('[welcome/finish]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not complete setup, please try again.' });
  }
});

export { router as welcomeRouter };
