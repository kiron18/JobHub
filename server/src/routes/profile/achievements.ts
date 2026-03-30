import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';
import { indexAchievement, deleteAchievement } from '../../services/vector';

const router = Router();

// GET /api/achievements
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

// POST /api/achievements
router.post('/achievements', authenticate, async (req, res) => {
    const { title, description, metric, metricType, skills } = req.body;
    const userId = (req as any).user.id;

    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const achievement = await prisma.achievement.create({
            data: {
                candidateProfileId: profile.id,
                userId,
                title,
                description,
                skills: Array.isArray(skills) ? skills.join(', ') : (skills || ''),
                metric: metric || null,
                metricType: metricType || null,
                isStaged: true
            }
        });

        // Index in Pinecone with userId namespace
        await indexAchievement(
            userId,
            achievement.id,
            `${achievement.title}: ${achievement.description}`,
            {
                metric: achievement.metric,
                metricType: achievement.metricType,
                skills: achievement.skills
            }
        );

        res.json(achievement);
    } catch (error) {
        console.error('Create Achievement Error:', error);
        res.status(500).json({ error: 'Failed to create achievement' });
    }
});

// PATCH /api/achievements/:id
router.patch('/achievements/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const { title, description, metric, metricType, skills } = req.body as any;
    const userId = (req as any).user.id;

    try {
        const achievement = await prisma.achievement.update({
            where: {
                id,
                candidateProfile: { userId }
            },
            data: {
                title,
                description,
                metric,
                metricType,
                skills: (Array.isArray(skills) ? skills.join(', ') : (skills as string | undefined))
            }
        });

        await indexAchievement(
            userId,
            achievement.id,
            `${achievement.title}: ${achievement.description}`,
            {
                metric: achievement.metric,
                metricType: achievement.metricType,
                skills: achievement.skills
            }
        );

        res.json(achievement);
    } catch (error) {
        console.error('Update Achievement Error:', error);
        res.status(500).json({ error: 'Failed to update achievement' });
    }
});

// DELETE /api/achievements/:id
router.delete('/achievements/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const userId = (req as any).user.id;

    try {
        await prisma.achievement.delete({
            where: {
                id: id as string,
                candidateProfile: { userId }
            }
        });
        await deleteAchievement(userId, id as string);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Achievement Error:', error);
        res.status(500).json({ error: 'Failed to delete achievement' });
    }
});

export default router;
