/**
 * One-off: populate ManualLeaderboardEntry with the real clients Kiron
 * tracks outside JobHub, so the leaderboard has something to look at before
 * he supplies their real numbers. Every row is marked isPlaceholder: true —
 * the coach dashboard's "Manual leaderboard entries" panel flags those
 * visually until they're updated with real data.
 *
 * Idempotent by displayName: re-running updates existing rows instead of
 * duplicating them (there's no DB-level unique constraint on displayName,
 * so this is the thing keeping repeat runs safe).
 *
 * Run: npx tsx src/scripts/seedManualLeaderboardEntries.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENTRIES = [
  { displayName: 'Nisha', applications: 61, outreach: 40, interviews: 2, offers: 0, currentStreak: 12 },
  { displayName: 'Akram B', applications: 42, outreach: 28, interviews: 1, offers: 0, currentStreak: 8 },
  { displayName: 'Dehwe S', applications: 16, outreach: 10, interviews: 0, offers: 0, currentStreak: 3 },
  { displayName: 'Radcliffe P', applications: 78, outreach: 55, interviews: 3, offers: 1, currentStreak: 15 },
  { displayName: 'Ashaan A', applications: 5, outreach: 3, interviews: 0, offers: 0, currentStreak: 1 },
  { displayName: 'Vikraam H', applications: 31, outreach: 20, interviews: 1, offers: 0, currentStreak: 6 },
  { displayName: 'Madhuya B', applications: 52, outreach: 33, interviews: 1, offers: 0, currentStreak: 10 },
  { displayName: 'Pawan K', applications: 22, outreach: 14, interviews: 0, offers: 0, currentStreak: 4 },
  { displayName: 'Jiyu A', applications: 47, outreach: 29, interviews: 2, offers: 0, currentStreak: 9 },
  { displayName: 'Cho R', applications: 11, outreach: 7, interviews: 0, offers: 0, currentStreak: 2 },
  { displayName: 'Shiwa K', applications: 36, outreach: 24, interviews: 1, offers: 0, currentStreak: 7 },
];

async function main() {
  for (const e of ENTRIES) {
    const existing = await prisma.manualLeaderboardEntry.findFirst({ where: { displayName: e.displayName } });
    if (existing) {
      await prisma.manualLeaderboardEntry.update({ where: { id: existing.id }, data: { ...e, isPlaceholder: true } });
      console.log(`updated: ${e.displayName}`);
    } else {
      await prisma.manualLeaderboardEntry.create({ data: { ...e, isPlaceholder: true } });
      console.log(`created: ${e.displayName}`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
