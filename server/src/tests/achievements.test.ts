import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../index', () => ({
    prisma: {
        candidateProfile: {
            findUnique: vi.fn(),
        },
        achievement: {
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

vi.mock('../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        next();
    },
}));

// Track whether indexAchievement was called
const mockIndexAchievement = vi.fn();

vi.mock('../services/vector', () => ({
    indexAchievement: (...args: any[]) => mockIndexAchievement(...args),
    deleteAchievement: vi.fn().mockResolvedValue(undefined),
}));

import achievementsRouter from '../routes/profile/achievements';
import { prisma } from '../index';

const app = express();
app.use(express.json());
app.use('/api', achievementsRouter);

const mockProfile = {
    id: 'profile-1',
    userId: 'test-user-id',
};

const mockCreatedAchievement = {
    id: 'achievement-1',
    candidateProfileId: 'profile-1',
    userId: 'test-user-id',
    title: 'Led PR for community festival',
    description: 'I secured 12 media placements and grew impressions 25% month-over-month',
    skills: 'Public Relations',
    metric: '25%',
    metricType: null,
    isStaged: true,
};

describe('POST /api/achievements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.candidateProfile.findUnique as any).mockResolvedValue(mockProfile);
        (prisma.achievement.create as any).mockResolvedValue(mockCreatedAchievement);
        mockIndexAchievement.mockResolvedValue(undefined);
    });

    it('creates achievement in DB and indexes in Pinecone', async () => {
        const res = await request(app)
            .post('/api/achievements')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Led PR for community festival',
                description: 'I secured 12 media placements and grew impressions 25% month-over-month',
                metric: '25%',
                skills: 'Public Relations',
            });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ title: 'Led PR for community festival' });

        // DB create was called
        expect(prisma.achievement.create).toHaveBeenCalled();

        // Pinecone index was called with correct args
        expect(mockIndexAchievement).toHaveBeenCalledWith(
            'test-user-id',
            'achievement-1',
            expect.stringContaining('Led PR for community festival'),
            expect.objectContaining({ metric: '25%', skills: 'Public Relations' })
        );
    });

    it('returns 200 even if Pinecone indexing fails (DB save is critical)', async () => {
        mockIndexAchievement.mockRejectedValue(new Error('Pinecone connection refused'));

        const res = await request(app)
            .post('/api/achievements')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Led PR for community festival',
                description: 'I secured 12 media placements',
                metric: '25%',
                skills: 'Public Relations',
            });

        // DB save must succeed even if Pinecone is down
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ title: 'Led PR for community festival' });
        expect(prisma.achievement.create).toHaveBeenCalledTimes(1);
    });

    it('returns 404 if profile not found', async () => {
        (prisma.candidateProfile.findUnique as any).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/achievements')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Test',
                description: 'Test description',
                skills: 'Test',
            });

        expect(res.status).toBe(404);
        expect(mockIndexAchievement).not.toHaveBeenCalled();
    });

    it('returns 500 if DB save fails', async () => {
        (prisma.achievement.create as any).mockRejectedValue(new Error('DB timeout'));

        const res = await request(app)
            .post('/api/achievements')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Test',
                description: 'Test description',
                skills: 'Test',
            });

        expect(res.status).toBe(500);
        // Pinecone should not have been called since DB save failed
        expect(mockIndexAchievement).not.toHaveBeenCalled();
    });
});
