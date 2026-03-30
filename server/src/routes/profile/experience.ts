import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// PATCH /api/experience/:id
router.patch('/experience/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  const { company, role, startDate, endDate, description } = req.body;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const exp = await prisma.experience.update({
      where: { id, candidateProfileId: profile.id },
      data: { company, role, startDate, endDate, description },
    });
    return res.json(exp);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update experience' });
  }
});

export default router;
