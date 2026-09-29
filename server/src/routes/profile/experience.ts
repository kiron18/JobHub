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

// POST /api/experience — one role, for the from-scratch onboarding path only
// (FromScratchCapture: someone whose resume never came through). Editing the
// bank stays removed; this exists because without it that path dead-ends on
// its second question. Start date is optional there, so it is here too.
router.post('/experience', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { company, role, startDate, endDate, description, type } = req.body ?? {};

  if (typeof company !== 'string' || !company.trim()) return res.status(400).json({ error: 'company is required' });
  if (typeof role !== 'string' || !role.trim()) return res.status(400).json({ error: 'role is required' });

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const end = typeof endDate === 'string' ? endDate.trim() : '';
    const isCurrent = end === '' || end.toLowerCase() === 'present';

    const exp = await prisma.experience.create({
      data: {
        candidateProfileId: profile.id,
        company: company.trim(),
        role: role.trim(),
        startDate: typeof startDate === 'string' ? startDate.trim() : '',
        endDate: isCurrent ? null : end,
        isCurrent,
        type: typeof type === 'string' && type.trim() ? type.trim() : 'work',
        description: typeof description === 'string' && description.trim() ? description : null,
      },
    });
    return res.status(201).json(exp);
  } catch (error) {
    console.error('[experience] create failed:', error);
    return res.status(500).json({ error: 'Failed to create experience' });
  }
});

export default router;
