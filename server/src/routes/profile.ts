import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { indexAchievement, deleteAchievement } from '../services/vector';
import fs from 'fs';
import path from 'path';

const router = Router();

// --- Profile Routes ---
router.get('/profile', authenticate, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                experience: true,
                education: true,
                volunteering: true,
                certifications: true,
                languages: true,
                achievements: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.post('/profile', authenticate, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { profile, discoveredAchievements, experience, education, volunteering, certifications, languages, skills, coachingAlerts } = req.body;

        if (!profile) {
            return res.status(400).json({ error: 'Profile data is required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedProfile = await tx.candidateProfile.upsert({
                where: { userId },
                update: {
                    name: profile.name,
                    email: profile.email,
                    professionalSummary: profile.professionalSummary,
                    skills: skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : undefined,
                    location: profile.location,
                    phone: profile.phone,
                    linkedin: profile.linkedin,
                    coachingAlerts: coachingAlerts || undefined,
                    experience: {
                        deleteMany: {},
                        create: experience?.map((exp: any) => ({
                            company: exp.company || 'Unknown Company',
                            role: exp.role || 'Unknown Role',
                            startDate: exp.startDate || 'Unknown',
                            endDate: exp.endDate,
                            description: exp.bullets?.join('\n') || exp.description || '',
                            coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                        })) || []
                    },
                    education: {
                        deleteMany: {},
                        create: education?.map((edu: any) => ({
                            institution: edu.institution || 'Unknown Institution',
                            degree: edu.degree || 'Unknown Degree',
                            year: edu.year,
                            coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                        })) || []
                    },
                    volunteering: {
                        deleteMany: {},
                        create: volunteering?.filter((vol: any) => vol.org || vol.organization).map((vol: any) => ({
                            organization: vol.org || vol.organization || 'Unknown Organisation',
                            role: vol.role || 'Volunteer',
                            description: vol.desc || vol.description
                        })) || []
                    },
                    certifications: {
                        deleteMany: {},
                        create: certifications?.filter((cert: any) => cert.name).map((cert: any) => ({
                            name: cert.name,
                            issuingBody: cert.issuer || cert.issuingBody || 'Unknown',
                            year: cert.year
                        })) || []
                    },
                    languages: {
                        deleteMany: {},
                        create: languages?.filter((lang: any) => lang.name).map((lang: any) => ({
                            name: lang.name,
                            proficiency: lang.proficiency || 'Conversational'
                        })) || []
                    },
                } as any,
                create: {
                    userId,
                    email: profile.email,
                    name: profile.name,
                    professionalSummary: profile.professionalSummary,
                    skills: skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : '{}',
                    location: profile.location,
                    phone: profile.phone,
                    linkedin: profile.linkedin,
                    coachingAlerts: coachingAlerts || undefined,
                    experience: {
                        create: experience?.map((exp: any) => ({
                            company: exp.company || 'Unknown Company',
                            role: exp.role || 'Unknown Role',
                            startDate: exp.startDate || 'Unknown',
                            endDate: exp.endDate,
                            description: exp.bullets?.join('\n') || exp.description || '',
                            coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                        })) || []
                    },
                    education: {
                        create: education?.map((edu: any) => ({
                            institution: edu.institution || 'Unknown Institution',
                            degree: edu.degree || 'Unknown Degree',
                            year: edu.year,
                            coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                        })) || []
                    },
                    volunteering: {
                        create: volunteering?.filter((vol: any) => vol.org || vol.organization).map((vol: any) => ({
                            organization: vol.org || vol.organization || 'Unknown Organisation',
                            role: vol.role || 'Volunteer',
                            description: vol.desc || vol.description
                        })) || []
                    },
                    certifications: {
                        create: certifications?.filter((cert: any) => cert.name).map((cert: any) => ({
                            name: cert.name,
                            issuingBody: cert.issuer || cert.issuingBody || 'Unknown',
                            year: cert.year
                        })) || []
                    },
                    languages: {
                        create: languages?.filter((lang: any) => lang.name).map((lang: any) => ({
                            name: lang.name,
                            proficiency: lang.proficiency || 'Conversational'
                        })) || []
                    }
                },
                include: {
                    experience: true,
                    achievements: true
                }
            }) as any;

            // Process achievements — deduplicate against existing by title to prevent re-import stacking
            if (discoveredAchievements && discoveredAchievements.length > 0) {
                const achievementsToCreate = discoveredAchievements.map((ach: any) => {
                    const experienceId = ach.experienceIndex !== undefined && updatedProfile.experience && updatedProfile.experience[ach.experienceIndex]
                        ? updatedProfile.experience[ach.experienceIndex].id
                        : null;

                    return {
                        candidateProfileId: updatedProfile.id,
                        userId,
                        experienceId,
                        title: ach.title || 'Untitled Achievement',
                        description: ach.description || ach.content || 'No description provided.',
                        metric: ach.metric || null,
                        metricType: ach.metricType || null,
                        industry: ach.industry || null,
                        skills: typeof ach.skills === 'string' ? ach.skills : (Array.isArray(ach.skills) ? ach.skills.join(', ') : (ach.skills || null)),
                        tags: typeof ach.tags === 'string' ? ach.tags : (Array.isArray(ach.tags) ? ach.tags.join(', ') : (ach.tags || null))
                    };
                });

                // Fetch existing titles so re-importing the same resume doesn't stack duplicates
                const existing = await tx.achievement.findMany({
                    where: { candidateProfileId: updatedProfile.id },
                    select: { title: true }
                });
                const existingTitles = new Set(existing.map((a: any) => a.title.toLowerCase().trim()));
                const newOnly = achievementsToCreate.filter((a: any) => !existingTitles.has(a.title.toLowerCase().trim()));

                if (newOnly.length > 0) {
                    await tx.achievement.createMany({ data: newOnly });
                }
            }

            return updatedProfile;
        });

        // Re-fetch to get new achievement IDs for Pinecone indexing
        const finalProfile = await prisma.candidateProfile.findUnique({
            where: { id: result.id },
            include: { achievements: true, experience: true }
        }) as any;

        // Index achievements in Pinecone in parallel
        if (finalProfile?.achievements && finalProfile.achievements.length > 0) {
            await Promise.all(finalProfile.achievements.map(async (ach: any) => {
                const experience = finalProfile.experience?.find((e: any) => e.id === ach.experienceId);
                try {
                    await indexAchievement(
                        userId,
                        ach.id,
                        `${ach.title}: ${ach.description}`,
                        {
                            metric: ach.metric,
                            metricType: ach.metricType,
                            industry: ach.industry,
                            role: experience?.role,
                            skills: ach.skills
                        }
                    );
                } catch (idxError) {
                    console.error('Pinecone Index Error (Warning):', idxError);
                }
            }));
        }

        res.json(finalProfile);
    } catch (error: any) {
        console.error('Profile Save Error:', error);
        res.status(500).json({
            error: 'Failed to save profile',
            details: error.message
        });
    }
});

// --- Achievement Routes ---
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

router.get('/jobs', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const jobs = await prisma.jobApplication.findMany({
            where: { candidateProfile: { userId } },
            orderBy: { createdAt: 'desc' },
            include: { documents: true }
        });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

router.patch('/jobs/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const userId = (req as any).user.id;
    const { status, dateApplied } = req.body;

    try {
        const job = await prisma.jobApplication.update({
            where: {
                id,
                candidateProfile: { userId }
            },
            data: {
                ...(status && { status }),
                ...(dateApplied !== undefined && { dateApplied: dateApplied ? new Date(dateApplied) : null })
            },
            include: { documents: true }
        });
        res.json(job);
    } catch (error) {
        console.error('Update Job Error:', error);
        res.status(500).json({ error: 'Failed to update job application' });
    }
});

export default router;
