import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/volunteering', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { organization, role, description } = req.body;
  if (!organization || !role) return res.status(400).json({ error: 'organization and role required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const vol = await prisma.volunteering.create({
      data: { organization, role, description: description || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(vol);
  } catch {
    return res.status(500).json({ error: 'Failed to create volunteering' });
  }
});

router.patch('/volunteering/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  const { organization, role, description } = req.body;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const vol = await prisma.volunteering.update({
      where: { id, candidateProfileId: profile.id },
      data: { ...(organization && { organization }), ...(role && { role }), ...(description !== undefined && { description: description || null }) },
    });
    return res.json(vol);
  } catch {
    return res.status(500).json({ error: 'Failed to update volunteering' });
  }
});

router.delete('/volunteering/:id', authenticate, async (req, res) => {
  const { id } = req.params as any;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.volunteering.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete volunteering' });
  }
});

export default router;
