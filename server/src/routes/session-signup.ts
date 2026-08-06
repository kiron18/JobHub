/**
 * /api/session-signup — registration + qualifying questions for a live group session.
 *
 *   POST /register            (public) name, email, answers, resume -> SessionRegistration
 *   GET  /export?key=...      (shared secret) the whole roster, three ways
 *
 * The route is deliberately question-agnostic. The frontend owns the question
 * list; the answers arrive as a JSON blob keyed by question id and are stored
 * as-is. Changing the questions before the next call means editing one array in
 * SessionSignupPage.tsx — no route change, no migration.
 *
 * The export is a plain GET behind a shared secret rather than admin login
 * because it gets opened in a browser tab an hour before a call. `format=brief`
 * is the one that matters: it aggregates the multiple-choice answers and lists
 * the free-text ones, which is what actually goes into the presentation.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { extractTextFromBuffer } from '../services/pdf';
import { sendWorkshopConfirmationEmail } from '../services/email';
import { prisma } from '../index';

const router = Router();

/** Which session new registrations belong to. Bump this before the next call. */
const CURRENT_SESSION_KEY = process.env.SESSION_KEY || '2026-08-06';

/** Where the workshop actually happens. Override per session without a deploy. */
const MEET_LINK = process.env.WORKSHOP_MEET_LINK || 'https://meet.google.com/tsg-arac-krg';

/** Used in the confirmation subject line and body. */
const WORKSHOP_TITLE = process.env.WORKSHOP_TITLE || '"Your first Aussie Job" Workshop';

/**
 * Start time, as an ISO timestamp with an offset, e.g. 2026-08-06T18:00:00+10:00.
 * When set, the confirmation carries a calendar invite and their own calendar
 * handles the reminders. When unset the email still sends, just without it.
 */
const WORKSHOP_START = process.env.WORKSHOP_START || '';
const WORKSHOP_DURATION_MINUTES = Number(process.env.WORKSHOP_DURATION_MINUTES || 60);

function workshopStart(): Date | null {
  if (!WORKSHOP_START) return null;
  const d = new Date(WORKSHOP_START);
  if (Number.isNaN(d.getTime())) {
    console.warn('[session-signup] WORKSHOP_START is not a valid date, skipping calendar invite:', WORKSHOP_START);
    return null;
  }
  return d;
}

/**
 * Guards the export. Set SESSION_EXPORT_KEY in the Railway env; the fallback
 * exists so the endpoint works locally without setup, and is not a secret.
 */
const EXPORT_KEY = process.env.SESSION_EXPORT_KEY || 'agc-session-export';

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

/**
 * Multer errors (oversized file, mostly) arrive as thrown errors rather than a
 * validation result, so they are caught here and turned into something the form
 * can show the person instead of a 500.
 */
function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.fields([{ name: 'resume', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is over 5MB — try exporting it as a PDF.'
        : 'We could not read that file. PDF, DOCX or TXT works best.';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', handleUpload, async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim() || null;
    const resumeSkipReason = String(req.body.resumeSkipReason || '').trim() || null;

    if (!name) return res.status(400).json({ error: 'Please give us your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'That email address does not look right.' });
    }

    let answers: Record<string, unknown> = {};
    if (req.body.answers) {
      try {
        answers = JSON.parse(String(req.body.answers));
      } catch {
        return res.status(400).json({ error: 'Something went wrong sending your answers. Please try again.' });
      }
    }

    // The form sends the question list alongside the answers so the export can
    // label and aggregate them without guessing. Missing or malformed is not
    // worth failing a registration over — the export falls back to the raw ids.
    // An ordered [{ id, label, type }] array; see the note in the export.
    let questionSchema: unknown[] | Record<string, unknown> | null = null;
    if (req.body.questionSchema) {
      try {
        questionSchema = JSON.parse(String(req.body.questionSchema));
      } catch {
        console.warn('[session-signup] unparseable questionSchema, ignoring');
      }
    }

    // Resume is optional at the API layer even though the form pushes hard for
    // it — a failed extraction should never cost us the registration.
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = files?.resume?.[0];
    let resumeText: string | null = null;
    let resumeFilename: string | null = null;

    if (file) {
      resumeFilename = file.originalname;
      try {
        const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
        resumeText = text?.trim() ? text : null;
      } catch (err) {
        console.error('[session-signup] resume extraction failed', err);
      }
    }

    // Upsert on email: someone re-submitting is correcting themselves, not
    // creating a second person. A re-submit without a resume must not wipe the
    // one they already gave us.
    const data = {
      name,
      phone,
      answers: answers as object,
      ...(questionSchema ? { questionSchema: questionSchema as object } : {}),
      resumeSkipReason,
      sessionKey: CURRENT_SESSION_KEY,
      ...(resumeText ? { resumeText } : {}),
      ...(resumeFilename ? { resumeFilename } : {}),
    };

    // Whether this is a first registration decides if we send the confirmation.
    // Someone re-submitting to fix an answer already has the link, and a second
    // copy of the same email is how you end up in their spam folder.
    const existing = await prisma.sessionRegistration.findUnique({
      where: { email },
      select: { id: true },
    });

    await prisma.sessionRegistration.upsert({
      where: { email },
      create: { email, ...data },
      update: data,
    });

    // The registration is already saved. A mail provider having a bad minute
    // must not turn a successful signup into an error on their screen, so this
    // is awaited for the log but never allowed to reject the request.
    if (!existing) {
      try {
        await sendWorkshopConfirmationEmail({
          to: email,
          name,
          meetLink: MEET_LINK,
          workshopTitle: WORKSHOP_TITLE,
          start: workshopStart(),
          durationMinutes: WORKSHOP_DURATION_MINUTES,
        });
      } catch (err) {
        console.error('[session-signup] confirmation email failed for', email, err);
      }
    }

    // Returned so the success screen can show the link too. Email is the
    // primary delivery, but it can be slow or land in spam, and they are
    // looking at the screen right now.
    res.json({ ok: true, meetLink: MEET_LINK });
  } catch (err) {
    console.error('[session-signup] register failed', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
});

// ── Export ───────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get('/export', async (req: Request, res: Response) => {
  if (String(req.query.key || '') !== EXPORT_KEY) {
    return res.status(403).send('Forbidden');
  }

  const sessionKey = String(req.query.session || CURRENT_SESSION_KEY);
  const format = String(req.query.format || 'brief');

  const rows = await prisma.sessionRegistration.findMany({
    where: { sessionKey },
    orderBy: { createdAt: 'asc' },
  });

  const answersOf = (r: (typeof rows)[number]) =>
    (r.answers && typeof r.answers === 'object' ? r.answers : {}) as Record<string, unknown>;

  // Every answer key seen across the roster, in first-seen order, so a question
  // added mid-day still shows up in the columns.
  const keys: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(answersOf(r))) if (!keys.includes(k)) keys.push(k);
  }

  // The question list as the form last sent it. Later rows win, so if the
  // questions were reworded mid-day the export reads the way the form does now.
  //
  // It arrives as an ordered array, not an object, because Postgres jsonb does
  // not preserve object key order — storing it as an object scrambles the
  // running order of the brief, which then no longer matches the form.
  const schema: Record<string, { label?: string; type?: string }> = {};
  let schemaOrder: string[] = [];
  for (const r of rows) {
    const s = r.questionSchema;
    if (Array.isArray(s)) {
      const entries = s as Array<{ id?: string; label?: string; type?: string }>;
      schemaOrder = entries.map((e) => String(e?.id ?? '')).filter(Boolean);
      for (const e of entries) {
        if (e?.id) schema[String(e.id)] = { label: e.label, type: e.type };
      }
    } else if (s && typeof s === 'object') {
      // Rows written before the array form. Labels still work; order doesn't.
      Object.assign(schema, s as Record<string, { label?: string; type?: string }>);
    }
  }
  const labelFor = (k: string) => schema[k]?.label || k.replace(/_/g, ' ');
  const isChoiceQuestion = (k: string) => schema[k]?.type === 'choice' || schema[k]?.type === 'multi';

  // Ask-order first; anything the schema no longer mentions keeps its
  // first-seen position at the end rather than disappearing.
  const orderedKeys = [
    ...schemaOrder.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !schemaOrder.includes(k)),
  ];

  if (format === 'json') {
    return res.json({ sessionKey, count: rows.length, registrations: rows });
  }

  if (format === 'csv') {
    const header = ['name', 'email', 'phone', 'resume', 'registeredAt', ...orderedKeys.map(labelFor)];
    const lines = [header.map(csvCell).join(',')];
    for (const r of rows) {
      const a = answersOf(r);
      lines.push([
        r.name,
        r.email,
        r.phone ?? '',
        r.resumeText ? (r.resumeFilename ?? 'yes') : `NO — ${r.resumeSkipReason ?? 'not given'}`,
        r.createdAt.toISOString(),
        ...orderedKeys.map((k) => {
          const v = a[k];
          return Array.isArray(v) ? v.join(' | ') : (v ?? '');
        }),
      ].map(csvCell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionKey}.csv"`);
    // BOM: without it Excel reads the file as ANSI and every dash and curly
    // quote in the answers comes out as mojibake.
    return res.send('﻿' + lines.join('\n'));
  }

  // Default: the pre-call read. Choice answers get counted, free text gets
  // listed with a name against it, because both go into the presentation
  // differently — one as a slide, one as a quote.
  const out: string[] = [];
  out.push(`SESSION ${sessionKey} — ${rows.length} registered`);
  out.push(`Pulled ${new Date().toISOString()}`);
  out.push('');

  const withResume = rows.filter((r) => r.resumeText).length;
  out.push(`Resumes in: ${withResume} of ${rows.length}`);
  out.push('');

  for (const k of orderedKeys) {
    const values = rows
      .map((r) => ({ name: r.name, v: answersOf(r)[k] }))
      .filter((x) => x.v != null && String(x.v).trim() !== '');

    if (!values.length) continue;

    out.push('─'.repeat(64));
    out.push(labelFor(k).toUpperCase());

    // Choice answers become a count you can put on a slide; free text stays
    // attributed, because those get read out. The form tells us which is which
    // rather than us inferring it from the answers, which fails on a small roster.
    const flat = values.flatMap((x) => (Array.isArray(x.v) ? x.v.map(String) : [String(x.v)]));

    if (isChoiceQuestion(k)) {
      const counts = new Map<string, number>();
      for (const s of flat) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        const pct = Math.round((n / rows.length) * 100);
        out.push(`  ${String(n).padStart(3)}  (${String(pct).padStart(3)}%)  ${label}`);
      }
    } else {
      for (const x of values) {
        const v = Array.isArray(x.v) ? x.v.join(' | ') : String(x.v);
        out.push(`  • ${v}`);
        out.push(`      — ${x.name}`);
      }
    }
    out.push('');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(out.join('\n'));
});

export default router;
