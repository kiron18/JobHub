import { describe, it, expect } from 'vitest';
import {
  ENTRY_LEVEL_QUALIFIERS,
  buildEntryLevelSearchTerm,
  stripEntryLevelQualifiers,
  buildSeekSearchUrl,
  buildSeekClusterKey,
  parseRelativeDate,
} from './seekHtmlScraper';

describe('qualifier helpers', () => {
  it('builds the entry-level search term', () => {
    expect(buildEntryLevelSearchTerm(['Laboratory Technician'])).toBe(
      'entry level graduate junior starter Laboratory Technician',
    );
  });
  it('strips the qualifier prefix back off', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(stripEntryLevelQualifiers(term)).toBe('Laboratory Technician');
  });
  it('leaves a clean role untouched', () => {
    expect(stripEntryLevelQualifiers('Laboratory Technician')).toBe('Laboratory Technician');
  });
});

describe('buildSeekSearchUrl', () => {
  it('produces a clean au.seek.com slug from a qualifier-prefixed role', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(buildSeekSearchUrl(term, 'sydney')).toBe(
      'https://au.seek.com/laboratory-technician-jobs/in-Sydney?daterange=7',
    );
  });
  it('honours a custom date range', () => {
    expect(buildSeekSearchUrl('Nurse', 'Melbourne', 14)).toBe(
      'https://au.seek.com/nurse-jobs/in-Melbourne?daterange=14',
    );
  });
});

describe('buildSeekClusterKey', () => {
  it('trims, lowercases the city, and is deterministic', () => {
    const a = buildSeekClusterKey('  Engineer  ', 'Melbourne, VIC', 'Tech');
    const b = buildSeekClusterKey('Engineer', 'Melbourne', 'Tech');
    expect(a.city).toBe('melbourne');
    expect(a.hash).toBe(b.hash);
  });
  it('differs by role', () => {
    expect(buildSeekClusterKey('A', 'Sydney', null).hash).not.toBe(
      buildSeekClusterKey('B', 'Sydney', null).hash,
    );
  });
});

describe('parseRelativeDate', () => {
  const NOW = new Date('2026-06-14T00:00:00.000Z');
  it('parses "6d ago" to 6 days before now', () => {
    const d = parseRelativeDate('6d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('parses "Posted 3d ago"', () => {
    const d = parseRelativeDate('Posted 3d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-11');
  });
  it('parses "Today" as now', () => {
    expect(parseRelativeDate('Today', NOW)!.toISOString()).toBe(NOW.toISOString());
  });
  it('parses "30+ days ago"', () => {
    const d = parseRelativeDate('30+ days ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-15');
  });
  it('returns null for "Featured" and empty input', () => {
    expect(parseRelativeDate('Featured', NOW)).toBeNull();
    expect(parseRelativeDate(null, NOW)).toBeNull();
  });
});
