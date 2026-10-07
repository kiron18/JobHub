/**
 * /api/admin/daily, the store behind Kiron's own daily checklist. Admin only
 * (same allowlist as the other admin routes).
 *
 *   GET /?date=YYYY-MM-DD   that day's log, the last 14 days, and the new
 *                           signups still waiting on a personal welcome
 *   PUT /:date              save that day's ticks, counts and note
 *
 * The task list itself is not known here. It lives in src/config/dailyTasks.ts
 * and this route stores whatever ids it is handed.
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';

const router = Router();

const HISTORY_DAYS = 14;
/** How far back a signup still counts as "new" and worth a welcome. */
const WELCOME_WINDOW_DAYS = 7;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEST_EMAIL = /kiron|norik|kamiproject/i;

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

/** YYYY-MM-DD in Sydney, optionally shifted by whole days. */
function sydneyDate(offsetDays = 0): string {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
  const d = new Date(`${s}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Keep only what a task can legitimately hold: a tick or a small count. */
function cleanDone(raw: unknown): Record<string, boolean | number> {
  const out: Record<string, boolean | number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 50)) {
    if (typeof v === 'boolean') out[k.slice(0, 60)] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k.slice(0, 60)] = Math.max(0, Math.min(9999, Math.round(v)));
  }
  return out;
}

router.use(authenticate, requireAdmin);

router.get('/', async (req: AuthRequest, res: Response) => {
  const today = sydneyDate();
  const date = typeof req.query.date === 'string' && DATE_RE.test(req.query.date) ? req.query.date : today;
  try {
    const [log, history, profiles] = await Promise.all([
      prisma.adminDailyLog.findUnique({ where: { date } }),
      prisma.adminDailyLog.findMany({ where: { date: { gte: sydneyDate(-(HISTORY_DAYS - 1)), lte: today } } }),
      prisma.candidateProfile.findMany({
        where: { createdAt: { gte: new Date(Date.now() - WELCOME_WINDOW_DAYS * 864e5) } },
        select: { userId: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Welcomed on any day counts, not just the one being looked at, so a
    // person ticked yesterday does not come back today.
    const welcomedRows = await prisma.adminDailyLog.findMany({
      where: { date: { gte: sydneyDate(-(WELCOME_WINDOW_DAYS + 1)) } },
      select: { date: true, welcomed: true },
    });
    const welcomedOn = new Map<string, string>();
    for (const r of welcomedRows) for (const id of r.welcomed) welcomedOn.set(id, r.date);

    const signups = profiles
      .filter((p) => !(p.email && (TEST_EMAIL.test(p.email) || EXEMPT_EMAILS.includes(p.email.toLowerCase()))))
      .map((p) => ({ userId: p.userId, name: p.name, email: p.email, joinedAt: p.createdAt, welcomedOn: welcomedOn.get(p.userId) ?? null }));

    res.json({
      today,
      date,
      log: { done: (log?.done as Record<string, boolean | number>) ?? {}, welcomed: log?.welcomed ?? [], note: log?.note ?? '' },
      history: history.map((h) => ({ date: h.date, done: h.done, welcomed: h.welcomed.length })),
      signups,
    });
  } catch (e: any) {
    console.error('[admin-daily/get]', e);
    res.status(500).json({ error: e?.message ?? 'failed' });
  }
});

router.put('/:date', async (req: AuthRequest, res: Response) => {
  const date = String(req.params.date);
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  if (date > sydneyDate()) return res.status(400).json({ error: 'that day has not happened yet' });
  const done = cleanDone(req.body?.done);
  const welcomed = Array.isArray(req.body?.welcomed)
    ? [...new Set((req.body.welcomed as unknown[]).filter((x): x is string => typeof x === 'string'))].slice(0, 200)
    : [];
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 2000) : '';
  try {
    const row = await prisma.adminDailyLog.upsert({
      where: { date },
      create: { date, done, welcomed, note },
      update: { done, welcomed, note },
    });
    res.json({ date: row.date, updatedAt: row.updatedAt });
  } catch (e: any) {
    console.error('[admin-daily/put]', e);
    res.status(500).json({ error: e?.message ?? 'failed' });
  }
});

export default router;
