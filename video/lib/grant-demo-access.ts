// Gives the fictional demo account member access, on STAGING only.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const url = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='))!.slice(13).replace(/^["']|["']$/g, '');
if (!url.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging');
const p = new PrismaClient({ datasourceUrl: url });
p.candidateProfile.updateMany({ where: { email: 'maya.fernando@jobhub-test.local' }, data: { dashboardAccess: true } })
  .then((r) => console.log('updated', r.count)).finally(() => p.$disconnect());
