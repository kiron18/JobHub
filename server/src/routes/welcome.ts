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
 *   POST  /brief   (anonymous) upload -> read + the questions only they can answer
 *   POST  /build   (anonymous) answers -> the finished clean resume, shown to them
 *   PATCH /resume  (anonymous) their own edit of it, before the single send
 *   POST  /finish  (authed)    claim the session onto their account
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
import { ipRateLimit } from '../middleware/ipRateLimit';
import { autoExtractAchievements } from '../services/autoExtract';
import { reconcileProfileEmail } from '../services/onboarding';
import { sendWelcomeResumeEmail } from '../services/email';
import { renderResumePdf } from '../services/resumePdf';
import { analyseIntakeResume, IntakeQuestion } from '../services/intakeAnalysis';
import { detectDocumentSignals, DocumentSignals } from '../services/documentSignals';
import { extractDocxStructure } from '../services/docxStructure';
import {
  buildCleanResume,
  BlankLeakError,
  ContentLossError,
  UngroundedFigureError,
  IntakeAnswer,
  IntakeAnswerStatus,
} from '../services/buildCleanResume';
import { MustKeep, describeRetention } from '../services/retentionGate';
import { targetRoleSeed } from '../lib/targetRoleSeed';
import { assertResumeSource, ResumeSourceError } from '../lib/resumeSourceGate';

const router = Router();

/** A session is good for a day — long enough to finish, short enough to sweep. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Rebuilds allowed per anonymous session. Each one costs an LLM call. */
const MAX_BUILDS = 3;
/**
 * Ceiling on an edited resume. Nothing a person types into that box comes near
 * this — a long two-pager is around 6,000 characters — so it is not a limit on
 * the candidate, it is a limit on what an automated client can push into a text
 * column that every future generation is then built from.
 */
const MAX_RESUME_CHARS = 60_000;

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

/**
 * The email address printed on the resume, if there is one.
 *
 * Used to pre-fill the address field at the end of the flow: people mistype the
 * thing they have typed ten thousand times, and a wrong address means the copy of
 * their resume never arrives and we can never reach them again. Their own
 * document is the most reliable source we have.
 *
 * Deliberately conservative: the first plausible match in the opening stretch of
 * the document, where contact details live. A referee's address further down
 * should never win.
 */
export function emailFromResume(text: string): string | null {
  const head = (text || '').slice(0, 1500);
  const match = head.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (!match) return null;

  const addr = match[0].toLowerCase().replace(/[.,;:]+$/, '');
  // Sample addresses left in templates people downloaded and never cleaned up.
  if (/^(example|email|yourname|name|firstname|lastname)@/.test(addr)) return null;
  if (/@(example|domain|email|company)\.(com|org)$/.test(addr)) return null;
  return addr;
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
router.post('/brief', ipRateLimit, optionalAuthenticate, handleUpload, async (req: Request, res: Response) => {
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

    const name = (file.originalname || '').toLowerCase();
    const isPdf = name.endsWith('.pdf') || (file.mimetype || '').includes('pdf');
    const isDocx = name.endsWith('.docx') || (file.mimetype || '').includes('wordprocessingml');

    // Word files cannot be sent natively, so convert to structure-preserving
    // HTML instead. Without this the model cannot see tables, and content laid
    // out in a table is one of the worst things on an Australian resume.
    const structure = isDocx ? await extractDocxStructure(file.buffer) : null;
    if (structure?.tableCount) {
      console.log(`[welcome/brief] docx structure: ${structure.tableCount} table(s), largest ${structure.largestTableCells} cells`);
    }

    const analysis = await analyseIntakeResume(
      text,
      signals,
      { buffer: file.buffer, filename: file.originalname || 'resume.pdf', isPdf },
      structure,
    );
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
        mustKeep: analysis.mustKeep as any,
      },
    });

    res.json({
      token,
      resumeEmail: emailFromResume(text),
      firstName: analysis.firstName,
      currentRole: analysis.currentRole,
      // What to AIM at, which is not the same as what they hold now. The box on
      // the client is seeded from this, never from currentRole. See targetRoleSeed.
      suggestedTargetRole: targetRoleSeed(analysis.currentRole),
      brief: analysis.brief,
      findings: analysis.findings,
      strengths: analysis.strengths,
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

    const built = await buildCleanResume({
      resumeText: session.resumeOriginalText,
      answers: resolved,
      targetRole: typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : null,
      signals: (session.signals as unknown as DocumentSignals | null) ?? undefined,
      mustKeep: (session.mustKeep as unknown as MustKeep | null) ?? undefined,
    });
    const clean = built.resume;

    if (built.repaired) {
      console.log('[welcome/build] retention gate recovered dropped content on retry');
    }

    await prisma.welcomeSession.update({
      where: { id: session.id },
      data: { resumeCleanText: clean },
    });

    // The real page count, off the same renderer that produces the emailed PDF,
    // rather than a guess from character count. Length estimates are wrong the
    // moment someone has a long education section, and this is the one number on
    // that screen an Australian candidate is actually judged on. Never fatal: a
    // render failure costs the count, not the resume.
    let pageCount: number | null = null;
    try {
      pageCount = (await renderResumePdf(clean)).pages;
    } catch (err) {
      console.warn('[welcome/build] page count unavailable:', (err as Error).message);
    }

    const unanswered = resolved.filter((a) => a.status !== 'answered');
    res.json({
      resume: clean,
      pageCount,
      // Shown to the candidate so they sign off on a document they know was
      // checked, rather than being asked to proofread it themselves.
      retention: {
        checked: built.retention.checked,
        summary: describeRetention(built.retention),
        repaired: built.repaired,
      },
      answeredCount: resolved.length - unanswered.length,
      outstanding: unanswered.map((a) => ({ questionId: a.questionId, question: a.question, status: a.status })),
    });
  } catch (err) {
    if (err instanceof ContentLossError) {
      // Never persist a resume that lost part of their real history.
      //
      // `missing` rides along in the response as well as the log. Every one of
      // these is three LLM attempts that all dropped the same thing, and the
      // only way to tell an over-strict check from a genuinely bad rewrite is to
      // see WHICH items it says went missing. Without that, this is a dead end
      // for the candidate and a mystery for us: the browser console shows a
      // bare 502 and the reason sits in a log nobody is reading at the time.
      //
      // It is their own resume content, so there is nothing here they are not
      // already looking at.
      console.error('[welcome/build] content loss, refused to save:', err.message);
      res.status(502).json({
        error: 'We could not rebuild your resume without leaving something out. Please try again.',
        missing: err.missing?.map((m) => m.item) ?? [],
      });
      return;
    }
    if (err instanceof UngroundedFigureError) {
      console.error('[welcome/build] unsourced figures, refused to save:', err.message);
      res.status(502).json({ error: 'We could not rebuild your resume without adding a figure we cannot verify. Please try again.' });
      return;
    }
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

// ── PATCH /api/welcome/resume ────────────────────────────────────────────────
// The candidate's own edit of the rebuilt resume, saved before the single send.
//
// Anonymous like /brief and /build: the token IS the credential, and the whole
// point of this flow is that they do the work and see the result before being
// asked for an email. This is also the last write to resumeCleanText before
// /finish copies it onto the profile, so it runs the same gate that guards that
// field — in 'human' mode, because they wrote it.
router.patch('/resume', async (req: Request, res: Response) => {
  try {
    const { token, resume } = req.body || {};

    const session = await loadSession(token);
    if (!session) {
      res.status(410).json({ error: 'Your session expired, please upload your resume again.' });
      return;
    }
    if (session.claimedByUserId) {
      res.status(409).json({ error: 'This resume has already been saved to an account.' });
      return;
    }
    if (!session.resumeCleanText) {
      res.status(409).json({ error: 'Your resume has not been built yet.' });
      return;
    }

    const text = typeof resume === 'string' ? resume.trim() : '';
    if (!text) { res.status(400).json({ error: 'Nothing to save.' }); return; }
    if (text.length > MAX_RESUME_CHARS) {
      res.status(413).json({ error: 'That is longer than a resume can be. Trim it and try again.' });
      return;
    }

    // Their own history is the source, same as at /finish: the original upload
    // plus everything they told us in the questions. 'human' mode, so a figure
    // they added that is in neither is an advisory rather than a refusal — it is
    // their resume, and the upload is not the limit of what is true about them.
    const answered = ((session.answers as unknown as IntakeAnswer[] | null) ?? [])
      .filter((a) => a.status === 'answered')
      .map((a) => a.value);
    const check = assertResumeSource(
      text,
      [session.resumeOriginalText, ...answered],
      'human',
      'welcome/edit',
    );

    await prisma.welcomeSession.update({
      where: { id: session.id },
      data: { resumeCleanText: text, resumeEditedAt: new Date() },
    });

    // Recomputed off the same renderer that produces the emailed PDF, so the
    // number on screen moves as they cut. Never fatal: a render failure costs
    // the count, not the edit they just made.
    let pageCount: number | null = null;
    try {
      pageCount = (await renderResumePdf(text)).pages;
    } catch (err) {
      console.warn('[welcome/resume] page count unavailable:', (err as Error).message);
    }

    res.json({ ok: true, pageCount, figures: check.ungroundedFigures });
  } catch (err) {
    if (err instanceof ResumeSourceError) {
      // In 'human' mode only two things throw, and both are defects in the
      // document rather than claims about the person, so both can be said
      // plainly enough to act on.
      const { tooShort, placeholders } = err.check;
      console.warn('[welcome/resume] refused the edit:', err.message);
      res.status(422).json({
        error: tooShort
          ? 'That is too short to be a resume. Put the content back before saving.'
          : `Fill in the square brackets before saving: ${placeholders.slice(0, 3).join(', ')}`,
        placeholders,
      });
      return;
    }
    console.error('[welcome/resume]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not save your edit, please try again.' });
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

    // The gate on resumeRawText, grounded against the original upload plus what
    // the candidate told us.
    //
    // The mode turns on who wrote the text that is about to land. Untouched, it
    // is the model's, and an ungrounded figure is a fabrication that must never
    // get in: once it is in this field checkGrounding treats it as truth
    // forever and will defend it in every future application rather than catch
    // it. Once the candidate has edited it on the resume screen, the same
    // figure is them telling us something true about themselves that the upload
    // did not happen to say, and refusing it would mean refusing their own
    // resume back. Length and placeholders still throw either way.
    const answered = ((session.answers as unknown as IntakeAnswer[] | null) ?? [])
      .filter((a) => a.status === 'answered')
      .map((a) => a.value);
    assertResumeSource(
      session.resumeCleanText,
      [session.resumeOriginalText, ...answered],
      session.resumeEditedAt ? 'human' : 'authored',
      'welcome/finish',
    );

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

    // Their copy of the resume, plus the reason to come back. Fire-and-forget:
    // a mail failure must never cost them the account they just finished making.
    if (email) {
      sendWelcomeResumeEmail({
        to: email,
        firstName: session.firstName,
        resumeMarkdown: session.resumeCleanText,
      }).catch((err) => console.warn('[welcome/finish] resume email failed (non-fatal):', err?.message));
    }

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ResumeSourceError) {
      // The rebuild retries on this three times, so reaching here means it kept
      // producing figures with no source. Never persist it: this field is what
      // every future application is built from and graded against.
      console.error('[welcome/finish] resumeRawText gate refused the write:', err.message);
      res.status(502).json({ error: 'We could not verify every figure on your resume. Please rebuild it and try again.' });
      return;
    }
    console.error('[welcome/finish]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not complete setup, please try again.' });
  }
});

export { router as welcomeRouter };
