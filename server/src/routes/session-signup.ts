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
import { recordLeadSignal, recordSkoolClick } from '../services/salesLead';
import { timingSafeEqual } from 'crypto';
import {
  currentSessionKey,
  MEET_LINK,
  SKOOL_URL,
  WORKSHOP_TITLE,
  WORKSHOP_DURATION_MINUTES,
  WORKSHOP_TZ,
  EXPORT_KEY,
  workshopStart,
} from '../config/workshop';

const router = Router();

/**
 * When the next workshop is. Public and deliberately free of anything private:
 * the signup page reads it so the date on screen is the real one.
 *
 * The page used to say "Today" as a hardcoded string, which was true on the day
 * it was written and wrong every day after. Now that the schedule rolls weekly
 * on its own, the page has to roll with it or it lies to every registrant about
 * the one fact they need in order to turn up.
 */
router.get('/next', (_req: Request, res: Response) => {
  const start = workshopStart();
  res.json({
    sessionKey: currentSessionKey(),
    startsAt: start ? start.toISOString() : null,
    durationMinutes: WORKSHOP_DURATION_MINUTES,
    timeZone: WORKSHOP_TZ,
    title: WORKSHOP_TITLE,
  });
});

/**
 * POST /skool-click?lead=<id> — they clicked through to the group.
 *
 * Public and unauthenticated, because the person clicking has no account and
 * never will: that is the entire point of the free funnel.
 *
 * The id arrives in the QUERY STRING rather than the body on purpose. This is
 * called with `navigator.sendBeacon` from a page that is redirecting away, and
 * a beacon sends `text/plain`, which the JSON body parser drops on the floor.
 * A body is read too, for the fetch fallback.
 *
 * Always 204, even for an unknown or missing id. The caller is a page on its
 * way out the door and cannot act on a failure, and the redirect must never be
 * held up by our bookkeeping.
 */
router.post('/skool-click', async (req: Request, res: Response) => {
  const fromQuery = typeof req.query.lead === 'string' ? req.query.lead : '';
  const fromBody = typeof (req.body as any)?.leadId === 'string' ? (req.body as any).leadId : '';
  const leadId = (fromQuery || fromBody).trim().slice(0, 64);

  res.status(204).end();

  if (!leadId) return;
  try {
    await recordSkoolClick(leadId);
  } catch (err) {
    console.error('[session-signup] skool click stamp failed', err);
  }
});

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

// ── Parse ────────────────────────────────────────────────────────────────────

/**
 * Pull the email off a resume so the form can pre-fill it instead of asking for
 * something the person has already given us.
 *
 * Pre-fill, never substitute. The email is the join key across the CRM, JobHub
 * and Stripe, and a silently mis-parsed one is worse than an empty field: it
 * creates a record nobody can match to a payment later. So this hands back a
 * suggestion, the form shows it, and the person confirms it in one tap.
 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Filenames and asset paths in an extracted PDF read as emails to a regex. */
const NOT_AN_EMAIL = /\.(png|jpe?g|gif|svg|webp|pdf|docx?)$/i;

function detectEmail(text: string): string | null {
  const matches = text.match(EMAIL_RE) || [];
  for (const m of matches) {
    if (NOT_AN_EMAIL.test(m)) continue;
    return m.toLowerCase();
  }
  return null;
}

/**
 * The name is almost always the first line of a resume, set larger than
 * everything else. Anything that looks like contact details, a heading or a
 * sentence is rejected rather than guessed at, because a wrong pre-filled name
 * is more annoying to correct than an empty one.
 */
function detectName(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
  for (const line of lines) {
    if (line.length > 40 || line.includes('@') || /\d/.test(line)) continue;
    if (/^(curriculum vitae|resume|cv|profile|summary)$/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[A-Za-z][A-Za-z'’.-]*$/.test(w))) continue;
    return line;
  }
  return null;
}

router.post('/parse-resume', handleUpload, async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = files?.resume?.[0];
  if (!file) return res.status(400).json({ error: 'No file received.' });

  // A failed parse is not an error the person needs to see. They keep the file
  // they just picked and simply type the two fields themselves, which is where
  // the form was before this route existed.
  try {
    const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
    if (!text?.trim()) return res.json({ email: null, name: null });
    return res.json({ email: detectEmail(text), name: detectName(text) });
  } catch (err) {
    console.error('[session-signup] parse failed', err);
    return res.json({ email: null, name: null });
  }
});

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

    let resumeFile: Uint8Array<ArrayBuffer> | null = null;
    let resumeMimetype: string | null = null;

    if (file) {
      resumeFilename = file.originalname;
      // The bytes are kept alongside the text: the ATS structural check in the
      // report has to inspect the real document, and a flattened string has
      // already lost the text boxes and tables that check looks for.
      // Copied into a plain Uint8Array: Prisma's Bytes field wants a view over a
      // real ArrayBuffer, and a Node Buffer can sit on a SharedArrayBuffer.
      resumeFile = new Uint8Array(file.buffer);
      resumeMimetype = file.mimetype;
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
      // Resolved per request, never at module load: the server runs for weeks
      // and a hoisted value would file every registration against whichever
      // week the process happened to boot in.
      sessionKey: currentSessionKey(),
      ...(resumeText ? { resumeText } : {}),
      ...(resumeFilename ? { resumeFilename } : {}),
      ...(resumeFile ? { resumeFile, resumeMimetype } : {}),
    };

    // Everyone who comes through the funnel lands on the sales board, whichever
    // door they used. Never allowed to fail the registration: a board row is
    // worth less than the registration itself.
    const leadId = await recordLeadSignal({
      email,
      name,
      phone,
      source: answers && (answers as any).source_asset ? 'free-resource' : 'session',
      sourceAsset: (answers as any)?.source_asset ?? null,
      hasResume: !!resumeText,
      signals: { registeredAt: new Date() },
    }).catch((err) => {
      console.error('[session-signup] sales board sync failed', err);
      return null;
    });

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
    //
    // The Skool URL rides along for the same reason it lives in config: the
    // confirmation screen and the confirmation email must never disagree about
    // where the group is.
    // `leadId` rides along so the confirmation screen can stamp its own Skool
    // click against this person. Null when the board sync failed, and every
    // consumer has to treat it as optional: the link must still work.
    res.json({ ok: true, meetLink: MEET_LINK, skoolUrl: SKOOL_URL, leadId });
  } catch (err) {
    console.error('[session-signup] register failed', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
});

// ── Attendance ───────────────────────────────────────────────────────────────

/**
 * The claim link, dropped in the Meet chat partway through the session.
 *
 * One link for the whole room rather than a personal link each: it has to be
 * pasteable into a chat window in one go. What makes it an attendance record is
 * that only people in the room ever see it, so claiming is proof of presence.
 * They identify themselves with the email they registered with, which we
 * already hold.
 *
 * Unknown emails are told so plainly. Someone who typoed their address needs to
 * know now, while they are still in the room and can fix it, and the honest
 * answer leaks nothing: the roster is the set of people who filled in a public
 * form.
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'That email address does not look right.' });
    }

    const existing = await prisma.sessionRegistration.findUnique({
      where: { email },
      select: { id: true, attendedAt: true, resumeText: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'I cannot find that email on the registration list. Check for a typo, or use the address you signed up with.',
      });
    }

    // Re-claiming is not an error. People tap the link twice, or on a second
    // device, and the first claim is the one that counts.
    if (!existing.attendedAt) {
      await prisma.sessionRegistration.update({
        where: { id: existing.id },
        data: { attendedAt: new Date() },
      });
    }

    await recordLeadSignal({
      email,
      signals: { attendedAt: new Date() },
    }).catch((err) => console.error('[session-signup] sales board sync failed', err));

    // Said up front, because it is the one case where the promised report is
    // never going to arrive and they can still fix it tonight.
    res.json({ ok: true, hasResume: !!existing.resumeText });
  } catch (err) {
    console.error('[session-signup] claim failed', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
});

// ── The report ───────────────────────────────────────────────────────────────

/**
 * The generated diagnostic, addressed by its unguessable token.
 *
 * The token is the only credential, which is the right trade for something
 * emailed to someone who has no account and should not need one to read what
 * they were promised.
 */
router.get('/report/:token', async (req: Request, res: Response) => {
  const token = String(req.params.token || '');
  if (token.length < 20) return res.status(404).json({ error: 'Not found' });

  const row = await prisma.sessionRegistration.findUnique({
    where: { reportToken: token },
    select: { report: true, name: true },
  });

  if (!row?.report) return res.status(404).json({ error: 'Not found' });
  res.json({ report: row.report, name: row.name });
});

// ── Export ───────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Constant-time key check.
 *
 * A plain `!==` on a secret leaks its length and, in principle, its prefix
 * through response timing. That mattered less when the key was a placeholder
 * everyone could read; now that it is the only thing standing between the open
 * internet and everyone's resume, the comparison is worth doing properly.
 */
function keyMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

router.get('/export', async (req: Request, res: Response) => {
  // No key configured means the endpoint is off, not open. See the note on
  // EXPORT_KEY in config/workshop.ts for why there is no fallback value.
  if (!EXPORT_KEY) {
    console.warn('[session-signup] export requested but SESSION_EXPORT_KEY is unset');
    return res.status(503).send('The roster export is not configured.');
  }
  if (!keyMatches(String(req.query.key || ''), EXPORT_KEY)) {
    return res.status(403).send('Forbidden');
  }

  const sessionKey = String(req.query.session || currentSessionKey());
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
