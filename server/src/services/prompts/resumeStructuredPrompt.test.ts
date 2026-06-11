import { describe, it, expect } from 'vitest';
import { RESUME_STRUCTURED_PROMPT } from './resumeStructuredPrompt';

// blueprint / achievements are no longer used by the prompt body, but the
// signature is unchanged so the route call sites keep working.
const blueprint = {} as any;
const profile = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  experience: [],
  education: [],
  resumeRawText: 'Jane Doe — Operations Lead. 6 years experience leading teams.',
} as any;

describe('RESUME_STRUCTURED_PROMPT', () => {
  it('includes the candidate raw resume and the job description', () => {
    const out = RESUME_STRUCTURED_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('Jane Doe — Operations Lead');
    expect(out).toContain('Some JD text');
  });

  it('enforces source-of-truth and honest numbers', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('Never invent a company');
    expect(out).toContain('Lead a bullet with a figure ONLY when');
  });

  it('carries the no-placeholder rule', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('bracketed placeholder');
  });

  it('asks for a first-person summary with no third person', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('first person');
    expect(out).toContain('no he/she/they');
  });

  it('lists each work entry with its id for the model to return', () => {
    const profileWithExp = {
      ...profile,
      experience: [{ id: 'exp-1', role: 'Trainee', company: 'Lanka Hospitals', startDate: '2021-11', endDate: '2023-02' }],
    };
    const out = RESUME_STRUCTURED_PROMPT('JD', profileWithExp, [], blueprint);
    expect(out).toContain('id: exp-1');
    expect(out).toContain('Trainee at Lanka Hospitals');
  });

  it('requests per-role curation flags in the output schema', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('"casual"');
    expect(out).toContain('"australianLocal"');
    expect(out).toContain('"bullets"');
  });

  it('tells the model never to drop a real professional role for being off-field', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('NEVER mark a real professional role casual');
  });

  it('does not inject a fixed years figure', () => {
    const out = RESUME_STRUCTURED_PROMPT('JD', profile, [], blueprint, undefined, null, undefined, undefined, 2);
    expect(out).not.toContain('USE EXACTLY THIS NUMBER');
  });
});
