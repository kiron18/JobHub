import { describe, it, expect } from 'vitest';
import { sydneyToday, todayBlock } from './promptDate';

// 24 Aug 2026 22:00 UTC is already 25 Aug in Sydney — the exact rollover that
// makes "today" wrong if a prompt is given a UTC date instead of a local one.
const ROLLOVER = new Date('2026-08-24T22:00:00.000Z');

describe('sydneyToday', () => {
  it('reports the Sydney date, not the UTC date', () => {
    expect(sydneyToday(ROLLOVER).iso).toBe('2026-08-25');
  });

  it('renders a human-readable form alongside the ISO one', () => {
    expect(sydneyToday(new Date('2026-08-25T03:00:00.000Z')).long).toBe('25 August 2026');
  });
});

describe('todayBlock', () => {
  it('states the date in both forms so the model cannot misread it', () => {
    const block = todayBlock(ROLLOVER);
    expect(block).toContain('25 August 2026');
    expect(block).toContain('2026-08-25');
  });

  it('tells the model its own sense of the year is overridden', () => {
    expect(todayBlock(ROLLOVER)).toMatch(/overrides your own sense of what year it is/);
  });

  it('resolves a role still marked Present against the real date', () => {
    expect(todayBlock(ROLLOVER)).toContain('still marked "Present"');
  });

  it('stays a single short paragraph, so it cannot become a lecture about dates', () => {
    const block = todayBlock(ROLLOVER);
    expect(block.split(String.fromCharCode(10)).filter(Boolean)).toHaveLength(1);
    expect(block.length).toBeLessThan(400);
  });

  it('avoids the hedging words the scan prompt bans', () => {
    const block = todayBlock(ROLLOVER);
    for (const banned of ['likely', 'may be', 'might', 'possibly', 'probably']) {
      expect(block.toLowerCase()).not.toContain(banned);
    }
  });

  it('is evaluated per call, never frozen at module load', () => {
    expect(todayBlock(new Date('2027-01-05T03:00:00.000Z'))).toContain('2027-01-05');
  });
});
