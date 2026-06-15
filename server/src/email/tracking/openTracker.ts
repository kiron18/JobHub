import { Router } from 'express';
import { prisma } from '../../index';

const router = Router();

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/email/track/open/:emailSendId', async (req, res) => {
  const { emailSendId } = req.params;
  try {
    await prisma.emailOpen.create({
      data: {
        emailSendId,
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

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  });
  res.end(TRANSPARENT_GIF);
});

export default router;
