/**
 * /api/admin/sales — the sales board.
 *
 * Replaces the local Python CRM. The pipeline is deliberately much shorter than
 * the one it replaces: ten hand-dragged stages became five derived ones plus
 * Dead, because every stage that needed dragging was a stage that went stale.
 *
 * Read-heavy and small: the whole board is one query, because denormalising the
 * four funnel signals onto SalesLead was the point of that table existing.
 */
import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { STAGES, type Stage } from '../services/salesLead';
import { currentSessionKey, MEET_LINK } from '../config/workshop';
import { attachResumeToLead } from '../services/leadResume';
import { extractTextFromBuffer } from '../services/pdf';
import { parseResumeContact, PROFESSIONS } from '../services/resumeContact';
import { calendarConfigured } from '../services/googleCalendar';
import { activeMeeting, cancelMeeting, removeCalendarEvents, setMeeting } from '../services/salesMeeting';

const router = Router();

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/**
 * The board.
 *
 * Archived rows are excluded unless asked for. They are imported leads with
 * neither an email nor a resume: nothing to send, nothing to read, and on a
 * board that has to be scannable in one glance they were pure noise. Hidden,
 * never deleted, because a name plus a LinkedIn URL is still reachable by hand.
 */
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const includeArchived = String(req.query.archived || '') === 'true';
  const search = String(req.query.search || '').trim();

  const leads = await prisma.salesLead.findMany({
    where: {
      ...(includeArchived ? {} : { archived: false }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
  });

  // The registration carries what they told us and what they uploaded, which is
  // the only thing on this board worth reading before a call. Fetched in one
  // query and stitched, rather than a join, because SalesLead deliberately has
  // no foreign key to it: a lead can exist with no registration at all.
  const emails = leads.map((l) => l.email).filter((e): e is string => !!e);
  const registrations = emails.length
    ? await prisma.sessionRegistration.findMany({
        where: { email: { in: emails } },
        select: {
          email: true, answers: true, questionSchema: true,
          resumeFilename: true, resumeText: true, sessionKey: true,
          reportToken: true, reportError: true,
        },
      })
    : [];
  const byEmail = new Map(registrations.map((r) => [r.email, r]));

  const counts: Record<string, number> = {};
  for (const s of STAGES) counts[s] = 0;
  for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;

  const archivedCount = await prisma.salesLead.count({ where: { archived: true } });

  // Every meeting that has not been cancelled, for everyone, not only the
  // people this search returned: the week and month overview is a picture of
  // the calendar, and it must not shrink because a name was typed in a box.
  const meetings = await prisma.salesMeeting.findMany({
    where: { cancelledAt: null },
    orderBy: { startsAt: 'asc' },
    take: 2000,
    select: {
      id: true, leadId: true, startsAt: true, minutes: true, notify: true,
      meetLink: true, calendarLink: true, calendarError: true,
      reminderDaySentAt: true, reminderHourSentAt: true,
      lead: { select: { name: true } },
    },
  });

  // The one meeting a row shows: the next call that has not finished, or
  // failing that the most recent one that has. `meetings` is oldest first, so
  // the first unfinished one is the soonest and the last finished one wins.
  const now = Date.now();
  const meetingFor = new Map<string, (typeof meetings)[number]>();
  const hasUpcoming = new Set<string>();
  for (const m of meetings) {
    if (hasUpcoming.has(m.leadId)) continue;
    meetingFor.set(m.leadId, m);
    if (m.startsAt.getTime() + m.minutes * 60_000 > now) hasUpcoming.add(m.leadId);
  }

  res.json({
    counts,
    archivedCount,
    professions: PROFESSIONS,
    // Said out loud so the board can warn before a meeting is booked rather
    // than after it has quietly failed to reach the calendar.
    calendarConnected: calendarConfigured(),
    meetings: meetings.map((m) => ({
      id: m.id, leadId: m.leadId, name: m.lead.name, startsAt: m.startsAt, minutes: m.minutes,
    })),
    // Which session the board should read as "the next one". Sent rather than
    // worked out in the browser, because the schedule and its timezone live on
    // the server and a client-side guess drifts across the DST switch.
    nextSessionKey: currentSessionKey(),
    // The room the confirmation and reminder emails are sending people to,
    // read from the same constant those emails use. It is here so the board
    // shows the link that actually went out rather than the one you think
    // went out: on 25 Aug the two were different and nobody found out until
    // the session had already started.
    meetLink: MEET_LINK,
    leads: leads.map((l) => {
      const reg = l.email ? byEmail.get(l.email) : undefined;
      const meeting = meetingFor.get(l.id);
      return {
        ...l,
        meeting: meeting
          ? {
              id: meeting.id, startsAt: meeting.startsAt, minutes: meeting.minutes, notify: meeting.notify,
              meetLink: meeting.meetLink, calendarLink: meeting.calendarLink, calendarError: meeting.calendarError,
              // Null means still to send. The board turns these into "next reminder goes at".
              reminderDayPending: !meeting.reminderDaySentAt,
              reminderHourPending: !meeting.reminderHourSentAt,
            }
          : null,
        // Resume text is deliberately not sent to the board: it is long enough
        // to dominate the payload and is only ever read one person at a time.
        answers: reg?.answers ?? null,
        questionSchema: reg?.questionSchema ?? null,
        resumeFilename: reg?.resumeFilename ?? null,
        hasResumeText: !!reg?.resumeText,
        sessionKey: reg?.sessionKey ?? null,
        reportToken: reg?.reportToken ?? null,
        reportError: reg?.reportError ?? null,
      };
    }),
  });
});

/** The contact fields that can be typed over. Each is "a string, or cleared". */
const CONTACT_FIELDS = [
  'phone', 'location', 'jobTitle', 'profession', 'company', 'linkedinUrl', 'visaStatus', 'education',
] as const;

/**
 * Notes, next action, Dead, un-archiving, and the contact details.
 *
 * The details are editable because they were read off a resume by a model, and
 * a reader that is right nine times in ten still needs somewhere to be
 * corrected the tenth.
 */
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const body = req.body ?? {};
  const { stage, notes, nextBest, archived } = body;

  if (stage !== undefined && !STAGES.includes(stage as Stage)) {
    return res.status(400).json({ error: `Unknown stage: ${stage}` });
  }

  const current = await prisma.salesLead.findUnique({ where: { id }, select: { email: true } });
  if (!current) return res.status(404).json({ error: 'That person is not on the board any more.' });

  const contact: Record<string, string | null> = {};
  for (const f of CONTACT_FIELDS) {
    if (body[f] !== undefined) contact[f] = String(body[f] ?? '').trim() || null;
  }
  if (body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'A name is the one thing a contact cannot be without.' });
    contact.name = name;
  }

  // Email is the join key to the resume, the registration and Stripe, so a
  // change to it is checked rather than just written.
  let emailChange: string | null | undefined;
  if (body.email !== undefined) {
    const email = String(body.email ?? '').trim().toLowerCase() || null;
    if (email !== current.email) {
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: `${email} is not an email address.` });
      }
      if (email) {
        const clash = await prisma.salesLead.findUnique({ where: { email }, select: { name: true } });
        if (clash) return res.status(409).json({ error: `${email} already belongs to ${clash.name} on the board.` });
      }
      emailChange = email;
    }
  }

  const lead = await prisma.salesLead.update({
    where: { id },
    data: {
      ...(stage !== undefined ? { stage } : {}),
      ...(notes !== undefined ? { notes: String(notes) } : {}),
      ...(nextBest !== undefined ? { nextBest: String(nextBest) } : {}),
      ...(archived !== undefined ? { archived: !!archived } : {}),
      ...contact,
      ...(emailChange !== undefined ? { email: emailChange } : {}),
    },
  });

  // The resume is filed against the email, so a corrected address has to take
  // the file with it or the row would show "none" for a resume we still hold.
  // Skipped when the new address already has a registration of its own.
  if (emailChange && current.email) {
    const taken = await prisma.sessionRegistration.findUnique({ where: { email: emailChange }, select: { id: true } });
    if (!taken) {
      await prisma.sessionRegistration.updateMany({ where: { email: current.email }, data: { email: emailChange } });
    }
  }

  // A call booked before the email was known went on the calendar with nobody
  // invited. Writing the event again with the same time adds them, and Google
  // sends the invite. Same time means the reminders are left as they were.
  if (emailChange !== undefined) {
    const booked = await activeMeeting(id);
    if (booked) await setMeeting({ leadId: id, startsAt: booked.startsAt });
  }

  res.json({ lead });
});

// ── Meetings ─────────────────────────────────────────────────────────────────

/**
 * Book a call with someone, or move the one already booked.
 *
 * One endpoint for both because from the board they are the same act: "this
 * person, this time". Whether that creates a calendar event or moves one is
 * for the server to know. Sending the same time again retries a calendar write
 * that failed, without re-sending any reminder.
 */
router.put('/:id/meeting', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const startsAt = new Date(String(req.body?.startsAt ?? ''));
  if (Number.isNaN(startsAt.getTime())) {
    return res.status(400).json({ error: 'Pick a day and a time for the meeting.' });
  }
  // A few minutes of grace for a clock that is slightly out, and no more: a
  // meeting in the past would send an invite for a call that cannot happen.
  if (startsAt.getTime() < Date.now() - 5 * 60_000) {
    return res.status(400).json({ error: 'That time has already passed.' });
  }

  let minutes: number | undefined;
  if (req.body?.minutes !== undefined) {
    minutes = Math.round(Number(req.body.minutes));
    if (!Number.isFinite(minutes) || minutes < 10 || minutes > 240) {
      return res.status(400).json({ error: 'A meeting runs between 10 minutes and 4 hours.' });
    }
  }

  const meeting = await setMeeting({
    leadId: String(req.params.id),
    startsAt,
    minutes,
    notify: req.body?.notify === undefined ? undefined : !!req.body.notify,
  });
  if (!meeting) return res.status(404).json({ error: 'That person is not on the board any more.' });

  console.log(
    `[admin-sales] meeting ${meeting.id} set for ${meeting.startsAt.toISOString()}` +
    (meeting.calendarError ? ` (calendar: ${meeting.calendarError})` : ' (on the calendar)'),
  );
  res.json({ meeting });
});

/** Cancel the upcoming call and take it off the calendar. */
router.delete('/:id/meeting', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const cancelled = await cancelMeeting(String(req.params.id));
  res.json({ cancelled });
});

/**
 * Delete people outright.
 *
 * Archive hides; this removes. It exists because the board accumulates two
 * kinds of row that hiding does not really deal with: test signups made while
 * building the funnel, and imported names that were never real leads. Leaving
 * those archived still leaves them in every count you take later.
 *
 * ⚠️ THE REGISTRATION GOES WITH THEM. A lead with a SessionRegistration still
 * behind it is not gone: they stay on the workshop roster, they still get the
 * reminder email, and the next funnel signal rebuilds the lead row from the
 * registration's email. So a delete that only removed the lead would be a
 * delete that quietly did not work. That also means it takes the resume on
 * file with it, which is why the caller is expected to confirm by name.
 *
 * Takes a list because the realistic clean-up is ten test rows at once, and one
 * request that either happens or does not beats ten that can half-happen.
 */
router.post('/delete', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const raw: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const cleaned = raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
  const ids = [...new Set(cleaned)].slice(0, 200);
  if (!ids.length) return res.status(400).json({ error: 'No leads given to delete.' });

  // Read first, so the response can name what actually went and so a stale id
  // in the list is a no-op rather than an error.
  const leads = await prisma.salesLead.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  if (!leads.length) return res.json({ deleted: 0, registrationsDeleted: 0, names: [] });

  const emails = leads.map((l) => l.email).filter((e): e is string => !!e);

  // Read before the delete, because the meeting rows cascade away with the
  // lead and take the event ids with them. Only calls still to come: one that
  // has already happened is history on the calendar and stays there.
  const upcoming = await prisma.salesMeeting.findMany({
    where: { leadId: { in: leads.map((l) => l.id) }, cancelledAt: null, startsAt: { gt: new Date() } },
    select: { id: true, googleEventId: true, notify: true },
  });

  const registrationsDeleted = await prisma.$transaction(async (tx) => {
    const gone = emails.length
      ? await tx.sessionRegistration.deleteMany({ where: { email: { in: emails } } })
      : { count: 0 };
    await tx.salesLead.deleteMany({ where: { id: { in: leads.map((l) => l.id) } } });
    return gone.count;
  });

  // After the commit, and best effort: a calendar problem must not turn a
  // delete that worked into an error on screen.
  await removeCalendarEvents(upcoming);

  console.log(
    `[admin-sales] deleted ${leads.length} lead(s) and ${registrationsDeleted} registration(s): ` +
    leads.map((l) => l.email ?? l.name).join(', '),
  );

  res.json({
    deleted: leads.length,
    registrationsDeleted,
    names: leads.map((l) => l.name),
  });
});

// ── Resume upload ────────────────────────────────────────────────────────────

/** Same limits the public signup form uses, so a file that works there works
 *  here. Memory storage because the bytes go straight into Postgres. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    cb(null, ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt'));
  },
});

/**
 * The upload at the top of the board: a resume in, a contact out.
 *
 * Reads the name, email, phone, location, job title and the rest off the
 * document and creates the person in one step, so the next thing on screen can
 * be "when are you meeting them".
 *
 * ⚠️ AN EMAIL THAT IS ALREADY ON THE BOARD UPDATES THAT PERSON, AND ONLY FILLS
 * BLANKS. The same resume uploaded twice must not make two people, and a
 * phone number typed in by hand last week must not be overwritten by whatever
 * the reader made of the document today. `existing` tells the board which
 * happened so it can say so.
 *
 * A resume with no email in it still creates the contact, but the file has
 * nowhere to be filed until one is added: the registration that holds resumes
 * is keyed on email. `resumeSaved: false` says so, and the board re-sends the
 * file itself once an address is typed in.
 */
router.post('/intake', authenticate, requireAdmin, (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is over 5MB. Try exporting it as a PDF.'
        : 'We could not read that file. PDF, DOCX or TXT works best.';
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file came through. PDF, DOCX or TXT.' });

  try {
    let text = '';
    try {
      text = (await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname))?.trim() ?? '';
    } catch (err) {
      console.error('[admin-sales] intake extraction failed', err);
    }

    const { contact, parsed } = await parseResumeContact(text);
    const { name: parsedName, email, ...details } = contact;

    // "Priya_Sharma_Resume_2026.pdf" is a better name than "Unnamed" when the
    // document itself gave nothing up, which is what a scanned PDF does.
    const fromFilename = file.originalname
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_\-.]+/g, ' ')
      .replace(/\b(resume|cv|curriculum vitae|final|updated|new|v?\d+)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const name = parsedName || fromFilename || (email ? email.split('@')[0] : 'Unnamed');

    const found = email ? await prisma.salesLead.findUnique({ where: { email } }) : null;

    let lead;
    if (found) {
      const blanks: Record<string, string> = {};
      for (const [k, v] of Object.entries(details)) {
        if (v && !(found as Record<string, unknown>)[k]) blanks[k] = v;
      }
      lead = await prisma.salesLead.update({
        where: { id: found.id },
        // Uploading someone's resume is a reason to see them again.
        data: { ...blanks, archived: false },
      });
    } else {
      const filled = Object.fromEntries(Object.entries(details).filter(([, v]) => !!v));
      lead = await prisma.salesLead.create({
        data: { name, email, source: 'resume-upload', ...filled },
      });
    }

    let resumeSaved = false;
    if (lead.email) {
      await attachResumeToLead({
        email: lead.email,
        fallbackName: lead.name,
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      resumeSaved = true;
    }

    console.log(
      `[admin-sales] intake: ${found ? 'updated' : 'created'} ${lead.email ?? lead.name} ` +
      `from ${file.originalname} (${text.length} chars, ${parsed ? 'read by model' : 'not read'})`,
    );

    const meeting = await activeMeeting(lead.id);
    res.json({
      lead,
      existing: !!found,
      // False when the model could not read it: the fields are then an email
      // and a phone number at best, and the board says to check them.
      parsed,
      chars: text.length,
      resumeSaved,
      filename: file.originalname,
      meeting: meeting ? { startsAt: meeting.startsAt, minutes: meeting.minutes, notify: meeting.notify } : null,
    });
  } catch (err) {
    console.error('[admin-sales] intake failed', err);
    res.status(500).json({ error: 'The upload failed on our side. Try again.' });
  }
});

/**
 * Put a resume against someone by hand.
 *
 * For the resume that arrives by email or gets handed over on a call, which is
 * most of them for anyone who did not come through the signup form. Needs an
 * email on the lead, because email is what the registration is keyed on and
 * there is nowhere else to hang the file.
 *
 * Reports the character count back rather than a bare success: a scanned PDF
 * uploads perfectly and yields nothing, and finding that out an hour before a
 * call is worse than being told now.
 */
router.post('/:id/resume', authenticate, requireAdmin, (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is over 5MB. Try exporting it as a PDF.'
        : 'We could not read that file. PDF, DOCX or TXT works best.';
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file came through. PDF, DOCX or TXT.' });

  const lead = await prisma.salesLead.findUnique({
    where: { id: String(req.params.id) },
    select: { name: true, email: true },
  });
  if (!lead) return res.status(404).json({ error: 'That person is not on the board any more.' });
  if (!lead.email) {
    return res.status(400).json({
      error: `${lead.name} has no email on file, and the resume is filed against the email. Add one first.`,
    });
  }

  try {
    const result = await attachResumeToLead({
      email: lead.email,
      fallbackName: lead.name,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    console.log(`[admin-sales] resume attached to ${lead.email}: ${result.filename} (${result.chars} chars)`);
    res.json(result);
  } catch (err) {
    console.error('[admin-sales] resume upload failed', err);
    res.status(500).json({ error: 'The upload failed on our side. Try again.' });
  }
});

/** The original resume file, so a card can hand back the real document. */
router.get('/:id/resume', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const lead = await prisma.salesLead.findUnique({
    where: { id: String(req.params.id) },
    select: { email: true },
  });
  if (!lead?.email) return res.status(404).send('Not found');

  const reg = await prisma.sessionRegistration.findUnique({
    where: { email: lead.email },
    select: { resumeFile: true, resumeMimetype: true, resumeFilename: true, resumeText: true },
  });

  if (reg?.resumeFile) {
    res.setHeader('Content-Type', reg.resumeMimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${reg.resumeFilename || 'resume'}"`);
    return res.send(Buffer.from(reg.resumeFile));
  }
  // Registrations taken before the bytes were kept still have the text, which
  // is worth more than a 404 an hour before a call.
  if (reg?.resumeText) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(reg.resumeText);
  }
  res.status(404).send('No resume on file');
});

export default router;
