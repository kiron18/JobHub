import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// PATCH /api/education/:id
router.patch('/education/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  const { institution, degree, field, year } = req.body;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const edu = await prisma.education.update({
      where: { id, candidateProfileId: profile.id },
      data: { institution, degree, field, year },
    });
    return res.json(edu);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update education' });
  }
});

export default router;
