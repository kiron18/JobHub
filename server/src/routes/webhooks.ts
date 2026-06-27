import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { sendAccessRequestNotification } from '../services/email';
import { generateBattleCard } from '../services/battleCard';

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

// POST /api/webhooks/calendly
// Fired by Calendly when an invitee books or cancels a call.
// Secured with a shared secret passed as ?key=<CALENDLY_WEBHOOK_KEY> in the webhook URL.
router.post('/calendly', async (req, res) => {
  const key = (req.query.key as string) || req.headers['x-calendly-key'];
  if (!key || key !== process.env.CALENDLY_WEBHOOK_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const event = req.body?.event as string | undefined;
  const payload = req.body?.payload as any;

  // Only handle new bookings
  if (event !== 'invitee.created') {
    return res.json({ ok: true, skipped: true });
  }

  const inviteeEmail: string | undefined = payload?.invitee?.email?.toLowerCase().trim();
  const inviteeName: string | undefined = payload?.invitee?.name?.trim();
  const startTime: string | undefined = payload?.event?.start_time;
  const calendlyEventId: string | undefined = payload?.event?.uuid;

  if (!inviteeEmail) {
    return res.status(400).json({ error: 'No invitee email in payload' });
  }

  console.log(`[webhook/calendly] booking confirmed: ${inviteeName} <${inviteeEmail}> at ${startTime}`);

  // Acknowledge immediately so Calendly doesn't retry
  res.json({ ok: true });

  // Fire-and-forget: find intake record, generate battle card
  setImmediate(async () => {
    try {
      let intake = await prisma.bookingIntake.findFirst({
        where: { email: inviteeEmail },
        orderBy: { createdAt: 'desc' },
      });

      if (!intake) {
        // Booked via Calendly without our intake form — create a minimal record
        intake = await prisma.bookingIntake.create({
          data: {
            name: inviteeName || inviteeEmail,
            email: inviteeEmail,
            calendlyEventId: calendlyEventId || null,
            callScheduledAt: startTime ? new Date(startTime) : null,
          },
        });
        console.log(`[webhook/calendly] created minimal intake for ${inviteeEmail}`);
      } else {
        await prisma.bookingIntake.update({
          where: { id: intake.id },
          data: {
            calendlyEventId: calendlyEventId || null,
            callScheduledAt: startTime ? new Date(startTime) : null,
            name: inviteeName || intake.name,
          },
        });
      }

      const battleCard = await generateBattleCard({
        name: inviteeName || intake.name,
        email: inviteeEmail,
        linkedinUrl: intake.linkedinUrl,
        currentRole: intake.currentRole,
        targetRole: intake.targetRole,
        visaStatus: intake.visaStatus,
        biggestChallenge: intake.biggestChallenge,
        resumeText: intake.resumeText,
        callScheduledAt: startTime ? new Date(startTime) : null,
      });

      await prisma.bookingIntake.update({
        where: { id: intake.id },
        data: { battleCard, battleCardAt: new Date(), obsidianSynced: false },
      });

      console.log(`[webhook/calendly] battle card generated for ${inviteeEmail}`);
    } catch (err) {
      console.error('[webhook/calendly] battle card generation failed:', err);
    }
  });
});

export default router;
