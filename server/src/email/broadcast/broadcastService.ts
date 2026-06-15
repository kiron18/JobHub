import { prisma } from '../../index';
import { sendEmail } from '../send/sendEmail';

export async function sendBroadcast(broadcastId: string): Promise<{ total: number; sent: number; errors: number }> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error('Broadcast not found');

  const criteria = (broadcast.targetCriteria as { tag?: string }) ?? {};
  const tagName = criteria.tag;
  if (!tagName) throw new Error('Broadcast targetCriteria missing tag');

  const tag = await prisma.tag.findUnique({ where: { name: tagName } });
  if (!tag) throw new Error(`Tag "${tagName}" not found`);

  // Find all contacts with this tag, opted in, not unsubscribed
  const contactTags = await prisma.contactTag.findMany({
    where: {
      tagId: tag.id,
      contact: { emailOptIn: true, unsubscribedAt: null },
    },
    include: { contact: true },
  });

  let sent = 0;
  let errors = 0;

  for (const ct of contactTags) {
    try {
      const { resendEmailId, error } = await sendEmail({
        to: ct.contact.email,
        subject: broadcast.subject,
        bodyText: broadcast.bodyText ?? undefined,
        bodyHtml: broadcast.bodyHtml ?? undefined,
      });

      await prisma.emailSend.create({
        data: {
          contactId: ct.contactId,
          broadcastId: broadcast.id,
          resendEmailId,
          subject: broadcast.subject,
          fromEmail: process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>',
          toEmail: ct.contact.email,
        },
      });

      await prisma.contact.update({
        where: { id: ct.contactId },
        data: { lastActivityAt: new Date() },
      });

      if (error) { errors++; continue; }
      sent++;
    } catch {
      errors++;
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'sent', sentAt: new Date() },
  });

  console.log(`[broadcast] "${broadcast.name}" — ${sent} sent, ${errors} errors`);
  return { total: contactTags.length, sent, errors };
}
