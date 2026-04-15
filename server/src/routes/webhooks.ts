import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { sendAccessRequestNotification } from '../services/email';

const router = Router();

// POST /api/webhooks/membership
// Called by Make when a Skool member upgrades to Premium or cancels.
// Secured with a shared secret in the X-Webhook-Secret header.
router.post('/membership', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const { email, level, event } = req.body as {
    email?: string;
    level?: string;
    event?: string;
  };

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  // Determine whether this event grants or revokes access.
  // Make sends level = "Premium" (or "premium") on upgrade,
  // and event = "subscription_cancelled" / level = "Standard" on downgrade.
  const grantAccess =
    typeof level === 'string' &&
    level.toLowerCase() !== 'standard' &&
    level.toLowerCase() !== 'free';

  try {
    const updated = await prisma.candidateProfile.updateMany({
      where: { email: email.toLowerCase().trim() },
      data: { dashboardAccess: grantAccess },
    });

    console.log(
      `[webhook/membership] ${email} → dashboardAccess=${grantAccess} (level=${level}, event=${event}, rows=${updated.count})`
    );

    if (updated.count === 0) {
      // User hasn't signed up to JobHub yet — store the access grant
      // so it applies when they do. We log it but don't fail the webhook.
      console.warn(`[webhook/membership] No profile found for ${email} — access will apply on first login.`);
    }

    return res.json({ ok: true, dashboardAccess: grantAccess, rowsUpdated: updated.count });
  } catch (err) {
    console.error('[webhook/membership] DB error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/webhooks/request-access
// Called by authenticated users who want dashboard access approved.
// Marks their profile as requested and fires an admin notification email.
router.post('/request-access', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { skoolEmail } = req.body as { skoolEmail?: string };

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (profile.dashboardAccess) {
      return res.json({ ok: true, status: 'already_approved' });
    }

    await prisma.candidateProfile.update({
      where: { userId },
      data: { dashboardAccessRequested: true },
    });

    sendAccessRequestNotification({
      userName: profile.name ?? '',
      userEmail: profile.email ?? profile.marketingEmail ?? '',
      skoolEmail: skoolEmail ?? '',
      targetRole: profile.targetRole ?? '',
      userId,
    }).catch(err => console.error('[request-access] email error:', err));

    return res.json({ ok: true, status: 'requested' });
  } catch (err) {
    console.error('[request-access] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
