import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/experience — read-only access to experience entries
// NOTE: Creation and editing removed. Users update their profile by re-uploading their resume.
router.get('/experience', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { experience: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile.experience);
  } catch (error) {
    console.error('[experience] fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch experience' });
  }
});

export default router;
