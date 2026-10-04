import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  if (!process.env.DATABASE_URL?.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging');
  console.log(await p.candidateProfile.findFirst({ where: { email: 'kironburn@gmail.com' },
    select: { plan: true, whatsappOptInCode: true, whatsappVerifiedAt: true, whatsappNumber: true } }));
  const s: any[] = await p.$queryRawUnsafe(`select id, "updatedAt" from "WhatsappSession" order by "updatedAt" desc limit 3`).catch((e: any) => [String(e.message).slice(0, 120)]);
  console.log('session rows:', s);
  await p.$disconnect();
})();
