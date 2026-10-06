import { prisma } from '../../index';
import { sendEmail } from '../send/sendEmail';
import { unenrollFromSequence } from './enrollment';

export async function processSequenceEmails(): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sequenceEngine] RESEND_API_KEY not set — skipping sequence processing');
    return;
  }

  const now = new Date();
  let sent = 0;

  // Fetch all active enrollments
  const enrollments = await prisma.contactSequence.findMany({
    where: { completed: false, unenrolledAt: null },
    include: {
      contact: true,
      sequence: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
    },
  });

  for (const enrollment of enrollments) {
    try {
      // Skip unsubscribed contacts
      if (enrollment.contact.unsubscribedAt || !enrollment.contact.emailOptIn) {
        await unenrollFromSequence(enrollment.contactId, enrollment.sequence.name, 'unsubscribed');
        continue;
      }

      const step = enrollment.sequence.steps.find(s => s.stepOrder === enrollment.currentStep);
      if (!step) {
        // No step found — mark complete
        await prisma.contactSequence.update({
          where: { id: enrollment.id },
          data: { completed: true, completedAt: now, unenrolledReason: 'completed' },
        });
        continue;
      }

      // Compute scheduled send time
      const baseDate = enrollment.lastStepSentAt ?? enrollment.enrolledAt;
      const scheduledSendAt = new Date(baseDate.getTime() + step.delayDays * 24 * 60 * 60 * 1000);

      if (now < scheduledSendAt) continue; // not yet time

      // Check dedup — was this step already sent manually?
      const alreadySent = await prisma.emailSend.findFirst({
        where: {
          contactId: enrollment.contactId,
          sequenceStepId: step.id,
        },
      });
      if (alreadySent) {
        // Already sent — advance to next step
        await advanceStep(enrollment.id, step, now);
        continue;
      }

      // Send the email
      const template = await prisma.emailTemplate.findUnique({ where: { id: step.templateId } });
      if (!template) {
        console.warn(`[sequenceEngine] template ${step.templateId} not found for step ${step.id}`);
        await advanceStep(enrollment.id, step, now);
        continue;
      }

      // The row comes first: its id is what the open pixel and click redirect
      // are keyed on, so a row written after the send could never record either.
      const row = await prisma.emailSend.create({
        data: {
          contactId: enrollment.contactId,
          sequenceId: enrollment.sequenceId,
          sequenceStepId: step.id,
          templateId: template.id,
          subject: template.subject,
          fromEmail: process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>',
          toEmail: enrollment.contact.email,
        },
      });

      const { resendEmailId, error } = await sendEmail({
        to: enrollment.contact.email,
        subject: template.subject,
        bodyText: template.bodyText ?? undefined,
        bodyHtml: template.bodyHtml ?? undefined,
        trackingId: row.id,
      });

      if (error) {
        await prisma.emailSend.delete({ where: { id: row.id } }).catch(() => {});
        console.error(`[sequenceEngine] send error for contact ${enrollment.contactId}:`, error);
        continue; // Don't advance — retry next cron run
      }
      if (resendEmailId) {
        await prisma.emailSend.update({ where: { id: row.id }, data: { resendEmailId } });
      }

      // Update Contact lastActivityAt
      await prisma.contact.update({
        where: { id: enrollment.contactId },
        data: { lastActivityAt: now },
      });

      await advanceStep(enrollment.id, step, now);
      sent++;

      console.log(`[sequenceEngine] sent step ${step.stepOrder} of "${enrollment.sequence.name}" to ${enrollment.contact.email}`);
    } catch (err) {
      console.error(`[sequenceEngine] error processing enrollment ${enrollment.id}:`, err);
    }
  }

  console.log(`[sequenceEngine] done — ${sent} email(s) sent`);
}

async function advanceStep(enrollmentId: string, currentStep: { stepOrder: number }, now: Date): Promise<void> {
  await prisma.contactSequence.update({
    where: { id: enrollmentId },
    data: {
      currentStep: currentStep.stepOrder + 1,
      lastStepSentAt: now,
    },
  });
}
