import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      update: vi.fn(),
    },
  },
}));

// Mock authenticate middleware to inject a test user
vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

import express from 'express';
import request from 'supertest';
import skoolRouter from './skool';
import { prisma } from '../index';

const app = express();
app.use(express.json());
app.use('/api/skool', skoolRouter);

const mockUpdate = vi.mocked(prisma.candidateProfile.update);

describe('POST /api/skool/join', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves skool email and flips skoolJoined to true', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(app)
      .post('/api/skool/join')
      .send({ skoolEmail: 'member@skool.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
      data: { skoolJoined: true, skoolCommunityEmail: 'member@skool.com' },
    });
  });

  it('sets skoolJoined true with no email when skoolEmail is blank', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(app)
      .post('/api/skool/join')
      .send({ skoolEmail: '' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
      data: { skoolJoined: true, skoolCommunityEmail: null },
    });
  });

  it('returns 500 when prisma update throws', async () => {
    vi.mocked(prisma.candidateProfile.update).mockRejectedValue(new Error('db error'));
    const res = await request(app)
      .post('/api/skool/join')
      .send({ skoolEmail: 'x@y.com' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to record join' });
  });
});
