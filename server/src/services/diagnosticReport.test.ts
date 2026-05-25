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

describe('diagnostic prompt: Headline Insight section', () => {
  it('emits the ## Headline Insight section', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('## Headline Insight');
  });

  it('mandates exactly one sentence for the headline', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/ONE sentence/);
  });

  it('caps the headline at 32 words', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/Maximum 32 words/);
  });

  it('forbids recap-style openers and compliments in the headline', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/Never open with a compliment/i);
    expect(p).toMatch(/Reveal, do not summarise/i);
  });

  it('requires headline and Honest Assessment to agree', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/SAME primary blocker/i);
  });

  it('explicitly bans each rescue / reframe phrase', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain("that's not a weakness");
    expect(p).toContain("that's actually");
    expect(p).toContain("it's a specialism");
    expect(p).toContain('the good news is');
    expect(p).toContain('but actually');
  });

  it('includes the diagnosed bad-output anti-example', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/cast wide while your evidence points narrow/);
    expect(p).toMatch(/most important one to study/);
  });
});

describe('diagnostic prompt: global DIAGNOSIS VOICE block', () => {
  it('declares the DIAGNOSIS VOICE rules section', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('DIAGNOSIS VOICE');
  });

  it("includes the 'couldn't have written it themselves' test", () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/couldn't have written it themselves/i);
  });

  it('bans mid-sentence reframes globally', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/No mid-sentence reframes/i);
  });

  it('bans abstract costs globally', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/No abstract costs/i);
  });

  it('frames warmth as being right, not soft', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/warmth is in being on their side and being right/i);
  });

  it('exempts the 3-Step Fix and What JobHub sections', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/EXCEPT "The 3-Step Fix" and "What JobHub Will Do For You"/);
  });
});

describe('diagnostic prompt: Honest Assessment voice', () => {
  it('points Honest Assessment at the DIAGNOSIS VOICE rules', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/## The Honest Assessment[\s\S]*Apply all DIAGNOSIS VOICE rules/);
  });

  it('demands a quoted phrase from the candidate file', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/Quote at least one specific phrase, bullet, or choice from their actual file/);
  });

  it('forbids ending the diagnosis on a softener', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/do not end on a softener/i);
  });

  it('marks the tone shift to calm-ally for the fix half', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/Voice shifts here: calm-ally/);
  });
});
