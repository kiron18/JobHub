import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../services/llm', () => ({
  callLLM: vi.fn(),
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

import extractRouter from '../routes/extract';
import { callLLM } from '../services/llm';

const app = express();
app.use(express.json());
app.use('/api/extract', extractRouter);

// 101 chars — just over the 100-char scanned-PDF threshold
const VALID_RESUME_TEXT = `John Smith\nSenior Software Engineer\njohn@example.com | Sydney, NSW\n\nEXPERIENCE\nAcme Corp — Senior Engineer (2020–2024)\n• Led legacy system migration saving $200k per year\n• Built CI/CD pipeline cutting deploy time by 60%\n\nEDUCATION\nUniversity of Sydney — Bachelor of Computer Science (2016)`;

const mockStage1 = {
  profile: {
    fullName: 'John Smith',
    email: 'john@example.com',
    phone: null,
    location: 'Sydney, NSW',
    professionalSummary: '',
  },
  skills: { technical: ['TypeScript'], industryKnowledge: [], softSkills: [] },
  experience: [
    {
      role: 'Senior Engineer',
      company: 'Acme Corp',
      startDate: '2020',
      endDate: '2024',
      bullets: ['Led legacy system migration saving $200k per year'],
    },
  ],
  education: [{ institution: 'University of Sydney', degree: 'Bachelor of Computer Science', year: '2016' }],
  volunteering: [],
  certifications: [],
  languages: [],
  coachingAlerts: [],
};

const mockStage2 = {
  achievements: [
    {
      title: 'Legacy migration',
      description: 'Led migration of legacy system',
      metric: '$200k annual savings',
      metricType: 'FINANCIAL',
    },
  ],
};

describe('POST /api/extract/resume', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 if text is missing', async () => {
    const res = await request(app)
      .post('/api/extract/resume')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 with scanned-PDF message if text is under 100 chars', async () => {
    const res = await request(app)
      .post('/api/extract/resume')
      .set('Authorization', 'Bearer test-token')
      .send({ text: 'Too short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scanned/i);
  });

  it('returns extracted profile and achievements on valid resume text', async () => {
    (callLLM as any)
      .mockResolvedValueOnce(JSON.stringify(mockStage1))   // Stage 1
      .mockResolvedValueOnce(JSON.stringify(mockStage2));  // Stage 2 (first role)

    const res = await request(app)
      .post('/api/extract/resume')
      .set('Authorization', 'Bearer test-token')
      .send({ text: VALID_RESUME_TEXT });

    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBe('John Smith');
    expect(res.body.experience).toHaveLength(1);
    expect(Array.isArray(res.body.discoveredAchievements)).toBe(true);
    expect(res.body.discoveredAchievements[0].title).toBe('Legacy migration');
  });

  it('still returns profile if Stage 2 JSON is malformed (partial failure tolerance)', async () => {
    (callLLM as any)
      .mockResolvedValueOnce(JSON.stringify(mockStage1))
      .mockResolvedValueOnce('not valid json {{{{');

    const res = await request(app)
      .post('/api/extract/resume')
      .set('Authorization', 'Bearer test-token')
      .send({ text: VALID_RESUME_TEXT });

    // Route continues on Stage 2 parse error — profile is still returned
    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBe('John Smith');
    expect(res.body.discoveredAchievements).toHaveLength(0);
  });
});
