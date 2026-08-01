/**
 * Repair applications whose dateApplied disagrees with their status.
 *
 * Two shapes of bad row, both created by PATCH /api/jobs/:id before it learned
 * to keep dateApplied in step with status:
 *
 *   1. status != SAVED, dateApplied NULL — a sent application that the client's
 *      own tracker, the leaderboard and the coach view all filter out, because
 *      those count on dateApplied. The client sent it and got no credit.
 *   2. status = SAVED, dateApplied SET — moved back to saved, but the stale
 *      date makes it count as sent.
 *
 * For (1) the date is unknowable after the fact. updatedAt is the closest
 * honest proxy: the row's last status change. It is never invented out of thin
 * air, and createdAt is used when updatedAt is somehow earlier.
 *
 * Run with:  npx tsx -r dotenv/config scripts/backfill-date-applied.ts          (dry run)
 *            npx tsx -r dotenv/config scripts/backfill-date-applied.ts --write
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WRITE = process.argv.includes('--write');

async function main() {
  console.log(WRITE ? '=== WRITING ===\n' : '=== DRY RUN (pass --write to apply) ===\n');

  const profiles = await prisma.candidateProfile.findMany({ select: { userId: true, name: true, email: true } });
  const who = new Map(profiles.map(p => [p.userId, `${p.name ?? '?'} <${p.email ?? 'no email'}>`]));

  // (1) Sent, but no date.
  const sentNoDate = await prisma.jobApplication.findMany({
    where: { status: { not: 'SAVED' }, dateApplied: null },
    select: { id: true, userId: true, status: true, company: true, title: true, createdAt: true, updatedAt: true },
  });

  console.log(`Sent applications with no dateApplied: ${sentNoDate.length}`);
  for (const r of sentNoDate) {
    const stamp = r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
    console.log(`  ${(who.get(r.userId) ?? r.userId).slice(0, 44).padEnd(46)} ${r.status.padEnd(10)} ${(r.company ?? '?').slice(0, 22).padEnd(24)} -> dateApplied=${stamp.toISOString().slice(0, 10)}`);
    if (WRITE) {
      await prisma.jobApplication.update({ where: { id: r.id }, data: { dateApplied: stamp } });
    }
  }

  // (2) Saved, but carrying a date.
  const savedWithDate = await prisma.jobApplication.findMany({
    where: { status: 'SAVED', dateApplied: { not: null } },
    select: { id: true, userId: true, company: true, dateApplied: true },
  });

  console.log(`\nSAVED applications still carrying a dateApplied: ${savedWithDate.length}`);
  for (const r of savedWithDate) {
    console.log(`  ${(who.get(r.userId) ?? r.userId).slice(0, 44).padEnd(46)} ${(r.company ?? '?').slice(0, 22).padEnd(24)} had ${r.dateApplied?.toISOString().slice(0, 10)} -> null`);
    if (WRITE) {
      await prisma.jobApplication.update({ where: { id: r.id }, data: { dateApplied: null } });
    }
  }

  console.log(WRITE ? '\nDone.' : '\nNothing written. Re-run with --write to apply.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
