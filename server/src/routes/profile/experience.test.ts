import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn() },
    experience: { create: vi.fn() },
  },
}));

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', email: 'a@b.com' };
    next();
  },
}));

async function app() {
  const router = (await import('./experience')).default;
  const a = express();
  a.use(express.json());
  a.use('/api', router);
  return a;
}
const prisma = async () => (await import('../../index')).prisma as any;

beforeEach(async () => {
  const p = await prisma();
  vi.clearAllMocks();
  p.candidateProfile.findUnique.mockResolvedValue({ id: 'cp1' });
  p.experience.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', ...data }));
});

describe('POST /api/experience (from-scratch onboarding)', () => {
  it('saves the role exactly as FromScratchCapture sends it, with no dates', async () => {
    const res = await request(await app()).post('/api/experience')
      .send({ company: ' Woolworths ', role: 'Team Member', startDate: null, endDate: null, description: '' });
    expect(res.status).toBe(201);
    const { data } = (await prisma()).experience.create.mock.calls[0][0];
    expect(data).toMatchObject({
      candidateProfileId: 'cp1', company: 'Woolworths', role: 'Team Member',
      startDate: '', endDate: null, isCurrent: true, type: 'work', description: null,
    });
  });

  it('keeps an end date when one is given', async () => {
    await request(await app()).post('/api/experience')
      .send({ company: 'ANZ', role: 'Analyst', startDate: 'Jan 2023', endDate: 'Mar 2024' });
    const { data } = (await prisma()).experience.create.mock.calls[0][0];
    expect(data).toMatchObject({ startDate: 'Jan 2023', endDate: 'Mar 2024', isCurrent: false });
  });

  it('rejects a missing company or role', async () => {
    const a = await app();
    expect((await request(a).post('/api/experience').send({ role: 'x' })).status).toBe(400);
    expect((await request(a).post('/api/experience').send({ company: 'x' })).status).toBe(400);
  });

  it('404s without a profile', async () => {
    (await prisma()).candidateProfile.findUnique.mockResolvedValue(null);
    const res = await request(await app()).post('/api/experience').send({ company: 'a', role: 'b' });
    expect(res.status).toBe(404);
  });
});
