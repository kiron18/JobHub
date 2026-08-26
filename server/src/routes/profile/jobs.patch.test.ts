import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../index', () => ({
  prisma: {
    jobApplication: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    candidateProfile: { findUnique: vi.fn() },
    document: { updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', email: 'a@b.com' };
    next();
  },
  mintExtensionToken: vi.fn(),
  hashExtensionToken: vi.fn(),
}));

vi.mock('../../services/qc/linkDocuments', () => ({ linkDocumentsToApplication: vi.fn() }));
// Mocked whole, not spread over the real module: importing it constructs a
// Resend client, which throws without an API key.
vi.mock('../../services/email', () => ({ sendStatusEmail: vi.fn().mockResolvedValue(undefined) }));

async function app() {
  const router = (await import('./jobs')).default;
  const a = express();
  a.use(express.json());
  a.use('/api', router);
  return a;
}

async function mocks() {
  return {
    prisma: (await import('../../index')).prisma as any,
    link: (await import('../../services/qc/linkDocuments')).linkDocumentsToApplication as any,
  };
}

const AD = 'A long job advert. '.repeat(30);

beforeEach(async () => {
  const { prisma, link } = await mocks();
  vi.clearAllMocks();
  prisma.jobApplication.findFirst.mockResolvedValue({
    status: 'SAVED',
    title: 'Data Analyst',
    company: 'Telstra',
    description: AD,
    interviewReachedAt: null,
    offerReachedAt: null,
    dateApplied: null,
  });
  prisma.jobApplication.update.mockResolvedValue({ id: 'j1', status: 'APPLIED', documents: [] });
  link.mockResolvedValue(0);
});

describe('PATCH /api/jobs/:id — the row the fit check already made', () => {
  it('moves a saved job to applied without creating a second one', async () => {
    const { prisma } = await mocks();
    const res = await request(await app())
      .patch('/api/jobs/j1')
      .send({ status: 'APPLIED', dateApplied: '2026-08-26T00:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(prisma.jobApplication.update.mock.calls[0][0].data.status).toBe('APPLIED');
  });

  // Documents used to be linked only when a job row was created. The row is now
  // created by the fit check at the start, so linking has to happen here or
  // every application made through the front door loses its documents.
  it('attaches the documents written for this advert once it is applied', async () => {
    const { prisma, link } = await mocks();
    link.mockResolvedValue(2);
    prisma.jobApplication.findUnique.mockResolvedValue({
      id: 'j1', status: 'APPLIED', documents: [{ id: 'd1' }, { id: 'd2' }],
    });

    const res = await request(await app()).patch('/api/jobs/j1').send({ status: 'APPLIED' });

    expect(link).toHaveBeenCalledWith('u1', 'j1', AD);
    expect(res.body.documents).toHaveLength(2);
  });

  it('does not go looking for documents on a status that is not a sent one', async () => {
    const { link } = await mocks();
    await request(await app()).patch('/api/jobs/j1').send({ status: 'SAVED' });
    expect(link).not.toHaveBeenCalled();
  });

  it('still sends the applied email when documents were linked', async () => {
    const { prisma, link } = await mocks();
    link.mockResolvedValue(1);
    prisma.jobApplication.findUnique.mockResolvedValue({ id: 'j1', documents: [{ id: 'd1' }] });
    const { sendStatusEmail } = await import('../../services/email');

    await request(await app()).patch('/api/jobs/j1').send({ status: 'APPLIED' });

    expect(sendStatusEmail).toHaveBeenCalled();
  });

  it('saves the status change even when linking blows up', async () => {
    const { link } = await mocks();
    link.mockRejectedValue(new Error('boom'));
    const res = await request(await app()).patch('/api/jobs/j1').send({ status: 'APPLIED' });
    expect(res.status).toBe(200);
  });
});
