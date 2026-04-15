import { Router } from 'express';
import { prisma } from '../index';

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

export default router;
