import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/certifications — read-only access to certification entries
// NOTE: Creation and editing removed. Users update their profile by re-uploading their resume.
router.get('/certifications', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { certifications: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile.certifications);
  } catch (error) {
    console.error('[certifications] fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

export default router;
