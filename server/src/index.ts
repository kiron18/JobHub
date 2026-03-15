import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import extractRouter from './routes/extract';
import analyzeRouter from './routes/analyze';
import generateRouter from './routes/generate';
import multer from 'multer';
import { extractTextFromPDF } from './services/pdf';
import { indexAchievement, deleteAchievement } from './services/vector';
import { authenticate } from './middleware/auth';
import fs from 'fs';
import path from 'path';


dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

export const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3002;


app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

const logFile = path.join(__dirname, '../server.log');
const log = (msg: string) => {
    const entry = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(logFile, entry);
};

// Redirect console to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
    log(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
    log(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
    originalConsoleError(...args);
};

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        log(`${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// --- Protected API Routes ---
app.use('/api/analyze', authenticate, analyzeRouter);
app.use('/api/extract', authenticate, extractRouter);
app.use('/api/generate', authenticate, generateRouter);


// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { calculateCompletionScore } from './services/profile';

// --- Profile Routes ---
app.get('/api/profile', authenticate, async (req, res) => {
    try {
        const userId = (req as any).user.id; // Extract userId here
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

app.post('/api/profile', authenticate, async (req, res) => {
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
                            company: exp.company,
                            role: exp.role,
                            startDate: exp.startDate,
                            endDate: exp.endDate,
                            description: exp.bullets?.join('\n') || exp.description || '',
                            coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                        })) || []
                    },
                    education: {
                        deleteMany: {},
                        create: education?.map((edu: any) => ({
                            institution: edu.institution,
                            degree: edu.degree,
                            year: edu.year,
                            coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                        })) || []
                    },
                    volunteering: {
                        deleteMany: {},
                        create: volunteering?.map((vol: any) => ({
                            organization: vol.org || vol.organization,
                            role: vol.role,
                            description: vol.desc || vol.description
                        })) || []
                    },
                    certifications: {
                        deleteMany: {},
                        create: certifications?.map((cert: any) => ({
                            name: cert.name,
                            issuingBody: cert.issuer || cert.issuingBody,
                            year: cert.year
                        })) || []
                    },
                    languages: {
                        deleteMany: {},
                        create: languages?.map((lang: any) => ({
                            name: lang.name,
                            proficiency: lang.proficiency
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
                            company: exp.company,
                            role: exp.role,
                            startDate: exp.startDate,
                            endDate: exp.endDate,
                            description: exp.bullets?.join('\n') || exp.description || '',
                            coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                        })) || []
                    },
                    education: {
                        create: education?.map((edu: any) => ({
                            institution: edu.institution,
                            degree: edu.degree,
                            year: edu.year,
                            coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                        })) || []
                    },
                    volunteering: {
                        create: volunteering?.map((vol: any) => ({
                            organization: vol.org || vol.organization,
                            role: vol.role,
                            description: vol.desc || vol.description
                        })) || []
                    },
                    certifications: {
                        create: certifications?.map((cert: any) => ({
                            name: cert.name,
                            issuingBody: cert.issuer || cert.issuingBody,
                            year: cert.year
                        })) || []
                    },
                    languages: {
                        create: languages?.map((lang: any) => ({
                            name: lang.name,
                            proficiency: lang.proficiency
                        })) || []
                    }
                },
                include: {
                    experience: true,
                    achievements: true
                }
            }) as any;

            // Process achievements
            if (discoveredAchievements && discoveredAchievements.length > 0) {
                const achievementsToCreate = discoveredAchievements.map((ach: any) => {
                    const experienceId = ach.experienceIndex !== undefined && updatedProfile.experience && updatedProfile.experience[ach.experienceIndex] 
                        ? updatedProfile.experience[ach.experienceIndex].id 
                        : null;
                    
                    return {
                        candidateProfileId: updatedProfile.id,
                        userId, // Add this line
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

                await tx.achievement.createMany({
                    data: achievementsToCreate
                });
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
                        userId, // Use userId as namespace
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
app.get('/api/achievements', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    log(`Handling GET /api/achievements for user: ${userId}`);
    try {
        log('Querying profile...');
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            log('Profile not found for user - returning empty achievements');
            return res.json([]);
        }

        log('Querying achievements...');
        const achievements = await prisma.achievement.findMany({
            where: { 
                candidateProfile: { userId }
            },
            orderBy: { createdAt: 'desc' }
        });
        log(`Found ${achievements.length} achievements`);
        res.json(achievements);
    } catch (error) {
        log(`Error fetching achievements: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

app.post('/api/achievements', authenticate, async (req, res) => {
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
app.get('/api/achievements/count', authenticate, async (req, res) => {
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

app.patch('/api/achievements/:id', authenticate, async (req, res) => {
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

app.delete('/api/achievements/:id', authenticate, async (req, res) => {
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

app.get('/api/jobs', authenticate, async (req, res) => {
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

// --- Document Routes ---
app.get('/api/documents', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const docs = await prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

app.post('/api/documents', authenticate, async (req, res) => {
    const { title, content, type } = req.body;
    const userId = (req as any).user.id;
    try {
        const doc = await prisma.document.create({
            data: {
                title,
                content,
                type: type || 'RESUME',
                userId
            }
        });
        res.json(doc);
    } catch (error) {
        console.error('Save Document Error:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});

app.post('/api/documents/upload', authenticate, upload.single('file'), async (req, res) => {
    const userId = (req as any).user.id;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let content = '';
        if (req.file.mimetype === 'application/pdf') {
            content = await extractTextFromPDF(req.file.buffer);
        } else {
            content = req.file.buffer.toString('utf-8');
        }

        const doc = await prisma.document.create({
            data: {
                title: req.file.originalname,
                content: content,
                type: 'RESUME',
                userId
            }
        });

        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process file upload' });
    }
});



app.post('/api/tracker/finalize', authenticate, async (req, res) => {
    const { type, content, jobDescription, company, role } = req.body;
    const userId = (req as any).user.id;
    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId }
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        // 1. Create JobApplication
        const jobApp = await prisma.jobApplication.create({
            data: {
                candidateProfileId: profile.id,
                title: role || 'Unknown Role',
                company: company || 'Unknown Company',
                description: jobDescription,
                status: 'SAVED',
                userId
            }
        });

        // 2. Map frontend type to Prisma enum DocumentType
        let docType: any = 'RESUME';
        if (type === 'cover-letter') docType = 'COVER_LETTER';
        if (type === 'selection-criteria') docType = 'STAR_RESPONSE';

        // 3. Create Document linked to JobApplication
        const doc = await prisma.document.create({
            data: {
                title: `${type.toUpperCase()} - ${company || 'General'}`,
                content,
                type: docType,
                jobApplicationId: jobApp.id,
                userId
            }
        });

        res.json({ success: true, jobAppId: jobApp.id, documentId: doc.id });
    } catch (error) {
        console.error('Finalize Error:', error);
        res.status(500).json({ error: 'Failed to finalize application' });
    }
});

app.patch('/api/documents/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const { content } = req.body as any;
    const userId = (req as any).user.id;
    try {
        const doc = await prisma.document.update({
            where: { id: id as string, userId: userId as string },
            data: { content: content as string }
        });
        res.json(doc);
    } catch (error) {
        console.error('Update Document Error:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});


// Final error handler - must be after all routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err.message, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
    console.log(`🚀 Job Ready Backend running on http://localhost:${PORT}`);
});
