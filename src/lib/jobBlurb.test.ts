import { describe, it, expect } from 'vitest';
import { jobBlurb } from './jobBlurb';

describe('jobBlurb', () => {
  it('collapses whitespace/newlines to one line', () => {
    expect(jobBlurb('Line one\n\nLine two   tabbed')).toBe('Line one Line two tabbed');
  });
  it('truncates to ~120 chars with an ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = jobBlurb(long);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns empty string for empty/nullish input', () => {
    expect(jobBlurb('')).toBe('');
    expect(jobBlurb(undefined as any)).toBe('');
  });
  it('does not add an ellipsis when under the limit', () => {
    expect(jobBlurb('Short and sweet')).toBe('Short and sweet');
  });
});
