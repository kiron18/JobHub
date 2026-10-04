import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { EXEMPT_EMAILS } from '../../routes/stripe';
import { emailHasLinks } from '../send/sendEmail';

const router = Router();

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const email = (req.user?.email ?? '').toLowerCase();
  if (!email || !EXEMPT_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.use(authenticate, requireAdmin);

/** Distinct-EmailSend opens/clicks for a set of EmailSend ids — one row per
 * person who ever opened/clicked, not one row per open/click event. */
async function engagement(emailSendIds: string[]): Promise<{ opens: number; clicks: number }> {
  if (emailSendIds.length === 0) return { opens: 0, clicks: 0 };
  const [opens, clicks] = await Promise.all([
    prisma.emailOpen.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: emailSendIds } } }),
    prisma.emailClick.groupBy({ by: ['emailSendId'], where: { emailSendId: { in: emailSendIds } } }),
  ]);
  return { opens: opens.length, clicks: clicks.length };
}

/** Rate as a percent, or null — rendered as "N/A" — when there was never a
 * link to click in the first place, which is a different fact than "nobody
 * clicked it". */
function clickRateOf(clicks: number, sends: number, hasLinks: boolean): number | null {
  if (!hasLinks) return null;
  return sends > 0 ? Math.round((clicks / sends) * 100) : 0;
}

// GET /admin/email-analytics — every email that has actually gone out
// (broadcasts, and standalone transactional sends like the welcome resume
// email), each with the recipients/opens/CTR a "Mail" button can show.
router.get('/admin/email-analytics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalContacts, optedInContacts, totalSends, broadcasts, standaloneTemplateIds] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { emailOptIn: true, unsubscribedAt: null } }),
      prisma.emailSend.count(),
      prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      // Transactional sends: have a template, were never part of a sequence
      // step or a broadcast. The welcome resume email is the one of these
      // that actually exists today.
      prisma.emailSend.findMany({
        where: { templateId: { not: null }, sequenceId: null, broadcastId: null },
        distinct: ['templateId'],
        select: { templateId: true },
      }),
    ]);

    const broadcastEntries = await Promise.all(
      broadcasts.map(async (b) => {
        const sends = await prisma.emailSend.findMany({ where: { broadcastId: b.id }, select: { id: true } });
        const sendIds = sends.map((s) => s.id);
        const { opens, clicks } = await engagement(sendIds);
        const hasLinks = emailHasLinks(b.bodyHtml);
        return {
          id: b.id, kind: 'broadcast' as const, label: b.name, subject: b.subject,
          sentAt: b.sentAt ?? b.createdAt, recipients: sendIds.length, opens, clicks,
          ctr: clickRateOf(clicks, sendIds.length, hasLinks), hasLinks,
        };
      }),
    );

    const templateEntries = await Promise.all(
      standaloneTemplateIds
        .map((t) => t.templateId)
        .filter((id): id is string => !!id)
        .map(async (templateId) => {
          const [template, sends] = await Promise.all([
            prisma.emailTemplate.findUnique({ where: { id: templateId } }),
            prisma.emailSend.findMany({
              where: { templateId, sequenceId: null, broadcastId: null },
              select: { id: true, subject: true, sentAt: true },
              orderBy: { sentAt: 'desc' },
            }),
          ]);
          if (!template) return null;
          const sendIds = sends.map((s) => s.id);
          const { opens, clicks } = await engagement(sendIds);
          const hasLinks = emailHasLinks(template.bodyHtml);
          return {
            id: template.id, kind: 'template' as const, label: template.name,
            // The real per-person subject (e.g. "Sharon, here is your...") varies;
            // the most recent send's is the representative one to show.
            subject: sends[0]?.subject ?? template.subject,
            sentAt: sends[0]?.sentAt ?? template.updatedAt, recipients: sendIds.length, opens, clicks,
            ctr: clickRateOf(clicks, sendIds.length, hasLinks), hasLinks,
          };
        }),
    );

    const emails = [...broadcastEntries, ...templateEntries.filter((e): e is NonNullable<typeof e> => !!e)]
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));

    return res.json({
      totals: { totalContacts, optedIn: optedInContacts, totalSends },
      emails,
    });
  } catch (err) {
    console.error('[analyticsRoutes] GET /admin/email-analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch email analytics' });
  }
});

export default router;
