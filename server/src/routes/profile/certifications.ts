import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/certifications', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { name, issuingBody, year } = req.body as { name: string; issuingBody: string; year?: string };
  if (!name || !issuingBody) return res.status(400).json({ error: 'name and issuingBody required' });
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const cert = await prisma.certification.create({
      data: { name, issuingBody, year: year || null, candidateProfileId: profile.id },
    });
    return res.status(201).json(cert);
  } catch {
    return res.status(500).json({ error: 'Failed to create certification' });
  }
});

router.patch('/certifications/:id', authenticate, async (req, res) => {
  const id = req.params['id'] as string;
  const userId = (req as any).user.id;
  const { name, issuingBody, year } = req.body as { name?: string; issuingBody?: string; year?: string };
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const cert = await prisma.certification.update({
      where: { id, candidateProfileId: profile.id },
      data: { ...(name && { name }), ...(issuingBody && { issuingBody }), ...(year !== undefined && { year: year || null }) },
    });
    return res.json(cert);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    return res.status(500).json({ error: 'Failed to update certification' });
  }
});

router.delete('/certifications/:id', authenticate, async (req, res) => {
  const id = req.params['id'] as string;
  const userId = (req as any).user.id;
  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await prisma.certification.delete({ where: { id, candidateProfileId: profile.id } });
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    return res.status(500).json({ error: 'Failed to delete certification' });
  }
});

export default router;
