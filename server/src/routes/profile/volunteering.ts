import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/volunteering — read-only access to volunteering entries
// NOTE: Creation and editing removed. Users update their profile by re-uploading their resume.
router.get('/volunteering', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { volunteering: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile.volunteering);
  } catch (error) {
    console.error('[volunteering] fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch volunteering' });
  }
});

export default router;
