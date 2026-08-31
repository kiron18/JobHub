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

  // It is one sentence of fact. Everything that ever followed the date was a
  // rule restating something obvious, and one of those rules is what made the
  // model claim a role marked "Present" had ended. Nothing may be added here.
  it('is the date and nothing else', () => {
    const block = todayBlock(ROLLOVER);
    expect(block).toBe("Today's date is 25 August 2026 (2026-08-25), Australia/Sydney time.");
  });

  it('is evaluated per call, never frozen at module load', () => {
    expect(todayBlock(new Date('2027-01-05T03:00:00.000Z'))).toContain('2027-01-05');
  });
});
