import { describe, it, expect } from 'vitest';
import { RESUME_STRUCTURED_PROMPT } from './resumeStructuredPrompt';

const blueprint = {
  positioningStatement: 'Seasoned operator.',
  messagingAngles: [] as string[],
  pitfallFlags: [] as string[],
  proofPoints: [] as Array<{ achievementId: string }>,
  sector: 'TECH_STARTUP',
  toneBlueprint: 'Professional, direct Australian English.',
  structureNotes: 'Standard.',
  employerInsight: 'MISSING',
} as any;

const profile = { name: 'Jane Doe', email: 'jane@example.com', experience: [], education: [] } as any;

describe('RESUME_STRUCTURED_PROMPT', () => {
  it('does not instruct the model to emit [VERIFY] tokens', () => {
    const out = RESUME_STRUCTURED_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).not.toContain('Only use a [VERIFY');
  });

  it('carries the no-placeholder rule', () => {
    const out = RESUME_STRUCTURED_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('NEVER emit a bracketed placeholder');
  });
});
