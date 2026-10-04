// Exercises the exact Contact/EmailTemplate/EmailSend/EmailOpen/EmailClick
// writes sendWelcomeResumeEmail and analyticsRoutes now do, against the real
// schema, without sending a real email or importing src/index (which would
// boot a second full server). Cleans up everything it creates.
import { PrismaClient } from '@prisma/client';
import { emailHasLinks } from '../src/email/send/sendEmail';

const prisma = new PrismaClient();
const TEST_EMAIL = 'qa-email-tracking-test@jobhub-test.local';

async function main() {
  const contact = await prisma.contact.upsert({
    where: { email: TEST_EMAIL },
    update: { firstName: 'QA Test', lastActivityAt: new Date() },
    create: { email: TEST_EMAIL, firstName: 'QA Test', source: 'welcome_resume' },
  });
  console.log('contact ok:', contact.id);

  const bodyHtml = '<p>Hi QA Test,</p><p><a href="https://aussiegradcareers.com.au">Start the free challenge</a></p>';
  const template = await prisma.emailTemplate.upsert({
    where: { name: 'welcome_resume' },
    update: { subject: 'Here is your rewritten resume', bodyHtml },
    create: { name: 'welcome_resume', subject: 'Here is your rewritten resume', bodyHtml },
  });
  console.log('template ok:', template.id, '| hasLinks:', emailHasLinks(template.bodyHtml));

  const emailSend = await prisma.emailSend.create({
    data: { contactId: contact.id, templateId: template.id, subject: 'QA Test, here is your rewritten resume', fromEmail: 'test@test.local', toEmail: TEST_EMAIL },
  });
  console.log('emailSend ok:', emailSend.id);

  await prisma.emailOpen.create({ data: { emailSendId: emailSend.id } });
  await prisma.emailClick.create({ data: { emailSendId: emailSend.id, url: 'https://aussiegradcareers.com.au' } });
  console.log('open + click rows ok');

  // Same shape the GET /admin/email-analytics template-grouping branch computes.
  const sends = await prisma.emailSend.findMany({ where: { templateId: template.id, sequenceId: null, broadcastId: null }, select: { id: true } });
  const sendIds = sends.map((s) => s.id);
  const opens = (await prisma.emailOpen.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: sendIds } } })).length;
  const clicks = (await prisma.emailClick.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: sendIds } } })).length;
  console.log(`dashboard row would show: recipients=${sendIds.length} opens=${opens} clicks=${clicks} ctr=${Math.round((clicks / sendIds.length) * 100)}%`);

  // Clean up — this is a synthetic test contact, not a real person.
  await prisma.emailClick.deleteMany({ where: { emailSendId: emailSend.id } });
  await prisma.emailOpen.deleteMany({ where: { emailSendId: emailSend.id } });
  await prisma.emailSend.delete({ where: { id: emailSend.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  // Template stays — it's the real grouping row sendWelcomeResumeEmail will
  // upsert into on the next real signup, deleting it would just recreate it.
  console.log('cleanup ok (contact + emailSend + open + click removed; template kept)');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
