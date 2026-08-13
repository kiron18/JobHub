/**
 * The figure gate decides whether a rewritten resume line is shown to someone
 * deciding whether to pay us. A rewrite that quotes a metric the person never
 * achieved is worse than showing nothing, so these cases are the contract.
 */
import { describe, it, expect } from 'vitest';
import { figuresIn, rewriteFiguresAreGrounded, pickVerifiedTranslation } from './gapReport';

const RESUME = `
Arjun Menon
- Responsible for maintaining daily sales dashboards for the regional team
- Rebuilt reporting for a team of 12 using Power BI
- Reduced manual handling time by 35% across the Monday cycle
`;

describe('figuresIn', () => {
  it('reads digits, percentages and comma-grouped numbers', () => {
    expect(figuresIn('cut 1,200 records by 35% over 4 weeks')).toEqual(['1200', '35', '4']);
  });

  it('reads numbers written as words, because the model uses both forms', () => {
    expect(figuresIn('a team of twelve over four hours')).toEqual(['12', '4']);
  });

  it('finds nothing in a line that asserts no quantity', () => {
    expect(figuresIn('Rebuilt the regional sales dashboard in Power BI')).toEqual([]);
  });
});

describe('rewriteFiguresAreGrounded', () => {
  it('accepts a rewrite whose figures are all in the resume', () => {
    expect(rewriteFiguresAreGrounded('Rebuilt reporting for a team of 12', RESUME)).toBe(true);
  });

  it('accepts the same figures spelled as words', () => {
    expect(rewriteFiguresAreGrounded('Rebuilt reporting for a team of twelve', RESUME)).toBe(true);
  });

  it('accepts a rewrite that asserts no figures at all', () => {
    expect(rewriteFiguresAreGrounded('Rebuilt the regional sales dashboard in Power BI', RESUME)).toBe(true);
  });

  it('rejects an invented metric, however plausible', () => {
    // The exact failure this gate exists for: nothing in the resume says four
    // hours or twenty minutes, and both read as real achievements.
    expect(
      rewriteFiguresAreGrounded('cutting the Monday cycle from 4 hours to 20 minutes', RESUME),
    ).toBe(false);
  });

  it('rejects a figure that is inflated rather than invented', () => {
    expect(rewriteFiguresAreGrounded('Reduced handling time by 85%', RESUME)).toBe(false);
  });
});

describe('pickVerifiedTranslation', () => {
  const good = {
    wrote: 'Responsible for maintaining daily sales dashboards for the regional team',
    reads: 'Someone handed you a dashboard and you kept it alive',
    instead: 'Rebuilt the regional sales dashboard in Power BI for a team of 12',
  };
  const invented = {
    wrote: 'Responsible for maintaining daily sales dashboards for the regional team',
    reads: 'Someone handed you a dashboard and you kept it alive',
    instead: 'Cut the reporting cycle from 4 hours to 20 minutes',
  };

  it('takes the first translation that passes', () => {
    expect(pickVerifiedTranslation([good], RESUME)).toEqual(good);
  });

  it('skips an ungrounded rewrite and falls through to a clean one', () => {
    expect(pickVerifiedTranslation([invented, good], RESUME)).toEqual(good);
  });

  it('returns null rather than showing an ungrounded rewrite', () => {
    expect(pickVerifiedTranslation([invented], RESUME)).toBeNull();
  });

  it('rejects a "before" line that is not actually in their resume', () => {
    // Guards the other half of the exhibit: quoting a line back at someone who
    // never wrote it is the same betrayal as inventing the metric.
    const notTheirs = { ...good, wrote: 'Led a team of engineers across three continents' };
    expect(pickVerifiedTranslation([notTheirs], RESUME)).toBeNull();
  });

  it('handles a missing or empty translation list', () => {
    expect(pickVerifiedTranslation(undefined, RESUME)).toBeNull();
    expect(pickVerifiedTranslation([], RESUME)).toBeNull();
  });
});
