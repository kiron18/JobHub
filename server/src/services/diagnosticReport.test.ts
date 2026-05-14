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
  it('includes the JobHub platform capability brief', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('JobHub platform capabilities');
    expect(p).toContain('TARGETING:');
    expect(p).toContain('RESUME:');
    expect(p).toContain('APPLICATIONS:');
  });

  it('emits MOVE_TARGETING / MOVE_RESUME / MOVE_APPLICATIONS subsections in spec', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('### MOVE_TARGETING');
    expect(p).toContain('### MOVE_RESUME');
    expect(p).toContain('### MOVE_APPLICATIONS');
  });

  it('every MOVE_* block contains all four labelled keys', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    const moveBlocks = p.split('### MOVE_').slice(1);
    expect(moveBlocks).toHaveLength(3);
    moveBlocks.forEach((block) => {
      expect(block).toMatch(/HEADLINE:/);
      expect(block).toMatch(/SITUATION:/);
      expect(block).toMatch(/JOBHUB:/);
      expect(block).toMatch(/OUTCOME:/);
    });
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
});
