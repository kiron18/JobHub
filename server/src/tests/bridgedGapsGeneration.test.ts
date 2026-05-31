import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mock external deps BEFORE importing router ──────────────────────────────

vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      findUnique: vi.fn(),
    },
    jobApplication: {
      findUnique: vi.fn(),
    },
    document: {
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

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

// Bypass access check so we don't need DB for it
vi.mock('../middleware/accessControl', () => ({
  checkAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../services/llm', () => ({
  callLLM: vi.fn(),
  callClaude: vi.fn(),
}));

// Mock callLLMWithRetry (used in Stage 2) — this module calls callLLM internally,
// so we mock callLLM directly and let callLLMWithRetry pass through to it.
vi.mock('../utils/callLLMWithRetry', () => ({
  callLLMWithRetry: vi.fn(),
}));

// Mock strategy module (generateBlueprint calls callClaude internally)
// We mock generateBlueprint directly to keep the test focused on the prompt pass-through.
vi.mock('../services/strategy', () => ({
  generateBlueprint: vi.fn(),
}));

vi.mock('../services/blueprint-cache', () => ({
  getCachedBlueprint: vi.fn().mockReturnValue(null),
  setCachedBlueprint: vi.fn(),
}));

// Mock services/generation — buildAchievementContext is dynamically imported
const mockBuildAchievementContext = vi.hoisted(() => vi.fn());
vi.mock('../services/generation', () => ({
  buildAchievementContext: mockBuildAchievementContext,
  buildPerCriterionAchievements: vi.fn(),
  rankAchievements: vi.fn().mockResolvedValue([]),
}));

// Mock the prompts that depend on companyIntel
vi.mock('../services/companyIntel', () => ({
  salutationTitle: vi.fn().mockReturnValue('Hiring Manager'),
}));

// Mock scrubInjection — just returns the input unchanged
vi.mock('../services/scrubInjection', () => ({
  scrubInjection: vi.fn().mockReturnValue({ scrubbed: 'the job description text', flaggedPatterns: [] }),
}));

import generateRouter from '../routes/generate';
import { prisma } from '../index';
import { callLLM } from '../services/llm';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { generateBlueprint } from '../services/strategy';

const app = express();
app.use(express.json());
app.use('/generate', generateRouter);

// ── Reusable blueprint ──────────────────────────────────────────────────────

const MOCK_BLUEPRINT = {
  openingHook: 'Experienced engineer with a track record of delivery.',
  positioningStatement: 'Position as a senior full-stack engineer.',
  proofPoints: [
    {
      achievementId: 'ach-1',
      framingAngle: 'Demonstrates strong React expertise',
      jdConnection: 'JD requires React — candidate has 4 years React experience',
      narrativeNote: 'Lead role on this project',
    },
  ],
  messagingAngles: ['React expertise', 'Team leadership'],
  toneBlueprint: 'Professional, direct Australian English.',
  structureNotes: 'Standard cover letter format with 4 paragraphs.',
  pitfallFlags: ['Results-driven', 'Team player', 'Detail-oriented'],
  employerInsight: 'Acme Corp is a growing tech company.',
  sector: 'GENERAL' as const,
};

const MOCK_BLUEPRINT_RESULT = {
  blueprint: MOCK_BLUEPRINT,
  cached: false,
  tokens: { input: 500, output: 300, cost_usd: 0.002 },
};

// ── Profile ─────────────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  id: 'profile-1',
  userId: 'test-user-id',
  name: 'Jane Smith',
  fullName: 'Jane Smith',
  professionalSummary: 'Experienced software engineer with 5+ years in full-stack development.',
  targetRole: 'Senior Software Engineer',
  location: 'Sydney, Australia',
  skills: JSON.stringify({
    technical: ['TypeScript', 'React', 'Node.js'],
    industryKnowledge: [],
    softSkills: ['Communication', 'Leadership'],
  }),
  experience: [
    {
      id: 'exp-1',
      company: 'TechCo',
      role: 'Software Engineer',
      startDate: '2020-01-01',
      endDate: null,
      current: true,
      description: 'Building full-stack applications.',
    },
  ],
  education: [],
  achievements: [],
  volunteering: [],
  certifications: [],
  languages: [],
  identityCards: null,
};

// ── Valid request body for cover-letter-structured ───────────────────────────

const VALID_BODY = {
  jobDescription: 'Senior Software Engineer role at Acme Corp. Must have 5+ years experience with TypeScript, React, and Node.js.',
  selectedAchievementIds: ['ach-1'],
  analysisContext: {
    tone: 'Professional',
    matchedIdentityCard: null,
  },
  jobApplicationId: 'temp-id',
  companyResearch: null,
  companyIntel: null,
  bridgedGaps: [
    { skill: 'Adobe Creative Suite', statement: 'Used Adobe Creative Suite to build marketing collateral and brand assets for a product launch reaching 50,000 users.' },
  ],
};

// The mock JSON response from the LLM (Stage 2)
const MOCK_COVER_LETTER_JSON = JSON.stringify({
  salutation: 'Dear Hiring Manager,',
  p1: 'I am excited to apply for the Senior Software Engineer role at Acme Corp. With over five years of full-stack development experience, I bring a proven track record of delivering high-quality software products.',
  p2: 'At TechCo, I led the development of a customer-facing platform that improved user engagement by 40 percent. My leadership directly contributed to a 25 percent reduction in bug reports.',
  p3: 'Beyond my technical expertise, I have used Adobe Creative Suite to build marketing collateral and brand assets for a product launch reaching 50,000 users, demonstrating my ability to bridge engineering and design.',
  p4: 'I would welcome the opportunity to discuss how my experience aligns with the needs of Acme Corp. Thank you for your consideration.',
  signoff: 'Yours faithfully,\nJane Smith',
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /generate/cover-letter-structured — bridgedGaps injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks for happy-path
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(MOCK_PROFILE);
    (prisma.jobApplication.findUnique as any).mockResolvedValue(null);
    (prisma.document.create as any).mockResolvedValue({ id: 'doc-1' });

    // Mock buildAchievementContext to return a simple achievement
    mockBuildAchievementContext.mockResolvedValue([
      {
        id: 'ach-1',
        title: 'Platform Redesign',
        description: 'Led the redesign of the customer-facing platform, improving engagement by 40%.',
        metric: '40% engagement increase',
      },
    ]);

    // Stage 1: generateBlueprint returns a mock blueprint
    (generateBlueprint as any).mockResolvedValue(MOCK_BLUEPRINT_RESULT);

    // Stage 2: callLLMWithRetry returns mock cover letter JSON
    (callLLMWithRetry as any).mockResolvedValue(MOCK_COVER_LETTER_JSON);

    // We also mock callLLM directly in case any fallback code path hits it
    (callLLM as any).mockResolvedValue(MOCK_COVER_LETTER_JSON);
  });

  it('passes bridgedGaps into the prompt as CONFIRMED CAPABILITIES', async () => {
    let capturedPrompt: string | undefined;

    // Override callLLMWithRetry to capture the prompt and then return mock data
    (callLLMWithRetry as any).mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve(MOCK_COVER_LETTER_JSON);
    });

    const res = await request(app)
      .post('/generate/cover-letter-structured')
      .set('Authorization', 'Bearer test-token')
      .send(VALID_BODY);

    // Assert the HTTP response is successful
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');

    // Assert the prompt contains the bridgedGaps data
    expect(capturedPrompt).toBeDefined();
    expect(capturedPrompt!).toContain('CONFIRMED CAPABILITIES');
    expect(capturedPrompt!).toContain('Adobe');
    expect(capturedPrompt!).toContain('CONTRADICTION GUARD');
  });

  it('does not include the CONFIRMED CAPABILITIES header block when bridgedGaps is empty', async () => {
    let capturedPrompt: string | undefined;

    (callLLMWithRetry as any).mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve(MOCK_COVER_LETTER_JSON);
    });

    const bodyWithoutGaps = { ...VALID_BODY, bridgedGaps: [] };

    const res = await request(app)
      .post('/generate/cover-letter-structured')
      .set('Authorization', 'Bearer test-token')
      .send(bodyWithoutGaps);

    expect(res.status).toBe(200);

    expect(capturedPrompt).toBeDefined();
    // The CONFIRMED CAPABILITIES header SECTION is only rendered when
    // bridgedGaps.length > 0. The phrase also appears in the CONTRADICTION GUARD
    // text ("any skill listed above (CONFIRMED CAPABILITIES)") so we check for
    // the actual header line with equals signs that wraps the section.
    expect(capturedPrompt!).not.toContain('CONFIRMED CAPABILITIES (the candidate possesses these');
  });
});
