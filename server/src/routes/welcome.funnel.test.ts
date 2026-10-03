/**
 * The server-side front-door funnel events. These are the complete record of
 * uploads, builds and signups (the browser copies are lost to ad blockers and
 * the sessions are swept after a day), so who they are keyed on is the
 * behaviour: the browser's PostHog id when sent, then our visitor id, then the
 * welcome session, and always an alias onto the account at /finish.
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
vi.mock('../middleware/ipRateLimit', () => ({ ipRateLimit: (_req: any, _res: any, next: any) => next() }));
vi.mock('../services/resumePdf', () => ({ renderResumePdf: vi.fn() }));
vi.mock('../services/autoExtract', () => ({ autoExtractAchievements: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/onboarding', () => ({ reconcileProfileEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/email', () => ({ sendWelcomeResumeEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/posthogServer', () => ({
  captureServerEvent: vi.fn(),
  posthogServer: { alias: vi.fn() },
}));

import { prisma } from '../index';
import { captureServerEvent, posthogServer } from '../lib/posthogServer';

const capture = captureServerEvent as any;
const alias = (posthogServer as any).alias;
const find = prisma.welcomeSession.findUnique as any;

async function app() {
  const { welcomeRouter } = await import('./welcome');
  const a = express();
  a.use(express.json());
  a.use('/api/welcome', welcomeRouter);
  return a;
}

const RESUME = `# Priya Ramesh
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

function session() {
  return {
    id: 's1', token: 'tok', resumeOriginalText: ORIGINAL, resumeCleanText: RESUME,
    resumeEditedAt: new Date(), answers: [], claimedByUserId: null, createdAt: new Date(),
    firstName: 'Priya', fullName: 'Priya Ramesh', resumeFilename: 'priya.pdf', buildCount: 0, questions: [],
  };
}

const events = () => capture.mock.calls.map((c: any[]) => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.candidateProfile.findUnique as any).mockResolvedValue(null);
  (prisma.candidateProfile.upsert as any).mockResolvedValue({});
  (prisma.welcomeSession.update as any).mockResolvedValue({});
});

describe('POST /api/welcome/finish funnel events', () => {
  it('records signup_completed on the account, with the live host', async () => {
    find.mockResolvedValue(session());
    const res = await request(await app()).post('/api/welcome/finish')
      .set('Origin', 'https://www.aussiegradcareers.com.au')
      .send({ token: 'tok', targetRoles: ['Data Analyst'], ph_id: 'ph-123' });

    expect(res.status).toBe(200);
    const signup = events().find((e: any) => e.event === 'signup_completed');
    expect(signup).toMatchObject({ distinctId: 'u1', properties: { flow: 'welcome', new_profile: true, $host: 'www.aussiegradcareers.com.au' } });
  });

  it('aliases the browser PostHog id too, since a blocked identify() never merges it', async () => {
    find.mockResolvedValue(session());
    await request(await app()).post('/api/welcome/finish').send({ token: 'tok', targetRoles: ['Data Analyst'], ph_id: 'ph-123', vid: 'v-1' });
    expect(alias).toHaveBeenCalledWith({ distinctId: 'u1', alias: 'ph-123' });
  });

  it('aliases our visitor id onto the account when PostHog was blocked', async () => {
    find.mockResolvedValue(session());
    await request(await app()).post('/api/welcome/finish').send({ token: 'tok', targetRoles: ['Data Analyst'], vid: 'v-77' });
    expect(alias).toHaveBeenCalledWith({ distinctId: 'u1', alias: 'visitor:v-77' });
  });

  it('aliases the session-keyed events when there is no id at all', async () => {
    find.mockResolvedValue(session());
    await request(await app()).post('/api/welcome/finish').send({ token: 'tok', targetRoles: ['Data Analyst'] });
    expect(alias).toHaveBeenCalledWith({ distinctId: 'u1', alias: 'welcome:tok' });
  });
});

describe('POST /api/welcome/build funnel events', () => {
  it('records an expired session as a failed build, keyed on the browser id', async () => {
    find.mockResolvedValue(null);
    const res = await request(await app()).post('/api/welcome/build').send({ token: 'gone', ph_id: 'ph-9' });

    expect(res.status).toBe(410);
    expect(events()).toContainEqual(expect.objectContaining({
      distinctId: 'ph-9', event: 'resume_build_failed', properties: expect.objectContaining({ reason: 'session_expired' }),
    }));
  });

  it('falls back to the session token when there is no browser id', async () => {
    find.mockResolvedValue({ ...session(), buildCount: 3 });
    await request(await app()).post('/api/welcome/build').send({ token: 'tok' });
    expect(events()).toContainEqual(expect.objectContaining({
      distinctId: 'welcome:tok', event: 'resume_build_failed', properties: expect.objectContaining({ reason: 'build_limit' }),
    }));
  });
});
