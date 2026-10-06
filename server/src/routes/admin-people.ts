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
import { supabase } from '../lib/supabase';

const router = Router();

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

/** Our own inboxes, +tag variants included. Same rule /admin/traffic uses. */
const TEST_EMAIL = /kiron|norik|kamiproject/i;
const isTest = (email: string | null | undefined) =>
  !!email && (TEST_EMAIL.test(email) || EXEMPT_EMAILS.includes(email.toLowerCase()));

export type PersonStatus = 'Paid' | 'Trial' | 'Signed up' | 'Lapsed' | 'Lead';

/** Same three signals as /admin/funnel/user-usage: payments reach us by three
 * routes, and reading only `plan` misses anyone whose payment was never matched
 * back to their account. */
function isPaidNow(p: {
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
    const [loginEmail, profiles, withResume, challenges, leads] = await Promise.all([
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
    ]);

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
      }))
      .sort((a, b) => +b.joinedAt - +a.joinedAt);

    const counts: Record<PersonStatus, number> = { Paid: 0, Trial: 0, 'Signed up': 0, Lapsed: 0, Lead: 0 };
    for (const p of people) counts[p.status]++;

    res.json({ counts, people });
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

export default router;
