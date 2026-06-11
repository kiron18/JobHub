import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { sendBroadcast } from '../broadcast/broadcastService';

const router = Router();

router.use(authenticate);

// GET /admin/broadcasts — List all broadcasts (ordered by createdAt desc)
router.get('/admin/broadcasts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ broadcasts });
  } catch (err) {
    console.error('[broadcastRoutes] GET /admin/broadcasts error:', err);
    return res.status(500).json({ error: 'Failed to list broadcasts' });
  }
});

// POST /admin/broadcasts — Create broadcast
router.post('/admin/broadcasts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, subject, bodyText, bodyHtml, targetCriteria, sendNow } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ error: 'name and subject are required' });
    }

    if (!targetCriteria || !targetCriteria.tag) {
      return res.status(400).json({ error: 'targetCriteria with tag is required' });
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        name,
        subject,
        bodyText: bodyText ?? null,
        bodyHtml: bodyHtml ?? null,
        targetCriteria,
        status: sendNow ? 'sending' : 'draft',
      },
    });

    if (sendNow) {
      // Fire-and-forget — do not await
      sendBroadcast(broadcast.id).catch((err) => {
        console.error(`[broadcastRoutes] sendBroadcast(${broadcast.id}) failed:`, err);
      });
    }

    return res.status(201).json({ broadcast });
  } catch (err) {
    console.error('[broadcastRoutes] POST /admin/broadcasts error:', err);
    return res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// POST /admin/broadcasts/:id/send — Send a draft broadcast
router.post('/admin/broadcasts/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const broadcast = await prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.status !== 'draft') {
      return res.status(400).json({ error: `Broadcast already has status "${broadcast.status}"` });
    }

    await prisma.broadcast.update({
      where: { id },
      data: { status: 'sending' },
    });

    // Fire-and-forget — do not await
    sendBroadcast(id).catch((err) => {
      console.error(`[broadcastRoutes] sendBroadcast(${id}) failed:`, err);
    });

    return res.json({ ok: true, message: 'Broadcast send initiated' });
  } catch (err) {
    console.error('[broadcastRoutes] POST /admin/broadcasts/:id/send error:', err);
    return res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export default router;
