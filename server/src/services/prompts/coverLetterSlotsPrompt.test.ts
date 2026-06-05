import { describe, it, expect } from 'vitest';
import { COVER_LETTER_SLOTS_PROMPT } from './coverLetterSlotsPrompt';

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

describe('COVER_LETTER_SLOTS_PROMPT', () => {
  it('does not instruct the model to emit [VERIFY] tokens', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).not.toContain('Only use a [VERIFY');
  });

  it('carries the no-placeholder rule', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('NEVER emit a bracketed placeholder');
  });
});
