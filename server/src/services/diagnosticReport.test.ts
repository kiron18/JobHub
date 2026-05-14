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

  it('lists the four labelled keys per move', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('HEADLINE:');
    expect(p).toContain('SITUATION:');
    expect(p).toContain('JOBHUB:');
    expect(p).toContain('OUTCOME:');
  });

  it('forbids em dashes and avoid-list words in the voice rules', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/no em dashes/i);
    expect(p).toMatch(/avoid.*(brutal|killing|crushing)/i);
  });

  it('does not contain the old "first 7 days are free" sentence', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).not.toContain('first 7 days are free');
  });
});
