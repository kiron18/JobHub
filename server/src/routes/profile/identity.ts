import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { deriveIdentityCards } from '../../services/identityDerivation';

const router = Router();

/**
 * POST /api/profile/regenerate-identity
 * Triggers a fresh identity derivation for the authenticated user.
 * Fire-and-forget — returns immediately.
 */
router.post('/profile/regenerate-identity', authenticate, async (req, res) => {
  const userId = (req as any).user.id;

  deriveIdentityCards(userId).catch(err => {
    console.error('[Identity Regenerate] Background error:', err);
  });

  return res.json({ status: 'started' });
});

export default router;
