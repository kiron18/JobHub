import { describe, it, expect } from 'vitest';
import { COVER_LETTER_SLOTS_PROMPT } from './coverLetterSlotsPrompt';

// blueprint / achievements / bridgedGaps are no longer used by the prompt body,
// but the signature is unchanged so the route call site keeps working.
const blueprint = {} as any;
const profile = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  experience: [],
  education: [],
  resumeRawText: 'Jane Doe — Operations Lead. 6 years experience leading teams.',
} as any;

describe('COVER_LETTER_SLOTS_PROMPT', () => {
  it('includes the candidate raw resume and the job description', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('Jane Doe — Operations Lead');
    expect(out).toContain('Some JD text');
  });

  it('enforces source-of-truth and honest numbers', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('NEVER state or imply experience, skills, qualifications, years');
    expect(out).toContain('Use a specific figure only when it is in the resume');
  });

  it('requires a real company connection (competitor test) and bans placeholders', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('COMPETITOR TEST');
    expect(out).toContain('No placeholders of any kind');
  });

  it('weaves in real company research when present, and does not invent it when absent', () => {
    const withIntel = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint, undefined, null, { summary: 'ACME builds submarines in Adelaide.' });
    expect(withIntel).toContain('ACME builds submarines in Adelaide.');
    const without = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint);
    expect(without).toContain('do not fabricate company facts');
  });

  it('sets salutation and signoff from the contact (faithfully for a generic hiring manager)', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('JD', profile, [], blueprint);
    expect(out).toContain('Dear Hiring Manager,');
    expect(out).toContain('Yours faithfully,');
  });
});
