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

// POST /api/education
router.post('/education', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { institution, degree, field, year } = req.body;
  if (!institution || !degree) return res.status(400).json({ error: 'institution and degree required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const edu = await prisma.education.create({
      data: { institution, degree, field: field || null, year: year || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(edu);
  } catch {
    return res.status(500).json({ error: 'Failed to create education' });
  }
});

// DELETE /api/education/:id
router.delete('/education/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.education.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete education' });
  }
});

export default router;
