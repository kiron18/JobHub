import { Router } from 'express';
import { prisma } from '../../index';
import { isTrackableLink as isSafeRedirectUrl } from '../send/sendEmail';

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A reload or a back-and-forth inside this window is the same click. */
const SAME_CLICK_MS = 10 * 60_000;

async function recordClick(emailSendId: string, url: string, req: { headers: Record<string, unknown>; ip?: string }) {
  const since = new Date(Date.now() - SAME_CLICK_MS);
  const recent = await prisma.emailClick.findFirst({
    where: { emailSendId, url, clickedAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.emailClick.create({
    data: {
      emailSendId,
      url,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
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
}

// POST /email/landed?e=<EmailSend id>&p=<path>
//
// Sent by the site (src/lib/emailClick.ts) when someone arrives from an email
// link, which carries ?e=<id>. A beacon, so it has no body and nobody waits on
// the answer. Always 204: a bad or unknown id is simply not recorded.
router.post('/email/landed', async (req, res) => {
  const id = String(req.query.e ?? '');
  const path = String(req.query.p ?? '/').slice(0, 500);
  if (UUID.test(id)) {
    try {
      const exists = await prisma.emailSend.findUnique({ where: { id }, select: { id: true } });
      if (exists) await recordClick(id, path, req);
    } catch { /* tracking failures are non-critical */ }
  }
  res.status(204).end();
});

// GET /email/track/click/:id?url=
//
// How clicks were counted before 2026-10-15: every link went through here.
// New emails no longer use it, but emails already in inboxes do, so it stays
// and keeps redirecting.
router.get('/email/track/click/:emailSendId', async (req, res) => {
  const { emailSendId } = req.params;
  const targetUrl = req.query.url as string;
  if (!targetUrl) { res.status(400).send('Missing url param'); return; }
  if (!isSafeRedirectUrl(targetUrl)) { res.status(400).send('Invalid redirect target'); return; }

  try {
    await recordClick(emailSendId, new URL(targetUrl).pathname, req);
  } catch { /* tracking failures are non-critical */ }

  res.redirect(302, targetUrl);
});

export default router;
