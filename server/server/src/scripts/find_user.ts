/** Read-only: find profiles by a fuzzy email/name fragment. Usage: npx tsx src/scripts/find_user.ts <fragment> */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const prisma = new PrismaClient();
async function main() {
  const q = (process.argv[2] ?? '').toLowerCase().trim();
  const dbUrl = process.env.DATABASE_URL ?? '';
  const host = dbUrl.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`DB: ${host}`);
  const total = await prisma.candidateProfile.count();
  console.log(`Total profiles in this DB: ${total}\n`);
  if (!q) { console.error('Pass a fragment, e.g. "pawan".'); process.exit(1); }
  const rows = await prisma.candidateProfile.findMany({
    where: { OR: [
      { email: { contains: q, mode: 'insensitive' } },
      { marketingEmail: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ] },
    select: { email: true, marketingEmail: true, name: true, plan: true, planStatus: true, createdAt: true },
    take: 25,
  });
  if (rows.length === 0) { console.log(`No profiles match "${q}".`); return; }
  for (const r of rows) {
    console.log(`${r.name ?? '(no name)'} | email=${r.email} | mktg=${r.marketingEmail ?? '-'} | plan=${r.plan}/${r.planStatus} | ${r.createdAt.toISOString().slice(0,10)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
