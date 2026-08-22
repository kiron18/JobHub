import { describe, it, expect } from 'vitest';
import {
  checkSubtractive, checkVariant, stripFillers, numbersIn,
  CLEAN_PROMPT, buildVariantPrompt, VARIANT_SPEC,
} from './clean';

const RAW = `Um so basically last year I was um working at the store and, like, during the
stocktake I noticed that one of the product lines was out by about forty units you know. And the
problem was that nobody had, nobody had picked it up because the report was really long. So I went
back through like three months of delivery dockets and I found that the supplier was shipping
cartons of ten when our system expected twelve. And I showed my manager the dockets and yeah in the
end we recovered around two thousand dollars in credit.`;

const HONEST_CLEAN = `Last year I was working at the store, and during the stocktake I noticed that
one of the product lines was out by about forty units. The problem was that nobody had picked it up
because the report was long. So I went back through three months of delivery dockets and found that
the supplier was shipping cartons of ten when our system expected twelve. I showed my manager the
dockets, and in the end we recovered around two thousand dollars in credit.`;

describe('checkSubtractive', () => {
  it('passes a clean that only removed', () => {
    const check = checkSubtractive(RAW, HONEST_CLEAN);
    expect(check.ok).toBe(true);
    expect(check.invented).toEqual([]);
  });

  it('catches an invented job title', () => {
    const embellished = HONEST_CLEAN.replace('working at the store', 'working as inventory supervisor');
    const check = checkSubtractive(RAW, embellished);
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('invented_words');
    expect(check.invented).toContain('supervisor');
  });

  it('catches a claim being promoted', () => {
    const check = checkSubtractive('I helped out with the stocktake that week', 'I led the stocktake that week');
    expect(check.ok).toBe(false);
    expect(check.invented).toContain('led');
  });

  it('catches a number that was never spoken', () => {
    const check = checkSubtractive(RAW, `${HONEST_CLEAN} This saved the business $20,000 annually.`);
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('invented_numbers');
    expect(check.inventedNumbers).toContain('$20000');
  });

  it('catches a number quietly changed rather than added', () => {
    const check = checkSubtractive('it was out by about 40 units', 'it was out by about 400 units');
    expect(check.inventedNumbers).toContain('400');
    expect(check.ok).toBe(false);
  });

  it('reports the number problem ahead of the word problem, because it is worse', () => {
    const check = checkSubtractive('I checked 40 units', 'I audited 400 units');
    expect(check.problem).toBe('invented_numbers');
  });

  it('allows connectives that speech drops and writing needs', () => {
    const check = checkSubtractive('went back through dockets, found supplier shipping ten', 'I went back through the dockets and found that the supplier was shipping ten');
    expect(check.ok).toBe(true);
  });

  it('allows a word to change its inflection', () => {
    expect(checkSubtractive('I check the dockets and recorded it', 'I checked the docket and I was recording it').ok).toBe(true);
  });

  it('catches text that grew instead of tightening', () => {
    const check = checkSubtractive('I checked the dockets and found the error', 'I checked the dockets and I found the error and I checked the dockets and I found the error again');
    expect(check.ok).toBe(false);
  });

  it('catches a clean that summarised the story away', () => {
    const check = checkSubtractive(RAW, 'I found a stocktake problem.');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('gutted');
  });

  it('rejects an empty clean rather than silently banking nothing', () => {
    expect(checkSubtractive(RAW, '').problem).toBe('empty');
    expect(checkSubtractive(RAW, '   ').ok).toBe(false);
  });

  it('does not care about capitalisation or punctuation', () => {
    expect(checkSubtractive('i went back through the dockets and found it', 'I went back through the dockets, and found it.').ok).toBe(true);
  });
});

describe('numbersIn', () => {
  it('normalises thousands separators so 2,000 and 2000 are the same number', () => {
    expect(numbersIn('we recovered $2,000 in credit')).toContain('$2000');
  });

  it('keeps percentages distinct', () => {
    expect(numbersIn('it fell by 10%')).toEqual(['10%']);
  });

  it('finds nothing in text with no numbers', () => {
    expect(numbersIn('I checked the dockets')).toEqual([]);
  });
});

describe('stripFillers', () => {
  it('removes verbal tics without a model', () => {
    const out = stripFillers('Um so basically I like went back, you know, through the dockets');
    expect(out).not.toMatch(/\bum\b|\bbasically\b|\byou know\b/i);
    expect(out).toContain('went back');
  });

  it('collapses a repeated false start', () => {
    expect(stripFillers('nobody had, nobody had picked it up')).toBe('nobody had picked it up');
  });

  it('leaves an already clean sentence alone', () => {
    const clean = 'I went back through three months of delivery dockets.';
    expect(stripFillers(clean)).toBe(clean);
  });

  it('is itself subtractive, so its output always passes the check', () => {
    expect(checkSubtractive(RAW, stripFillers(RAW)).ok).toBe(true);
  });

  it('survives an empty transcript', () => {
    expect(stripFillers('')).toBe('');
  });
});

describe('checkVariant', () => {
  const approved = HONEST_CLEAN;

  it('allows a variant to be much shorter than its source', () => {
    const headline = 'I noticed one product line was out by forty units and we recovered two thousand dollars.';
    expect(checkVariant(approved, headline).ok).toBe(true);
  });

  it('still refuses a variant that invents a number', () => {
    const check = checkVariant(approved, 'I noticed one product line was out and we recovered $50,000 in credit.');
    expect(check.ok).toBe(false);
    expect(check.inventedNumbers).toContain('$50000');
  });

  it('still refuses a variant that invents a word', () => {
    expect(checkVariant(approved, 'As inventory supervisor I noticed the product line was out.').ok).toBe(false);
  });
});

describe('the prompts say the same thing the checks enforce', () => {
  it('the clean prompt forbids adding facts and changing numbers', () => {
    expect(CLEAN_PROMPT).toMatch(/MUST NOT/);
    expect(CLEAN_PROMPT).toMatch(/not already in the transcript/);
    expect(CLEAN_PROMPT).toMatch(/change any number/);
  });

  it('the variant prompt forbids strengthening a claim', () => {
    const prompt = buildVariantPrompt('some approved text', 'short');
    expect(prompt).toMatch(/Add nothing/);
    expect(prompt).toMatch(/stronger/);
    expect(prompt).toContain('some approved text');
  });

  it('every variant has a word budget and a stated purpose', () => {
    for (const name of ['headline', 'short', 'medium', 'full'] as const) {
      expect(VARIANT_SPEC[name].words).toBeGreaterThan(0);
      expect(VARIANT_SPEC[name].purpose.length).toBeGreaterThan(10);
    }
  });

  it('the budgets go up in the order the names imply', () => {
    expect(VARIANT_SPEC.headline.words).toBeLessThan(VARIANT_SPEC.short.words);
    expect(VARIANT_SPEC.short.words).toBeLessThan(VARIANT_SPEC.medium.words);
    expect(VARIANT_SPEC.medium.words).toBeLessThan(VARIANT_SPEC.full.words);
  });
});
