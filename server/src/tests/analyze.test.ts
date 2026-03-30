import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock external deps BEFORE importing router
vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      findUnique: vi.fn(),
    },
    jobApplication: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  },
}));

// Bypass rate limiter so tests don't hit the in-memory cap
vi.mock('../middleware/analyzeRateLimit', () => ({
  analyzeRateLimit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

vi.mock('../services/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('../services/vector', () => ({
  searchAchievements: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/generation', () => ({
  rankAchievements: vi.fn().mockResolvedValue([]),
}));

import analyzeRouter from '../routes/analyze';
import { prisma } from '../index';
import { callLLM } from '../services/llm';

const app = express();
app.use(express.json());
app.use('/api/analyze', analyzeRouter);

const SHORT_JD = 'a'.repeat(49);
const VALID_JD =
  'Senior Software Engineer role at Acme Corp. Must have 5+ years experience with TypeScript, React, and Node.js. ' +
  'You will lead a team and ship high-quality software products in an agile environment. Strong communication skills required.';

const mockProfile = {
  id: 'profile-1',
  userId: 'test-user-id',
  fullName: 'Jane Smith',
  professionalSummary: 'Experienced engineer',
  skills: JSON.stringify({ technical: ['TypeScript', 'React'], industryKnowledge: [], softSkills: [] }),
  achievements: [],
};

// ── /jd-summary ─────────────────────────────────────────────────────────────

describe('POST /api/analyze/jd-summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 if jobDescription is missing', async () => {
    const res = await request(app)
      .post('/api/analyze/jd-summary')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 if jobDescription is too short', async () => {
    const res = await request(app)
      .post('/api/analyze/jd-summary')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: SHORT_JD });
    expect(res.status).toBe(400);
  });

  it('returns parsed summary on valid input', async () => {
    (callLLM as any).mockResolvedValueOnce(
      JSON.stringify({
        roleType: 'Individual Contributor',
        experienceYears: '5+ years',
        keySkills: ['TypeScript', 'React'],
        arrangement: 'Hybrid',
        employmentType: 'Full-time',
        salaryMentioned: null,
        closingDate: null,
        securityClearance: null,
      })
    );

    const res = await request(app)
      .post('/api/analyze/jd-summary')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: VALID_JD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ roleType: 'Individual Contributor', experienceYears: '5+ years' });
  });
});

// ── /gap ─────────────────────────────────────────────────────────────────────

describe('POST /api/analyze/gap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(mockProfile);
  });

  it('returns 400 if jobDescription is too short', async () => {
    const res = await request(app)
      .post('/api/analyze/gap')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: SHORT_JD });
    expect(res.status).toBe(400);
  });

  it('returns 404 if profile not found', async () => {
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/analyze/gap')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: VALID_JD });
    expect(res.status).toBe(404);
  });

  it('returns gap analysis on valid input', async () => {
    (callLLM as any).mockResolvedValueOnce(
      JSON.stringify({
        overallFit: 'STRONG',
        missingKeywords: ['Kubernetes'],
        skillGaps: [],
        strengthAreas: ['TypeScript', 'React'],
        quickWins: ['Add metrics to achievements'],
        profileReadiness: 75,
      })
    );

    const res = await request(app)
      .post('/api/analyze/gap')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: VALID_JD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ overallFit: 'STRONG', profileReadiness: 75 });
    expect(Array.isArray(res.body.strengthAreas)).toBe(true);
  });
});

// ── /achievement-suggestions ─────────────────────────────────────────────────

describe('POST /api/analyze/achievement-suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(mockProfile);
  });

  it('returns 400 if jobDescription is too short', async () => {
    const res = await request(app)
      .post('/api/analyze/achievement-suggestions')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: SHORT_JD });
    expect(res.status).toBe(400);
  });

  it('returns suggestions array on valid input', async () => {
    (callLLM as any).mockResolvedValueOnce(
      JSON.stringify({
        suggestions: [
          { title: 'Team leadership', prompt: 'Describe a time you led a team', example: 'Led team of 5 to deliver X', why: 'Role requires team lead' },
        ],
      })
    );

    const res = await request(app)
      .post('/api/analyze/achievement-suggestions')
      .set('Authorization', 'Bearer test-token')
      .send({ jobDescription: VALID_JD });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions[0].title).toBe('Team leadership');
  });
});
