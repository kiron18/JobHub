import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const broadcasts = await prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' } });
  console.log('BROADCASTS:', broadcasts.length);
  for (const b of broadcasts) {
    const sends = await prisma.emailSend.count({ where: { broadcastId: b.id } });
    console.log(`- [${b.status}] "${b.name}" subj="${b.subject}" sends=${sends} sentAt=${b.sentAt} createdAt=${b.createdAt}`);
  }
  const totalSends = await prisma.emailSend.count();
  const noBroadcast = await prisma.emailSend.count({ where: { broadcastId: null } });
  console.log('TOTAL EmailSend rows:', totalSends, ' | without broadcastId:', noBroadcast);
  const bySubject = await prisma.emailSend.groupBy({ by: ['subject'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 15 });
  console.log('TOP SUBJECTS (EmailSend table):');
  for (const s of bySubject) console.log(`  ${s._count.id}x  "${s.subject}"`);
  const contacts = await prisma.contact.count();
  console.log('Contacts:', contacts);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
