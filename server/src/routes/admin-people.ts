/**
 * /api/admin/people: every person we know about, one row each.
 *
 * Two tables hold people and neither is complete on its own. SalesLead has
 * everyone who came through a workshop, the CRM import or a Stripe payment;
 * CandidateProfile has everyone who made an account. Plenty of people are in
 * both. They are merged on email, the join key across JobHub, the CRM and
 * Stripe, so one person is one row whichever doors they came through.
 *
 * Status is worked out, never stored, so it cannot drift:
 *   Paid       paying now (any of the three billing signals, see isPaidNow)
 *   Trial      on a card trial or mid-way through the free challenge
 *   Signed up  has an account, neither of the above
 *   Lapsed     paid at some point, not paying now
 *   Lead       no account yet
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EXEMPT_EMAILS } from './stripe';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabase } from '../lib/supabase';
import StripeLib from 'stripe';
import { PROFESSIONS } from '../services/resumeContact';
import { calendarConfigured } from '../services/googleCalendar';
import { lastActiveByUser } from '../services/adminActivity';
import { mondayAEST, tokenToInstant, weeklyEquivalent, type GoalType } from '../services/tracker/goals';
import { SENT_APPLICATION_FILTER } from '../services/tracker/metricHelpers';

const router = Router();

/** Our own inboxes, +tag variants included. Same rule /admin/traffic uses. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;
const isTest = (email: string | null | undefined) =>
  !!email && (TEST_EMAIL.test(email) || EXEMPT_EMAILS.includes(email.toLowerCase()));

export type PersonStatus = 'Paid' | 'Trial' | 'Signed up' | 'Lapsed' | 'Lead';

/**
 * Where someone sits in the one list the console shows. Worked out, never
 * stored, from what is true right now: a payment beats a booked call, a booked
 * call beats a stage somebody set by hand last month.
 */
export type PersonBucket = 'Client' | 'Trial' | 'Call booked' | 'Pitched' | 'Lead' | 'Lapsed' | 'Dead';
export const BUCKETS: PersonBucket[] = ['Client', 'Trial', 'Call booked', 'Pitched', 'Lead', 'Lapsed', 'Dead'];

export function bucketOf(r: {
  paid: boolean; trial: boolean; everPaid: boolean; stage: string | null; hasUpcomingCall: boolean;
}): PersonBucket {
  if (r.paid || r.stage === 'Client') return 'Client';
  if (r.stage === 'Dead') return 'Dead';
  if (r.trial) return 'Trial';
  if (r.hasUpcomingCall) return 'Call booked';
  if (r.stage === 'Pitched') return 'Pitched';
  if (r.everPaid) return 'Lapsed';
  return 'Lead';
}

/** Three signals, because payments reach us by three routes, and reading only
 * `plan` misses anyone whose payment was never matched back to their account. */
export function isPaidNow(p: {
  plan: string | null; planStatus: string | null; subscriptionStatus: string | null; accessExpiresAt: Date | null;
}, now: Date): boolean {
  const plan = (p.plan ?? 'free').toLowerCase();
  const planStatus = (p.planStatus ?? 'active').toLowerCase();
  if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) return true;
  const sub = (p.subscriptionStatus ?? '').toLowerCase();
  if (sub === 'active' || sub === 'trialing') return true;
  return !!p.accessExpiresAt && p.accessExpiresAt > now;
}

/** Every Supabase auth user, paged: the sign-in address lives there, not on
 * the profile (profile.email is whatever was printed on the resume). */
async function authEmails(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) if (u.email) out.set(u.id, u.email);
      if (data.users.length < 1000) break;
    }
  } catch (err) {
    // Falls back to the profile's own email rather than failing the page.
    console.warn('[admin-people] supabase listUsers failed, using profile emails:', (err as Error).message);
  }
  return out;
}

const CHALLENGE_LIVE = new Set(['day_in_progress', 'day_passed_waiting']);

router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const [loginEmail, profiles, withResume, challenges, leads, upcoming, lastActive] = await Promise.all([
      authEmails(),
      prisma.candidateProfile.findMany({
        select: {
          userId: true, name: true, email: true, createdAt: true,
          plan: true, planStatus: true, subscriptionStatus: true, accessExpiresAt: true,
          trialEndDate: true, stripeSubscriptionId: true,
        },
      }),
      // Raw so only the ids travel, not every resume's full text.
      prisma.$queryRaw<{ userId: string }[]>`
        SELECT "userId" FROM "CandidateProfile"
        WHERE "resumeRawText" IS NOT NULL OR "resumeOriginalText" IS NOT NULL`,
      prisma.trialChallenge.findMany({ select: { userId: true, status: true } }),
      prisma.salesLead.findMany({
        where: { archived: false },
        select: {
          id: true, name: true, email: true, stage: true, source: true,
          hasResume: true, paidAt: true, createdAt: true,
        },
      }),
      // Oldest first, so the first one seen per lead is their next call.
      prisma.salesMeeting.findMany({
        where: { cancelledAt: null, startsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        select: { leadId: true, startsAt: true },
      }),
      lastActiveByUser(),
    ]);

    const nextCall = new Map<string, Date>();
    for (const m of upcoming) if (!nextCall.has(m.leadId)) nextCall.set(m.leadId, m.startsAt);

    const resumeSet = new Set(withResume.map((p) => p.userId));
    const challengeLive = new Set(challenges.filter((c) => CHALLENGE_LIVE.has(c.status)).map((c) => c.userId));

    interface Row {
      email: string | null;
      name: string | null;
      userId: string | null;
      leadId: string | null;
      stage: string | null;
      source: string;
      joinedAt: Date;
      hasResume: boolean;
      paid: boolean;
      everPaid: boolean;
      trial: boolean;
      hasAccount: boolean;
      trialEndsAt: Date | null;
    }
    const byKey = new Map<string, Row>();

    for (const p of profiles) {
      const email = loginEmail.get(p.userId) ?? p.email ?? null;
      if (isTest(email) || isTest(p.email)) continue;
      const key = email ? email.trim().toLowerCase() : `user:${p.userId}`;
      const paid = isPaidNow(p, now);
      const everPaid = paid || !!p.stripeSubscriptionId || (p.plan ?? 'free') !== 'free' || !!p.accessExpiresAt;
      const trial = (!!p.trialEndDate && p.trialEndDate > now) || challengeLive.has(p.userId);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          email, name: p.name ?? null, userId: p.userId, leadId: null, stage: null, source: 'app',
          joinedAt: p.createdAt, hasResume: resumeSet.has(p.userId),
          paid, everPaid, trial, hasAccount: true,
          trialEndsAt: p.trialEndDate && p.trialEndDate > now ? p.trialEndDate : null,
        });
        continue;
      }
      // A second profile under the same email: a duplicate signup. Keep the
      // strongest facts from both, and point at the paying one if there is one.
      if (paid && !existing.paid) existing.userId = p.userId;
      existing.name = existing.name ?? p.name ?? null;
      existing.joinedAt = p.createdAt < existing.joinedAt ? p.createdAt : existing.joinedAt;
      existing.hasResume ||= resumeSet.has(p.userId);
      existing.paid ||= paid;
      existing.everPaid ||= everPaid;
      existing.trial ||= trial;
    }

    for (const l of leads) {
      if (isTest(l.email)) continue;
      const key = l.email ? l.email.trim().toLowerCase() : `lead:${l.id}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.leadId = l.id;
        existing.stage = l.stage;
        existing.source = l.source;
        existing.name = existing.name ?? l.name;
        existing.joinedAt = l.createdAt < existing.joinedAt ? l.createdAt : existing.joinedAt;
        existing.hasResume ||= l.hasResume;
        existing.everPaid ||= !!l.paidAt;
        continue;
      }
      byKey.set(key, {
        email: l.email, name: l.name, userId: null, leadId: l.id, stage: l.stage, source: l.source,
        joinedAt: l.createdAt, hasResume: l.hasResume,
        // Paid with no account yet: they bought before signing up. Stripe's
        // paidAt is the only signal, so trust it rather than calling them a lead.
        paid: !!l.paidAt, everPaid: !!l.paidAt, trial: false, hasAccount: false, trialEndsAt: null,
      });
    }

    const statusOf = (r: Row): PersonStatus =>
      r.paid ? 'Paid'
        : r.trial ? 'Trial'
          : r.everPaid ? 'Lapsed'
            : r.hasAccount ? 'Signed up'
              : 'Lead';

    const people = [...byKey.values()]
      .map((r) => ({
        name: r.name,
        email: r.email,
        status: statusOf(r),
        // The sales stage only adds something for people with no account:
        // Registered / Attended / Pitched / Dead says how warm a lead is.
        stage: r.hasAccount ? null : r.stage,
        source: r.source,
        joinedAt: r.joinedAt,
        hasResume: r.hasResume,
        hasAccount: r.hasAccount,
        trialEndsAt: r.trialEndsAt,
        userId: r.userId,
        leadId: r.leadId,
        bucket: bucketOf({ ...r, hasUpcomingCall: !!(r.leadId && nextCall.has(r.leadId)) }),
        nextCallAt: (r.leadId && nextCall.get(r.leadId)) || null,
        lastActiveAt: (r.userId && lastActive.get(r.userId)) || null,
      }))
      .sort((a, b) => +b.joinedAt - +a.joinedAt);

    const counts: Record<PersonStatus, number> = { Paid: 0, Trial: 0, 'Signed up': 0, Lapsed: 0, Lead: 0 };
    for (const p of people) counts[p.status]++;
    const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<PersonBucket, number>;
    for (const p of people) buckets[p.bucket]++;

    res.json({ counts, buckets, people, professions: PROFESSIONS, calendarConnected: calendarConfigured() });
  } catch (err) {
    console.error('[admin-people] list failed', err);
    res.status(500).json({ error: 'Failed to load people.' });
  }
});

/**
 * One person's resume, wherever it is.
 *
 * The original file when we kept one (workshop registrations store the bytes),
 * otherwise the text: the uploaded original before the rebuilt clean copy,
 * since the original is what they actually sent us.
 */
router.get('/resume', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const email = String(req.query.email || '').trim();
  const userId = String(req.query.userId || '').trim();

  const reg = email
    ? await prisma.sessionRegistration.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { resumeFile: true, resumeMimetype: true, resumeFilename: true, resumeText: true },
      })
    : null;
  if (reg?.resumeFile) {
    res.setHeader('Content-Type', reg.resumeMimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(reg.resumeFilename || 'resume').replace(/"/g, '')}"`);
    return res.send(Buffer.from(reg.resumeFile));
  }

  const p = userId
    ? await prisma.candidateProfile.findUnique({
        where: { userId },
        select: { resumeOriginalText: true, resumeRawText: true },
      })
    : null;
  const text = p?.resumeOriginalText || p?.resumeRawText || reg?.resumeText;
  if (text) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(text);
  }

  res.status(404).send('No resume on file');
});

// ── One person ───────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

const PROFILE_FIELDS = {
  userId: true, name: true, email: true, createdAt: true, phone: true, location: true,
  plan: true, planStatus: true, subscriptionStatus: true, accessExpiresAt: true, trialEndDate: true,
  stripeSubscriptionId: true, stripeCustomerId: true, billingHoldAt: true,
  whatsappNumber: true, whatsappVerifiedAt: true, targetRole: true, visaStatus: true,
  dailyApplicationGoal: true, applicationGoalType: true, dailyOutreachGoal: true, outreachGoalType: true,
  resumeFilename: true,
} as const;

/** This week in the app, against the client's own weekly targets. */
async function weekOf(
  p: {
    userId: string; dailyApplicationGoal: number; applicationGoalType: string;
    dailyOutreachGoal: number; outreachGoalType: string;
  },
  now: Date,
) {
  const weekStart = tokenToInstant(mondayAEST());
  const [apps, outreach, lifetime, lastActive] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId: p.userId, ...SENT_APPLICATION_FILTER, dateApplied: { gte: weekStart } },
      select: { id: true, sourceUrl: true },
    }),
    prisma.outreachLog.count({ where: { userId: p.userId, createdAt: { gte: weekStart } } }),
    prisma.jobApplication.count({ where: { userId: p.userId, ...SENT_APPLICATION_FILTER } }),
    lastActiveByUser([p.userId]),
  ]);
  const goalType = (t: string): GoalType => (t === 'weekly' ? 'weekly' : 'daily');
  const last = lastActive.get(p.userId) ?? null;
  return {
    // The same job logged twice is one application, as everywhere else.
    applications: new Set(apps.map((a) => a.sourceUrl ?? `__id:${a.id}`)).size,
    applicationTarget: weeklyEquivalent(p.dailyApplicationGoal, goalType(p.applicationGoalType)),
    outreach,
    outreachTarget: weeklyEquivalent(p.dailyOutreachGoal, goalType(p.outreachGoalType)),
    lifetimeApplications: lifetime,
    lastActiveAt: last,
    daysQuiet: last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null,
  };
}

/**
 * Everything about one person, for the page that is open during a call.
 *
 * Takes whichever ids the list had: a lead id, a user id, or both. The two
 * halves are joined on email, the same way the list joins them, so a client
 * who was once a lead is one page and not two.
 */
router.get('/person', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const leadId = String(req.query.leadId || '').trim();
  const userId = String(req.query.userId || '').trim();
  if (!leadId && !userId) return res.status(400).json({ error: 'A leadId or a userId is needed.' });

  try {
    const now = new Date();
    let lead = leadId ? await prisma.salesLead.findUnique({ where: { id: leadId } }) : null;
    let profile = userId ? await prisma.candidateProfile.findUnique({ where: { userId }, select: PROFILE_FIELDS }) : null;

    // Fill in the other half by email. The sign-in address first, because
    // profile.email is whatever was printed on the resume.
    let signInEmail: string | null = null;
    if (profile) {
      try {
        const { data } = await supabase.auth.admin.getUserById(profile.userId);
        signInEmail = data.user?.email?.toLowerCase() ?? null;
      } catch { /* the profile's own email will do */ }
    }
    if (profile && !lead) {
      const emails = [signInEmail, profile.email?.toLowerCase()].filter((e): e is string => !!e);
      if (emails.length) lead = await prisma.salesLead.findFirst({ where: { email: { in: emails } } });
    }
    if (lead?.email && !profile) {
      profile = await prisma.candidateProfile.findFirst({
        where: { email: { equals: lead.email, mode: 'insensitive' } }, select: PROFILE_FIELDS,
      });
    }
    if (!lead && !profile) return res.status(404).json({ error: 'That person is not here any more.' });

    const email = lead?.email ?? signInEmail ?? profile?.email ?? null;

    const [meetings, reg, activity, challenge] = await Promise.all([
      lead
        ? prisma.salesMeeting.findMany({
            where: { leadId: lead.id, cancelledAt: null },
            orderBy: { startsAt: 'desc' },
            select: {
              id: true, startsAt: true, minutes: true, notify: true, meetLink: true, calendarLink: true,
              calendarError: true, reminderDaySentAt: true, reminderHourSentAt: true,
            },
          })
        : [],
      email
        ? prisma.sessionRegistration.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { resumeFilename: true, resumeText: true, answers: true, questionSchema: true },
          })
        : null,
      profile ? weekOf(profile, now) : null,
      profile ? prisma.trialChallenge.findFirst({ where: { userId: profile.userId }, select: { status: true } }) : null,
    ]);

    // Same rule the board uses: the next call that has not finished, or
    // failing that the most recent one that has. Newest first here, so the
    // soonest unfinished one is the last of them.
    const unfinished = meetings.filter((m) => m.startsAt.getTime() + m.minutes * 60_000 > now.getTime());
    const current = unfinished.length ? unfinished[unfinished.length - 1] : meetings[0] ?? null;

    const paid = profile ? isPaidNow(profile, now) : !!lead?.paidAt;
    const everPaid = paid || !!lead?.paidAt || !!profile?.stripeSubscriptionId
      || (!!profile && (profile.plan ?? 'free') !== 'free') || !!profile?.accessExpiresAt;
    const trial = !!profile && ((!!profile.trialEndDate && profile.trialEndDate > now) || CHALLENGE_LIVE.has(challenge?.status ?? ''));

    res.json({
      name: lead?.name ?? profile?.name ?? email ?? 'No name yet',
      email,
      bucket: bucketOf({ paid, trial, everPaid, stage: lead?.stage ?? null, hasUpcomingCall: unfinished.length > 0 }),
      lead,
      meeting: current
        ? {
            id: current.id, startsAt: current.startsAt, minutes: current.minutes, notify: current.notify,
            meetLink: current.meetLink, calendarLink: current.calendarLink, calendarError: current.calendarError,
            reminderDayPending: !current.reminderDaySentAt, reminderHourPending: !current.reminderHourSentAt,
          }
        : null,
      meetings: meetings.map((m) => ({ id: m.id, startsAt: m.startsAt, minutes: m.minutes })),
      hasResume: !!(reg?.resumeText || reg?.resumeFilename || profile?.resumeFilename || lead?.hasResume),
      answers: reg?.answers ?? null,
      questionSchema: reg?.questionSchema ?? null,
      account: profile
        ? {
            userId: profile.userId,
            joinedAt: profile.createdAt,
            plan: profile.plan,
            planStatus: profile.planStatus,
            paid,
            trialEndsAt: profile.trialEndDate && profile.trialEndDate > now ? profile.trialEndDate : null,
            onHold: !!profile.billingHoldAt,
            phone: profile.whatsappNumber ?? profile.phone ?? null,
            location: profile.location,
            targetRole: profile.targetRole,
            visaStatus: profile.visaStatus,
          }
        : null,
      activity,
      professions: PROFESSIONS,
      calendarConnected: calendarConfigured(),
    });
  } catch (err) {
    console.error('[admin-people] person failed', err);
    res.status(500).json({ error: 'Could not load that person.' });
  }
});

/**
 * What this person has paid, straight from Stripe.
 *
 * Its own request so the page does not wait on Stripe to draw. Found by the
 * customer id on the account when there is one, and by every Stripe customer
 * under their email.
 */
router.get('/person/payments', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const userId = String(req.query.userId || '').trim();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'Stripe is not configured on this server.' });

  try {
    const stripe = new StripeLib(key, { apiVersion: '2026-03-25.dahlia' as any });
    const customers = new Set<string>();
    if (userId) {
      const p = await prisma.candidateProfile.findUnique({ where: { userId }, select: { stripeCustomerId: true } });
      if (p?.stripeCustomerId) customers.add(p.stripeCustomerId);
    }
    if (email) {
      const found = await stripe.customers.list({ email, limit: 10 });
      for (const c of found.data) customers.add(c.id);
    }

    const payments: { id: string; paidAt: string; amount: number; refunded: number; currency: string; description: string | null }[] = [];
    for (const customer of customers) {
      const charges = await stripe.charges.list({ customer, limit: 50 });
      for (const ch of charges.data) {
        if (ch.status !== 'succeeded') continue;
        payments.push({
          id: ch.id,
          paidAt: new Date(ch.created * 1000).toISOString(),
          amount: ch.amount / 100,
          refunded: ch.amount_refunded / 100,
          currency: ch.currency,
          description: ch.description ?? null,
        });
      }
    }
    payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    res.json({ payments });
  } catch (err: any) {
    console.error('[admin-people] payments failed', err?.message ?? err);
    res.status(500).json({ error: 'Could not load payments from Stripe.' });
  }
});

/**
 * Put an account holder on the pipeline.
 *
 * Notes and booked calls hang off a SalesLead, and someone who signed up in
 * the app without ever being a lead does not have one. Finds theirs by email
 * if it exists, so pressing this twice never makes two.
 */
router.post('/lead', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = String(req.body?.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'A userId is needed.' });
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId }, select: { name: true, email: true, phone: true, location: true },
    });
    if (!profile) return res.status(404).json({ error: 'That account is not here any more.' });

    let email = profile.email?.trim().toLowerCase() || null;
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      email = data.user?.email?.toLowerCase() ?? email;
    } catch { /* the profile's own email will do */ }

    const existing = email ? await prisma.salesLead.findUnique({ where: { email } }) : null;
    const lead = existing
      ? await prisma.salesLead.update({ where: { id: existing.id }, data: { archived: false } })
      : await prisma.salesLead.create({
          data: {
            name: profile.name || (email ? email.split('@')[0] : 'No name yet'),
            email, phone: profile.phone, location: profile.location, source: 'app',
          },
        });
    res.json({ lead });
  } catch (err) {
    console.error('[admin-people] ensure lead failed', err);
    res.status(500).json({ error: 'Could not add them to the pipeline.' });
  }
});

export default router;
