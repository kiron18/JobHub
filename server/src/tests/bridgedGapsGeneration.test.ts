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
  PREMIUM_MODEL: 'mock-premium-model',
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
import { callLLM, callClaude } from '../services/llm';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { generateBlueprint } from '../services/strategy';

// Cover-letter generation is now a single Claude pass; callClaude returns
// { content, usage }. Helper builds that shape from a JSON content string.
const claudeReply = (content: string) => ({
  content,
  usage: { promptTokens: 500, completionTokens: 300 },
});

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

const SAMPLE_RESUME_TEXT = `
Jane Smith
jane.smith@example.com | +61 412 345 678

EXPERIENCE
Software Engineer at TechCo (Jan 2020 - Present)
- Building full-stack applications with TypeScript, React, and Node.js
- Led the redesign of the customer-facing platform, improving engagement by 40%

EDUCATION
Bachelor of Computer Science · 2018
University of Technology
`;

const MOCK_PROFILE = {
  id: 'profile-1',
  userId: 'test-user-id',
  name: 'Jane Smith',
  fullName: 'Jane Smith',
  resumeRawText: SAMPLE_RESUME_TEXT,
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

// The mock response from the LLM (V2 returns markdown, not JSON)
const MOCK_COVER_LETTER_MARKDOWN = `Dear Hiring Manager,

I am excited to apply for the Senior Software Engineer role at Acme Corp. With over five years of full-stack development experience, I bring a proven track record of delivering high-quality software products.

At TechCo, I led the development of a customer-facing platform that improved user engagement by 40 percent. My leadership directly contributed to a 25 percent reduction in bug reports.

Beyond my technical expertise, I have demonstrated my ability to bridge engineering and design, collaborating closely with product and marketing teams.

I would welcome the opportunity to discuss how my experience aligns with the needs of Acme Corp. Thank you for your consideration.

Yours sincerely,
Jane Smith
`;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /generate/cover-letter-structured — no invented capabilities', () => {
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

    // Generation: callClaude returns the mock cover letter markdown (V2 single pass)
    (callClaude as any).mockResolvedValue(claudeReply(MOCK_COVER_LETTER_MARKDOWN));

    // Legacy paths (not used by the structured route any more) kept harmlessly mocked
    (callLLMWithRetry as any).mockResolvedValue(MOCK_COVER_LETTER_MARKDOWN);
    (callLLM as any).mockResolvedValue(MOCK_COVER_LETTER_MARKDOWN);
  });

  it('never injects an invented-capability block, even when a client still sends bridgedGaps', async () => {
    let capturedPrompt: string | undefined;

    (callClaude as any).mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve(claudeReply(MOCK_COVER_LETTER_MARKDOWN));
    });

    // VALID_BODY still carries a legacy bridgedGaps array; the route must ignore it.
    const res = await request(app)
      .post('/generate/cover-letter-structured')
      .set('Authorization', 'Bearer test-token')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');

    // The bridged-gaps feature is gone: the gap CONTENT (the invented capability)
    // must never reach the prompt, regardless of what a legacy client sends.
    expect(capturedPrompt).toBeDefined();
    expect(capturedPrompt!).not.toContain('Adobe');
    expect(capturedPrompt!).not.toContain('CONFIRMED CAPABILITIES (the candidate possesses');
  });

  it('generates a cover letter from the candidate profile and JD', async () => {
    (callClaude as any).mockResolvedValue(claudeReply(MOCK_COVER_LETTER_MARKDOWN));

    const res = await request(app)
      .post('/generate/cover-letter-structured')
      .set('Authorization', 'Bearer test-token')
      .send({ ...VALID_BODY, bridgedGaps: [] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
  });
});
