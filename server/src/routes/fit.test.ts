import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn() },
    jobApplication: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', email: 'a@b.com' }; next(); },
}));

vi.mock('../services/fitReport', async () => {
  const actual = await vi.importActual<typeof import('../services/fitReport')>('../services/fitReport');
  return { ...actual, runFitReport: vi.fn() };
});

vi.mock('../services/duplicateDetection', () => ({ findDuplicateApplication: vi.fn() }));
vi.mock('../services/seekJobUrl', () => ({
  fetchSeekJobFromUrl: vi.fn(),
  SeekUrlError: class SeekUrlError extends Error {},
}));

async function app() {
  const router = (await import('./fit')).default;
  const a = express();
  a.use(express.json());
  a.use('/api/fit', router);
  return a;
}

const REPORT = {
  jobTitle: 'Data Analyst',
  company: 'Telstra',
  fit: 72,
  band: 'stretch' as const,
  verdict: 'You can do this.',
  youHave: ['SQL'],
  missing: ['Power BI'],
  outcome: 'apply' as const,
  searchRoles: [],
};

const AD = 'Data Analyst at Telstra. '.repeat(20);

async function mocks() {
  return {
    prisma: (await import('../index')).prisma as any,
    fit: (await import('../services/fitReport')).runFitReport as any,
    dup: (await import('../services/duplicateDetection')).findDuplicateApplication as any,
    seek: (await import('../services/seekJobUrl')).fetchSeekJobFromUrl as any,
  };
}

beforeEach(async () => {
  const { prisma, fit, dup } = await mocks();
  vi.clearAllMocks();
  prisma.candidateProfile.findUnique.mockResolvedValue({
    id: 'p1', resumeRawText: 'x'.repeat(500), resumeOriginalText: null,
  });
  fit.mockResolvedValue({ report: REPORT, requirements: [{ section: '', text: 'r' }], flagged: [], ms: 8000 });
  dup.mockResolvedValue(null);
  prisma.jobApplication.create.mockResolvedValue({ id: 'j1' });
  prisma.jobApplication.update.mockResolvedValue({ id: 'j1' });
});

describe('POST /api/fit/check', () => {
  it('returns the report and saves the job it was run against', async () => {
    const { prisma } = await mocks();
    const res = await request(await app()).post('/api/fit/check').send({ jobDescription: AD });

    expect(res.status).toBe(200);
    expect(res.body.report.fit).toBe(72);
    expect(res.body.jobId).toBe('j1');

    const saved = prisma.jobApplication.create.mock.calls[0][0].data;
    expect(saved.title).toBe('Data Analyst');
    expect(saved.company).toBe('Telstra');
    expect(saved.fitScore).toBe(72);
    // The job lands in the tracker they will already be using on the day they
    // pay, rather than a throwaway list.
    expect(saved.status).toBe('SAVED');
    expect(saved.candidateProfileId).toBe('p1');
  });

  it('checks against the clean rebuilt resume, which is what they would send', async () => {
    const { prisma, fit } = await mocks();
    prisma.candidateProfile.findUnique.mockResolvedValue({
      id: 'p1', resumeRawText: 'CLEAN', resumeOriginalText: 'ORIGINAL',
    });
    await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    expect(fit.mock.calls[0][0]).toBe('CLEAN');
  });

  it('falls back to the original upload for a profile that predates the rebuild', async () => {
    const { prisma, fit } = await mocks();
    prisma.candidateProfile.findUnique.mockResolvedValue({
      id: 'p1', resumeRawText: null, resumeOriginalText: 'ORIGINAL',
    });
    await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    expect(fit.mock.calls[0][0]).toBe('ORIGINAL');
  });

  it('updates the existing row instead of growing the list on a recheck', async () => {
    const { prisma, dup } = await mocks();
    dup.mockResolvedValue({ applicationId: 'existing', status: 'APPLIED', dateApplied: '2026-08-01' });

    const res = await request(await app()).post('/api/fit/check').send({ jobDescription: AD });

    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    expect(prisma.jobApplication.update.mock.calls[0][0].where).toEqual({ id: 'existing' });
    // Told, not hidden: they should know they already applied here.
    expect(res.body.alreadyTracked.status).toBe('APPLIED');
  });

  it('does not run duplicate detection when the ad never named an employer', async () => {
    const { fit, dup } = await mocks();
    fit.mockResolvedValue({
      report: { ...REPORT, company: null }, requirements: [], flagged: [], ms: 1,
    });
    await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    // Two anonymous "Business Analyst" ads are usually two different employers.
    expect(dup).not.toHaveBeenCalled();
  });

  it('names an untitled ad rather than saving an empty title', async () => {
    const { prisma, fit } = await mocks();
    fit.mockResolvedValue({
      report: { ...REPORT, jobTitle: null }, requirements: [], flagged: [], ms: 1,
    });
    await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    expect(prisma.jobApplication.create.mock.calls[0][0].data.title).toBe('Untitled role');
  });

  it('rejects a paste too short to be a job ad', async () => {
    const res = await request(await app()).post('/api/fit/check').send({ jobDescription: 'Data Analyst' });
    expect(res.status).toBe(400);
  });

  it('tells the frontend when there is no resume to check against', async () => {
    const { prisma } = await mocks();
    prisma.candidateProfile.findUnique.mockResolvedValue(null);
    const res = await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    expect(res.status).toBe(404);
    expect(res.body.needsResume).toBe(true);
  });

  it('reads a Seek link server-side, since the advertiser is outside what anyone copies', async () => {
    const { seek, fit } = await mocks();
    seek.mockResolvedValue({ description: AD, sourceUrl: 'https://www.seek.com.au/job/123' });
    const res = await request(await app())
      .post('/api/fit/check')
      .send({ url: 'https://www.seek.com.au/job/123' });
    expect(res.status).toBe(200);
    expect(fit.mock.calls[0][1]).toBe(AD);
  });

  it('tells them to paste the text when the link cannot be read', async () => {
    const { seek } = await mocks();
    seek.mockRejectedValue(new Error('boom'));
    const res = await request(await app())
      .post('/api/fit/check')
      .send({ url: 'https://www.seek.com.au/job/123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paste/i);
  });

  it('does not leak an internal failure to the screen', async () => {
    const { fit } = await mocks();
    fit.mockRejectedValue(new Error('OPENROUTER_API_KEY is not set'));
    const res = await request(await app()).post('/api/fit/check').send({ jobDescription: AD });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/OPENROUTER/);
  });
});

describe('GET /api/fit/jobs', () => {
  it('lists only jobs that have been checked, and sends the headline not the essay', async () => {
    const { prisma } = await mocks();
    prisma.jobApplication.findMany.mockResolvedValue([
      { id: 'j1', title: 'Data Analyst', company: 'Telstra', fitScore: 72, fitReport: REPORT },
    ]);

    const res = await request(await app()).get('/api/fit/jobs');

    expect(prisma.jobApplication.findMany.mock.calls[0][0].where.fitCheckedAt).toEqual({ not: null });
    expect(res.body.jobs[0].band).toBe('stretch');
    expect(res.body.jobs[0].fitReport).toBeUndefined();
  });
});

describe('GET /api/fit/jobs/:id', () => {
  it('reopens a saved report without paying for the call twice', async () => {
    const { prisma } = await mocks();
    prisma.jobApplication.findFirst.mockResolvedValue({ id: 'j1', title: 'Data Analyst', fitReport: REPORT });
    const res = await request(await app()).get('/api/fit/jobs/j1');
    expect(res.status).toBe(200);
    expect(res.body.report.fit).toBe(72);
  });

  it('scopes the lookup to the caller, so an id is not a key to someone else', async () => {
    const { prisma } = await mocks();
    prisma.jobApplication.findFirst.mockResolvedValue(null);
    const res = await request(await app()).get('/api/fit/jobs/someone-elses-id');
    expect(prisma.jobApplication.findFirst.mock.calls[0][0].where.userId).toBe('u1');
    expect(res.status).toBe(404);
  });
});

describe('the ad, carried forward', () => {
  it('returns the resolved ad text so a link never reaches the generator', async () => {
    const { seek } = await mocks();
    seek.mockResolvedValue({ description: AD, sourceUrl: 'https://www.seek.com.au/job/123' });
    const res = await request(await app())
      .post('/api/fit/check')
      .send({ url: 'https://www.seek.com.au/job/123' });
    expect(res.body.jobDescription).toBe(AD);
  });
});
