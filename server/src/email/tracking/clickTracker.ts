import { Router } from 'express';
import { prisma } from '../../index';
import { isTrackableLink as isSafeRedirectUrl } from '../send/sendEmail';

const router = Router();

router.get('/email/track/click/:emailSendId', async (req, res) => {
  const { emailSendId } = req.params;
  const targetUrl = req.query.url as string;
  if (!targetUrl) { res.status(400).send('Missing url param'); return; }
  if (!isSafeRedirectUrl(targetUrl)) { res.status(400).send('Invalid redirect target'); return; }

  try {
    await prisma.emailClick.create({
      data: {
        emailSendId,
        url: targetUrl,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    const emailSend = await prisma.emailSend.findUnique({
      where: { id: emailSendId },
      select: { contactId: true },
    });
    if (emailSend) {
      await prisma.contact.update({
        where: { id: emailSend.contactId },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }
  } catch { /* tracking failures are non-critical */ }

  res.redirect(302, targetUrl);
});

export default router;
