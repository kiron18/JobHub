import { describe, it, expect } from 'vitest';
import { buildDiagnosticPromptForTest } from './diagnosticReport';

const baseInput = {
  targetRole: 'Marketing Analyst',
  targetCity: 'Sydney',
  seniority: 'mid',
  industry: 'finance',
  responsePattern: 'mostly_silence',
  resumeText: 'Sample resume',
};

describe('diagnostic prompt: Section 5 MOVE_* emission', () => {
  it('emits MOVE_TARGETING / MOVE_RESUME / MOVE_APPLICATIONS subsections', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('### MOVE_TARGETING');
    expect(p).toContain('### MOVE_RESUME');
    expect(p).toContain('### MOVE_APPLICATIONS');
  });

  it('every MOVE_* block contains an ACTION label', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    const moveBlocks = p.split('### MOVE_').slice(1);
    expect(moveBlocks).toHaveLength(3);
    moveBlocks.forEach((block) => {
      expect(block).toMatch(/ACTION:/);
    });
  });

  it('explicitly forbids markdown bold around labels', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/Do NOT wrap labels in markdown bold/i);
  });

  it('voice rules forbid em dashes', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/no em dashes/i);
  });

  it('voice rules list each avoid-list word', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('brutal');
    expect(p).toContain('killing');
    expect(p).toContain('crushing');
  });

  it('does not contain the old "first 7 days are free" sentence', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).not.toContain('first 7 days are free');
  });

  it('does not contain the old HEADLINE/SITUATION/JOBHUB/OUTCOME labels', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).not.toContain('HEADLINE:');
    expect(p).not.toContain('SITUATION:');
    expect(p).not.toContain('JOBHUB:');
    expect(p).not.toContain('OUTCOME:');
  });
});
