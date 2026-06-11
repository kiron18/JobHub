import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /admin/email-analytics — Aggregate email analytics
router.get('/admin/email-analytics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalContacts,
      optedInContacts,
      totalSends,
      totalOpens,
      totalClicks,
      sequences,
      broadcasts,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { emailOptIn: true, unsubscribedAt: null } }),
      prisma.emailSend.count(),
      prisma.emailOpen.groupBy({ by: ['emailSendId'], _count: { id: true } }).then(r => r.length),
      prisma.emailClick.groupBy({ by: ['emailSendId'], _count: { id: true } }).then(r => r.length),
      prisma.emailSequence.findMany({
        orderBy: { priority: 'desc' },
        include: {
          _count: {
            select: {
              contactSequences: true,
              emailSends: true,
            },
          },
        },
      }),
      prisma.broadcast.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Per-sequence stats
    const sequenceStats = await Promise.all(
      sequences.map(async (seq) => {
        const seqSends = await prisma.emailSend.count({
          where: { sequenceId: seq.id },
        });
        const seqOpens = await prisma.emailOpen.groupBy({
          by: ['emailSendId'],
          where: { emailSend: { sequenceId: seq.id } },
          _count: { id: true },
        }).then(r => r.length);
        const seqClicks = await prisma.emailClick.groupBy({
          by: ['emailSendId'],
          where: { emailSend: { sequenceId: seq.id } },
          _count: { id: true },
        }).then(r => r.length);

        const activeEnrollments = await prisma.contactSequence.count({
          where: { sequenceId: seq.id, completed: false, unenrolledAt: null },
        });

        return {
          id: seq.id,
          name: seq.name,
          priority: seq.priority,
          active: seq.active,
          activeEnrollments,
          totalEnrollments: seq._count.contactSequences,
          sends: seqSends,
          opens: seqOpens,
          clicks: seqClicks,
          openRate: seqSends > 0 ? Math.round((seqOpens / seqSends) * 100) : 0,
          clickRate: seqSends > 0 ? Math.round((seqClicks / seqSends) * 100) : 0,
        };
      })
    );

    // Per-broadcast stats
    const broadcastStats = await Promise.all(
      broadcasts.map(async (b) => {
        const bSends = await prisma.emailSend.count({ where: { broadcastId: b.id } });
        const bOpens = await prisma.emailOpen.groupBy({
          by: ['emailSendId'],
          where: { emailSend: { broadcastId: b.id } },
          _count: { id: true },
        }).then(r => r.length);
        const bClicks = await prisma.emailClick.groupBy({
          by: ['emailSendId'],
          where: { emailSend: { broadcastId: b.id } },
          _count: { id: true },
        }).then(r => r.length);

        return {
          id: b.id,
          name: b.name,
          status: b.status,
          sentAt: b.sentAt,
          createdAt: b.createdAt,
          sends: bSends,
          opens: bOpens,
          clicks: bClicks,
          openRate: bSends > 0 ? Math.round((bOpens / bSends) * 100) : 0,
          clickRate: bSends > 0 ? Math.round((bClicks / bSends) * 100) : 0,
        };
      })
    );

    return res.json({
      totals: {
        totalContacts,
        optedIn: optedInContacts,
        totalSends,
        totalOpens,
        totalClicks,
      },
      sequences: sequenceStats,
      broadcasts: broadcastStats,
    });
  } catch (err) {
    console.error('[analyticsRoutes] GET /admin/email-analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch email analytics' });
  }
});

export default router;
