/**
 * Give every paying client a year of access from the day their money arrived.
 *
 * Sets `accessExpiresAt` to first-payment + 1 year on each profile that Stripe
 * can be matched to. From 9 Sep 2026 that date is the whole story: see
 * withinPaidWindow in middleware/accessControl.ts — a future accessExpiresAt
 * grants access whatever the plan, the plan status or the grant flag say, so a
 * finished three-month bundle and a cancelled subscription both stop being the
 * end of somebody's access.
 *
 * TWO RULES, both about not taking anything away:
 *
 *   1. It only ever EXTENDS. A client whose existing expiry is already later
 *      than a year from their first payment keeps the later date.
 *   2. It touches accessExpiresAt and nothing else. No plan, no planStatus, no
 *      dashboardAccess, no counters. If this is run twice it writes the same
 *      dates again, and if it is wrong the blast radius is one column.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 *   npx tsx src/scripts/grant_year_from_first_payment.ts
 *   npx tsx src/scripts/grant_year_from_first_payment.ts --apply
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { planYearOfAccess, ACCESS_YEARS } from './first_payment_report';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const mask = (email: string | null | undefined): string => {
  const s = (email ?? '').trim();
  const at = s.lastIndexOf('@');
  return at <= 0 ? '(no email)' : `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
};
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const { matched, unmatched, orphanPayments } = await planYearOfAccess(prisma);

  const toWrite = matched.filter(m => !m.current || m.target > m.current);
  const alreadyLater = matched.filter(m => m.current && m.target <= m.current);

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}`);
  console.log(`${ACCESS_YEARS} year of access from each client's first payment.\n`);

  console.log(`WILL BE EXTENDED (${toWrite.length})`);
  for (const m of toWrite.sort((a, b) => a.first.at.getTime() - b.first.at.getTime())) {
    console.log(`  ${mask(m.email).padEnd(32)} ${(m.plan ?? '').padEnd(12)} paid ${day(m.first.at)}`
      + `  ${day(m.current).padEnd(11)} -> ${day(m.target)}`);
  }

  if (alreadyLater.length) {
    console.log(`\nALREADY LATER, LEFT ALONE (${alreadyLater.length})`);
    for (const m of alreadyLater) console.log(`  ${mask(m.email).padEnd(32)} keeps ${day(m.current)}`);
  }

  console.log(`\nNOT TOUCHED — a grant with no payment in Stripe (${unmatched.length})`);
  for (const u of unmatched) console.log(`  ${mask(u.email).padEnd(32)} grant=${u.dashboardAccess}`);

  if (orphanPayments.length) {
    console.log(`\n⚠ PAID BUT NO PROFILE MATCHES (${orphanPayments.length}) — these people have no access`);
    for (const [email, p] of orphanPayments) console.log(`  ${mask(email).padEnd(32)} paid ${day(p.at)} ${p.currency} ${p.amount}`);
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write it.');
    return;
  }

  let written = 0;
  for (const m of toWrite) {
    await prisma.candidateProfile.update({
      where: { userId: m.userId },
      data: { accessExpiresAt: m.target },
    });
    written++;
  }
  console.log(`\nwrote accessExpiresAt on ${written} profile${written === 1 ? '' : 's'}.`);

  // Read it back rather than trusting the writes. This is a customer-facing
  // column and the cost of a silent no-op here is somebody losing access.
  const check = await prisma.candidateProfile.findMany({
    where: { userId: { in: toWrite.map(m => m.userId) } },
    select: { userId: true, email: true, accessExpiresAt: true },
  });
  const wrong = check.filter(c => {
    const want = toWrite.find(m => m.userId === c.userId)!.target;
    return c.accessExpiresAt?.getTime() !== want.getTime();
  });
  console.log(wrong.length === 0
    ? 'verified: every row reads back with the date it was given.'
    : `MISMATCH on ${wrong.length}: ${wrong.map(w => mask(w.email)).join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
