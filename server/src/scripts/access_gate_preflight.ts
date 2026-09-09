/**
 * Who is about to be affected if FREE_TIER_GATE is switched on.
 *
 * Run this BEFORE flipping the switch, every time. The gate has been paused
 * since the Sep 2026 pricing rework, which means the product currently gives
 * every signed-in account unlimited access and the database has been quietly
 * drifting underneath that for months: bundles have expired, free counters have
 * been climbing, and nothing enforced any of it. Turning the gate on makes all
 * of that real at once, on whoever's request happens to arrive first.
 *
 * Three things this is looking for, in order of how much they would hurt:
 *
 *   1. EXPIRED BUNDLES. A `three_month` row whose accessExpiresAt has passed is
 *      downgraded to free — a real write, on a real client, the moment they next
 *      press a button. These are paying customers. Deal with each one (extend
 *      the date, move them to a subscription, or decide to let it lapse) before
 *      the gate goes on, not after.
 *   2. BUNDLES EXPIRING SOON. The same problem, on a timer.
 *   3. FREE ACCOUNTS ALREADY OVER A LIMIT. Their counters accrued while the
 *      limits meant nothing, so switching the gate on retroactively spends an
 *      allowance they never knew they had, and they hit a wall with no warning.
 *
 * READ ONLY. It writes nothing and it prints no full email addresses — enough
 * of each to recognise the person, and no more.
 *
 *   npx tsx src/scripts/access_gate_preflight.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { isGateEnforced } from '../config/accessGate';

const prisma = new PrismaClient();

/** How far ahead counts as "expiring soon". */
const SOON_DAYS = 21;

const FREE_LIMITS: Record<string, number> = { generation: 5, analysis: 5, job_search: 1, match_score: 1 };

const mask = (email: string | null | undefined): string => {
  const s = (email ?? '').trim();
  const at = s.lastIndexOf('@');
  if (at <= 0) return '(no email on the profile)';
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
};

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  console.log(`Gate is currently: ${isGateEnforced() ? 'ENFORCED' : 'PAUSED'}`);
  console.log(`(that is this shell's FREE_TIER_GATE, not production's — check /api/health for that)\n`);

  const rows = await prisma.candidateProfile.findMany({
    select: {
      email: true, plan: true, planStatus: true, accessExpiresAt: true, trialEndDate: true,
      dashboardAccess: true, billingHoldAt: true, stripeSubscriptionId: true, updatedAt: true,
      freeGenerationsUsed: true, freeAnalysesUsed: true, freeJobSearchesUsed: true, freeMatchScoresUsed: true,
    },
  });

  const now = new Date();
  const soon = new Date(now.getTime() + SOON_DAYS * 86_400_000);

  /*
    hasActiveAccess, copied rather than imported, and it must be kept in step
    with middleware/accessControl.ts.

    Importing the real one would be better and cannot be done: accessControl
    takes `prisma` from ../index, which is the Express entry point, so a script
    that imports it boots the whole server and never returns.

    It HAS drifted once already — this clause did not exist until accessExpiresAt
    became the senior signal, and without it the preflight cheerfully reported
    that eight paying clients were about to lose access. If you change the rule
    over there, change it here.
  */
  const keepsUnlimited = (p: (typeof rows)[number]) => {
    if (p.billingHoldAt != null) return false;
    if (p.accessExpiresAt != null && p.accessExpiresAt > now) return true;
    if (p.dashboardAccess === true) return true;
    const plan = p.plan ?? 'free';
    const status = p.planStatus ?? 'active';
    if (plan !== 'free' && (status === 'active' || status === 'trialing')) return true;
    return p.trialEndDate != null && p.trialEndDate > now;
  };

  const paying = rows.filter(r => (r.plan ?? 'free') !== 'free' || r.dashboardAccess === true);
  const expired = paying.filter(r => r.plan === 'three_month' && r.accessExpiresAt && r.accessExpiresAt < now);
  const expiringSoon = paying.filter(
    r => r.plan === 'three_month' && r.accessExpiresAt && r.accessExpiresAt >= now && r.accessExpiresAt < soon,
  );
  const overLimit = rows.filter(
    r => !keepsUnlimited(r) &&
      ((r.freeGenerationsUsed ?? 0) >= FREE_LIMITS.generation || (r.freeAnalysesUsed ?? 0) >= FREE_LIMITS.analysis),
  );

  console.log(`profiles: ${rows.length}   keep unlimited: ${rows.filter(keepsUnlimited).length}   `
    + `drop to free limits: ${rows.filter(r => !keepsUnlimited(r)).length}\n`);

  console.log(`PAYING OR GRANTED (${paying.length})`);
  for (const p of paying.sort((a, b) => (a.accessExpiresAt?.getTime() ?? 8e15) - (b.accessExpiresAt?.getTime() ?? 8e15))) {
    const flag = expired.includes(p) ? '  <-- EXPIRED, will be downgraded'
      : expiringSoon.includes(p) ? '  <-- expires soon'
      : '';
    console.log(`  ${mask(p.email).padEnd(32)} ${(p.plan ?? '').padEnd(12)} ${(p.planStatus ?? '').padEnd(10)}`
      + ` expires=${day(p.accessExpiresAt).padEnd(10)} grant=${p.dashboardAccess ? 'yes' : 'NO '}`
      + ` stripeSub=${p.stripeSubscriptionId ? 'yes' : 'no '}${flag}`);
  }

  console.log(`\n1. EXPIRED BUNDLES — downgraded on their next request (${expired.length})`);
  for (const p of expired) console.log(`  ${mask(p.email)}  ended ${day(p.accessExpiresAt)}`);
  if (expired.length === 0) console.log('  none');

  console.log(`\n2. EXPIRING WITHIN ${SOON_DAYS} DAYS (${expiringSoon.length})`);
  for (const p of expiringSoon) console.log(`  ${mask(p.email)}  ends ${day(p.accessExpiresAt)}`);
  if (expiringSoon.length === 0) console.log('  none');

  console.log(`\n3. FREE ACCOUNTS ALREADY AT OR OVER A LIMIT — blocked on their next request (${overLimit.length})`);
  for (const p of overLimit.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    console.log(`  ${mask(p.email).padEnd(32)} generations=${p.freeGenerationsUsed} analyses=${p.freeAnalysesUsed}`
      + `  last active ${day(p.updatedAt)}`);
  }
  if (overLimit.length === 0) console.log('  none');

  const holds = rows.filter(r => r.billingHoldAt != null);
  console.log(`\nbilling holds in place: ${holds.length}${holds.length ? ' — ' + holds.map(h => mask(h.email)).join(', ') : ''}`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
