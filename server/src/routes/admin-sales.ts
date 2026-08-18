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
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { STAGES, type Stage } from '../services/salesLead';
import { currentSessionKey } from '../config/workshop';

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

  res.json({
    counts,
    archivedCount,
    // Which session the board should read as "the next one". Sent rather than
    // worked out in the browser, because the schedule and its timezone live on
    // the server and a client-side guess drifts across the DST switch.
    nextSessionKey: currentSessionKey(),
    leads: leads.map((l) => {
      const reg = l.email ? byEmail.get(l.email) : undefined;
      return {
        ...l,
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

/** Notes, next action, Dead, and un-archiving. The only manual edits there are. */
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { stage, notes, nextBest, archived } = req.body ?? {};

  if (stage !== undefined && !STAGES.includes(stage as Stage)) {
    return res.status(400).json({ error: `Unknown stage: ${stage}` });
  }

  const lead = await prisma.salesLead.update({
    where: { id },
    data: {
      ...(stage !== undefined ? { stage } : {}),
      ...(notes !== undefined ? { notes: String(notes) } : {}),
      ...(nextBest !== undefined ? { nextBest: String(nextBest) } : {}),
      ...(archived !== undefined ? { archived: !!archived } : {}),
    },
  });
  res.json({ lead });
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

  const registrationsDeleted = await prisma.$transaction(async (tx) => {
    const gone = emails.length
      ? await tx.sessionRegistration.deleteMany({ where: { email: { in: emails } } })
      : { count: 0 };
    await tx.salesLead.deleteMany({ where: { id: { in: leads.map((l) => l.id) } } });
    return gone.count;
  });

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
