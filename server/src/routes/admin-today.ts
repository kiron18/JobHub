/**
 * /api/admin/today: the list of things to do, worked out from what is true.
 *
 *   GET /
 *
 * Four lists, each one a reason to act today rather than a report:
 *
 *   calls       who the calls are with, in order
 *   followUps   leads that have stalled with the next move on our side
 *   quiet       paying clients who have stopped using the app
 *   money       payments that need a person
 *
 * The hand-ticked checklist (posts, DMs, connection requests) is not here. It
 * lives in /api/admin/daily and the page shows the two together.
 *
 * Every list is capped. A to-do list with forty rows on it is not one, and the
 * full picture is one click away on People.
 */
import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { isPaidNow } from './admin-people';
import { daysSince, lastActiveByUser } from '../services/adminActivity';

const router = Router();

router.use(authenticate, requireAdmin);

const DAY_MS = 86_400_000;
/** Days without a reply before a pitch is worth chasing. */
const PITCH_STALE_DAYS = 3;
/** Days without activity before a paying client counts as gone quiet. */
const QUIET_DAYS = 4;
/** Past this they are not quiet, they have left, and a nudge is the wrong tool. */
const QUIET_CEILING_DAYS = 45;
const CAP = 8;

/** Our own inboxes, +tag variants included. Same rule /admin/people uses. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;

/** The start and end of today in Sydney, as instants. */
function sydneyDayBounds(now: Date): { start: Date; end: Date } {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now);
  // Sydney is UTC+10 or +11. Find which by asking what the wall clock reads
  // at the UTC midnight of that date, then stepping back by that much.
  const utcMidnight = new Date(`${day}T00:00:00.000Z`);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', hour12: false }).format(utcMidnight));
  const start = new Date(utcMidnight.getTime() - hour * 3_600_000);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const { start, end } = sydneyDayBounds(now);

    const [todayMeetings, upcoming, everMet, leads, profiles, lastActive, unmatched] = await Promise.all([
      prisma.salesMeeting.findMany({
        where: { cancelledAt: null, startsAt: { gte: start, lt: end } },
        orderBy: { startsAt: 'asc' },
        select: {
          id: true, startsAt: true, minutes: true, meetLink: true,
          lead: { select: { id: true, name: true, email: true, stage: true, jobTitle: true, profession: true, visaStatus: true } },
        },
      }),
      prisma.salesMeeting.findMany({
        where: { cancelledAt: null, startsAt: { gt: now } },
        select: { leadId: true },
      }),
      prisma.salesMeeting.findMany({ where: { cancelledAt: null }, distinct: ['leadId'], select: { leadId: true } }),
      prisma.salesLead.findMany({
        where: { archived: false, stage: { notIn: ['Client', 'Dead'] }, paidAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, email: true, stage: true, hasResume: true, updatedAt: true },
      }),
      prisma.candidateProfile.findMany({
        select: {
          userId: true, name: true, email: true, phone: true, whatsappNumber: true,
          plan: true, planStatus: true, subscriptionStatus: true, accessExpiresAt: true,
          billingHoldAt: true, billingHoldInvoiceUrl: true, createdAt: true,
        },
      }),
      lastActiveByUser(),
      prisma.unmatchedPayment.findMany({
        orderBy: { lastSeenAt: 'desc' },
        take: CAP,
        select: { email: true, amount: true, reason: true },
      }),
    ]);

    const hasUpcoming = new Set(upcoming.map((m) => m.leadId));
    const hasMet = new Set(everMet.map((m) => m.leadId));

    // A client's own account, for the calls list: "9 applications this week"
    // is on the person page, here it is enough to know which side of the sale
    // the call is on.
    const calls = todayMeetings.map((m) => ({
      meetingId: m.id,
      leadId: m.lead.id,
      name: m.lead.name,
      startsAt: m.startsAt,
      minutes: m.minutes,
      meetLink: m.meetLink,
      kind: m.lead.stage === 'Client' ? 'Client check-in' : 'Sales call',
      about: [m.lead.jobTitle ?? m.lead.profession, m.lead.visaStatus].filter(Boolean).join(', ') || null,
      finished: m.startsAt.getTime() + m.minutes * 60_000 <= now.getTime(),
    }));

    const followUps: { leadId: string; name: string; why: string; action: 'message' | 'book' }[] = [];
    for (const l of leads) {
      if (TEST_EMAIL.test(l.email ?? '') || hasUpcoming.has(l.id)) continue;
      const days = daysSince(l.updatedAt, now);
      if (l.stage === 'Pitched' && days >= PITCH_STALE_DAYS) {
        followUps.push({ leadId: l.id, name: l.name, why: `Pitched ${days} days ago. No reply yet.`, action: 'message' });
      } else if (l.stage !== 'Pitched' && l.hasResume && !hasMet.has(l.id)) {
        followUps.push({ leadId: l.id, name: l.name, why: 'Resume on file. No call booked.', action: 'book' });
      }
    }

    const real = profiles.filter((p) => !TEST_EMAIL.test(p.email ?? ''));

    const quiet = real
      .filter((p) => isPaidNow(p, now))
      .map((p) => {
        // Never active counts from the day they joined: a client who paid a
        // fortnight ago and has done nothing is the quietest of all.
        const days = daysSince(lastActive.get(p.userId) ?? p.createdAt, now);
        return {
          userId: p.userId,
          name: p.name ?? p.email ?? 'No name yet',
          days,
          never: !lastActive.has(p.userId),
          phone: p.whatsappNumber ?? p.phone ?? null,
          email: p.email,
        };
      })
      .filter((p) => p.days >= QUIET_DAYS && p.days <= QUIET_CEILING_DAYS)
      .sort((a, b) => b.days - a.days);

    const money = [
      ...real
        .filter((p) => p.billingHoldAt || ['past_due', 'unpaid'].includes((p.planStatus ?? '').toLowerCase())
          || ['past_due', 'unpaid'].includes((p.subscriptionStatus ?? '').toLowerCase()))
        .map((p) => ({
          kind: 'failed' as const,
          userId: p.userId as string | null,
          name: p.name ?? p.email ?? 'No name yet',
          why: p.billingHoldAt
            ? `Payment failed ${daysSince(p.billingHoldAt, now)} days ago. Access is on hold.`
            : 'Payment is past due.',
          invoiceUrl: p.billingHoldInvoiceUrl,
          email: p.email,
        })),
      ...unmatched
        .filter((u) => !TEST_EMAIL.test(u.email))
        .map((u) => ({
          kind: 'unmatched' as const,
          userId: null,
          name: u.email,
          why: `Paid${u.amount ? ` $${u.amount.toFixed(0)}` : ''} with no account to match it to.`,
          invoiceUrl: null,
          email: u.email,
        })),
    ];

    res.json({
      calls,
      followUps: followUps.slice(0, CAP),
      followUpsTotal: followUps.length,
      quiet: quiet.slice(0, CAP),
      quietTotal: quiet.length,
      money: money.slice(0, CAP),
      moneyTotal: money.length,
    });
  } catch (err) {
    console.error('[admin-today] failed', err);
    res.status(500).json({ error: 'Could not load today.' });
  }
});

export default router;
