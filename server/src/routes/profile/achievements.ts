import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/achievements — read-only access to achievements
// NOTE: Creation and editing removed. Users update their profile by re-uploading their resume.
router.get('/achievements', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    console.log(`Handling GET /api/achievements for user: ${userId}`);
    try {
        console.log('Querying profile...');
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            console.log('Profile not found for user - returning empty achievements');
            return res.json([]);
        }

        console.log('Querying achievements...');
        const achievements = await prisma.achievement.findMany({
            where: {
                candidateProfile: { userId }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`Found ${achievements.length} achievements`);
        res.json(achievements);
    } catch (error) {
        console.error(`Error fetching achievements: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// GET /api/achievements/count
router.get('/achievements/count', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const count = await prisma.achievement.count({
            where: { candidateProfile: { userId } }
        });
        res.json({ count });
    } catch (error) {
        console.error('Failed to fetch achievement count:', error);
        res.status(500).json({ error: 'Failed to fetch achievement count' });
    }
});

export default router;
