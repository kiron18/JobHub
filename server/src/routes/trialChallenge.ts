import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  isEligibleForTrial,
  resolveTrialState,
  beginDay,
  getOrCreateWhatsappOptInCode,
  TrialChallengeError,
} from '../services/trialChallenge/engine';
import { isTrialChallengeEnabled } from '../config/trialChallengeGate';

const router = Router();

/** The number the trial's WhatsApp bot links as — see services/whatsappBaileys.ts. */
const WHATSAPP_TRIAL_NUMBER = '61422769597';

router.get('/state', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  if (!isTrialChallengeEnabled()) {
    // Flag off: report ineligible so the frontend keeps its existing
    // ApplyPreviewGate behaviour untouched. Nothing else in this route runs.
    return res.json({
      eligible: false, status: 'not_started', currentDay: 0, windowEndsAt: null,
      minimumRequired: 0, appliedThisWindow: 0, linkedinUnlocked: false, forfeitureDeadline: null,
    });
  }

  const eligible = await isEligibleForTrial(userId, req.user!.email);
  if (!eligible) {
    return res.json({
      eligible: false, status: 'not_started', currentDay: 0, windowEndsAt: null,
      minimumRequired: 0, appliedThisWindow: 0, linkedinUnlocked: false, forfeitureDeadline: null,
    });
  }

  const state = await resolveTrialState(userId);
  // The WhatsApp opt-in link/QR needs this any time the candidate is
  // eligible, not only once they've reached a pass screen, so it's generated
  // here rather than in a separate call.
  const optInCode = await getOrCreateWhatsappOptInCode(userId);
  const whatsappOptInLink = `https://wa.me/${WHATSAPP_TRIAL_NUMBER}?text=${encodeURIComponent(`START ${optInCode}`)}`;

  if (!state) {
    return res.json({
      eligible: true, status: 'not_started', currentDay: 0, windowEndsAt: null,
      minimumRequired: 0, appliedThisWindow: 0, linkedinUnlocked: false, forfeitureDeadline: null,
      whatsappOptInLink,
    });
  }
  res.json({ ...state, whatsappOptInLink });
});

router.post('/begin', authenticate, async (req: AuthRequest, res) => {
  if (!isTrialChallengeEnabled()) return res.status(403).json({ error: 'not_enabled' });
  const userId = req.user!.id;
  const eligible = await isEligibleForTrial(userId, req.user!.email);
  if (!eligible) return res.status(403).json({ error: 'not_eligible' });

  try {
    const state = await beginDay(userId);
    res.json(state);
  } catch (err) {
    if (err instanceof TrialChallengeError) {
      return res.status(409).json({ error: err.code, message: err.message });
    }
    console.error('[trial-challenge] begin failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// The phone number itself is never taken here — it's captured automatically
// off the inbound "START <code>" WhatsApp message (see whatsappBaileys.ts).
// This only ever sets the candidate's preferred reminder hour.
router.post('/whatsapp-opt-in', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { reminderTimePreferenceHour } = req.body as { reminderTimePreferenceHour?: number };

  if (
    reminderTimePreferenceHour === undefined ||
    !Number.isInteger(reminderTimePreferenceHour) ||
    reminderTimePreferenceHour < 0 || reminderTimePreferenceHour > 23
  ) {
    return res.status(400).json({ error: 'invalid_reminder_hour' });
  }

  await prisma.candidateProfile.update({ where: { userId }, data: { reminderTimePreferenceHour } });
  res.json({ ok: true });
});

export default router;
