import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// POST /api/experience — create a new experience entry on the user's profile.
// Used by FromScratchCapture during onboarding when resume parsing yields no
// usable experience data. Required: company, role, startDate. endDate is
// optional ("Present" or empty signals a current role).
router.post('/experience', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { company, role, startDate, endDate, description, type } = req.body ?? {};

  if (!company || typeof company !== 'string' || !company.trim()) {
    return res.status(400).json({ error: 'company is required' });
  }
  if (!role || typeof role !== 'string' || !role.trim()) {
    return res.status(400).json({ error: 'role is required' });
  }
  if (!startDate || typeof startDate !== 'string' || !startDate.trim()) {
    return res.status(400).json({ error: 'startDate is required' });
  }

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const normalisedEnd = typeof endDate === 'string' ? endDate.trim() : '';
    const isCurrent = normalisedEnd === '' || normalisedEnd.toLowerCase() === 'present';

    const exp = await prisma.experience.create({
      data: {
        candidateProfileId: profile.id,
        company: company.trim(),
        role: role.trim(),
        startDate: startDate.trim(),
        endDate: isCurrent ? null : normalisedEnd,
        isCurrent,
        type: typeof type === 'string' && type.trim() ? type.trim() : 'work',
        description: typeof description === 'string' ? description : null,
      },
    });
    return res.status(201).json(exp);
  } catch (error) {
    console.error('[experience] create failed:', error);
    return res.status(500).json({ error: 'Failed to create experience' });
  }
});

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
