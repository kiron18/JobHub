import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/skool/join
router.post('/join', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { skoolEmail } = req.body as { skoolEmail?: string };

  const email = skoolEmail?.trim() || null;

  try {
    await prisma.candidateProfile.update({
      where: { userId },
      data: {
        skoolJoined: true,
        skoolCommunityEmail: email,
      },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[skool/join] error:', err);
    return res.status(500).json({ error: 'Failed to record join' });
  }
});

export default router;
