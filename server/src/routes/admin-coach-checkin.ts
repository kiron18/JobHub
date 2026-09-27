/**
 * /api/admin/coach-checkin, the test and review console for the WhatsApp
 * check-in. Admin only (same allowlist as the other admin routes).
 *
 *   POST /run               fire a morning or evening check-in right now
 *   POST /start-challenge   set a member's challenge start date (for "Day N of 90")
 *   GET  /messages          recent messages both ways, flagged first
 *
 * /run ignores the once-a-day guard and the master switch on purpose: it is
 * how you test without waiting for 8am, and it only ever messages a member
 * who has already texted the bot in.
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { runCoachCheckin } from '../services/coachCheckin/run';

const router = Router();

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.use(authenticate, requireAdmin);

router.post('/run', async (req: AuthRequest, res: Response) => {
  const { slot, email } = req.body ?? {};
  if (slot !== 'morning' && slot !== 'evening') return res.status(400).json({ error: 'slot must be morning or evening' });
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'email is required, so a test can never go to everyone' });
  try {
    res.json(await runCoachCheckin(slot, { force: true, onlyEmails: [email.trim().toLowerCase()] }));
  } catch (e: any) {
    console.error('[admin-coach-checkin/run]', e);
    res.status(500).json({ error: e?.message ?? 'failed' });
  }
});

router.post('/start-challenge', async (req: AuthRequest, res: Response) => {
  const { email, startedAt } = req.body ?? {};
  if (typeof email !== 'string') return res.status(400).json({ error: 'email is required' });
  const when = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'startedAt is not a date' });
  const { count } = await prisma.candidateProfile.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { challengeStartedAt: when },
  });
  res.json({ updated: count, startedAt: when.toISOString() });
});

router.get('/messages', async (req: AuthRequest, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;
  let userId: string | undefined;
  if (email) {
    const p = await prisma.candidateProfile.findFirst({ where: { email }, select: { userId: true } });
    if (!p) return res.json({ messages: [] });
    userId = p.userId;
  }
  const messages = await prisma.coachMessage.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  // Flagged first, then newest, so anything needing a person is at the top.
  messages.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.createdAt.getTime() - a.createdAt.getTime());
  res.json({ messages });
});

export default router;
