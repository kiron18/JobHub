import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/education — read-only access to education entries
// NOTE: Creation and editing removed. Users update their profile by re-uploading their resume.
router.get('/education', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { education: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile.education);
  } catch (error) {
    console.error('[education] fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch education' });
  }
});

export default router;
