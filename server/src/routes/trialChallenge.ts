import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  isEligibleForTrial,
  resolveTrialState,
  beginDay,
  TrialChallengeError,
} from '../services/trialChallenge/engine';
import { isTrialChallengeEnabled } from '../config/trialChallengeGate';

const router = Router();

/** E.164-ish: a plus, then 7-15 digits. Loose on purpose — this only gates a WhatsApp send attempt, not a signup. */
const E164_RE = /^\+[1-9]\d{6,14}$/;

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
  if (!state) {
    return res.json({
      eligible: true, status: 'not_started', currentDay: 0, windowEndsAt: null,
      minimumRequired: 0, appliedThisWindow: 0, linkedinUnlocked: false, forfeitureDeadline: null,
    });
  }
  res.json(state);
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

router.post('/whatsapp-opt-in', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { whatsappNumber, reminderTimePreferenceHour } = req.body as {
    whatsappNumber?: string;
    reminderTimePreferenceHour?: number;
  };

  if (whatsappNumber !== undefined && whatsappNumber !== '' && !E164_RE.test(whatsappNumber)) {
    return res.status(400).json({ error: 'invalid_whatsapp_number' });
  }
  if (
    reminderTimePreferenceHour !== undefined &&
    (!Number.isInteger(reminderTimePreferenceHour) || reminderTimePreferenceHour < 0 || reminderTimePreferenceHour > 23)
  ) {
    return res.status(400).json({ error: 'invalid_reminder_hour' });
  }

  await prisma.candidateProfile.update({
    where: { userId },
    data: {
      ...(whatsappNumber !== undefined ? { whatsappNumber: whatsappNumber || null } : {}),
      ...(reminderTimePreferenceHour !== undefined ? { reminderTimePreferenceHour } : {}),
    },
  });

  res.json({ ok: true });
});

export default router;
