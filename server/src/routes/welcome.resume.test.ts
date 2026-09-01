/**
 * PATCH /api/welcome/resume — the candidate's own edit of the rebuilt resume.
 *
 * The gate is the reason this endpoint has tests at all. resumeCleanText is
 * copied onto profile.resumeRawText at /finish, and that field is the ground
 * truth every future generation is built from and graded against, so what may
 * and may not be written here is the whole behaviour. The real
 * `resumeSourceGate` runs in these tests deliberately — mocking it would test
 * the plumbing and leave the rule itself unproven.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../index', () => ({
  prisma: {
    welcomeSession: { findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    candidateProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', email: 'a@b.com' }; next(); },
  optionalAuthenticate: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/ipRateLimit', () => ({
  ipRateLimit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/resumePdf', () => ({ renderResumePdf: vi.fn() }));
vi.mock('../services/autoExtract', () => ({ autoExtractAchievements: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/onboarding', () => ({ reconcileProfileEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/email', () => ({ sendWelcomeResumeEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../index';
import { renderResumePdf } from '../services/resumePdf';

async function app() {
  const { welcomeRouter } = await import('./welcome');
  const a = express();
  a.use(express.json());
  a.use('/api/welcome', welcomeRouter);
  return a;
}

/**
 * A resume long enough to clear MIN_RESUME_LENGTH, with every figure in it also
 * present in ORIGINAL below, so the grounding half of the gate is quiet unless a
 * test deliberately adds something.
 */
const EDITED = `# Priya Ramesh
Sydney NSW | priya@example.com

## Professional summary
Clinical research coordinator with six years across oncology trials, moving into
data analysis. Ran site start-up for 14 studies and cut screening turnaround.

## Experience
### Clinical Research Coordinator, Westmead
- Coordinated 14 studies from site start-up through to close-out.
- Cut screening turnaround from 21 days to 9 by rebuilding the intake checklist.

## Education
### Master of Public Health, University of Sydney`;

const ORIGINAL = `Priya Ramesh
Clinical research coordinator, Westmead. 14 studies. Screening turnaround 21 days
down to 9 days. Master of Public Health, University of Sydney, six years total.`;

function session(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    token: 'tok',
    resumeOriginalText: ORIGINAL,
    resumeCleanText: 'the resume as the model rebuilt it',
    resumeEditedAt: null,
    answers: [],
    claimedByUserId: null,
    createdAt: new Date(),
    firstName: 'Priya',
    resumeFilename: 'priya.pdf',
    ...over,
  };
}

const find = prisma.welcomeSession.findUnique as any;
const update = prisma.welcomeSession.update as any;
const render = renderResumePdf as any;

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  render.mockResolvedValue({ pages: 2, buffer: Buffer.from('') });
});

describe('PATCH /api/welcome/resume', () => {
  it('saves the edit, stamps that a human wrote it, and returns the fresh page count', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED });

    expect(res.status).toBe(200);
    expect(res.body.pageCount).toBe(2);

    const write = update.mock.calls[0][0];
    expect(write.where).toEqual({ id: 's1' });
    expect(write.data.resumeCleanText).toBe(EDITED);
    expect(write.data.resumeEditedAt).toBeInstanceOf(Date);
    // Measured off the text that was just saved, not the one it replaced.
    expect(render).toHaveBeenCalledWith(EDITED);
  });

  it('accepts a figure the candidate added, and says which one it was', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED.replace('for 14 studies', 'for 14 studies across 37 sites') });

    // Human mode: their history is not limited to what the upload happened to
    // say, so a new figure is an advisory, never a refusal. Two digits, because
    // the grounding check does not chase single ones.
    expect(res.status).toBe(200);
    expect(res.body.figures).toContain('37');
    expect(update).toHaveBeenCalled();
  });

  it('refuses square-bracket placeholders, which are a defect either way', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED.replace('14 studies', '[how many] studies') });

    expect(res.status).toBe(422);
    expect(res.body.placeholders.length).toBeGreaterThan(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses an edit that emptied the document', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: 'Priya Ramesh\nSydney' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/too short/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an empty body without reaching the gate', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: '   ' });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('caps what can be pushed into the field', async () => {
    find.mockResolvedValue(session());

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: 'x'.repeat(60_001) });

    expect(res.status).toBe(413);
    expect(update).not.toHaveBeenCalled();
  });

  it('410s an expired or unknown token', async () => {
    find.mockResolvedValue(null);

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'gone', resume: EDITED });

    expect(res.status).toBe(410);
  });

  it('409s once the session has been claimed onto an account', async () => {
    find.mockResolvedValue(session({ claimedByUserId: 'u9' }));

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED });

    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it('409s before the rebuild has produced anything to edit', async () => {
    find.mockResolvedValue(session({ resumeCleanText: null }));

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED });

    expect(res.status).toBe(409);
  });

  it('keeps the edit when the page count cannot be rendered', async () => {
    find.mockResolvedValue(session());
    render.mockRejectedValue(new Error('pdfkit exploded'));

    const res = await request(await app())
      .patch('/api/welcome/resume')
      .send({ token: 'tok', resume: EDITED });

    expect(res.status).toBe(200);
    expect(res.body.pageCount).toBeNull();
    expect(update).toHaveBeenCalled();
  });
});

describe('POST /api/welcome/finish — which gate the rebuilt resume meets', () => {
  beforeEach(() => {
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(null);
    (prisma.candidateProfile.upsert as any).mockResolvedValue({});
  });

  const body = { token: 'tok', targetRoles: ['Data Analyst'], targetCity: 'Sydney' };

  it('refuses a figure the model invented, when nobody has edited the resume', async () => {
    find.mockResolvedValue(session({
      resumeCleanText: EDITED.replace('for 14 studies', 'for 14 studies across 37 sites'),
      resumeEditedAt: null,
    }));

    const res = await request(await app()).post('/api/welcome/finish').send(body);

    expect(res.status).toBe(502);
    expect(prisma.candidateProfile.upsert).not.toHaveBeenCalled();
  });

  it('accepts the same figure once the candidate has typed it themselves', async () => {
    find.mockResolvedValue(session({
      resumeCleanText: EDITED.replace('for 14 studies', 'for 14 studies across 37 sites'),
      resumeEditedAt: new Date(),
    }));

    const res = await request(await app()).post('/api/welcome/finish').send(body);

    expect(res.status).toBe(200);
    const write = (prisma.candidateProfile.upsert as any).mock.calls[0][0];
    expect(write.create.resumeRawText).toContain('across 37 sites');
  });

  it('still refuses a placeholder on an edited resume', async () => {
    find.mockResolvedValue(session({
      resumeCleanText: EDITED.replace('14 studies', '[how many] studies'),
      resumeEditedAt: new Date(),
    }));

    const res = await request(await app()).post('/api/welcome/finish').send(body);

    expect(res.status).toBe(502);
    expect(prisma.candidateProfile.upsert).not.toHaveBeenCalled();
  });
});
