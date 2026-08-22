/**
 * /api/admin/workshop — the prep console for a live session.
 *
 * One job: at 4pm on workshop day, turn a roster and a pasted Skool thread into
 * a run sheet plus a fact sheet on every attendee, with their resume one click
 * away. Read almost entirely, written twice (paste the thread, generate the
 * briefs), and both writes are explicit presses.
 *
 * Everything time dependent is resolved per request. See the warning at the top
 * of `config/workshop.ts`: a hoisted session key froze the whole funnel for a
 * week, and this route would fail the same way, silently, by showing last week's
 * roster on the afternoon of this week's call.
 *
 * The resume is deliberately NOT served here. `/api/admin/sales/:id/resume`
 * already does it, so the roster carries the sales lead id and the page links to
 * that. Two endpoints serving the same bytes is two places to get the fallback
 * to `resumeText` wrong.
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import {
  currentSessionKey,
  workshopStart,
  workshopSlotLabel,
  MEET_LINK,
  SKOOL_URL,
  WORKSHOP_TITLE,
  WORKSHOP_DURATION_MINUTES,
  WORKSHOP_TZ,
} from '../config/workshop';
import { PUBLIC_APP_URL } from '../lib/appUrl';
import {
  matchThreadToRoster,
  generateCoachBrief,
  type CoachBrief,
  type RosterEntry,
} from '../services/coachBrief';

const router = Router();

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/** The session being looked at. Defaults to the next one, resolved now. */
function sessionOf(req: AuthRequest): string {
  const asked = String(req.query.session || req.body?.session || '').trim();
  return asked || currentSessionKey();
}

// ── The roster ───────────────────────────────────────────────────────────────

/**
 * GET / — everything the page renders, in one call.
 *
 * One query per table rather than a join, because SessionRegistration has no
 * foreign key to SalesLead by design: a registration is a person who filled in a
 * public form, and a lead can exist without one.
 */
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const sessionKey = sessionOf(req);
  const start = workshopStart();

  const rows = await prisma.sessionRegistration.findMany({
    where: { sessionKey },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, email: true, phone: true,
      answers: true, questionSchema: true,
      resumeFilename: true, resumeText: true, resumeSkipReason: true,
      question: true, coachBrief: true, coachBriefAt: true,
      attendedAt: true, createdAt: true,
    },
  });

  // The lead id is what makes the existing resume endpoint reachable from here.
  // Matched on email, the join key across the CRM, JobHub and Stripe.
  const emails = rows.map((r) => r.email);
  const leads = emails.length
    ? await prisma.salesLead.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, stage: true, paidAt: true },
      })
    : [];
  const leadByEmail = new Map(leads.map((l) => [l.email, l]));

  const floor = await prisma.sessionFloorQuestion.findMany({
    where: { sessionKey },
    orderBy: { createdAt: 'asc' },
  });

  // Every session that has ever taken a registration, so a past one can be
  // reopened. Newest first: the only two anyone wants are this week and last.
  const sessions = await prisma.sessionRegistration.groupBy({
    by: ['sessionKey'],
    _count: { _all: true },
    orderBy: { sessionKey: 'desc' },
    take: 24,
  });

  res.json({
    session: {
      sessionKey,
      // Only meaningful for the upcoming session. A past sessionKey being
      // viewed still gets the real next start, and the page uses the key to
      // decide whether to show a countdown at all.
      startsAt: start ? start.toISOString() : null,
      isNext: sessionKey === currentSessionKey(),
      durationMinutes: WORKSHOP_DURATION_MINUTES,
      timeZone: WORKSHOP_TZ,
      slotLabel: workshopSlotLabel(),
      title: WORKSHOP_TITLE,
      meetLink: MEET_LINK,
      skoolUrl: SKOOL_URL,
      claimUrl: `${PUBLIC_APP_URL}/claim`,
    },
    sessions: sessions.map((s) => ({ sessionKey: s.sessionKey, count: s._count._all })),
    counts: {
      registered: rows.length,
      resumes: rows.filter((r) => r.resumeText).length,
      questions: rows.filter((r) => r.question?.trim()).length,
      briefs: rows.filter((r) => r.coachBrief).length,
      attended: rows.filter((r) => r.attendedAt).length,
      floor: floor.length,
    },
    floorQuestions: floor,
    roster: rows.map((r) => {
      const lead = leadByEmail.get(r.email);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        registeredAt: r.createdAt.toISOString(),
        attendedAt: r.attendedAt ? r.attendedAt.toISOString() : null,
        question: r.question,
        coachBrief: r.coachBrief as CoachBrief | null,
        coachBriefAt: r.coachBriefAt ? r.coachBriefAt.toISOString() : null,
        // The text itself is not sent: it is long enough to dominate the payload
        // and the page never shows it, it links to the real file instead.
        hasResume: !!r.resumeText,
        resumeFilename: r.resumeFilename,
        resumeSkipReason: r.resumeSkipReason,
        answers: r.answers ?? null,
        questionSchema: r.questionSchema ?? null,
        leadId: lead?.id ?? null,
        stage: lead?.stage ?? null,
        paid: !!lead?.paidAt,
      };
    }),
  });
});

// ── The paste box ────────────────────────────────────────────────────────────

/**
 * POST /questions/match — split a pasted thread and propose a match per question.
 *
 * Writes nothing on purpose. Name matching is the step most likely to be wrong,
 * and it is wrong in the way that costs most: one person's question read out
 * under another person's name. So the proposal goes on screen with a dropdown
 * and a second press commits it.
 */
router.post('/questions/match', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const sessionKey = sessionOf(req);
  const thread = String(req.body?.thread ?? '').trim();

  if (thread.length < 20) {
    return res.status(400).json({ error: 'Paste the thread first. There is nothing in the box.' });
  }

  const roster: RosterEntry[] = await prisma.sessionRegistration.findMany({
    where: { sessionKey },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  });

  if (!roster.length) {
    return res.status(400).json({ error: `Nobody is registered for ${sessionKey}, so there is nothing to match against.` });
  }

  try {
    const matches = await matchThreadToRoster(thread, roster);
    res.json({ matches, rosterSize: roster.length });
  } catch (err) {
    console.error('[admin-workshop] thread match failed', err);
    res.status(502).json({
      error: 'The matcher could not read that thread. Paste it again, or assign the questions by hand.',
    });
  }
});

/**
 * POST /questions — commit the reviewed matches.
 *
 * Replaces rather than merges, for the whole session. Re-pasting a thread means
 * the thread grew, and the paste is the complete current state of it; merging
 * would strand an edited question next to its older self with no way to tell
 * which one is live.
 *
 * A registration that has no question in this paste has its question cleared for
 * the same reason. Anything else makes "delete a wrong match" impossible.
 */
router.post('/questions', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const sessionKey = sessionOf(req);
  const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : null;

  if (!assignments) {
    return res.status(400).json({ error: 'No assignments in the request.' });
  }

  const roster = await prisma.sessionRegistration.findMany({
    where: { sessionKey },
    select: { id: true },
  });
  const validIds = new Set(roster.map((r) => r.id));

  // Collapse to one question per person: the same person posting twice in a
  // thread is one person with more to say, not two roster entries.
  const byRegistration = new Map<string, string[]>();
  const floor: { poster: string | null; question: string }[] = [];

  for (const a of assignments) {
    const question = String(a?.question ?? '').trim();
    if (!question) continue;

    const id = typeof a?.registrationId === 'string' ? a.registrationId : null;
    if (id && validIds.has(id)) {
      byRegistration.set(id, [...(byRegistration.get(id) ?? []), question]);
    } else {
      floor.push({ poster: String(a?.poster ?? '').trim() || null, question });
    }
  }

  await prisma.$transaction([
    // Clear first, then set. Two statements rather than a per-row diff because
    // the whole point is that the paste is the complete state.
    prisma.sessionRegistration.updateMany({
      where: { sessionKey },
      data: { question: null },
    }),
    ...[...byRegistration.entries()].map(([id, questions]) =>
      prisma.sessionRegistration.update({
        where: { id },
        data: { question: questions.join('\n\n') },
      }),
    ),
    prisma.sessionFloorQuestion.deleteMany({ where: { sessionKey } }),
    ...(floor.length
      ? [prisma.sessionFloorQuestion.createMany({
          data: floor.map((f) => ({ sessionKey, poster: f.poster, question: f.question })),
        })]
      : []),
  ]);

  res.json({
    ok: true,
    assigned: byRegistration.size,
    floor: floor.length,
  });
});

// ── The fact sheets ──────────────────────────────────────────────────────────

async function briefOne(id: string): Promise<CoachBrief> {
  const row = await prisma.sessionRegistration.findUnique({
    where: { id },
    select: { name: true, resumeText: true, question: true, answers: true },
  });
  if (!row) throw new Error('No such registration');

  const brief = await generateCoachBrief({
    name: row.name,
    resumeText: row.resumeText,
    question: row.question,
    answers: (row.answers && typeof row.answers === 'object'
      ? row.answers
      : null) as Record<string, unknown> | null,
  });

  await prisma.sessionRegistration.update({
    where: { id },
    data: { coachBrief: brief as unknown as object, coachBriefAt: new Date() },
  });

  return brief;
}

/** POST /brief/:id — one fact sheet, cached on the row. */
router.post('/brief/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const brief = await briefOne(String(req.params.id));
    res.json({ ok: true, brief });
  } catch (err) {
    console.error('[admin-workshop] brief failed', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not generate that fact sheet.' });
  }
});

/**
 * POST /brief-all — the whole room in one press.
 *
 * Skips anyone who already has one unless `force` is set, so pressing it a
 * second time after adding a question costs one call rather than twelve.
 *
 * Three at a time. Sequential put a twelve-person room at roughly three minutes
 * of staring at a spinner; unbounded would hand OpenRouter a burst it answers
 * with 429s, and a rate limit at 4pm on workshop day is not a retry problem, it
 * is a no-fact-sheet problem. One failure never fails the batch: eleven fact
 * sheets and a named gap is a good outcome, twelve blanks is not.
 */
router.post('/brief-all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const sessionKey = sessionOf(req);
  const force = req.body?.force === true;

  // Filtered in JS rather than in the query: a null Json column needs
  // Prisma.DbNull to match, which is easy to get subtly wrong, and the roster is
  // a dozen rows. Correctness is worth more than the round trip here.
  const all = await prisma.sessionRegistration.findMany({
    where: { sessionKey },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, coachBrief: true },
  });
  const rows = force ? all : all.filter((r) => r.coachBrief == null);

  const failures: { name: string; error: string }[] = [];
  let generated = 0;

  const queue = [...rows];
  const worker = async () => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      try {
        await briefOne(row.id);
        generated += 1;
      } catch (err) {
        console.error('[admin-workshop] brief failed for', row.name, err);
        failures.push({ name: row.name, error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  await Promise.all([worker(), worker(), worker()]);

  res.json({ ok: true, generated, skipped: all.length - rows.length, failures });
});

export default router;
