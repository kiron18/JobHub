import { describe, it, expect } from 'vitest';
import { isGroundedInSource, normalizeForMatch } from './fidelityGuard';
import { checkGrounding } from './groundingGate';
import { normalizeEmDashes } from './styleLint';

const grounded = (value: string, source: string) =>
  isGroundedInSource(value, normalizeForMatch(source));

/**
 * These cases are the false positives the model bake-off surfaced. Every one of
 * them used to cost a full-price regeneration to "fix" work that was already
 * correct, so they are worth pinning.
 */
describe('grounding tolerates how real resumes are actually written', () => {
  it('accepts an employer the PDF extractor fused to the next word', () => {
    expect(grounded('CSIR - National Metallurgical Laboratory',
      'CSIR- National Metallurgical LaboratoryJuly 2017 - June 2018')).toBe(true);
  });

  it('accepts an employer whose spelling the resume got wrong', () => {
    expect(grounded('Elgar Homes Supported Residential Services',
      'at Elgar Homes Supported Resdential Services as housekeeper')).toBe(true);
  });

  it('accepts a transposed typo', () => {
    expect(grounded('Glenny Kebabs Glen Waverley',
      'Worked at Glenny Kebabs Glen Waverely store')).toBe(true);
  });

  it('accepts an inflected form of a word in the source', () => {
    expect(grounded('Mont Albert Manor (Aged Care Centre)',
      'Mont Albert Manor (Age Care centre)')).toBe(true);
  });
});

describe('grounding still catches employers the resume never mentions', () => {
  it.each([
    ['Google', 'Worked at Elgar Homes and Coles'],
    ['Commonwealth Bank of Australia', 'Worked at Elgar Homes and Coles'],
    ['Deloitte Consulting', 'Deloitte Australia, Sydney'],
    ['Amazon Web Services', 'Amazon warehouse in Sydney'],
  ])('rejects %s', (value, source) => {
    expect(grounded(value, source)).toBe(false);
  });

  it('does not confuse two organisations with a shared prefix', () => {
    expect(grounded('CSIRO', 'CSIR- National Metallurgical Laboratory')).toBe(false);
    expect(grounded('CSIR', 'CSIRO Data61 Canberra')).toBe(false);
  });
});

describe('numbers', () => {
  it('matches a decimal the source punctuated or spaced differently', () => {
    const r = checkGrounding('Improved accuracy to 87.9% and scored 73.33%.',
      'achieved 87.9%. \nUniversity, India with an aggregate of 73.33 %.', '');
    expect(r.violations).toEqual([]);
  });

  it('still catches invented numbers', () => {
    const r = checkGrounding('Grew revenue by 250% across 4200 accounts.', 'small local role', '');
    expect(r.violations).toHaveLength(2);
  });
});

describe('em dash normalisation', () => {
  it('replaces the dash the job ad title supplies', () => {
    expect(normalizeEmDashes('*Data Analyst — Financial Services*'))
      .toBe('*Data Analyst - Financial Services*');
  });

  it('handles an unspaced dash and leaves ordinary hyphens alone', () => {
    expect(normalizeEmDashes('accuracy matters—requirements')).toBe('accuracy matters - requirements');
    expect(normalizeEmDashes('trade-offs and multi-source data')).toBe('trade-offs and multi-source data');
  });
});
