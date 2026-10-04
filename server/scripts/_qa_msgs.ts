import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  if (!process.env.DATABASE_URL?.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging');
  const prof = await p.candidateProfile.findFirst({ where: { email: 'kironburn@gmail.com' }, select: { userId: true } });
  const rows = await p.coachMessage.findMany({ where: { userId: prof!.userId }, orderBy: { createdAt: 'asc' } });
  for (const r of rows) console.log(r.createdAt.toISOString().slice(11, 19), r.direction.padEnd(3), r.kind.padEnd(15), r.category ?? '', r.flagged ? 'FLAGGED' : '', '|', r.direction === 'out' ? r.body : `(${r.body.length} chars)`);
  await p.$disconnect();
})();
