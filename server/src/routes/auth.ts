import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { sendPasswordResetEmail } from '../services/email';
import { PUBLIC_APP_URL } from '../lib/appUrl';

const router = Router();

/**
 * Throttle per email address. Supabase recovery links are single-use, so every
 * resend invalidates the previous one: without a cap, someone hammering the
 * button races their own emails and can never click a live link. Also stops the
 * endpoint being used to mailbomb a third party.
 */
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_MAX = 3;
const recentSends = new Map<string, number[]>();

function throttled(email: string): boolean {
  const now = Date.now();
  const hits = (recentSends.get(email) ?? []).filter((t) => now - t < RESEND_WINDOW_MS);
  if (hits.length >= RESEND_MAX) {
    recentSends.set(email, hits);
    return true;
  }
  hits.push(now);
  recentSends.set(email, hits);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (recentSends.size > 5000) {
    for (const [key, times] of recentSends) {
      if (times.every((t) => now - t >= RESEND_WINDOW_MS)) recentSends.delete(key);
    }
  }
  return false;
}

/**
 * Send a fresh set-password link.
 *
 * Used by both the expired-link screen and "forgot password" on sign-in. Mints
 * the same Supabase recovery link the post-payment onboarding uses, and
 * delivers it through Resend so it comes from our sending domain rather than
 * Supabase's built-in SMTP.
 *
 * Always answers 200 with the same body, whether or not the account exists, so
 * the endpoint cannot be used to discover who our customers are.
 */
router.post('/resend-password-link', async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const generic = { ok: true, message: 'If that email has an account, a new link is on its way.' };

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
  }
  if (throttled(email)) {
    return res.status(429).json({
      ok: false,
      message: 'Too many requests. Check your inbox, or try again in 15 minutes.',
    });
  }

  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${PUBLIC_APP_URL}/set-password?flow=reset` },
    });
    if (error || !data?.properties?.action_link) {
      // Almost always "user not found". Log it, but tell the caller nothing.
      console.warn(`[auth] No reset link for ${email}: ${error?.message ?? 'no action_link returned'}`);
      return res.json(generic);
    }
    await sendPasswordResetEmail({ to: email, actionLink: data.properties.action_link });
    console.log(`[auth] Sent fresh password link to ${email}`);
  } catch (err: any) {
    console.error(`[auth] Failed sending password link to ${email}:`, err?.message ?? err);
  }

  return res.json(generic);
});

export default router;
